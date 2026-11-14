const $=s=>document.querySelector(s),form=$('#automation-form'),f=form.elements;let devices=[],rules=[],maps={};
const node=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
async function api(path,input){const r=await fetch(path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function message(text){$('#message').textContent=text;setTimeout(()=>$('#message').textContent='',6000);}
function setGroup(id,active){const group=$(id);group.hidden=!active;group.querySelectorAll('input,select').forEach(x=>x.disabled=!active);}
function triggerFields(){setGroup('#clock-field',f.trigger.value==='time');setGroup('#sun-offset-field',['dawn','dusk'].includes(f.trigger.value));setGroup('#temperature-trigger',f.trigger.value==='temperature');}
const steps=$('#automation-steps');
function addStep(saved){
 if(steps.children.length>=10){message('En fazla 10 işlem eklenebilir.');return;}
 const row=$('#automation-step').content.firstElementChild.cloneNode(true);
 const field=name=>row.querySelector('[name="'+name+'"]');
 const device=field('deviceId'),action=field('action'),roomBox=row.querySelector('[data-automation-rooms]');
 for(const d of devices){
  const option=node('option',d.name);option.value=d.id;device.append(option);
 }
 if(saved&&!devices.some(d=>d.id===saved.deviceId)){
  const option=node('option','Cihaz kullanılamıyor');option.value=saved.deviceId;device.append(option);
 }
 function visibility(){
  const type=devices.find(d=>d.id===device.value)?.type;
  row.querySelector('[data-climate-options]').hidden=type!=='climate'||action.value!=='on';
  row.querySelector('[data-robot-room-options]').hidden=type!=='vacuum'||action.value!=='rooms';
 }
 function populate(){
  const d=devices.find(d=>d.id===device.value),map=maps[device.value];
  const choices=d?.type==='vacuum'?[['start','Tüm evi temizle'],['pause','Duraklat'],['dock','Şarja dön'],...(map?.rooms?.length?[['rooms','Seçilen odaları temizle']]:[])]:[['on','Aç'],['off','Kapat']];
  action.replaceChildren();
  for(const [value,label] of choices){const option=node('option',label);option.value=value;action.append(option);}
  roomBox.replaceChildren();
  for(const room of map?.rooms||[]){
   const label=node('label',room.name),input=document.createElement('input');
   label.className='consent';input.type='checkbox';input.value=room.id;
   label.prepend(input);roomBox.append(label);
  }
  visibility();
 }
 if(saved)device.value=saved.deviceId;
 populate();
 if(saved){
  const command=saved.command;
  action.value=command.command||(command.power===false?'off':'on');
  field('mode').value=command.mode||'';field('setpoint').value=command.setpoint??'';
  if(command.mapId===maps[saved.deviceId]?.mapId){
   for(const input of roomBox.querySelectorAll('input'))input.checked=(command.rooms||[]).includes(Number(input.value));
  }
  visibility();
 }
 device.addEventListener('change',populate);
 action.addEventListener('change',visibility);
 row.querySelector('[data-remove-step]').addEventListener('click',()=>{
  if(steps.children.length>1)row.remove();
 });
 steps.append(row);
}
function readStep(row){
 const field=name=>row.querySelector('[name="'+name+'"]').value;
 const deviceId=field('deviceId'),device=devices.find(d=>d.id===deviceId),action=field('action');
 if(!device||!action)throw Error('Her işlem için etkin bir cihaz ve komut seçin.');
 const command=device.type==='vacuum'?{command:action}:{power:action==='on'};
 if(action==='rooms'){
  command.rooms=[...row.querySelectorAll('[data-automation-rooms] input:checked')].map(input=>Number(input.value));
  if(!command.rooms.length)throw Error('En az bir robot odası seçin.');
  command.mapId=maps[deviceId]?.mapId;
 }
 if(device.type==='climate'&&command.power){
  if(field('mode'))command.mode=field('mode');
  if(field('setpoint'))command.setpoint=Number(field('setpoint'));
 }
 return {deviceId,command};
}
f.trigger.addEventListener('change',triggerFields);
$('#automation-add-step').addEventListener('click',()=>addStep());
function reset(){form.reset();f.id.value='';$('#automation-cancel').hidden=true;steps.replaceChildren();addStep();triggerFields();}
$('#automation-cancel').addEventListener('click',reset);
function edit(rule){
 reset();f.id.value=rule.id;f.name.value=rule.name;f.enabled.checked=rule.enabled;f.trigger.value=rule.trigger.type;
 f.at.value=rule.trigger.at||'20:00';f.offset.value=rule.trigger.offsetMinutes||0;f.source.value=rule.trigger.source||'outdoor';
 f.operator.value=rule.trigger.operator||'above';f.value.value=rule.trigger.value??25;
 steps.replaceChildren();for(const action of rule.actions??[rule.action])addStep(action);
 triggerFields();$('#automation-cancel').hidden=false;form.scrollIntoView({behavior:'smooth'});
}
async function load(){if(window.evUser?.role!=='admin')document.querySelector('.intro p').textContent='Kayıtlı otomasyonları ve çalışma sonuçlarını izle.';const [d,a]=await Promise.all([api('/api/devices'),api('/api/automations')]);devices=d.devices.filter(d=>d.enabled&&d.configured&&['light','plug','climate','vacuum'].includes(d.type));rules=a.rules;maps=Object.fromEntries(await Promise.all(devices.filter(d=>d.type==='vacuum').map(async d=>{try{return [d.id,await api('/api/devices/'+d.id+'/rooms')];}catch{return [d.id,{rooms:[]}];}})));$('#automation-submit').disabled=!devices.length;if(!steps.children.length)addStep();const list=$('#automation-list');list.replaceChildren();for(const r of rules){const card=document.createElement('article');card.append(node('h3',r.name+' · '+(r.enabled?'Etkin':'Kapalı')),node('p',({time:'Saat '+r.trigger.at,dawn:'Aydınlanma',dusk:'Kararma',temperature:'Sıcaklık eşiği'}[r.trigger.type])));
 for(const action of r.actions??[r.action]){
  const target=d.devices.find(device=>device.id===action.deviceId);
  const command=action.command,map=maps[action.deviceId];
  const label=command.command==='rooms'?(map?.mapId===command.mapId?command.rooms.map(id=>map.rooms.find(room=>room.id===id)?.name||'Oda '+id).join(', '):'Haritayı kontrol edin'):({start:'Tüm evi temizle',pause:'Duraklat',dock:'Şarja dön'}[command.command]||(command.power?'Aç':'Kapat'));
  card.append(node('p',(target?.name||'Cihaz bulunamadı')+' · '+label));
 }
 const change=node('button','Düzenle');change.addEventListener('click',()=>edit(r));const toggle=node('button',r.enabled?'Durdur':'Etkinleştir');toggle.addEventListener('click',async()=>{try{await api('/api/automations/update',{...r,enabled:!r.enabled});await load();}catch(e){message(e.message);}});const remove=node('button','Sil');remove.addEventListener('click',async()=>{try{await api('/api/automations/delete',{id:r.id});await load();}catch(e){message(e.message);}});if(window.evUser?.role==='admin'){const actions=document.createElement('div');actions.className='automation-actions';actions.append(change,toggle,remove);card.append(actions);}list.append(card);}if(!rules.length)list.append(node('p','Henüz otomasyon yok.'));const log=$('#automation-log');log.replaceChildren();for(const x of a.log.slice(0,20))log.append(node('p',new Date(x.at).toLocaleString('tr-TR')+' · '+x.name+' · '+x.message));if(!a.log.length)log.append(node('p','Henüz çalıştırma yok.'));}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 try{
  const trigger={type:f.trigger.value};
  if(trigger.type==='time')trigger.at=f.at.value;
  if(['dawn','dusk'].includes(trigger.type))trigger.offsetMinutes=Number(f.offset.value);
  if(trigger.type==='temperature')Object.assign(trigger,{source:f.source.value,operator:f.operator.value,value:Number(f.value.value)});
  const input={id:f.id.value,name:f.name.value,enabled:f.enabled.checked,trigger,actions:[...steps.children].map(readStep)};
  await api(f.id.value?'/api/automations/update':'/api/automations',input);
  steps.replaceChildren();form.reset();f.id.value='';$('#automation-cancel').hidden=true;triggerFields();await load();message('Otomasyon kaydedildi.');
 }catch(error){message(error.message);}
});
triggerFields();load().catch(error=>message(error.message));
