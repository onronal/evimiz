import {uptime} from 'node:os';
import {readFile,writeFile,rename} from 'node:fs/promises';

export async function schedulePowerRecovery({file,recover,onError}){
 if(process.platform!=='linux')return null;
 const bootId=(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();
 let previous;
 try{previous=(await readFile(file,'utf8')).trim();}
 catch(error){if(error.code!=='ENOENT')throw error;}
 async function recordBoot(){
  const temp=new URL(file.href+'.tmp');
  await writeFile(temp,bootId+'\n',{mode:0o600});
  await rename(temp,file);
 }
 // Establish the first baseline without operating physical devices.
 if(previous===undefined){await recordBoot();return null;}
 if(previous===bootId)return null;
 return setTimeout(async()=>{
  try{await recover();await recordBoot();}
  catch(error){onError(error);}
 },Math.max(0,300-uptime())*1000).unref();
}
