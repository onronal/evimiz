import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {validateCamera} from './camera.mjs';
import {deviceStatuses} from './device-status.mjs';
import {localAddresses,persistLocalAddress} from './local-address.mjs';
import {collectNeighbors} from './network.mjs';
import {lgService,validateLGConnection,discoverLG} from './lg.mjs';
import {isIP} from 'node:net';
import {bulbOperation} from './bulb.mjs';
import {xiaomiStatus,vacuumCommand} from './xiaomi.mjs';
import {climateStatus,commandClimate} from './local-climate.mjs';
import {vestelSummary} from './vestel.mjs';
// Explicit adapters only: no shell commands, executable strings or arbitrary URLs from configuration.
const directory=new URL('./data/device-connections/',import.meta.url);
const pathFor=d=>{if(!/^(device-[a-f0-9-]{36}|light|climate|washer|dishwasher|vacuum|fryer)$/.test(d.id))throw Error('Geçersiz cihaz kimliği.');return new URL(d.id+'.json',directory);};
const privateIP=value=>isIP(value)===4&&(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(value));
export function validateConnection(d,input){
 if(d.legacy)throw Error('Mevcut cihazın bağlantısı özel kurulumundan yönetilir.');
 if(!input||typeof input!=='object')throw Error('Bağlantı bilgileri gerekli.');
 if(d.adapter==='tapo-rtsp')return validateCamera(input);
 if(d.adapter==='lg-webos')return validateLGConnection(input);
 if(d.adapter==='tuya-local'){
  if(!privateIP(input.ip)||typeof input.deviceId!=='string'||!/^[a-zA-Z0-9]{8,64}$/.test(input.deviceId)||typeof input.localKey!=='string'||Buffer.byteLength(input.localKey)!==16||!['3.3','3.4','3.5'].includes(input.version))throw Error('Tuya için özel ağ IPv4 adresi, cihaz kimliği, 16 bayt local key ve sürüm gerekli.');
  return {ip:input.ip,id:input.deviceId,key:input.localKey,version:input.version};
 }
 if(d.adapter==='xiaomi-local'){
  const models={vacuum:'dreame.vacuum.p2140p',fryer:'careli.fryer.maf02'};if(!privateIP(input.ip)||typeof input.token!=='string'||!/^[a-fA-F0-9]{32}$/.test(input.token)||!/^\d{1,20}$/.test(String(input.did))||input.model!==models[d.type])throw Error('Desteklenen model, özel ağ IPv4, sayısal DID ve 32 haneli token gerekli.');
  return {localip:input.ip,token:input.token,did:String(input.did),model:input.model,name:d.name};
 }
 if(d.adapter==='samsung-local'){if(!privateIP(input.ip))throw Error('Özel ağ IPv4 adresi gerekli.');return {ip:input.ip};}
 if(d.adapter==='vestel-cloud'){if(typeof input.deviceId!=='string'||!input.deviceId||input.deviceId.length>160)throw Error('Vestel cihaz kimliği gerekli.');return {deviceId:input.deviceId};}
 throw Error('Bağlantı adaptörü bulunamadı.');
}
export async function saveConnection(device,input){const config=validateConnection(device,input);await mkdir(directory,{recursive:true,mode:0o700});const file=pathFor(device),temp=new URL(device.id+'.tmp',directory);await writeFile(temp,JSON.stringify(config),{mode:0o600});await rename(temp,file);await localAddresses.forget(device.id);deviceStatuses.invalidate(device.id);return {ok:true,message:'Bağlantı bilgileri kaydedildi. Canlı durumu cihazlar sayfasından kontrol edin.'};}
export async function readConnection(d){return JSON.parse(await readFile(pathFor(d),'utf8'));}
export async function hasConnection(d,legacyFlags){if(d.legacy)return !!legacyFlags[d.type];try{await readConnection(d);return true;}catch{return false;}}
export const adapters=new Map([
 ['tapo-rtsp',{status:async()=>({kind:'camera',state:'İsteğe bağlı görüntü · bağlantı henüz doğrulanmadı',connected:false,readOnly:true})}],
 ['lg-webos',{apps:(d,c)=>lgService.apps(d,c),status:(d,c)=>localAddresses.read({id:d.id,config:c,read:next=>lgService.status(d,next),discover:async()=>{await discoverLG({duration:2000});return collectNeighbors();},persist:next=>persistLocalAddress(d,c,next)}),command:(d,c,input)=>lgService.command(d,c,input)}],
 ['tuya-local',{
  status:async(d,c)=>{const result=await bulbOperation(undefined,c,d.id);return {connected:true,at:new Date().toISOString(),kind:d.type,dps:result.dps};},
  command:async(d,c,input)=>{const data={};if(typeof input.power==='boolean')data['20']=input.power;if(input.brightness!==undefined){if(!Number.isInteger(input.brightness)||input.brightness<1||input.brightness>100)throw Error('Parlaklık 1–100 olmalı.');data['21']='white';data['22']=input.brightness*10;}if(input.temperature!==undefined){if(!Number.isInteger(input.temperature)||input.temperature<0||input.temperature>100)throw Error('Renk 0–100 olmalı.');data['21']='white';data['23']=input.temperature*10;}if(!Object.keys(data).length||Object.keys(input).some(k=>!['power','brightness','temperature'].includes(k)))throw Error('Geçersiz ampul komutu.');return {accepted:true,...await bulbOperation(data,c,d.id)};}
 }],
 ['xiaomi-local',{status:(d,c)=>xiaomiStatus(d.type,c,d.id),command:(d,c,input)=>{if(d.type!=='vacuum')throw Error('Airfryer salt okunur.');if(!['start','pause','dock','rooms'].includes(input.command))throw Error('Bu robotta yalnız temel temizlik komutları destekleniyor.');return vacuumCommand(input.command,input.rooms,c,d.id,input.mapId);}}],
 ['samsung-local',{status:(d,c)=>climateStatus(c,d.id),command:(d,c,input)=>commandClimate(input,c,d.id)}],
 ['vestel-cloud',{status:async(d,c)=>{const snapshot=await vestelSummary();const found=snapshot.devices.find(x=>x.id===c.deviceId&&x.kind===d.type);if(!found)throw Error('Bu hesapta eşleşen cihaz bulunamadı.');return {...found,at:snapshot.at,connected:true};}}]
]);
async function rawDeviceStatus(device){if(device.legacy){if(device.type==='light')return {connected:true,dps:(await bulbOperation()).dps};if(device.type==='climate')return climateStatus();if(['vacuum','fryer'].includes(device.type))return xiaomiStatus(device.type);const s=await vestelSummary();return {...s.devices.find(d=>d.kind===device.type),at:s.at,connected:s.connected};}const adapter=adapters.get(device.adapter);if(!adapter)throw Error('Adaptör bulunamadı.');return adapter.status(device,await readConnection(device));}
async function rawDeviceCommand(device,input){if(device.legacy)throw Error('Mevcut cihaz kartını kullanın.');const adapter=adapters.get(device.adapter);if(!adapter?.command)throw Error('Bu adaptör salt okunur.');return adapter.command(device,await readConnection(device),input);}

export async function deviceApps(d){if(d.adapter!=='lg-webos'||!d.enabled)throw Error('Bu cihaz uygulama listesi sunmuyor.');return lgService.apps(d,await readConnection(d));}

export function deviceStatus(device){if(!device.enabled)return Promise.reject(Error('Cihaz devre dışı.'));return deviceStatuses.read(device.id,()=>rawDeviceStatus(device),{maxAge:['washer','dishwasher'].includes(device.type)?10000:30000});}
lgService.onStatus((id,patch)=>deviceStatuses.patch(id,patch));
export async function deviceCommand(device,input){if(input.pointer||input.remoteKey)return rawDeviceCommand(device,input);deviceStatuses.invalidate(device.id);try{const result=await rawDeviceCommand(device,input);if(device.type==='tv'&&input.power===true)for(const delay of [3000,8000]){const timer=setTimeout(()=>{deviceStatuses.invalidate(device.id);deviceStatus(device).catch(()=>{});},delay);timer.unref();}return result;}finally{deviceStatuses.invalidate(device.id);}}
