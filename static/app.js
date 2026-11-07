const $=s=>document.querySelector(s),names={washer:'Çamaşır makinesi',dishwasher:'Bulaşık makinesi',vacuum:'Robot süpürge',fryer:'Airfryer'};
let currentSettings;
const dt=new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short'});
$('#date').textContent=new Intl.DateTimeFormat('tr-TR',{dateStyle:'full'}).format(new Date());
function message(t){$('#message').textContent=t;setTimeout(()=>$('#message').textContent='',5000)}
async function api(path,data){const r=await fetch(path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});const value=await r.json();if(!r.ok)throw Error(value.error||'İşlem tamamlanamadı');return value;}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
async function refresh(){const s=await api('/api/state');currentSettings=s.settings;$('#home-title').textContent=s.settings.home;document.title=s.settings.home+' · Ev paneli';const cleaning=s.events.filter(e=>['washer','dishwasher','vacuum'].includes(e.device));$('#event-count').textContent=cleaning.length+' kayıt';const events=$('#events');events.replaceChildren();const sorted=[...cleaning].sort((a,b)=>b.at.localeCompare(a.at));for(const e of sorted.slice(0,30)){const row=node('div','', 'event');row.append(node('div',names[e.device]+(e.kind==='started'?' · Çalıştırıldı':' · Tamamlandı')),node('span',dt.format(new Date(e.at))+(e.source==='vestel_recovered'?' · Eksik kayıt tamamlandı; gerçek bitiş saati bilinmiyor':e.source==='vestel'?' · Vestel (gözlem saati)':e.source==='xiaomi'?' · Xiaomi (gözlem saati)':' · Manuel')));events.append(row);}if(!cleaning.length)events.append(node('p','Henüz kayıt yok. İlk tamamlanmadan sonra kullanım takibi başlayacak.','empty'));const alerts=$('#alerts');alerts.replaceChildren();for(const a of s.alerts)alerts.append(node('div',names[a.device]+' için '+a.days+' gündür çalıştırma kaydı alınmadı.','alert'));if(!s.alerts.length)alerts.append(node('p',s.events.length?'Kayıtlı geçmişe göre bekleyen hatırlatma yok.':'Kullanım geçmişi henüz bilinmiyor. İlk kayıt gelene kadar süre uyarısı oluşturulmaz.','empty'));}

$('#event-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const f=e.target.elements;await api('/api/events',{device:f.device.value,kind:'completed',at:new Date(f.at.value).toISOString(),eventId:crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("")});await refresh();message('Manuel tamamlanma kaydı eklendi.')}catch(e){message(e.message)}finally{button.disabled=false}});
const now=new Date();now.setMinutes(now.getMinutes()-now.getTimezoneOffset());$('#event-form').elements.at.value=now.toISOString().slice(0,16);
let weatherRequest=0;
function weatherLabel(c){if(c===0)return 'Açık';if(c<=3)return 'Parçalı bulutlu';if(c<=48)return 'Sisli';if(c<=67)return 'Yağmurlu';if(c<=77)return 'Kar yağışlı';if(c<=82)return 'Sağanak yağışlı';if(c<=86)return 'Kar sağanağı';if(c>=95)return 'Gök gürültülü';return 'Hava durumu';}
async function loadEnvironment(){
 const request=++weatherRequest;const w=$('#weather-card'),sun=$('#sun-card');w.replaceChildren(node('span','DIŞARIDA BUGÜN','eyebrow'),node('p','Hava durumu yükleniyor…'));sun.replaceChildren(node('span','GÜNÜN SON IŞIĞI','eyebrow'),node('p','Güneş saatleri yükleniyor…'));
 try{const data=await api('/api/environment');if(request!==weatherRequest)return;
  if(data.needsConsent||data.needsLocation){const text=data.needsConsent?'Ev ayarlarından konum paylaşımını açın.':'Ev ayarlarından bulunan konumu seçin.';w.replaceChildren(node('h3','Konum bağlantısı bekleniyor'),node('p',text));sun.replaceChildren(node('h3','Hava kararma saati'),node('p',text));return;}
  w.replaceChildren(node('span','DIŞARIDA BUGÜN','eyebrow'),node('div',data.weather?Math.round(data.weather.temperature_2m)+'°C':'—°C','metric'),node('h3',data.weather?weatherLabel(data.weather.weather_code):'Hava durumu alınamadı'),node('p',data.place.label),node('p',data.weather?'Hissedilen '+Math.round(data.weather.apparent_temperature)+'°C · '+new Intl.DateTimeFormat('tr-TR',{timeZone:data.place.timezone,timeStyle:'short'}).format(new Date(data.updatedAt)):'Biraz sonra yeniden denenecek.'));
  const time=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('tr-TR',{timeZone:data.place.timezone,hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
  sun.replaceChildren(node('span','GÜNÜN IŞIK SAATLERİ','eyebrow'));
  const phases=node('div','','sun-phases');
  for(const [label,value,detail] of [['Aydınlanma',data.sun?.dawn,'Gün doğumu '+time(data.sun?.sunrise)],['Kararma',data.sun?.dusk,'Gün batımı '+time(data.sun?.sunset)]]){
   const phase=node('div','','sun-phase');phase.append(node('h3',label),node('div',time(value),'metric'),node('p',data.sun?detail:'Güneş saatleri alınamadı.'));phases.append(phase);
  }
  sun.append(phases,node('p','Sivil alacakaranlık başlangıcı / bitişi · '+data.place.timezone));
  const source=node('a','Hava: Open-Meteo');source.href='https://open-meteo.com/';w.append(source);const sunSource=node('a','Sun data by Sunrise-Sunset.org');sunSource.href='https://sunrise-sunset.org/';sun.append(sunSource);
 }catch(e){if(request!==weatherRequest)return;w.replaceChildren(node('h3','Hava durumu alınamadı'),node('p',e.message));sun.replaceChildren(node('h3','Güneş saatleri alınamadı'),node('p','Bağlantı kurulunca tekrar denenecek.'));}
}
refresh().then(loadEnvironment).catch(e=>message('Panel verileri alınamadı: '+e.message));
setInterval(loadEnvironment,600000);
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
updateBulb();setInterval(()=>{if(!document.hidden)updateBulb()},30000);
setInterval(()=>{if(!document.hidden&&!document.activeElement?.closest('form'))refresh().catch(()=>{});},60000);
