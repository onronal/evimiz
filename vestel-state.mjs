const labels={Selection:'Program seçimi',PreProgram:'Program bekliyor',Program:'Çalışıyor',Running:'Çalışıyor',InDelay:'Ertelendi',Pause:'Duraklatıldı',InDelayPause:'Ertelendi / duraklatıldı',EndMode:'Tamamlandı',End:'Tamamlandı',DoorOpened:'Kapak açık',FailureDisplay:'Hata',AutoDoorOpening:'Kapak açılıyor',Eco4060:'Eco 40–60',Eco50:'Eco 50',Cotton:'Pamuklu',Cotton20:'Pamuklu 20°',Synthetics:'Sentetik',Quick30:'Hızlı 30',Super50:'Süper 50',Prewash:'Ön yıkama',Fast60:'Hızlı 60',SpinDrain:'Sıkma / boşaltma'};
const tail=s=>s?.split('.').at(-1);
export function decodeVestel(device){
 const specs=device.discovery?.status||[],raw=device.status||{};
 function read(suffix){const spec=specs.find(s=>s.key?.endsWith('.'+suffix));if(!spec||!Object.hasOwn(raw,spec.commandName)||!/^\d+$/.test(String(raw[spec.commandName])))return null;let value=Number(raw[spec.commandName]);if(Number.isInteger(spec.position)&&Number.isInteger(spec.length))value=Math.floor(value/2**spec.position)%2**spec.length;const mapped=spec.values?.find(v=>v.commandValue===value);return {value,key:tail(mapped?.value),unit:spec.valueLimits?.unit};}
 const execution=read('ExecutionState'),program=read('SelectedProgram'),remaining=read('RemainingDuration');
 const kind=['WD','WM'].includes(device.type)?'washer':device.type==='DW'?'dishwasher':null;
 return {id:device.id,name:device.name,type:device.type,kind,readable:device.status!==null,stateKey:execution?.key||null,state:labels[execution?.key]||execution?.key||'Durum bilinmiyor',program:labels[program?.key]||program?.key||'—',remainingMinutes:remaining?.unit==='minute'?remaining.value:null,running:['Running','Program'].includes(execution?.key),completed:['End','EndMode'].includes(execution?.key),error:device.error||null};
}
export function trackCompletion(previous,current,at){
 const gap=previous?Date.parse(at)-Date.parse(previous.at):null;
 const wasCompleted=previous?.completed===true;
 const startedAt=current.running?(previous?.active?previous.startedAt:at):(previous?.active?previous.startedAt:null);
 const active=current.running||(previous?.active&&!current.completed&&['Pause','InDelayPause','DoorOpened','AutoDoorOpening'].includes(current.stateKey));
 const completed=!!((previous?.stateKey||previous?.active)&&!wasCompleted&&current.completed&&current.kind);
 return {next:{at,active,startedAt:active?startedAt:null,stateKey:current.stateKey,completed:!!current.completed,program:current.program,remainingMinutes:current.remainingMinutes},event:completed?{device:current.kind,kind:'completed',at,observedAt:at,source:'vestel',eventId:'vestel:'+current.kind+':'+(startedAt||at),observedStartedAt:startedAt,program:current.program,timeAccuracy:'observed',observationGapMinutes:gap===null?null:Math.round(gap/60000),note:gap>5*60000?'İzleme aralığında kesinti vardı; bitiş bu okumada görüldü.':!startedAt?'Çalışma başlangıcı görülmedi; cihazın tamamlandı durumu kaydedildi.':null}:null};
}
