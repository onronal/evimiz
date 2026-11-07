import {createJoystick} from '/tv-joystick.js';
import {watchDevice} from '/device-live.js';
import {renderRemaining} from '/remaining.js';
const make=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
let devices=[],layout={rooms:[],assignments:{}};
const grid=document.querySelector('.devices'),filter=document.querySelector('#device-room-filter');
function applyFilter(){const value=filter.value;let count=0;for(const card of grid.querySelectorAll('[data-device-id]')){const room=layout.assignments[card.dataset.deviceId]||'unassigned';const show=value==='all'||room===value;card.classList.toggle('filter-hidden',!show);if(show&&!card.hidden)count++;}document.querySelector('#device-filter-count').textContent=count+' cihaz gösteriliyor';const url=new URL(location.href);if(value==='all')url.searchParams.delete('room');else url.searchParams.set('room',value);history.replaceState(null,'',url);}
function showFilteredDevices(){
 applyFilter();
 filter.closest('.room-results').classList.add('room-results-scrolled');
 filter.scrollIntoView({
  block:'start',
  behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'
 });
}
async function request(d,action,input){const r=await fetch('/api/devices/'+d.id+'/'+action,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
function addFullScreen(card,name){
 const dialog=document.createElement('dialog'),button=make('button','⛶ Tam ekran');
 dialog.className='device-fullscreen';
 dialog.setAttribute('aria-label',name+' tam ekran');
 button.className='device-fullscreen-toggle';
 button.setAttribute('aria-haspopup','dialog');
 card.append(button);
 button.addEventListener('click',()=>{
  if(dialog.open){dialog.close();return;}
  if(dialog.isConnected)return;
  card.after(dialog);
  if(dialog.moveBefore)dialog.moveBefore(card,null);
  else dialog.append(card);
  button.textContent='×';
  button.setAttribute('aria-label','Tam ekrandan çık');
  dialog.showModal();
  button.focus();
 });
 dialog.addEventListener('close',()=>{
  if(dialog.parentNode.moveBefore)dialog.parentNode.moveBefore(card,dialog);
  else dialog.before(card);
  dialog.remove();
  button.textContent='⛶ Tam ekran';
  button.removeAttribute('aria-label');
  button.focus({preventScroll:true});
 });
}
function instanceCard(d,spec){const card=document.createElement('article');card.dataset.deviceId=d.id;card.append(make('h3',d.name));const badge=make('span',layout.rooms.find(r=>r.id===layout.assignments[d.id])?.name||'Oda atanmamış');badge.className='room-badge';card.append(badge);const status=make('p',d.configured?'Durum okunuyor…':'Bağlantı kurulumu bekleniyor.');card.append(status);if(!d.configured){card.append(make('p',spec.instructions));const a=make('a','Bağlantıyı yönet');a.href='/admin#device-management';a.className='button';a.dataset.adminOnly='';card.append(a);return card;}
 if(d.type==='tv'||d.type==='camera')addFullScreen(card,d.name);
 const timerEl=['washer','dishwasher','fryer'].includes(d.type)?make('div',''):null;if(timerEl)card.append(timerEl);
 const controls=[];let last,reading=false,commandBusy=false;const updateTime=d.type==='tv'?make('small','TV değişiklikleri canlı iletilir.'):null;if(updateTime){updateTime.dataset.tvUpdate='';card.append(updateTime);}
 const addButton=(text,fn)=>{const b=make('button',text);b.disabled=true;b.addEventListener('click',()=>command(fn()));controls.push(b);card.append(b);return b;};
 function tvVisibility(){if(d.type!=='tv')return;const on=last?.power==='on';for(const el of card.querySelectorAll('[data-tv-online]')){el.hidden=!on;if(!on&&el.tagName==='DETAILS')el.open=false;}for(const el of card.querySelectorAll('[data-tv-wake]'))el.hidden=on;const external=last?.soundOutput&&last.soundOutput!=='tv_speaker';for(const el of card.querySelectorAll('[data-tv-absolute-volume]'))el.hidden=!on||!!external;const out=card.querySelector('[data-tv-audio-note]');if(out)out.textContent=external?'Harici ses çıkışı · Ses + / Ses − TV üzerinden iletilir; soundbar desteğine bağlıdır.':'Ses çıkışı: '+(last?.soundOutput==='tv_speaker'?'TV hoparlörü':'Henüz doğrulanamadı');}
 async function read(){if(reading)return;reading=true;try{last=await request(d,'status');if(d.type==='light')status.textContent=last.dps?.['20']?'Açık':'Kapalı';else if(d.type==='tv')status.textContent=(last.state||'Güç durumu bilinmiyor')+' · Ses '+(last.volume??'—')+(last.muted===true?' · Sessiz':'');else if(d.type==='climate')status.textContent=(last.power==='on'?'Açık':'Kapalı')+' · '+(last.temperature??'—')+'°C';else status.textContent=(last.state||'Durum alındı')+(timerEl?'':last.remainingTime!=null?' · Kalan '+last.remainingTime+' dk':last.remainingMinutes!=null?' · Kalan '+last.remainingMinutes+' dk':'');if(timerEl)renderRemaining(timerEl,last.remainingMinutes??last.remainingTime,{active:last.running,completed:last.completed,timer:last.remainingTimer});if(updateTime&&last?.at)updateTime.textContent='Son okuma: '+new Date(last.at).toLocaleTimeString('tr-TR')+' · Paylaşılan durum';if(!commandBusy)controls.forEach(b=>b.disabled=b.hasAttribute('data-requires-apps')&&!b.dataset.appsReady);tvVisibility();}catch(e){if(d.type==='tv')last=null;tvVisibility();status.textContent=e.message;if(timerEl)renderRemaining(timerEl,null,{stale:true});if(!commandBusy)controls.forEach(b=>b.disabled=!b.hasAttribute('data-wake'));}finally{reading=false;}}
 async function command(input){if(commandBusy)return;commandBusy=true;controls.forEach(b=>b.disabled=true);let error;try{await request(d,'commands',input);}catch(e){error=e.message;}finally{commandBusy=false;await read();if(error)status.textContent=error;}}

 if(d.type==='camera'){const start=make('button','Canlı görüntüyü aç'),stop=make('button','Görüntüyü kapat'),view=document.createElement('img'),note=make('p','Yalnız görüntü açılınca kameraya bağlanılır. Ses ve kayıt yok.');const directions=make('div',''),directionStatus=make('p','');
 directions.hidden=true;
 directionStatus.setAttribute('role','status');
 let viewing=false,moving=false;
 const joystick=createJoystick({
  label:'Kamera yönü · analog kola yön verin',
  ready:()=>viewing,
  stopMovement:()=>{},
  async move(x,y){
   if(moving||!viewing)return;
   const direction=Math.abs(x)>=Math.abs(y)?(x<0?'left':'right'):(y<0?'up':'down');
   moving=true;
   directionStatus.textContent='Yön komutu gönderiliyor…';
   try{await request(d,'camera-move',{direction});if(viewing)directionStatus.textContent='Kamera komutu kabul etti.';}
   catch(error){joystick.stop();if(viewing)directionStatus.textContent=error.message;}
   finally{moving=false;}
  }
 });
 directions.className='camera-directions';
 directions.append(joystick.element,directionStatus);
 stop.hidden=true;view.hidden=true;view.className='camera-view';view.alt='Kameranın canlı görüntüsü';function end(){viewing=false;joystick.stop();directions.hidden=true;directionStatus.textContent='';view.removeAttribute('src');view.hidden=true;start.hidden=false;stop.hidden=true;note.textContent='Görüntü kapalı; kamera bağlantısı bırakıldı.';}start.addEventListener('click',()=>{if(window.evUser?.role!=='admin'){note.textContent='Kamera görüntüsü yalnız yöneticiye açık.';return;}viewing=true;start.hidden=true;stop.hidden=false;view.hidden=false;directions.hidden=false;note.textContent='Kameraya bağlanılıyor…';view.src='/api/devices/'+d.id+'/camera-stream';});view.addEventListener('load',()=>{if(viewing)note.textContent='Canlı görüntü · düşük çözünürlük · kayıt yok';});view.addEventListener('error',()=>{if(viewing){end();note.textContent='Görüntü açılamadı. Kamera hesabı, IP ve sunucudaki FFmpeg kurulumunu kontrol edin.';}});stop.addEventListener('click',end);document.addEventListener('visibilitychange',()=>{if(document.hidden&&viewing)end();});window.addEventListener('pagehide',end);card.append(start,stop,view,note,directions);}
 if(d.type==='tv'){card.classList.add('tv-card');const wake=addButton('TV’yi aç',()=>({power:true}));wake.dataset.wake='';wake.dataset.tvWake='';addButton('TV’yi kapat',()=>({power:false}));addButton('Sessiz / sesi aç',()=>({mute:!last?.muted}));const label=make('label','Ses (0–100)'),volume=document.createElement('input');volume.type='number';volume.min=0;volume.max=100;volume.value=10;volume.setAttribute('aria-label',d.name+' ses düzeyi');label.append(volume);label.dataset.tvAbsoluteVolume='';card.append(label);const applyVolume=addButton('Sesi uygula',()=>({volume:Number(volume.value)}));applyVolume.classList.add('tv-volume-apply');applyVolume.dataset.tvAbsoluteVolume='';addButton('Ses −',()=>({volumeStep:'down'}));addButton('Ses +',()=>({volumeStep:'up'}));const audioNote=make('p','Ses çıkışı okunuyor…');audioNote.dataset.tvAudioNote='';card.append(audioNote);addButton('Oynat',()=>({media:'play'}));addButton('Duraklat',()=>({media:'pause'}));card.append(make('p','Açık uygulamanın oynatıcısını kontrol eder; destek uygulamaya göre değişebilir.'));
 const remote=document.createElement('details');
 remote.append(make('summary','İmleç ve kumanda'));
 const pointerNote=make('p','İmleci taşımak için analog kola yön verin.');
 pointerNote.setAttribute('role','status');
 const sensitivityLabel=make('label','İmleç hassasiyeti'),sensitivity=document.createElement('input');
 sensitivity.type='range';sensitivity.min='0.5';sensitivity.max='2.5';sensitivity.step='0.1';sensitivity.value='1.2';
 sensitivityLabel.append(sensitivity);
 let dx=0,dy=0,scheduled=false,busy=false,lastSent=0;
 const joystick=createJoystick({ready:()=>last?.connected&&last.power==='on'&&remote.open,move:(x,y)=>{dx=Math.max(-160,Math.min(160,dx+x));dy=Math.max(-160,Math.min(160,dy+y));schedule();},stopMovement:()=>{dx=dy=0;},sensitivity:()=>Number(sensitivity.value)});
 const clickButton=addButton('Tıkla',()=>({pointer:{action:'click'}}));
 remote.append(joystick.element,pointerNote,sensitivityLabel,clickButton);
 async function pointer(input){try{const result=await request(d,'commands',input);pointerNote.textContent=result.message||'İmleç komutu gönderildi.';}catch(e){pointerNote.textContent=e.message;dx=dy=0;}}
 async function flush(){scheduled=false;if(busy)return;const x=Math.max(-80,Math.min(80,Math.round(dx))),y=Math.max(-80,Math.min(80,Math.round(dy)));if(!x&&!y)return;dx-=x;dy-=y;busy=true;lastSent=performance.now();await pointer({pointer:{action:'move',dx:x,dy:y}});busy=false;if(Math.abs(dx)>=.5||Math.abs(dy)>=.5)schedule();}
 function schedule(){if(!scheduled&&!busy){scheduled=true;setTimeout(flush,Math.max(0,32-(performance.now()-lastSent)));}}
 remote.addEventListener('toggle',()=>{if(!remote.open)joystick.stop();if(remote.open&&last?.connected)pointer({pointer:{action:'prepare'}});});
 const keys=make('div','');keys.className='tv-remote-keys';for(const [key,title]of [['HOME','Ana ekran'],['BACK','Geri'],['ENTER','Tamam'],['LEFT','←'],['UP','↑'],['DOWN','↓'],['RIGHT','→']]){const b=addButton(title,()=>({remoteKey:key}));b.setAttribute('aria-label',d.name+' '+title);keys.append(b);}remote.append(keys);card.append(remote);
 const keyboard=document.createElement('details');keyboard.append(make('summary','Klavye / Arama'));const form=document.createElement('form'),textLabel=make('label','TV’ye gönderilecek metin'),text=document.createElement('input');text.type='text';text.maxLength=500;text.autocomplete='off';text.autocapitalize='off';text.spellcheck=false;text.setAttribute('aria-label',d.name+' arama metni');textLabel.append(text);const replaceLabel=make('label','TV’deki mevcut metni değiştir'),replace=document.createElement('input');replace.type='checkbox';replaceLabel.className='consent';replaceLabel.prepend(replace);const submit=make('button','Metni gönder');submit.type='submit';const note=make('p','Önce TV’de arama veya metin alanını seçin. Destek uygulamaya bağlıdır.');form.append(textLabel,replaceLabel,submit);form.addEventListener('submit',async e=>{e.preventDefault();if(!text.value.trim())return;submit.disabled=true;try{await request(d,'commands',{text:{value:text.value,replace:replace.checked}});note.textContent='Metin komutu gönderildi. Aramayı çalıştırmak için Enter kullanabilirsiniz.';text.value='';}catch(e){note.textContent=e.message;}finally{submit.disabled=false;}});keyboard.append(form,note);const keyboardActions=make('div','');keyboardActions.className='tv-keyboard-actions';for(const [key,label]of [['enter','Ara / Enter'],['backspace','Son karakteri sil']]){const b=addButton(label,()=>({keyboard:key}));keyboardActions.append(b);}keyboard.append(keyboardActions);card.append(keyboard);
 const appsDetails=document.createElement('details');appsDetails.append(make('summary','Uygulamalar'));const appSelect=document.createElement('select');appSelect.setAttribute('aria-label',d.name+' uygulaması');const load=make('button','Uygulamaları yükle'),launch=addButton('Seçili uygulamayı aç',()=>({launchApp:appSelect.value})),appNote=make('p','Liste yalnız istediğinizde TV’den okunur.');appsDetails.className='tv-apps';const appActions=make('div','');appActions.className='tv-app-actions';appActions.append(load,launch);appsDetails.append(appSelect,appActions,appNote);card.append(appsDetails);launch.dataset.requiresApps='';launch.dataset.appsReady='';load.addEventListener('click',async()=>{load.disabled=true;try{const result=await request(d,'apps');appSelect.replaceChildren();for(const app of result.apps){const o=make('option',app.title);o.value=app.id;appSelect.append(o);}launch.dataset.appsReady=result.apps.length?'1':'';launch.disabled=!last?.connected||!result.apps.length;appNote.textContent=result.apps.length+' uygulama.';}catch(e){appNote.textContent=e.message;}finally{load.disabled=false;}});
 }
 if(d.type==='light'){addButton('Aç / kapat',()=>({power:!last?.dps?.['20']}));addButton('Sarı',()=>({temperature:0}));addButton('Beyaz',()=>({temperature:100}));}
 if(d.type==='vacuum')for(const [command,label]of [['start','Temizliği başlat'],['pause','Duraklat'],['dock','Şarja dön']])addButton(label,()=>({command}));
 if(d.type==='climate'){addButton('Aç / kapat',()=>({power:last?.power!=='on'}));const mode=document.createElement('select');mode.setAttribute('aria-label',d.name+' modu');for(const [key,name]of [['cool','Soğutma'],['heat','Isıtma'],['auto','Otomatik'],['dry','Nem alma'],['fan','Fan']]){const o=make('option',name);o.value=key;mode.append(o);}card.append(mode);addButton('Modu uygula',()=>({mode:mode.value}));const temp=document.createElement('input');temp.type='number';temp.min=16;temp.max=30;temp.value=24;temp.setAttribute('aria-label',d.name+' hedef sıcaklık');card.append(temp);addButton('Sıcaklığı uygula',()=>({setpoint:Number(temp.value)}));}
 const refresh=make('button','Durumu yenile');refresh.addEventListener('click',read);card.append(refresh);if(d.type==='tv'){for(const el of [...card.children])if(el!==refresh&&el!==status&&!el.classList.contains('device-fullscreen-toggle')&&!el.hasAttribute('data-tv-wake')&&['BUTTON','DETAILS','LABEL','P'].includes(el.tagName))el.dataset.tvOnline='';tvVisibility();}read();watchDevice(d.id,read);return card;}
async function renderDevices(){const [response,stateResponse]=await Promise.all([fetch('/api/devices'),fetch('/api/state?summary=1')]);if(!response.ok||!stateResponse.ok)throw Error('Cihaz kayıtları alınamadı.');const data=await response.json(),state=await stateResponse.json();devices=data.devices;layout=state.settings.layout;for(const spec of data.catalog){const card=document.querySelector('#'+spec.id+'-card');if(!card)continue;const d=devices.find(d=>d.legacy&&d.type===spec.id);card.hidden=!d?.enabled||!d.configured;if(d){card.dataset.deviceId=d.id;card.querySelector('h3').textContent=d.name;const badge=make('span',layout.rooms.find(r=>r.id===layout.assignments[d.id])?.name||'Oda atanmamış');badge.className='room-badge';card.querySelector('h3').after(badge);}}
 for(const d of devices.filter(d=>d.enabled&&!d.legacy))grid.append(instanceCard(d,data.catalog.find(c=>c.id===d.type)));
 for(const room of [...layout.rooms,{id:'unassigned',name:'Oda atanmamış'}]){const o=make('option',room.name);o.value=room.id;filter.append(o);}const selected=new URLSearchParams(location.search).get('room');if([...filter.options].some(o=>o.value===selected))filter.value=selected;
 const ranks=new Map((layout.deviceOrder||[]).map((id,i)=>[id,i])),roomRanks=new Map(layout.rooms.map((r,i)=>[r.id,i]));const ordered=[...devices].sort((a,b)=>(roomRanks.get(layout.assignments[a.id])??10000)-(roomRanks.get(layout.assignments[b.id])??10000)||(ranks.get(a.id)??10000)-(ranks.get(b.id)??10000));for(const d of ordered){const card=[...grid.children].find(c=>c.dataset.deviceId===d.id);if(card)grid.append(card);}devices=ordered;
 const roomList=document.querySelector('#home-room-list');roomList.replaceChildren();for(const room of layout.rooms){const card=document.createElement('article');card.append(make('h3',room.name),make('p',devices.filter(d=>d.enabled&&layout.assignments[d.id]===room.id).map(d=>d.name).join(' · ')||'Henüz cihaz atanmamış'));const button=make('button','Bu odanın cihazları');button.addEventListener('click',()=>{filter.value=room.id;showFilteredDevices();});card.append(button);roomList.append(card);}if(!layout.rooms.length)roomList.append(make('p','Henüz oda eklenmedi.'));filter.addEventListener('change',showFilteredDevices);applyFilter();}
renderDevices().catch(e=>grid.prepend(make('p',e.message)));
