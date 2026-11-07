import {readFile,writeFile,rename} from 'node:fs/promises';
import {internetIntervals,validateInternetInterval} from './layout.mjs';
import {randomBytes} from 'node:crypto';
const file=new URL('./data/internet.json',import.meta.url);
let state={enabled:false,intervalMinutes:15,history:[],nextAt:null},running=null,timer;
try{state={...state,...JSON.parse(await readFile(file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}
if(!internetIntervals.includes(state.intervalMinutes))state.intervalMinutes=15;
async function save(){const temp=new URL('./data/internet.tmp',import.meta.url);await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,file);}
async function request(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000),cache:'no-store'});if(!r.ok)throw Error('Test servisi yanıt vermedi');return r;}
export function internetState(){return {...state,running:!!running,provider:'Cloudflare',downloadBytes:5000000,uploadBytes:1000000};}
export function runInternetTest(){
 if(running)return running;
 running=(async()=>{
  const result={at:new Date().toISOString(),reachable:false,latencyMs:null,downloadMbps:null,uploadMbps:null,error:null};
  try{
   const probes=[];for(let i=0;i<3;i++){const start=performance.now();await(await request('https://speed.cloudflare.com/__down?bytes=0&nonce='+Date.now())).arrayBuffer();probes.push(performance.now()-start);}
   result.latencyMs=Math.round(probes.sort((a,b)=>a-b)[1]);result.reachable=true;
   let start=performance.now();const down=await(await request('https://speed.cloudflare.com/__down?bytes=5000000&nonce='+Date.now())).arrayBuffer();const elapsed=performance.now()-start;
   if(down.byteLength!==5000000)throw Error('İndirme örneği tamamlanamadı');result.downloadMbps=Math.round(down.byteLength*8/elapsed/1000*10)/10;
   start=performance.now();await(await request('https://speed.cloudflare.com/__up',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:randomBytes(1000000)})).arrayBuffer();result.uploadMbps=Math.round(1000000*8/(performance.now()-start)/1000*10)/10;
  }catch{result.error=result.reachable?'Hız ölçümü tamamlanamadı.':'Cloudflare test servisine ulaşılamadı; internet veya servis kaynaklı olabilir.';}
  state.history=[result,...state.history].slice(0,96);state.nextAt=state.enabled?new Date(Date.now()+state.intervalMinutes*60000).toISOString():null;await save();return result;
 })().finally(()=>{running=null;schedule();});return running;
}
function schedule(){clearTimeout(timer);if(state.enabled){const delay=Math.max(0,Date.parse(state.nextAt||new Date().toISOString())-Date.now());timer=setTimeout(()=>runInternetTest().catch(()=>{}),delay);timer.unref();}}
export async function enableInternet(enabled,intervalMinutes=state.intervalMinutes){state.intervalMinutes=validateInternetInterval(intervalMinutes);state.enabled=enabled;state.nextAt=enabled?new Date(Date.now()+state.intervalMinutes*60000).toISOString():null;await save();schedule();return internetState();}
schedule();
