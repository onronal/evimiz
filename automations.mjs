import {randomUUID} from 'node:crypto';
import {validateRoomSelection} from './rooms.mjs';
const kinds=['time','dawn','dusk','temperature'];
function temperature(input){if(!input||!['indoor','outdoor'].includes(input.source)||!['above','below'].includes(input.operator)||!Number.isFinite(input.value)||input.value< -50||input.value>60)throw Error('Sıcaklık koşulunu kontrol edin.');return {source:input.source,operator:input.operator,value:input.value};}
export function validateAutomation(input,devices,maps={}){if(typeof input.name!=='string'||!input.name.trim()||input.name.length>80||typeof input.enabled!=='boolean'||!kinds.includes(input.trigger?.type))throw Error('Otomasyon adı ve tetikleyiciyi kontrol edin.');const trigger={type:input.trigger.type};if(trigger.type==='time'){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.trigger.at))throw Error('Saat HH:MM olmalı.');trigger.at=input.trigger.at;}if(['dawn','dusk'].includes(trigger.type)){const offset=input.trigger.offsetMinutes??0;if(!Number.isInteger(offset)||Math.abs(offset)>180)throw Error('Gün ışığı farkı -180 ile 180 dakika arasında olmalı.');trigger.offsetMinutes=offset;}if(trigger.type==='temperature')Object.assign(trigger,temperature(input.trigger));if(input.conditions!==undefined&&(!input.conditions||typeof input.conditions!=='object'||Array.isArray(input.conditions)||Object.keys(input.conditions).length))throw Error('Ek koşullar desteklenmiyor. Tek bir tetikleyici seçin.');
 const actions=input.actions;
 if(actions!==undefined&&(!Array.isArray(actions)||actions.length<1||actions.length>10))throw Error('1–10 işlem ekleyin.');
 const validated=(actions??[input.action]).map(action=>validateAction(action,devices,maps));
 return {id:'automation-'+randomUUID(),name:input.name.trim(),enabled:input.enabled,trigger,...(actions===undefined?{action:validated[0]}:{actions:validated})};
}
export function automationActions(rule){return rule.actions??[rule.action];}
function validateAction(action,devices,maps){
 const device=devices.find(d=>d.id===action?.deviceId&&d.enabled);if(!device||!['light','plug','climate','vacuum'].includes(device.type))throw Error('Komut destekleyen etkin bir cihaz seçin.');const c=action.command||{},command={};if(['light','plug'].includes(device.type)){if(typeof c.power!=='boolean'||Object.keys(c).some(k=>k!=='power'))throw Error('Cihaz için aç/kapat seçin.');command.power=c.power;}
 if(device.type==='climate'){if(!Object.keys(c).length||Object.keys(c).some(k=>!['power','mode','setpoint'].includes(k))||c.power!==undefined&&typeof c.power!=='boolean'||c.mode!==undefined&&!['cool','heat','auto','dry','fan','wind','fanOnly'].includes(c.mode)||c.setpoint!==undefined&&(!Number.isFinite(c.setpoint)||c.setpoint<10||c.setpoint>35))throw Error('Klima komutunu kontrol edin.');Object.assign(command,c);}
 if(device.type==='vacuum'){if(!['start','pause','dock','rooms'].includes(c.command)||Object.keys(c).some(k=>!['command','rooms','mapId'].includes(k)))throw Error('Robot komutunu kontrol edin.');command.command=c.command;if(c.command==='rooms'){const map=maps[device.id];if(!map||map.mapId===undefined)throw Error('Bu robot için önce harita oda eşleştirmesi yapılmalı.');command.rooms=validateRoomSelection(map,c.rooms,c.mapId);command.mapId=map.mapId;}else if(c.rooms!==undefined||c.mapId!==undefined)throw Error('Oda seçimi yalnız oda temizliğinde kullanılabilir.');}
 return {deviceId:device.id,command};
}
const matchTemperature=(c,ctx)=>{const value=ctx[c.source];return Number.isFinite(value)&&(c.operator==='above'?value>c.value:value<c.value);};
export function evaluateAutomation(rule,context,previous={},now=Date.now()){
 if(!rule.enabled)return {due:false,matched:false,reason:'Kapalı'};
 let matched=false,key=null;const trigger=rule.trigger;
 if(trigger.type==='temperature')matched=matchTemperature(trigger,context);
 else if(trigger.type==='time'){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:context.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));matched=parts.hour+':'+parts.minute===trigger.at;if(context.resumeAfter&&Date.parse(context.resumeAfter)>Math.floor(now/60000)*60000)matched=false;key=[parts.year,parts.month,parts.day,trigger.at].join('-');}
 else{const at=Date.parse(context.sun?.[trigger.type])+trigger.offsetMinutes*60000;matched=Number.isFinite(at)&&now>=at&&now-at<60000&&(!context.resumeAfter||at>=Date.parse(context.resumeAfter));key=Number.isFinite(at)?new Date(at).toISOString():null;}
 const cooldown=previous.attemptAt?now-Date.parse(previous.attemptAt)>=30*60000:true;
 const due=matched&&(trigger.type==='temperature'?!previous.matched&&cooldown:previous.key!==key);
 return {due,matched,key,reason:due?'Koşullar sağlandı':matched?'Bu tetikleme işlendi veya bekleme süresinde':'Koşullar henüz sağlanmadı / veri yok'};
}
