// Read-only Tuya discovery. Never sends control commands or contacts the cloud.
import dgram from 'node:dgram';
import {createHash,createDecipheriv} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
const key=createHash('md5').update('yGAdlopoPVldABfn').digest();
const found=new Map(),sockets=[];
function parse(data){
 const candidates=[data];
 if(data.length>24&&data.readUInt32BE(0)===0x55aa)candidates.push(data.subarray(20,-8),data.subarray(16,-8));
 for(const payload of [...candidates]){try{const d=createDecipheriv('aes-128-ecb',key,null);candidates.push(Buffer.concat([d.update(payload),d.final()]));}catch{}}
 for(const p of candidates){try{const text=p.toString('utf8');const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start>=0&&end>start){const value=JSON.parse(text.slice(start,end+1));if(value.gwId||value.devId||value.ip)return value;}}catch{}}
 return null;
}
for(const port of [6666,6667,7000]){
 const socket=dgram.createSocket({type:'udp4',reuseAddr:true});sockets.push(socket);
 socket.on('error',e=>console.log(JSON.stringify({port,error:e.code})));
 socket.on('message',(data,remote)=>{const value=parse(data);if(value){const device={ip:remote.address,deviceId:value.gwId||value.devId,version:value.version,productId:value.productKey||value.productId,port};if(!found.has(device.ip)){found.set(device.ip,device);console.log(JSON.stringify(device));}}else console.log(JSON.stringify({ip:remote.address,port,bytes:data.length,decoded:false}));});
 socket.bind(port,'0.0.0.0',()=>console.log('Listening UDP '+port));
}
setTimeout(async()=>{for(const socket of sockets){try{socket.close();}catch{}}await mkdir(new URL('./data/',import.meta.url),{recursive:true});await writeFile(new URL('./data/discovered-devices.json',import.meta.url),JSON.stringify([...found.values()],null,2));console.log('Discovery complete: '+found.size+' devices');},25000);
