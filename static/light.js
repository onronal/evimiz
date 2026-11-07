import {watchDevice} from '/device-live.js';
const registry=await fetch('/api/devices').then(r=>r.json());
if(registry.devices.some(d=>d.legacy&&d.type==='light'&&d.enabled&&d.configured)){
const $=s=>document.querySelector(s);
function message(t){$('#message').textContent=t;setTimeout(()=>$('#message').textContent='',5000)}
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const value=await r.json();if(!r.ok)throw Error(value.error||'İşlem tamamlanamadı');return value;}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
const lightCard=$('#light-card');
let lightBusy=false;
function renderBulb(dps){
 $('#light-status').textContent=dps['20']?'Açık · Yerel bağlantı':'Kapalı · Yerel bağlantı';
 $('#light-power').textContent=dps['20']?'Işığı kapat':'Işığı aç';$('#light-power').dataset.on=String(dps['20']);
 if(Number.isFinite(dps['22']))$('#light-brightness').value=Math.round(dps['22']/10);
 if(Number.isFinite(dps['23']))$('#light-temperature').value=Math.round(dps['23']/10);
 $('#light-mode').textContent=dps['21']==='white'?'Beyaz ışık modu':dps['21']==='scene'?'Sahne modu · Renk/parlaklık seçimi beyaz moda geçirir':'Renk modu · Renk/parlaklık seçimi beyaz moda geçirir';
}
async function updateBulb(command){if(lightBusy)return;lightBusy=true;const controls=lightCard.querySelectorAll('button,input');controls.forEach(c=>c.disabled=true);try{const result=await api('/api/bulb',command);renderBulb(result.dps);if(command)message('Ampul ayarı uygulandı.');}catch(e){$('#light-status').textContent='Bağlantı kurulamadı';message(e.message);}finally{lightBusy=false;controls.forEach(c=>c.disabled=false);}}
$('#light-power').addEventListener('click',()=>updateBulb({power:$('#light-power').dataset.on!=='true'}));
$('#light-warm').addEventListener('click',()=>updateBulb({temperature:0}));
$('#light-cool').addEventListener('click',()=>updateBulb({temperature:100}));
$('#light-refresh').addEventListener('click',()=>updateBulb());
$('#light-brightness').addEventListener('change',e=>updateBulb({brightness:Number(e.target.value)}));
$('#light-temperature').addEventListener('change',e=>updateBulb({temperature:Number(e.target.value)}));
updateBulb();watchDevice('light',()=>{if(!lightBusy)updateBulb();});

}
