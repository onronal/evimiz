import {deviceStatuses} from './device-status.mjs';
import {readFile} from 'node:fs/promises';
import {localAddresses,persistLocalAddress} from './local-address.mjs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
let queue=Promise.resolve();const caches=new Map(),pending=new Map();
function run(command={},config,instance='climate'){
 const result=queue.then(()=>new Promise((resolve,reject)=>{
  const child=spawn(root+'data/samsung-venv/bin/python',[root+'samsung-local.py'],{cwd:root,stdio:['pipe','pipe','pipe']});
  let output='';let settled=false;
  const timer=setTimeout(()=>{child.kill();finish(Error('Yerel klima yanıt vermedi.'));},30000);
  function finish(error,value){if(settled)return;settled=true;clearTimeout(timer);if(error){caches.delete(instance);reject(error);}else{caches.set(instance,{at:Date.now(),value});resolve(value);}}
  child.on('error',()=>finish(Error('Yerel klima çalışma ortamı başlatılamadı.')));
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>32768){child.kill();finish(Error('Geçersiz klima yanıtı.'));}});child.stderr.on('data',()=>{});
  child.on('close',code=>{try{const data=JSON.parse(output);if(code!==0||data.error)return finish(Error(data.error||'Klima bağlantısı kurulamadı.'));finish(null,data);}catch{finish(Error('Klima verisi çözümlenemedi.'));}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({...command,...(config?{_connection:config}:{})}));
 }));queue=result.catch(()=>{});return result;
}
export function climateStatus(config,instance='climate'){const cache=caches.get(instance);if(cache&&Date.now()-cache.at<20000)return Promise.resolve(cache.value);if(pending.has(instance))return pending.get(instance);const read=(async()=>{const c=config||JSON.parse(await readFile(root+'data/samsung-local/connection.json','utf8')),d={id:instance,type:'climate',legacy:!config};return localAddresses.read({id:instance,config:c,read:next=>run({},next,instance),persist:next=>persistLocalAddress(d,c,next)});})().finally(()=>pending.delete(instance));pending.set(instance,read);return read;}
export async function commandClimate(input,config,instance='climate'){
 const allowed=['power','mode','setpoint'];if(!input||!Object.keys(input).length||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Geçersiz klima komutu');
 deviceStatuses.invalidate(instance);let data;try{data=await run(input,config,instance);}finally{deviceStatuses.invalidate(instance);}return {accepted:true,confirmed:data.confirmed,message:data.confirmed?'Ayar yerel Wi-Fi üzerinden uygulandı ve klimadan doğrulandı.':'Komut gönderildi; istenen ayar henüz doğrulanmadı.',status:data};
}
