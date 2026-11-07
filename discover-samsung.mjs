import dgram from 'node:dgram';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const socket=dgram.createSocket('udp4'),found=[];
// CoAP NON GET /oic/res. Discovery only; no ownership or control writes.
const token=randomBytes(2),id=randomBytes(2);
const packet=Buffer.concat([Buffer.from([0x52,1]),id,token,Buffer.from([0xb3]),Buffer.from('oic'),Buffer.from([0x03]),Buffer.from('res')]);
socket.on('error',e=>console.log('Discovery error: '+e.code));
socket.on('message',(data,remote)=>{
 if(data.length<6||!data.subarray(4,6).equals(token))return;
 const item={ip:remote.address,port:remote.port,code:data[1],hex:data.toString('hex')};found.push(item);console.log(JSON.stringify({ip:item.ip,port:item.port,code:item.code,bytes:data.length,payload:data.toString('utf8').replace(/[^\x20-\x7E]/g,'.')}));
});
socket.bind(0,'0.0.0.0',()=>{socket.setBroadcast(true);for(const host of ['224.0.1.187','192.168.0.255','192.168.0.10','192.168.0.14','192.168.0.36'])socket.send(packet,5683,host);console.log('OCF discovery started');});
setTimeout(async()=>{socket.close();await writeFile(new URL('./data/samsung-discovery.json',import.meta.url),JSON.stringify(found,null,2),{mode:0o600});console.log('Discovery complete: '+found.length+' responses');},10000);
