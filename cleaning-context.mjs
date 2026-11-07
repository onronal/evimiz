// Requested rooms describe the accepted command, not proof of room coverage.
export function cleaningIntent(input,map,at=new Date().toISOString()){
 if(!['rooms','start'].includes(input.command))return null;
 return {at,scope:input.command==='rooms'?'rooms':'all',rooms:input.command==='rooms'?(input.rooms||[]).map(id=>({id,name:map.rooms.find(r=>r.id===id)?.name||'Oda '+id})):[]};
}
export function annotateActivity(state,device,current,events,at){
 state.cleaningContexts||={};state.vacuumIntents||={};
 const timerCycleId=current.remainingTimer?.cycleId;
 // Confirm an estimated ending in place. Stable event IDs prevent a second push.
 if(current.completed&&!current.estimatedCompletion&&timerCycleId){const ending=state.events.find(e=>e.device===device.id&&e.kind==='completed'&&e.timerCycleId===timerCycleId&&e.estimated);if(ending){ending.estimated=false;ending.confirmedAt=at;ending.source='vestel';}}
 return events.filter(e=>!(e.kind==='completed'&&timerCycleId&&state.events.some(old=>old.device===device.id&&old.kind==='completed'&&old.timerCycleId===timerCycleId))).map(e=>{
  let context=state.cleaningContexts[device.id];
  if(device.type==='vacuum'&&e.kind==='started'){
   const intent=state.vacuumIntents[device.id],age=Date.parse(at)-Date.parse(intent?.at);
   context=intent&&age>=0&&age<=300000?intent:null;
   state.cleaningContexts[device.id]=context;delete state.vacuumIntents[device.id];
  }
  return {...e,device:device.id,deviceType:device.type,program:current.program||null,...(timerCycleId?{timerCycleId}:{}),...(current.estimatedCompletion?{estimated:true,source:'estimated_timer'}:{}),...(device.type==='vacuum'&&context?{scope:context.scope,rooms:context.rooms}: {})};
 });
}
