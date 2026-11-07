// Read-only HomeVSmart connector. No appliance command endpoints are implemented.
import {createVestelClientStore} from './vestel-client.mjs';
import {createRemainingStore} from './remaining-tracker.mjs';
import {createHmac} from 'node:crypto';
import {readFile,writeFile,rename,rm,readdir} from 'node:fs/promises';
import {decodeVestel} from './vestel-state.mjs';
const file=new URL('./data/vestel-session.json',import.meta.url),snapshot=new URL('./data/vestel-snapshot.json',import.meta.url);
async function seedRemaining(){try{const dir=new URL('./data/',import.meta.url),files=(await readdir(dir)).filter(f=>/^vestel-observations-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().slice(-2),rows=[];for(const f of files){const lines=(await readFile(new URL(f,dir),'utf8')).trim().split('\n').slice(-600);for(const line of lines)try{const r=JSON.parse(line);if(r.at&&Array.isArray(r.devices))rows.push(r);}catch{}}return rows;}catch{return [];}}
const timers=await createRemainingStore({seed:seedRemaining});
const clientStore=await createVestelClientStore();
export function vestelClientStatus(){return clientStore.status();}
export async function configureVestelClient(input){
 if(readPending)throw Error('Cihaz okuması sürüyor. Biraz sonra tekrar deneyin.');
 // Never reuse a refresh token with a different service identity.
 const previous=clientStore.credentials(),next=await clientStore.save(input);
 const current=clientStore.credentials();
 if(previous.clientId!==current.clientId||previous.clientSecret!==current.clientSecret){session=null;idToken=null;expires=0;await Promise.all([rm(file,{force:true}),rm(snapshot,{force:true})]);}
 return {...next,connected:!!session};
}
let session=null,idToken=null,expires=0;
try{session=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
async function cognito(payload,target='InitiateAuth'){
 const r=await fetch('https://cognito-idp.eu-west-1.amazonaws.com/',{method:'POST',headers:{'Content-Type':'application/x-amz-json-1.1','X-Amz-Target':'AWSCognitoIdentityProviderService.'+target},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok||!data.AuthenticationResult)throw Error('Vestel girişi tamamlanamadı. Bilgileri ve uygulamadaki giriş yöntemini kontrol edin.');return data.AuthenticationResult;
}
function useTokens(result){idToken=result.IdToken;expires=Date.now()+((result.ExpiresIn||3600)-120)*1000;}
async function persist(){const temp=new URL('./data/vestel-session.tmp',import.meta.url);await writeFile(temp,JSON.stringify(session),{mode:0o600});await rename(temp,file);}
export async function loginVestel(email,password){
 const {clientId,clientSecret}=clientStore.credentials();
 if(!clientId||!clientSecret)throw Error('Vestel servis istemcisi yapılandırılmamış. Bu ekranda önce servis bilgilerini kaydedin.');
 const result=await cognito({AuthFlow:'USER_PASSWORD_AUTH',ClientId:clientId,AuthParameters:{USERNAME:email,PASSWORD:password,SECRET_HASH:createHmac('sha256',clientSecret).update(email+clientId).digest('base64')}});
 if(!result.RefreshToken)throw Error('Kalıcı oturum alınamadı.');
 session={refreshToken:result.RefreshToken};useTokens(result);await persist();
 return readVestel();
}
async function token(){const {clientId,clientSecret}=clientStore.credentials();if(!session)throw Error('Önce bu bilgisayardan Vestel hesabına giriş yapın.');if(!idToken||Date.now()>expires)useTokens(await cognito({ClientId:clientId,ClientSecret:clientSecret,RefreshToken:session.refreshToken,ClientMetadata:{}},'GetTokensFromRefreshToken'));return idToken;}
async function get(path){const r=await fetch('https://sh-native-api.homevsmart.com/v1.0'+path,{headers:{Token:await token(),Accept:'application/json','Accept-Language':'tr-TR','User-Agent':'AkilliYasam Production/4.2401.39 (com.vestel.SmartHome; build:2; iOS 26.5.0) Alamofire/5.12.0'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Vestel cihaz verisi alınamadı. Oturumu yeniden bağlamak gerekebilir.');return r.json();}
let readPending=null;
export function readVestel(){if(readPending)return readPending;readPending=readSnapshot().finally(()=>{readPending=null});return readPending;}
async function readSnapshot(){
 const homesBody=await get('/homes');let homes=homesBody.items||homesBody.data||homesBody;if(!Array.isArray(homes))homes=homes.homes||[];
 const devices=[];
 for(const home of homes){const homeId=home.homeId||home.id||home.uuid;if(!homeId)continue;const body=await get('/homes/'+encodeURIComponent(homeId)+'/devices');for(const device of body.items?.homeappliances||[]){const uuid=device.deviceId;if(!uuid)continue;
  const entry={name:device.customName||device.deviceName||device.name||device.deviceType||'Vestel cihazı',type:device.deviceType||'',id:uuid,model:device.model||'',status:null,discovery:null,error:null};
  try{entry.discovery=(await get('/device/discovery?uuid='+encodeURIComponent(uuid))).data||{};entry.status=(await get('/homeappliances/legacy/status?uuid='+encodeURIComponent(uuid))).data||{};}catch{entry.error='Bu cihazın durum verisi okunamadı.';}devices.push(entry);
 }}
 const result={at:new Date().toISOString(),devices};await writeFile(snapshot,JSON.stringify(result,null,2),{mode:0o600});const decoded=devices.map(decodeVestel);await timers.observe(decoded,result.at);return {at:result.at,devices:decoded.map(d=>timers.decorate(d))};
}
export async function vestelSummary(){try{const s=JSON.parse(await readFile(snapshot,'utf8'));return {connected:!!session,at:s.at,devices:s.devices.map(decodeVestel).map(d=>timers.decorate(d))};}catch{return {connected:!!session,devices:[]};}}
