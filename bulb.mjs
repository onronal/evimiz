import {deviceStatuses} from './device-status.mjs';
import {localAddresses,persistLocalAddress} from './local-address.mjs';
import {privateIPv4} from './lg.mjs';
import TuyAPI from 'tuyapi';
import {readFile,chmod} from 'node:fs/promises';
const configPath=new URL('./data/bulb.json',import.meta.url);
let queue=Promise.resolve();
function rawBulbOperation(data,override){
 const operation=queue.then(async()=>{
  const config=override||JSON.parse(await readFile(configPath,'utf8'));if(!override)await chmod(configPath,0o600);
  const device=new TuyAPI({...config,issueGetOnConnect:false,issueRefreshOnConnect:false});
  device.on('error',()=>{});
  let timeout;
  try{return await Promise.race([(async()=>{await device.connect();if(data)await device.set({multiple:true,data});return await device.get({schema:true});})(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Ampule ulaşılamadı. Elektriğini ve ağ bağlantısını kontrol edin.')),12000);})]);}
  finally{clearTimeout(timeout);device.disconnect();}
 });queue=operation.catch(()=>{});return operation;
}
export async function discoverBulb(config){const device=new TuyAPI({...config,ip:undefined,issueGetOnConnect:false,issueRefreshOnConnect:false});device.on('error',()=>{});try{await device.find({timeout:5});if(device.device.id!==config.id||!privateIPv4(device.device.ip))throw Error('Ampul kimliği doğrulanamadı.');return [{ip:device.device.ip}];}finally{device.disconnect();}}
export async function bulbOperation(data,override,instance='light'){
 if(data){deviceStatuses.invalidate(instance);try{return await rawBulbOperation(data,override);}finally{deviceStatuses.invalidate(instance);}}
 const config=override||JSON.parse(await readFile(configPath,'utf8')),d={id:instance,type:'light',legacy:!override};
 return localAddresses.read({id:instance,config,read:c=>rawBulbOperation(undefined,c),discover:discoverBulb,vendorIdentity:true,persist:c=>persistLocalAddress(d,config,c)});
}
if(process.argv[2]==='status'){
 try{console.log(JSON.stringify(await bulbOperation()));}catch{console.error('Ampul durum sorgusu başarısız.');process.exitCode=1;}
}
