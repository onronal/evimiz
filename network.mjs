import {execFile} from 'node:child_process';
import {Resolver} from 'node:dns/promises';
import {promisify} from 'node:util';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {privateIPv4} from './lg.mjs';
const run=promisify(execFile);
export function parseNeighbors(text,platform=process.platform){let rows=[];if(platform==='linux'){const data=JSON.parse(text);if(!Array.isArray(data))throw Error('Geçersiz komşu listesi.');rows=data.map(x=>({ip:x.dst,mac:x.lladdr}));}else rows=text.split('\n').flatMap(line=>{const m=line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+((?:[0-9a-f]{1,2}:){5}[0-9a-f]{1,2})\b/i);return m?[{ip:m[1],mac:m[2].split(':').map(x=>x.padStart(2,'0')).join(':')}]:[];});return [...new Map(rows.filter(x=>privateIPv4(x.ip)&&/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(x.mac||'')&&!/^(ff:|00:00:00:00:00:00)/i.test(x.mac)).map(x=>[x.ip,{ip:x.ip,mac:x.mac.toLowerCase()}])).values()].slice(0,128);}
export async function collectNeighbors(){if(process.platform==='darwin')return parseNeighbors((await run('/usr/sbin/arp',['-an'],{timeout:3000,maxBuffer:256000})).stdout,'darwin');if(process.platform==='linux')return parseNeighbors((await run('ip',['-j','neigh'],{timeout:3000,maxBuffer:256000})).stdout,'linux');throw Error('Bu sistemde ağ komşusu okuması desteklenmiyor.');}
async function ping(ip){try{await run('ping',process.platform==='darwin'?['-n','-c','1','-W','800',ip]:['-n','-c','1','-W','1',ip],{timeout:1800,maxBuffer:10000});return 'responded';}catch{return 'no_reply';}}
const resolver=new Resolver({timeout:400,tries:1});
async function resolveNeighborName(ip){
 if(!privateIPv4(ip))return null;
 try{
  const [name]=await resolver.reverse(ip);
  const hostname=name?.replace(/\.$/,'');
  return hostname?.length<=253&&/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(hostname)?hostname:null;
 }catch{return null;}
}
export function createNetworkService({file=new URL('./data/network.json',import.meta.url),neighbors=collectNeighbors,probe=ping,resolveName=resolveNeighborName}={}){let busy=null,last={at:null,devices:[],error:null};return {async status(){if(!last.at)try{last=JSON.parse(await readFile(file,'utf8'));}catch{}return {...last,running:!!busy,usage:{available:false,message:'Cihaz başına veri kullanımı için modem/yönlendirici trafik sayaçlarına erişim gerekir. Bu bağlantı henüz yok.'}};},scan(){if(busy)return busy;busy=(async()=>{try{const devices=(await neighbors()).map(x=>({...x,reachability:'unknown'}));let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<Math.min(devices.length,64)){const i=next++;const device=devices[i];
 const [reachability,hostname]=await Promise.all([probe(device.ip),resolveName(device.ip)]);
 device.reachability=reachability;
 if(hostname)device.hostname=hostname;}}));last={at:new Date().toISOString(),devices,error:null};const tmp=new URL(file.href+'.tmp');await writeFile(tmp,JSON.stringify(last),{mode:0o600});await rename(tmp,file);return last;}catch{last={...last,error:'Ağ kaydı okunamadı. macOS için arp, Raspberry Pi/Linux için iproute2 ve ping araçlarını kontrol edin.'};return last;}})().finally(()=>busy=null);return busy;}};}
export async function networkDeviceNames(devices){const names=new Map();let xiaomi;for(const d of devices){try{let c;if(!d.legacy)c=JSON.parse(await readFile(new URL('./data/device-connections/'+d.id+'.json',import.meta.url),'utf8'));else if(d.type==='light')c=JSON.parse(await readFile(new URL('./data/bulb.json',import.meta.url),'utf8'));else if(d.type==='climate')c=JSON.parse(await readFile(new URL('./data/samsung-local/connection.json',import.meta.url),'utf8'));else if(['vacuum','fryer'].includes(d.type)){xiaomi||=JSON.parse(await readFile(new URL('./data/xiaomi/mi-tokens.json',import.meta.url),'utf8'));c=xiaomi.find(x=>x.model===(d.type==='vacuum'?'dreame.vacuum.p2140p':'careli.fryer.maf02'));}const ip=c?.ip||c?.localip;if(privateIPv4(ip))names.set(ip,d.name);}catch{}}return names;}
