import {watchDevice} from '/device-live.js';
const registry=await fetch('/api/devices').then(r=>r.json());
if(registry.devices.some(d=>d.legacy&&d.type==='climate'&&d.enabled&&d.configured)){
const $=s=>document.querySelector(s),modeNames={cool:'Soğutma',heat:'Isıtma',auto:'Otomatik',dry:'Nem alma',fanOnly:'Yalnız fan',wind:'Fan',fan:'Yalnız fan'};
let current=null,busy=false;
async function api(body){const r=await fetch('/api/climate',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
async function refresh(){if(busy)return;try{current=await api();$('#climate-status').textContent=current.connected?(current.power==='on'?'Açık':'Kapalı')+' · Yerel Wi-Fi':'Bağlantı bekleniyor';if(!current.connected)return;
 $('#indoor-temperature').textContent=current.temperature!==null?current.temperature+'°'+current.unit:'—°C';$('#indoor-note').textContent=current.temperatureAt?'Klimanın ölçümü · '+new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'}).format(new Date(current.temperatureAt)):'Klima sıcaklık ölçümü zamanı bildirmedi.';
 $('#climate-power').disabled=current.power===null;$('#climate-power').textContent=current.power==='on'?'Klimayı kapat':'Klimayı aç';const modes=$('#climate-mode');modes.replaceChildren();for(const mode of current.modes){const option=document.createElement('option');option.value=mode;option.textContent=modeNames[mode]||mode;modes.append(option);}modes.value=current.mode;modes.disabled=!current.modes.length||current.power!=='on';
 const temperature=$('#climate-setpoint');temperature.disabled=!current.range||current.setpoint===null||current.power!=='on';if(current.range){temperature.min=current.range.minimum;temperature.max=current.range.maximum;}temperature.value=current.setpoint??'';$('#climate-note').textContent='Doğrudan yerel Wi-Fi · Anahtar yenileme gerekmez. Mod ve sıcaklık için önce klimayı açın.';
 }catch(e){$('#climate-status').textContent='Bağlantı kurulamadı';$('#climate-note').textContent=e.message;$('#climate-power').disabled=true;$('#climate-mode').disabled=true;$('#climate-setpoint').disabled=true;$('#indoor-note').textContent='Son gösterilen sıcaklık güncel olmayabilir.';}}
async function command(body){if(busy)return;busy=true;$('#climate-power').disabled=true;$('#climate-mode').disabled=true;$('#climate-setpoint').disabled=true;try{const d=await api(body);$('#climate-note').textContent=d.message;}catch(e){$('#climate-note').textContent=e.message;}finally{busy=false;setTimeout(refresh,3000);}}
$('#climate-power').addEventListener('click',()=>command({power:current.power!=='on'}));$('#climate-mode').addEventListener('change',e=>command({mode:e.target.value}));$('#climate-setpoint').addEventListener('change',e=>command({setpoint:Number(e.target.value)}));refresh();watchDevice('climate',()=>{if(!document.activeElement?.closest('#climate-card'))refresh();});

}
