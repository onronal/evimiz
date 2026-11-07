const types=['washer','dishwasher','vacuum'];
export function cleaningCycles(state,device='all'){
 const devices=[...(state.settings.devices||[]),...(state.archivedDevices||[]).map(e=>e.device)],kinds=new Map(devices.map(d=>[d.id,d.type])),names=new Map(devices.map(d=>[d.id,d.name]));
 const rows=[],open=new Map();
 for(const e of [...state.events].filter(e=>types.includes(e.deviceType||kinds.get(e.device)||e.device)&&(device==='all'||e.device===device)).sort((a,b)=>a.at.localeCompare(b.at)||(a.kind==='started'?-1:1))){
  if(!['started','completed'].includes(e.kind))continue;
  let row=open.get(e.device);
  if(e.kind==='started'||!row){row={id:e.eventId,device:e.device,type:e.deviceType||kinds.get(e.device)||e.device,name:names.get(e.device)||'Temizlik cihazı',at:e.at,startedAt:null,completedAt:null,manual:false,approximate:false,program:null,rooms:null,scope:null};rows.push(row);}
  if(e.kind==='started'){row.startedAt=e.at;open.set(e.device,row);}else {row.completedAt=e.at;row.estimated=!!e.estimated;open.delete(e.device);}
  row.manual||=e.source==='manual';row.approximate||=e.timeAccuracy==='unknown';row.program=e.program||row.program;
  if(e.scope){row.scope=e.scope;row.rooms=(e.rooms||[]).map(r=>({id:r.id,name:r.name}));}
  row.kind=row.completedAt?'completed':'started';row.status=row.completedAt?(row.estimated?'estimated_completed':'completed'):'running';
 }
 return rows.sort((a,b)=>b.at.localeCompare(a.at)||String(b.id).localeCompare(String(a.id)));
}
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function weeklyCleaning(rows,{now=Date.now(),timezone='Europe/Istanbul',weekOffset=0}={}){
 if(!Number.isInteger(weekOffset)||weekOffset>0||weekOffset< -520)throw Error('Geçersiz hafta.');
 const key=at=>new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 const today=key(now),day=new Date(today+'T12:00:00Z').getUTCDay(),start=addDays(today,-((day+6)%7)+weekOffset*7);
 const days=Array.from({length:7},(_,i)=>({date:addDays(start,i),label:['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'][i],counts:{washer:0,dishwasher:0,vacuum:0}}));
 for(const row of rows){const day=days.find(d=>d.date===key(row.startedAt||row.completedAt));if(day)day.counts[row.type]++;}
 return {start,end:days[6].date,offset:weekOffset,days,total:days.reduce((n,d)=>n+Object.values(d.counts).reduce((a,b)=>a+b,0),0)};
}
export function cleaningHistory(state,{page=1,pageSize=20,device='all',weekOffset=0,now=Date.now()}={}){
 page=Number(page);pageSize=Number(pageSize);if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>50)throw Error('Geçersiz sayfa.');
 const list=cleaningCycles(state,device),total=list.length,pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(page,pages);
 return {page,pageSize,total,pages,events:list.slice((page-1)*pageSize,page*pageSize),week:weeklyCleaning(list,{now,timezone:state.settings.place?.timezone||'Europe/Istanbul',weekOffset:Number(weekOffset)})};
}
