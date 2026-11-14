import {watchDevice} from '/device-live.js';
const registry=await fetch('/api/devices').then(r=>r.json());
const legacy=kind=>registry.devices.some(d=>d.legacy&&d.type===kind&&d.enabled&&d.configured);
import {renderRemaining} from '/remaining.js';
const $=s=>document.querySelector(s);
async function api(kind,body){const r=await fetch('/api/xiaomi/'+kind,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
let busy=false;
async function vacuum(){try{const data=await api('vacuum');$('#vacuum-state').textContent=data.name+' · '+data.state+(data.charging?' · Şarjda':'');$('#vacuum-info').textContent='Pil %'+data.battery+' · Cihazın toplam sayacı: '+data.totalCycles;$('#vacuum-note').textContent=data.fault?'Cihaz hata kodu: '+data.fault:'Yerel Wi-Fi · Oda seçimi aşağıda.';if(!busy)document.querySelectorAll('[data-vacuum]').forEach(b=>b.disabled=false);}catch(e){$('#vacuum-state').textContent='Bağlantı kurulamadı';$('#vacuum-note').textContent=e.message;document.querySelectorAll('[data-vacuum]').forEach(b=>b.disabled=true);}}
document.querySelectorAll('[data-vacuum]').forEach(button=>button.addEventListener('click',async()=>{if(busy)return;busy=true;document.querySelectorAll('[data-vacuum]').forEach(b=>b.disabled=true);try{const d=await api('vacuum',{command:button.dataset.vacuum});$('#vacuum-note').textContent=d.message;}catch(e){$('#vacuum-note').textContent=e.message;}finally{busy=false;setTimeout(vacuum,3000);}}));
async function fryer(){try{const d=await api('fryer');$('#fryer-state').textContent=d.name+' · '+d.state;$('#fryer-info').textContent='Hedef: '+(d.targetTemperature??'—')+'°C';renderRemaining($('#fryer-timer'),d.remainingTime,{active:d.running,completed:d.completed});$('#fryer-note').textContent=(d.fault?'Hata kodu: '+d.fault:'Yerel Wi-Fi · Yalnızca izleme')+' · Ölçülen iç sıcaklık değildir.';}catch(e){$('#fryer-state').textContent='Bağlantı kurulamadı';renderRemaining($('#fryer-timer'),null,{stale:true});$('#fryer-note').textContent=e.message;}}
if(legacy('vacuum')){vacuum();watchDevice('vacuum',()=>{if(!busy)vacuum();});}if(legacy('fryer')){fryer();watchDevice('fryer',fryer);}

let roomData;
const colors=['#d4a66e','#83b5a3','#93a9d0','#c39cba'];
async function loadRooms(){try{roomData=await api('rooms');const list=$('#room-list');list.replaceChildren();for(const [i,r]of roomData.rooms.entries()){const row=document.createElement('label');row.className='room-row';row.style.borderLeft='6px solid '+colors[i%4];const check=document.createElement('input');check.type='checkbox';check.value=r.id;check.dataset.roomSelect='';const name=document.createElement('input');name.value=r.name;name.maxLength=50;name.readOnly=window.evUser?.role!=='admin';name.dataset.roomId=r.id;name.setAttribute('aria-label','Haritada '+r.id+' numaralı odanın adı');row.append(check,name);list.append(row);}const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('aria-label','Robotun oda haritası');svg.setAttribute('viewBox',`0 0 ${roomData.width} ${roomData.height}`);svg.setAttribute('role','img');for(const [x,y,w,id]of roomData.runs||[]){const rect=document.createElementNS(ns,'rect');for(const [k,v]of Object.entries({x,y,width:w,height:1,fill:colors[roomData.rooms.findIndex(r=>r.id===id)%4]}))rect.setAttribute(k,v);svg.append(rect);}for(const r of roomData.rooms){const [x,y]=roomData.centers[r.id];const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('font-size',8);t.setAttribute('text-anchor','middle');t.textContent=r.id;svg.append(t);}$('#room-map').replaceChildren(svg);setupZoneSelection(svg);$('#rooms-note').textContent='Haritadaki numaralara göre oda adlarını kaydet. Harita değişirse eşleştirme yenilenmelidir. Oda komutu bu haritaya göre gönderilir; harita değiştiyse eşleştirmeyi yenileyin.';}catch(e){$('#rooms-note').textContent=e.message;}}
$('#rooms-save').addEventListener('click',async()=>{try{await api('rooms',{rooms:[...document.querySelectorAll('[data-room-id]')].map(x=>({id:Number(x.dataset.roomId),name:x.value}))});$('#rooms-note').textContent='Oda adları kaydedildi.';}catch(e){$('#rooms-note').textContent=e.message;}});
$('#rooms-clean').addEventListener('click',async e=>{if(busy)return;busy=true;e.target.disabled=true;document.querySelectorAll('[data-vacuum]').forEach(b=>b.disabled=true);try{const rooms=[...document.querySelectorAll('[data-room-select]:checked')].map(x=>Number(x.value));const d=await api('vacuum',{command:'rooms',rooms,mapId:roomData?.mapId});$('#rooms-note').textContent=d.message;}catch(error){$('#rooms-note').textContent=error.message;}finally{busy=false;e.target.disabled=false;setTimeout(vacuum,2000);}});
function setupZoneSelection(svg){
 const controls=$('#zone-controls'),select=$('#zone-select'),clean=$('#zone-clean'),note=$('#rooms-note');
 controls.hidden=!roomData.zoneRevision;
 if(controls.hidden)return;

 const overlay=document.createElementNS(svg.namespaceURI,'rect');
 overlay.setAttribute('class','zone-selection');
 overlay.setAttribute('visibility','hidden');
 svg.append(overlay);

 let pointer=null,start=null,selection=null;
 function point(event){
  const matrix=svg.getScreenCTM();
  if(!matrix)return null;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  return [Math.max(0,Math.min(roomData.width,p.x)),Math.max(0,Math.min(roomData.height,p.y))];
 }
 function preview(end){
  if(!end)return;
  const [x1,y1]=start,[x2,y2]=end;
  const width=Math.abs(x2-x1),height=Math.abs(y2-y1);
  for(const [key,value] of Object.entries({x:Math.min(x1,x2),y:Math.min(y1,y2),width,height}))
   overlay.setAttribute(key,value);
  overlay.setAttribute('visibility','visible');
  selection=width>2&&height>2?[x1,y1,x2,y2]:null;
 }
 select.onclick=()=>{
  const active=!svg.classList.contains('selecting-zone');
  svg.classList.toggle('selecting-zone',active);
  select.setAttribute('aria-pressed',String(active));
  select.textContent=active?'Alan seçimini iptal et':'Haritada alan seç';
  selection=null;
  clean.disabled=true;
  overlay.setAttribute('visibility','hidden');
  note.textContent=active?'Dikdörtgen çizmek için haritada sürükleyin.':'Alan seçimi iptal edildi.';
 };
 svg.addEventListener('pointerdown',event=>{
  if(!svg.classList.contains('selecting-zone')||pointer!==null||event.button!==0||select.disabled)return;
  start=point(event);
  if(!start)return;
  pointer=event.pointerId;
  svg.setPointerCapture(pointer);
  clean.disabled=true;
  preview(start);
 });
 svg.addEventListener('pointermove',event=>{
  if(event.pointerId===pointer)preview(point(event));
 });
 svg.addEventListener('pointerup',event=>{
  if(event.pointerId!==pointer)return;
  preview(point(event));
  pointer=null;
  clean.disabled=!selection;
  note.textContent=selection?'Alan seçildi. Dikdörtgeni yeniden çizebilir veya temizliği başlatabilirsiniz.':'Daha büyük bir dikdörtgen çizin.';
 });
 svg.addEventListener('lostpointercapture',event=>{
  if(event.pointerId!==pointer)return;
  pointer=null;
  selection=null;
  overlay.setAttribute('visibility','hidden');
 });
 clean.onclick=async()=>{
  if(busy||!selection||pointer!==null)return;
  busy=true;
  clean.disabled=true;
  select.disabled=true;
  document.querySelectorAll('[data-vacuum]').forEach(button=>button.disabled=true);
  try{
   const result=await api('vacuum',{command:'zone',mapId:roomData.mapId,zone:{selection,revision:roomData.zoneRevision}});
   svg.classList.remove('selecting-zone');
   select.setAttribute('aria-pressed','false');
   select.textContent='Haritada alan seç';
   overlay.setAttribute('visibility','hidden');
   selection=null;
   note.textContent=result.message;
  }catch(error){note.textContent=error.message;}
  finally{
   busy=false;
   select.disabled=false;
   clean.disabled=!selection;
   setTimeout(vacuum,2000);
  }
 };
}
if(legacy('vacuum'))loadRooms();
