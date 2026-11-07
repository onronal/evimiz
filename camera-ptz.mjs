import {createHash,randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {validateCamera} from './camera.mjs';

const deviceNs='http://www.onvif.org/ver10/device/wsdl';
const mediaNs='http://www.onvif.org/ver10/media/wsdl';
const ptzNs='http://www.onvif.org/ver20/ptz/wsdl';
const directions=new Map([['left',[-0.75,0]],['right',[0.75,0]],['up',[0,0.75]],['down',[0,-0.75]]]);
const xmlEscape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=name=>`(?:[\\w.-]+:)?${name}`;
function content(xml,name){
 return xml.match(new RegExp(`<${tag(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag(name)}>`))?.[1];
}

export function createCameraPtz({request=fetch,wait=delay}={}){
 const moving=new Set();
 return async function move(id,config,direction){
  const axes=directions.get(direction);
  if(!axes)throw Error('Geçerli bir kamera yönü seçin.');
  const camera=validateCamera(config);
  if(moving.has(id))throw Error('Kamera yön komutu devam ediyor.');
  moving.add(id);
  const origin=`http://${camera.ip}:2020`;
  async function soap(url,ns,action,body=''){
   const nonce=randomBytes(20),created=new Date().toISOString();
   const digest=createHash('sha1').update(nonce).update(created).update(camera.password).digest('base64');
   const envelope=`<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:o="${ns}" xmlns:t="http://www.onvif.org/ver10/schema"
    xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
    xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <s:Header><wsse:Security><wsse:UsernameToken><wsse:Username>${xmlEscape(camera.username)}</wsse:Username>
    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</wsse:Nonce>
    <wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>
    <s:Body><o:${action}>${body}</o:${action}></s:Body></s:Envelope>`;
   const response=await request(url,{method:'POST',headers:{'Content-Type':`application/soap+xml; charset=utf-8; action="${ns}/${action}"`},body:envelope,redirect:'error',signal:AbortSignal.timeout(2200)});
   const xml=await response.text();
   if(!response.ok||!new RegExp(`<${tag(action+'Response')}(?:\\s|/?>)`).test(xml))throw Error('ONVIF komutu reddedildi.');
   return xml;
  }
  function service(capabilities,name){
   const address=new URL(content(content(capabilities,name)||'','XAddr')?.trim());
   if(address.origin!==origin||address.username||address.password||address.search||address.hash)throw Error('Geçersiz kamera hizmet adresi.');
   return address.href;
  }
  let stage='ONVIF hizmeti';
  try{
   const caps=await soap(origin+'/onvif/device_service',deviceNs,'GetCapabilities','<o:Category>All</o:Category>');
   const media=service(caps,'Media'),ptz=service(caps,'PTZ');
   stage='ONVIF yön profili';
   const profiles=await soap(media,mediaNs,'GetProfiles');
   const profile=[...profiles.matchAll(new RegExp(`<${tag('Profiles')}\\s+([^>]+)>([\\s\\S]*?)</${tag('Profiles')}>`,'g'))]
    .find(([, ,body])=>new RegExp(`<${tag('PTZConfiguration')}(?:\\s|>)`).test(body));
   const token=profile?.[1].match(/\btoken\s*=\s*["']([\w.:-]{1,128})["']/)?.[1];
   if(!token)throw Error('Kamerada yön kontrol profili bulunamadı.');
   const profileToken=`<o:ProfileToken>${token}</o:ProfileToken>`;
   const [x,y]=axes;
   const speedSpace=content(profile[2],'DefaultContinuousPanTiltVelocitySpace')?.trim();
   const space=speedSpace?` space="${xmlEscape(speedSpace)}"`:'';
   stage='Hareket komutu';
   try{
    await soap(ptz,ptzNs,'ContinuousMove',profileToken+`<o:Velocity><t:PanTilt x="${x}" y="${y}"${space}/></o:Velocity><o:Timeout>PT1S</o:Timeout>`);
    await wait(500);
   }finally{
    try{await soap(ptz,ptzNs,'Stop',profileToken+'<o:PanTilt>true</o:PanTilt><o:Zoom>false</o:Zoom>');}
    catch{stage='Durma komutu';throw Error('ONVIF durma komutu doğrulanmadı.');}
   }
   return {ok:true};
  }catch{
   throw Error(stage+' doğrulanamadı. Kamera bağlantısını ve ONVIF ayarını kontrol edin.');
  }finally{
   moving.delete(id);
  }
 };
}
