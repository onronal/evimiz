import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
export function validateVestelClient(input){
 if(typeof input?.clientId!=='string'||typeof input?.clientSecret!=='string')throw Error('Client ID ve Client Secret gerekli.');
 const clientId=input.clientId.trim(),clientSecret=input.clientSecret.trim();
 if(typeof clientId!=='string'||!/^[a-zA-Z0-9]{1,128}$/.test(clientId)||typeof clientSecret!=='string'||!/^[a-zA-Z0-9+/=_-]{1,256}$/.test(clientSecret)||clientId.startsWith('YOUR_')||clientSecret.startsWith('YOUR_'))throw Error('Yetkili servis Client ID ve Client Secret bilgilerini kontrol edin.');
 return {clientId,clientSecret};
}
export async function createVestelClientStore({directory=new URL('./data/',import.meta.url),env=process.env}={}){
 const file=new URL('vestel-client.json',directory);let saved={};
 try{saved=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const credentials=()=>({clientId:env.VESTEL_CLIENT_ID||saved.clientId,clientSecret:env.VESTEL_CLIENT_SECRET||saved.clientSecret});
 const status=()=>({configured:!!(credentials().clientId&&credentials().clientSecret),managedByEnvironment:!!(env.VESTEL_CLIENT_ID||env.VESTEL_CLIENT_SECRET)});
 return {credentials,status,async save(input){if(status().managedByEnvironment)throw Error('Servis bilgileri ortam değişkenleriyle yönetiliyor. Değişikliği sunucu ortamında yapın.');const next=validateVestelClient(input);await mkdir(directory,{recursive:true,mode:0o700});const tmp=new URL('vestel-client.tmp',directory);await writeFile(tmp,JSON.stringify(next),{mode:0o600});await rename(tmp,file);saved=next;return status();}};
}
