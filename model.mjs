export const defaults = {home:'Evimiz',location:'',thresholds:{washer:7,dishwasher:4,vacuum:3}};
export function alerts(settings, events, now=Date.now()) {
  const tracked=settings.devices?settings.devices.filter(d=>d.enabled&&['washer','dishwasher','vacuum'].includes(d.type)).map(d=>({id:d.id,type:d.type})):['washer','dishwasher','vacuum'].map(id=>({id,type:id}));
  if(settings.vacationMode||settings.notifications?.reminders===false)return [];
  return tracked.flatMap(({id:device,type})=>{
    const preference=settings.notifications?.devices?.[device];if(preference?.reminder===false)return [];
    const relevant=events.filter(e=>e.device===device);
    const starts=relevant.filter(e=>e.kind==='started');
    const last=(starts.length?starts:relevant.filter(e=>e.kind==='completed')).sort((a,b)=>b.at.localeCompare(a.at))[0];
    if(!last) return [];
    const days=Math.floor((now-Date.parse(last.at))/86400000);
    return days>=(preference?.days??settings.thresholds[type]??defaults.thresholds[type]) ? [{device,days}] : [];
  });
}
export function validateEvent(input,devices=['washer','dishwasher','vacuum'].map(id=>({id,type:id}))){
  const device=devices.find(d=>d.id===input.device&&['washer','dishwasher','vacuum'].includes(d.type));if(!device)throw Error('Geçersiz cihaz');
  if(input.kind!=='completed') throw Error('Yalnızca tamamlanma kaydı destekleniyor');
  if(typeof input.eventId!=='string'||input.eventId.length<1||input.eventId.length>160) throw Error('Olay kimliği gerekli');
  const at=new Date(input.at);
  if(!Number.isFinite(at.getTime())||at.getTime()>Date.now()+60000) throw Error('Geçersiz tarih');
  return {device:input.device,deviceType:device.type,kind:input.kind,eventId:input.eventId,at:at.toISOString(),source:'manual'};
}
