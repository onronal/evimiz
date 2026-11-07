
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Veri servisi şu an yanıt vermiyor');return response.json();}
async function rawSearchLocations(query){
 const full=query.trim();if(full.length<2)return [];
 let data=await get('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:full,count:10,language:'tr',format:'json'}));
 if(!data.results?.length){const parts=full.split(/[\s/,]+/).filter(x=>x.length>2);const results=await Promise.all(parts.slice(0,3).map(name=>get('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name,count:10,language:'tr',format:'json'}))));data.results=results.flatMap(d=>d.results||[]);}
 return [...new Map((data.results||[]).map(p=>[p.id,{id:p.id,name:p.name,label:[p.name,p.admin2,p.admin1,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' / '),latitude:p.latitude,longitude:p.longitude,timezone:p.timezone||'UTC'}])).values()];
}
export async function fetchWeather(place){
 const data=await get('https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:place.latitude,longitude:place.longitude,current:'temperature_2m,apparent_temperature,weather_code,wind_gusts_10m',timezone:place.timezone}));
 if(!Number.isFinite(data.current?.temperature_2m))throw Error('Hava verisi geçersiz.');const t=data.current.time;const at=typeof t==='string'?(/[Zz]|[+-]\d{2}:\d{2}$/.test(t)?Date.parse(t):Date.parse(t+'Z')-(data.utc_offset_seconds||0)*1000):NaN;
 return {weather:data.current,weatherAt:Number.isFinite(at)?new Date(at).toISOString():null};
}
export async function fetchSun(place,day){const data=await get('https://api.sunrise-sunset.org/json?'+new URLSearchParams({lat:place.latitude,lng:place.longitude,date:day,formatted:'0'}));if(data.status!=='OK'||!data.results)throw Error('Güneş verisi geçersiz.');const result={dawn:data.results.civil_twilight_begin,sunrise:data.results.sunrise,sunset:data.results.sunset,dusk:data.results.civil_twilight_end};if(Object.values(result).some(v=>!Number.isFinite(Date.parse(v))))throw Error('Güneş zamanları geçersiz.');return result;}

const locations=new Map(),locationPending=new Map();
export async function searchLocations(query){const key=String(query).trim().slice(0,160);if(key.length<2)return [];const old=locations.get(key);if(old&&Date.now()-old.at<3600000)return old.value;if(locationPending.has(key))return locationPending.get(key);const job=rawSearchLocations(key).then(value=>{if(locations.size>=100)locations.delete(locations.keys().next().value);locations.set(key,{at:Date.now(),value});return value;}).finally(()=>locationPending.delete(key));locationPending.set(key,job);return job;}
