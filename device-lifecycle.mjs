export function archiveDevice(state,id,now=new Date().toISOString()){
 const device=state.settings.devices.find(d=>d.id===id);if(!device)throw Error('Cihaz bulunamadı.');
 state.archivedDevices||=[];state.archivedDevices.push({device:structuredClone(device),roomId:state.settings.layout.assignments[id]||null,archivedAt:now});
 if(state.settings.layout.deviceOrder)state.settings.layout.deviceOrder=state.settings.layout.deviceOrder.filter(x=>x!==id);state.settings.devices=state.settings.devices.filter(d=>d.id!==id);delete state.settings.layout.assignments[id];if(state.settings.indoorTemperatureSource===id)state.settings.indoorTemperatureSource=null;
 for(const rule of state.automations||[])if(rule.action.deviceId===id){rule.enabled=false;delete state.automationTracking?.[rule.id];}
 delete state.activityTracking?.[id];delete state.vacationTracking?.[id];
}
export function restoreDevice(state,id){const entry=state.archivedDevices?.find(e=>e.device.id===id);if(!entry)throw Error('Kaldırılmış cihaz bulunamadı.');if(state.settings.devices.length>=100)throw Error('Önce bir cihazı kaldırın; en fazla 100 cihaz olabilir.');if(state.settings.devices.some(d=>d.id===id))throw Error('Cihaz zaten kayıtlı.');state.settings.devices.push({...entry.device,enabled:false});state.settings.layout.assignments[id]=state.settings.layout.rooms.some(r=>r.id===entry.roomId)?entry.roomId:null;state.archivedDevices=state.archivedDevices.filter(e=>e!==entry);}
