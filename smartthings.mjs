import {readFile,writeFile,rename} from 'node:fs/promises';
const file=new URL('./data/smartthings.json',import.meta.url);
let config=null;
try{config=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
async function save(){const tmp=new URL('./data/smartthings.tmp',import.meta.url);await writeFile(tmp,JSON.stringify(config),{mode:0o600});await rename(tmp,file);}
async function request(path,body,token=config?.token){
 if(!token)throw Error('SmartThings bağlantısı henüz kurulmadı.');
 const r=await fetch('https://api.smartthings.com/v1'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(r.status===401)throw Error('SmartThings anahtarı geçersiz veya süresi dolmuş. Yerel kurulum ekranından yenileyin.');
 if(r.status===403)throw Error('SmartThings erişim izni yetersiz. Cihaz okuma/kontrol izinlerini kontrol edin.');
 if(!r.ok)throw Error('SmartThings şu anda yanıt vermiyor.');return r.json();
}
export async function connectSmartThings(token){
 if(typeof token!=='string'||token.length<20||token.length>2048||/\s/.test(token))throw Error('Geçerli erişim anahtarını girin.');
 const list=await request('/devices',null,token);
 const devices=(list.items||[]).filter(d=>d.components?.some(c=>c.capabilities?.some(x=>x.id==='airConditionerMode'))).map(d=>({id:d.deviceId,name:d.label||d.name}));
 if(!devices.length)throw Error('Bu hesapta erişilebilir klima bulunamadı. Cihaz okuma iznini kontrol edin.');
 config={token,addedAt:new Date().toISOString(),devices,deviceId:null};await save();return {devices};
}
export async function selectClimate(id){if(!config?.devices.some(d=>d.id===id))throw Error('Listeden bir klima seçin.');config.deviceId=id;await save();return climateStatus();}
export function decodeClimate(status,device){
 const main=status.components?.main||{};const attr=(cap,name)=>main[cap]?.[name];
 return {connected:true,name:device?.name||'Samsung klima',power:attr('switch','switch')?.value??null,mode:attr('airConditionerMode','airConditionerMode')?.value??null,modes:attr('airConditionerMode','supportedAcModes')?.value||[],temperature:attr('temperatureMeasurement','temperature')?.value??null,unit:attr('temperatureMeasurement','temperature')?.unit||'C',temperatureAt:attr('temperatureMeasurement','temperature')?.timestamp||null,setpoint:attr('thermostatCoolingSetpoint','coolingSetpoint')?.value??null,range:attr('thermostatCoolingSetpoint','coolingSetpointRange')?.value||null,at:new Date().toISOString(),temporaryToken:true};
}
export async function climateStatus(){if(!config?.deviceId)return {connected:false,needsSetup:true};const status=await request('/devices/'+encodeURIComponent(config.deviceId)+'/status');return decodeClimate(status,config.devices.find(d=>d.id===config.deviceId));}
export async function commandClimate(input){
 const current=await climateStatus();if(!current.connected)throw Error('Önce klimayı bağlayın.');
 const commands=[];
 if(input.power!==undefined){if(typeof input.power!=='boolean')throw Error('Geçersiz güç ayarı');commands.push({component:'main',capability:'switch',command:input.power?'on':'off'});}
 if(input.mode!==undefined){if(!current.modes.includes(input.mode))throw Error('Klima bu modu desteklemiyor.');commands.push({component:'main',capability:'airConditionerMode',command:'setAirConditionerMode',arguments:[input.mode]});}
 if(input.setpoint!==undefined){const min=current.range?.minimum,max=current.range?.maximum;if(!Number.isFinite(min)||!Number.isFinite(max))throw Error('Cihaz sıcaklık sınırlarını bildirmedi; bu ayar kapalı.');if(!Number.isFinite(input.setpoint)||input.setpoint<min||input.setpoint>max)throw Error('Sıcaklık cihaz sınırlarının dışında.');commands.push({component:'main',capability:'thermostatCoolingSetpoint',command:'setCoolingSetpoint',arguments:[input.setpoint]});}
 if(!commands.length)throw Error('Bir klima ayarı seçin.');
 await request('/devices/'+encodeURIComponent(config.deviceId)+'/commands',{commands});
 return {accepted:true,message:'Komut SmartThings tarafından alındı. Güncel durum birkaç saniye sonra okunacak.'};
}
