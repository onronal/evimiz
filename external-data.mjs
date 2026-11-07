import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {fetchWeather,fetchSun} from './environment.mjs';
import {fetchWeatherAlertRows,selectWeatherAlerts,weatherAdvice,provinceFor} from './weather-info.mjs';
const dayOf=(place,at)=>new Intl.DateTimeFormat('en-CA',{timeZone:place.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const locationKey=p=>JSON.stringify([p.latitude,p.longitude,p.timezone,p.label]);
export async function createExternalData({file=new URL('./data/environment.json',import.meta.url),weather=fetchWeather,sun=fetchSun,warnings=fetchWeatherAlertRows,now=Date.now,onUpdate=()=>{}}={}){
 let sources={},active=null,epoch=0,writes=Promise.resolve();const pending=new Map();
 try{sources=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 function configure(settings){const next=settings.externalWeatherConsent&&settings.place?locationKey(settings.place):null;if(next!==active){active=next;epoch++;}return active;}
 function save(){const job=writes.catch(()=>{}).then(async()=>{await mkdir(new URL('.',file),{recursive:true,mode:0o700});const tmp=new URL(file.href+'.tmp');await writeFile(tmp,JSON.stringify(sources),{mode:0o600});await rename(tmp,file);});writes=job;return job;}
 async function update(name,key,loader,interval,generation){const running=pending.get(name);if(running){if(running.key===key&&running.generation===generation)return running.job;await running.job.catch(()=>{});if(generation!==epoch)return;return update(name,key,loader,interval,generation);}const previous=sources[name];if(previous?.key===key&&previous.nextAt>now())return;
  const job=(async()=>{try{const value=await loader();if(generation!==epoch)return;sources[name]={key,value,checkedAt:new Date(now()).toISOString(),attemptedAt:new Date(now()).toISOString(),nextAt:now()+interval,failures:0,error:null};}catch{if(generation!==epoch)return;const old=previous?.key===key?previous:null,failures=(old?.failures||0)+1;sources[name]={...old,key,attemptedAt:new Date(now()).toISOString(),nextAt:now()+Math.min(900000,60000*2**Math.min(4,failures-1)),failures,error:name==='warnings'?'MGM uyarıları kontrol edilemedi; uyarı olmadığı anlamına gelmez.':name==='weather'?'Hava durumu güncellenemedi; son ölçüm eski olabilir.':'Güneş saatleri güncellenemedi.'};}
   await save();onUpdate();
  })().finally(()=>{if(pending.get(name)?.job===job)pending.delete(name);});pending.set(name,{key,generation,job});return job;
 }
 return {
  configure,
  async poll(settings){const key=configure(settings);if(!key)return;const place=structuredClone(settings.place),generation=epoch,day=dayOf(place,now());await Promise.allSettled([update('weather',key,()=>weather(place),600000,generation),update('sun',key+':'+day,()=>sun(place,day),86400000,generation),...(provinceFor(place)?[update('warnings',key,()=>warnings(),900000,generation)]:[])]);},
  read(settings){const place=settings.place;if(!settings.externalWeatherConsent)return {needsConsent:true};if(!place)return {needsLocation:true};const key=locationKey(place),day=dayOf(place,now()),get=(name,k)=>sources[name]?.key===k?sources[name]:null,w=get('weather',key),s=get('sun',key+':'+day),m=get('warnings',key);const errors=[];if(!w?.value)errors.push('Hava verisi sunucuda hazırlanıyor.');if(w?.error)errors.push(w.error);if(!s?.value)errors.push('Güneş saatleri sunucuda hazırlanıyor.');if(s?.error)errors.push(s.error);
   const data={place,updatedAt:w?.checkedAt||null,weather:w?.value?.weather||null,weatherAt:w?.value?.weatherAt||null,sun:s?.value||null,errors,stale:!w?.value||!s?.value||!!w?.error||!!s?.error||now()-Date.parse(w?.checkedAt)>630000,sources:{weather:{checkedAt:w?.checkedAt||null,attemptedAt:w?.attemptedAt||null,error:w?.error||null},sun:{checkedAt:s?.checkedAt||null,error:s?.error||null}},official:{...(m?.value?selectWeatherAlerts(m.value,place,now()):{province:provinceFor(place)?.[0]||null,alerts:[]}),checkedAt:m?.checkedAt||null,stale:!!m?.error||!m?.value||now()-Date.parse(m?.checkedAt)>930000,error:m?.error||(!m?.value&&provinceFor(place)?'MGM kontrolü sunucuda hazırlanıyor.':null)}};return {...data,advice:weatherAdvice(data,now())};
  }
 };
}
