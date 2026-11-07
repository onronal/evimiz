import {deviceCatalog} from './devices.mjs';
export function notificationSettings(settings){
 const saved=settings.notifications||{};
 return {internet:saved.internet!==false,reminders:saved.reminders!==false,vacation:saved.vacation!==false,devices:Object.fromEntries((settings.devices||[]).map(d=>{const s=saved.devices?.[d.id]||{};return [d.id,{started:s.started!==false,completed:s.completed!==false,reminder:s.reminder!==false,days:s.days??settings.thresholds?.[d.type]??3}];}))};
}
export function validateNotificationSettings(input,devices){
 if(!input||!['internet','reminders','vacation'].every(k=>typeof input[k]==='boolean')||!input.devices||typeof input.devices!=='object'||Array.isArray(input.devices))throw Error('Bildirim ayarlarını kontrol edin.');
 const result={internet:input.internet,reminders:input.reminders,vacation:input.vacation,devices:{}};
 for(const [id,value] of Object.entries(input.devices)){
  const d=devices.find(d=>d.id===id),spec=deviceCatalog.find(s=>s.id===d?.type);
  if(!d||!spec||!value||!['started','completed','reminder'].every(k=>typeof value[k]==='boolean')||!Number.isInteger(value.days)||value.days<1||value.days>365)throw Error('Cihaz bildirim ayarları geçersiz.');
  result.devices[id]={started:spec.notificationKinds.includes('started')&&value.started,completed:spec.notificationKinds.includes('completed')&&value.completed,reminder:spec.reminderSupported&&value.reminder,days:value.days};
 }
 return result;
}
