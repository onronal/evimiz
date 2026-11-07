import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {networkInterfaces} from 'node:os';
import {collectNeighbors} from './network.mjs';
import {privateIPv4} from './lg.mjs';
const run=promisify(execFile),validMac=x=>/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(x||'')&&!/^(00:00:00:00:00:00|ff:ff:ff:ff:ff:ff)$/i.test(x);
// Populate the local neighbor table; never scan ports or other routed networks.
export function localProbeTargets(ip,interfaces=networkInterfaces()){
 if(!privateIPv4(ip))return [];
 const octets=ip.split('.').map(Number);
 const local=Object.values(interfaces).flat().some(a=>a&&!a.internal&&a.family==='IPv4'&&a.address.split('.').slice(0,3).join('.')===octets.slice(0,3).join('.')&&a.netmask==='255.255.255.0');
 return local?Array.from({length:254},(_,i)=>octets.slice(0,3).join('.')+'.'+(i+1)):[];
}
let probes=null,probedAt=0;
export async function refreshLocalNeighbors(ip){if(probes)return probes;if(Date.now()-probedAt<120000)return;const targets=localProbeTargets(ip);if(!targets.length)return;probedAt=Date.now();probes=(async()=>{let next=0;await Promise.all(Array.from({length:16},async()=>{while(next<targets.length){const target=targets[next++];try{await run('ping',process.platform==='darwin'?['-n','-c','1','-W','400',target]:['-n','-c','1','-W','1',target],{timeout:1200,maxBuffer:1000});}catch{}}}));})().finally(()=>probes=null);return probes;}
export function createLocalAddressService({file=new URL('./data/address-identities.json',import.meta.url),neighbors=collectNeighbors,refresh=refreshLocalNeighbors,now=Date.now,cooldown=120000}={}){
 let pins={},loaded=false,loading,writes=Promise.resolve(),neighborAt=-Infinity,neighborRows=[],neighborWork;const attempts=new Map(),pending=new Map();
 async function load(){if(loaded)return;if(!loading)loading=(async()=>{try{pins=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}loaded=true;})().finally(()=>loading=null);await loading;}
 async function rows(force=false){if(!force&&now()-neighborAt<5000)return neighborRows;if(!neighborWork)neighborWork=neighbors().then(value=>{neighborRows=value;neighborAt=now();return value;}).catch(()=>[]).finally(()=>neighborWork=null);return neighborWork;}
 async function learn(id,mac){if(!validMac(mac)||pins[id])return;pins[id]=mac.toLowerCase();const op=writes.catch(()=>{}).then(async()=>{await mkdir(new URL('.',file),{recursive:true,mode:0o700});const tmp=new URL(file.href+'.tmp');await writeFile(tmp,JSON.stringify(pins),{mode:0o600});await rename(tmp,file);});writes=op;await op;}
 async function perform({id,config,read,discover,persist,vendorIdentity=false}){
  await load();const known=validMac(config.mac)?config.mac.toLowerCase():pins[id];let list=await rows();
  const currentMac=list.find(r=>r.ip===config.ip)?.mac?.toLowerCase();
  try{if(known&&currentMac&&known!==currentMac)throw Error('Kayıtlı adres başka bir cihaza ait.');const value=await read(config);list=await rows(true);const mac=list.find(r=>r.ip===config.ip)?.mac?.toLowerCase();if(known&&mac&&known!==mac)throw Error('Cihaz kimliği değişmiş.');await learn(id,mac);return value;}catch(original){
   if(!known&&!vendorIdentity)throw original;if(now()-(attempts.get(id)??-Infinity)<cooldown)throw original;attempts.set(id,now());
   let candidates;
   if(discover){candidates=await discover(config);list=await rows(true);}
   else {if(!known)throw original;await refresh(config.ip);list=await rows(true);candidates=list.filter(r=>r.mac.toLowerCase()===known).map(r=>({ip:r.ip}));}
   candidates=candidates.filter(c=>privateIPv4(c.ip)&&c.ip!==config.ip&&(!known||list.some(r=>r.ip===c.ip&&r.mac.toLowerCase()===known)));
   candidates=[...new Map(candidates.map(c=>[c.ip,c])).values()];if(candidates.length!==1)throw original;
   // MAC-based discovery must have a learned identity. Vendor discovery supplies its own device ID validation.
   if(!known&&!discover)throw original;
   const candidate={...config,ip:candidates[0].ip};const value=await read(candidate);await persist(candidate);
   await learn(id,list.find(r=>r.ip===candidate.ip)?.mac);return value;
  }
 }
 return {async forget(id){await load();delete pins[id];const op=writes.catch(()=>{}).then(async()=>{await mkdir(new URL('.',file),{recursive:true,mode:0o700});const tmp=new URL(file.href+'.tmp');await writeFile(tmp,JSON.stringify(pins),{mode:0o600});await rename(tmp,file);});writes=op;await op;},read(options){if(pending.has(options.id))return pending.get(options.id);const job=perform(options).finally(()=>pending.delete(options.id));pending.set(options.id,job);return job;}};
}
let writes=Promise.resolve();
export function persistLocalAddress(device,old,candidate){const task=writes.catch(()=>{}).then(async()=>{let file;if(device.legacy){const paths={light:'bulb.json',climate:'samsung-local/connection.json'};if(!paths[device.type])throw Error('Geçersiz eski bağlantı.');file=new URL('./data/'+paths[device.type],import.meta.url);}else{if(!/^device-[a-f0-9-]{36}$/.test(device.id))throw Error('Geçersiz cihaz kimliği.');file=new URL('./data/device-connections/'+device.id+'.json',import.meta.url);}const current=JSON.parse(await readFile(file,'utf8'));if(JSON.stringify(current)!==JSON.stringify(old))throw Error('Bağlantı değişmiş; tekrar okuyun.');current.ip=candidate.ip;const tmp=new URL(file.href+'.address.tmp');await writeFile(tmp,JSON.stringify(current,null,2),{mode:0o600});await rename(tmp,file);});writes=task;return task;}
export const localAddresses=createLocalAddressService();
