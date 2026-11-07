export function activityTransition(previous,current,at,device){
 const events=[];const running=!!current.running,completed=!!current.completed;const timerCycleId=current.remainingTimer?.cycleId;
 if(running&&!previous?.cycleOpen&&!(timerCycleId&&timerCycleId===previous?.timerCycleId))events.push({device,kind:'started',at,observedAt:at,eventId:`activity:${device}:started:${at}`,source:device==='washer'||device==='dishwasher'?'vestel':'xiaomi',timeAccuracy:'observed'});
 if(previous&&((device==='vacuum'&&Number.isFinite(previous.totalCycles)&&current.totalCycles>previous.totalCycles)||(device!=='vacuum'&&!previous.completed&&completed)))events.push({device,kind:'completed',at,observedAt:at,eventId:`activity:${device}:completed:${at}`,source:device==='washer'||device==='dishwasher'?'vestel':'xiaomi',timeAccuracy:'observed'});
 return {next:{running,completed,at,...(timerCycleId?{timerCycleId}:{}),cycleOpen:running||(!completed&&!current.resetCycle&&!!previous?.cycleOpen),...(device==='vacuum'?{totalCycles:current.totalCycles}:{})},events};
}
export function internetQuality(history){
 if(!history.length)return {bad:false,reason:'Ölçüm bekleniyor'};
 const latest=history[0];if(latest.error)return {bad:true,reason:'Son internet ölçümü başarısız. İnternet veya test servisi kaynaklı olabilir.'};
 const prior=history.slice(1,13).filter(x=>!x.error&&Number.isFinite(x.downloadMbps)).map(x=>x.downloadMbps).sort((a,b)=>a-b),baseline=prior.length>=3?prior[Math.floor(prior.length/2)]:null;
 const bad=latest.downloadMbps<5||latest.uploadMbps<1||latest.latencyMs>500||!!(baseline&&latest.downloadMbps<baseline*.4);
 return {bad,baseline,reason:bad?'Son ölçümde bağlantı yavaşladı. Kısa örneklem sonucu; Wi-Fi ve evdeki kullanım etkileyebilir.':'Son ölçümde kötüleşme görülmedi'};
}
