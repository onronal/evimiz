import dgram from 'node:dgram';
import {createHash,createCipheriv,createDecipheriv,timingSafeEqual,randomInt} from 'node:crypto';
const md5=b=>createHash('md5').update(b).digest();
async function rawRequest(device,method,params=[]){
 const token=Buffer.from(device.token,'hex');if(token.length!==16)throw Error('Xiaomi cihaz anahtarı geçersiz');
 const key=md5(token),iv=md5(Buffer.concat([key,token]));
 const socket=dgram.createSocket('udp4');let finish,timer;
 let settled=false;const response=new Promise((resolve,reject)=>{finish=(error,data)=>{if(settled)return;settled=true;clearTimeout(timer);socket.close();error?reject(error):resolve(data);};});
 let sent=false;const id=randomInt(1,10000);
 socket.on('error',()=>finish(Error('Xiaomi yerel bağlantısı kurulamadı.')));
 socket.on('message',(data,remote)=>{
  if(remote.address!==device.localip||data.length<32||data.readUInt16BE(0)!==0x2131||data.readUInt16BE(2)!==data.length)return;
  if(!sent){if(data.length!==32||String(data.readUInt32BE(8))!==String(device.did))return;sent=true;const cipher=createCipheriv('aes-128-cbc',key,iv);const payload=Buffer.concat([cipher.update(JSON.stringify({id,method,params})),cipher.final()]);const header=Buffer.alloc(32);header.writeUInt16BE(0x2131);header.writeUInt16BE(32+payload.length,2);data.copy(header,8,8,16);token.copy(header,16);md5(Buffer.concat([header,payload])).copy(header,16);socket.send(Buffer.concat([header,payload]),54321,device.localip);return;}
  if(data.length===32)return;
  try{const checksum=md5(Buffer.concat([data.subarray(0,16),token,data.subarray(32)]));if(!timingSafeEqual(checksum,data.subarray(16,32)))return;const decipher=createDecipheriv('aes-128-cbc',key,iv);const text=Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]).toString().replace(/\0+$/,'');const json=JSON.parse(text);if(json.id!==id)return;if(json.error)return finish(Error('Cihaz bu sorguyu desteklemiyor.'));finish(null,json.result);}catch{finish(Error('Xiaomi yanıtı doğrulanamadı.'));}
 });
 timer=setTimeout(()=>{const error=Error('Xiaomi cihazına ulaşılamadı; elektriğini ve Wi-Fi bağlantısını kontrol edin.');error.code='MIIO_TIMEOUT';finish(error);},8000);
 const hello=Buffer.alloc(32,0xff);hello.writeUInt16BE(0x2131);hello.writeUInt16BE(32,2);socket.send(hello,54321,device.localip);
 return response;
}

export function createMiioRequester(transport){const queues=new Map();return function request(device,method,params=[]){const id=device.localip,prior=queues.get(id)||Promise.resolve();const work=prior.catch(()=>{}).then(async()=>{try{return await transport(device,method,params);}catch(e){if(method!=='get_properties'||e.code!=='MIIO_TIMEOUT')throw e;return transport(device,method,params);}});queues.set(id,work);work.finally(()=>{if(queues.get(id)===work)queues.delete(id);}).catch(()=>{});return work;};}
export const miioRequest=createMiioRequester(rawRequest);
