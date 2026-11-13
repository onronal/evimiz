import {deviceStatuses} from './device-status.mjs';
import {createAddressRecovery,persistXiaomiAddress} from './xiaomi-discovery.mjs';
const recoverAddress=createAddressRecovery();
import {buildRoomAction} from './vacuum-room-command.mjs';
import {readFile} from 'node:fs/promises';
import {readRooms,validateRoomSelection} from './rooms.mjs';
import {miioRequest} from './miio-local.mjs';
const dir=new URL('./data/xiaomi/',import.meta.url),cache=new Map(),pending=new Map();
const models={vacuum:'dreame.vacuum.p2140p',fryer:'careli.fryer.maf02'};
const statuses={vacuum:{1:'Temizliyor',2:'Bekliyor',3:'Duraklatıldı',4:'Hata',5:'Şarja dönüyor',6:'Şarj oluyor',7:'Paspas yapıyor'},fryer:{0:'Kapalı',1:'Bekliyor',2:'Duraklatıldı',3:'Zamanlandı',4:'Pişiriyor',5:'Ön ısıtma',6:'Pişirme tamamlandı',7:'Ön ısıtma tamamlandı',8:'Ön ısıtma duraklatıldı',9:'Duraklatıldı'}};
async function deviceFor(kind){const devices=JSON.parse(await readFile(new URL('mi-tokens.json',dir),'utf8'));const device=devices.find(d=>d.model===models[kind]);if(!device)throw Error('Xiaomi cihazı henüz bağlanmadı.');return device;}
async function readStatus(kind,override){
 const device=override||await deviceFor(kind);const pairs=kind==='vacuum'?[[2,1],[2,2],[3,1],[3,2],[12,3]]:[[2,1],[2,2],[2,3],[2,4],[2,5]];
 const result=await miioRequest(device,'get_properties',pairs.map(([siid,piid])=>({did:kind==='fryer'?`${siid}-${piid}`:device.did,siid,piid})));
 if(!Array.isArray(result))throw Error('Geçersiz Xiaomi durum yanıtı');
 const value=(siid,piid)=>{const item=result.find(r=>r.siid===siid&&r.piid===piid&&r.code===0);return item?.value??null;};
 const status=value(2,1);if(status===null)throw Error('Cihaz durumu okunamadı.');
 return {connected:true,kind,name:device.name,model:device.model,source:'local',at:new Date().toISOString(),state:statuses[kind][status]||'Bilinmeyen durum',fault:value(2,2),...(kind==='vacuum'?{battery:value(3,1),charging:value(3,2)===1,totalCycles:value(12,3),roomsReady:true,running:[1,7].includes(status),completed:false,resetCycle:[2,5,6].includes(status),hasFault:status===4}:{targetTime:value(2,3),targetTemperature:value(2,4),remainingTime:value(2,5),running:[4,5].includes(status),completed:status===6,resetCycle:[0,1].includes(status),readOnly:true})};
}
export async function xiaomiStatus(kind,override,instance=kind){if(!models[kind])throw Error('Geçersiz Xiaomi türü');const cached=cache.get(instance);if(cached&&Date.now()-cached.at<15000)return cached.value;if(pending.has(instance))return pending.get(instance);const work=readStatus(kind,override).catch(async error=>{if(error.code!=='MIIO_TIMEOUT')throw error;const device=override||await deviceFor(kind);return recoverAddress(device,candidate=>readStatus(kind,candidate),candidate=>persistXiaomiAddress(device,candidate,instance,!override));}).then(value=>{cache.set(instance,{at:Date.now(),value});return value;}).finally(()=>pending.delete(instance));pending.set(instance,work);return work;}
async function rawVacuumCommand(command,rooms,override,instance='vacuum',expectedMapId){
 const actions={start:[2,1],pause:[2,2],dock:[3,1],rooms:[4,1]};if(!actions[command])throw Error('Geçersiz robot komutu');const device=override||await deviceFor('vacuum');const [siid,aiid]=actions[command];
 let payload={did:device.did,siid,aiid,in:[]};if(command==='rooms'){
 const known=await readRooms(override?{id:instance,type:'vacuum',legacy:false}:undefined);
 // Validate identity before even querying the robot's current settings.
 validateRoomSelection(known,rooms,expectedMapId);if(expectedMapId===undefined||known.mapId===undefined)throw Error('Robot oda listesini yenileyip tekrar seçin.');
 const settings=await miioRequest(device,'get_properties',[4,5].map(piid=>({did:device.did,siid:4,piid})));
 const value=piid=>settings?.find(p=>p.siid===4&&p.piid===piid&&p.code===0)?.value;
 payload=buildRoomAction(device,known,rooms,expectedMapId,{suction:value(4),water:value(5)});
 }const result=await miioRequest(device,'action',payload);cache.delete(instance);
 if(result?.code!==0)throw Error('Robot komutu kabul etmedi'+(Number.isInteger(result?.code)?' (kod '+result.code+')':'')+'.');return {accepted:true,confirmed:false,message:command==='rooms'?'Robot oda komutunu kabul etti. Temizliğin başladığı henüz doğrulanmadı; robot durumunu kontrol edin.':'Robot komutu aldı. Durum birazdan güncellenecek.'};
}

export async function vacuumCommand(command,rooms,override,instance='vacuum',expectedMapId){deviceStatuses.invalidate(instance);try{return await rawVacuumCommand(command,rooms,override,instance,expectedMapId);}finally{deviceStatuses.invalidate(instance);}}
