const $=s=>document.querySelector(s);let page=1,pages=1,filter='all',weekOffset=0,settings,requestNumber=0;
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const dt=new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'});
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
function message(text){$('#message').textContent=text;setTimeout(()=>$('#message').textContent='',5000);}
function chart(week){
 $('#week-title').textContent=new Date(week.start+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'})+' – '+new Date(week.end+'T12:00:00').toLocaleDateString('tr-TR',{day:'numeric',month:'short'});
 $('#week-total').textContent=week.total+' çalışma';$('#week-next').disabled=week.offset===0;
 const bars=$('#weekly-chart');bars.replaceChildren();const max=Math.max(1,...week.days.map(d=>Object.values(d.counts).reduce((a,b)=>a+b,0)));
 for(const day of week.days){const total=Object.values(day.counts).reduce((a,b)=>a+b,0),column=node('div','','week-column'),stack=node('div','','week-stack');column.append(node('strong',String(total)));stack.setAttribute('role','img');stack.setAttribute('aria-label',day.date+': '+day.counts.washer+' çamaşır, '+day.counts.dishwasher+' bulaşık, '+day.counts.vacuum+' robot');stack.title=stack.getAttribute('aria-label');for(const type of ['washer','dishwasher','vacuum']){const segment=node('div','','week-segment '+type);segment.style.height=(day.counts[type]/max*120)+'px';stack.append(segment);}column.append(stack,node('small',day.label),node('small',day.date.slice(8)));bars.append(column);}
}
async function refresh(){
 const request=++requestNumber;const [state,h]=await Promise.all([api('/api/state?summary=1'),api('/api/history?page='+page+'&weekOffset='+weekOffset+'&device='+encodeURIComponent(filter))]);if(request!==requestNumber)return;
 settings=state.settings;page=h.page;pages=h.pages;document.title='Temizlik geçmişi · '+settings.home;
 const cleaning=settings.devices.filter(d=>['washer','dishwasher','vacuum'].includes(d.type));
 for(const [select,all]of [[$('#history-device'),true],[$('#event-form').elements.device,false]]){const selected=select.value;select.replaceChildren();if(all){const o=node('option','Tüm temizlik cihazları');o.value='all';select.append(o);}for(const d of cleaning){const o=node('option',d.name);o.value=d.id;select.append(o);}if([...select.options].some(o=>o.value===selected))select.value=selected;}
 $('#event-form').querySelector('button').disabled=!cleaning.length;$('#event-count').textContent=h.total+' çalışma';$('#history-page').textContent='Sayfa '+page+' / '+pages;$('#history-prev').disabled=page<=1;$('#history-next').disabled=page>=pages;
 chart(h.week);const list=$('#events');list.replaceChildren();
 for(const e of h.events){const row=node('div','','history-row'),detail=node('div','','history-detail');detail.append(node('strong',e.name),node('span',e.status==='running'?'Başladı · bitiş bekleniyor':e.status==='estimated_completed'?'Tahmini tamamlandı':'Tamamlandı','history-kind '+(e.status==='running'?'started':'completed')));if(e.program)detail.append(node('small',e.program));row.append(detail);
  if(e.type==='vacuum')row.append(node('small',e.scope==='rooms'?'Seçilen odalar: '+e.rooms.map(r=>r.name).join(', '):e.scope==='all'?'Tüm ev seçildi':'Oda bilgisi kaydedilmemiş'));
  const times=node('div','','history-times');for(const [label,value]of [['Başlangıç',e.startedAt],['Bitiş',e.completedAt]]){const line=node('span',label+': ');if(value){const time=node('time',dt.format(new Date(value)));time.dateTime=value;line.append(time);}else line.append(node('span',label==='Başlangıç'?'Bilinmiyor':'Henüz kaydedilmedi'));times.append(line);}row.append(times);
  row.append(node('small',e.estimated?'Sayaç sıfırlandı · cihazın bitiş onayı bekleniyor':e.approximate?'Eksik geçmiş kaydı · Gerçek bitiş saati bilinmiyor':e.manual?'Manuel kayıt':'Otomatik kayıt · İzleme zamanı'));list.append(row);
 }
 if(!h.events.length)list.append(node('p','Bu seçim için henüz temizlik kaydı yok.','empty'));
 const alerts=$('#alerts');alerts.replaceChildren();const names=Object.fromEntries(settings.devices.map(d=>[d.id,d.name]));for(const a of state.alerts)alerts.append(node('p',names[a.device]+' '+a.days+' gündür çalıştırılmadı.','alert'));if(!state.alerts.length)alerts.append(node('p',settings.vacationMode?'Tatil modu açık. Temizlik hatırlatmaları kapalı.':'Bekleyen temizlik hatırlatması yok.'));
}
$('#history-device').addEventListener('change',e=>{filter=e.target.value;page=1;refresh().catch(e=>message(e.message));});
for(const [id,delta]of [['history-prev',-1],['history-next',1]])$('#'+id).addEventListener('click',()=>{page+=delta;refresh().catch(e=>message(e.message));});
for(const [id,delta]of [['week-prev',-1],['week-next',1]])$('#'+id).addEventListener('click',()=>{weekOffset+=delta;refresh().catch(e=>message(e.message));});
$('#event-form').addEventListener('submit',async e=>{e.preventDefault();try{const f=e.target.elements;await api('/api/events',{device:f.device.value,kind:'completed',at:new Date(f.at.value).toISOString(),eventId:crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')});page=1;await refresh();message('Tamamlanma kaydı eklendi.');}catch(error){message(error.message);}});
const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());$('#event-form').elements.at.value=now.toISOString().slice(0,16);refresh().catch(e=>message(e.message));setInterval(()=>{if(!document.hidden&&!document.activeElement?.closest('form'))refresh().catch(()=>{});},60000);
