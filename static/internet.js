import {watchDevice} from '/device-live.js';
import {renderInternetGraph} from '/internet-graph.js';
import {renderRemaining} from '/remaining.js';
const $=s=>document.querySelector(s);
async function api(path,body){const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
const format=new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short'});
function render(data){
 renderInternetGraph($('#internet-chart'),data.history);const last=data.history[0];
 $('#internet-status').textContent=data.running?'Ölçülüyor…':!last?'Henüz ölçüm yok':last.error?'Son ölçüm tamamlanamadı':'Son test başarılı';
 $('#internet-down').textContent=last?.downloadMbps!=null?last.downloadMbps+' Mbps':'—';$('#internet-up').textContent=last?.uploadMbps!=null?last.uploadMbps+' Mbps':'—';$('#internet-latency').textContent=last?.latencyMs!=null?last.latencyMs+' ms':'—';
 $('#internet-at').textContent=last?'Son test: '+format.format(new Date(last.at))+(last.error?' · '+last.error:''):'Ölçüm bilgisayardan yapılır; iPhone’un bağlantısını ölçmez.';
 $('#internet-next').textContent=data.enabled&&data.nextAt?'Ölçüm aralığı: '+data.intervalMinutes+' dk · Sonraki test: '+format.format(new Date(data.nextAt)):'Otomatik test kapalı';$('#internet-test').disabled=!data.enabled||data.running;
 const history=$('#internet-history');history.replaceChildren();for(const row of data.history.slice(0,8)){const p=document.createElement('p');p.textContent=format.format(new Date(row.at))+' · ↓ '+(row.downloadMbps??'—')+' / ↑ '+(row.uploadMbps??'—')+' Mbps · '+(row.error?'Eksik ölçüm':row.latencyMs+' ms');history.append(p);}
}
async function refresh(){try{render(await api('/api/internet'));}catch{$('#internet-status').textContent='Sunucuya ulaşılamadı';}}
$('#internet-test')?.addEventListener('click',async()=>{$('#internet-test').disabled=true;$('#internet-status').textContent='Ölçülüyor…';try{await api('/api/internet/test',{});}catch(error){$('#internet-at').textContent=error.message;return;}finally{await refresh();}});
if($('#internet-status')){refresh();setInterval(()=>{if(!document.hidden)refresh()},15000);}
async function vestel(){try{const s=await api('/api/vestel');for(const kind of ['washer','dishwasher']){const d=s.devices.find(d=>d.kind===kind);$('#'+kind+'-state').textContent=d?d.state:'Hesap bağlantısı bekleniyor';$('#'+kind+'-program').textContent=d?d.program:'';renderRemaining($('#'+kind+'-timer'),d?.remainingMinutes,{active:d?.running,completed:d?.completed,stale:!!s.pollError,timer:d?.remainingTimer});$('#'+kind+'-note').textContent=(s.at?'Son okuma: '+format.format(new Date(s.at)):'')+(s.pollError?' · '+s.pollError:' · Dakikada bir okunur');}}catch{for(const kind of ['washer','dishwasher']){$('#'+kind+'-note').textContent='Sunucuya ulaşılamadı; süre güncel olmayabilir.';renderRemaining($('#'+kind+'-timer'),null,{stale:true});}}}
if($('#washer-card')&&(await api('/api/devices')).devices.some(d=>d.legacy&&d.enabled&&d.configured&&['washer','dishwasher'].includes(d.type))){vestel();watchDevice('washer',vestel);watchDevice('dishwasher',vestel);}
async function notifications(){try{const d=await api('/api/notifications');if($('#internet-quality'))$('#internet-quality').textContent=d.quality.reason;const list=$('#notification-list');list.replaceChildren();for(const n of d.notifications.slice(0,12)){const p=document.createElement('p');p.textContent=(n.at?format.format(new Date(n.at))+' · ':'')+n.text;list.append(p);}if(!d.notifications.length)list.textContent='Yeni cihaz çalışmaları burada görünecek.';}catch{}}
if($('#notification-list')){notifications();setInterval(()=>{if(!document.hidden)notifications()},15000);}
