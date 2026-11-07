import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,alerts,validateEvent} from '../model.mjs';
import {decodeVestel,trackCompletion} from '../vestel-state.mjs';
import {decodeClimate} from '../smartthings.mjs';
test('Klima ölçülen ve hedef sıcaklığı ayırır; eksik veri uydurulmaz',()=>{
 const decoded=decodeClimate({components:{main:{switch:{switch:{value:'off'}},temperatureMeasurement:{temperature:{value:23,unit:'C',timestamp:'2026-01-01T00:00:00Z'}},thermostatCoolingSetpoint:{coolingSetpoint:{value:26}},airConditionerMode:{supportedAcModes:{value:['cool','heat']}}}}},{name:'Klima'});
 assert.equal(decoded.temperature,23);assert.equal(decoded.setpoint,26);assert.equal(decoded.range,null);assert.deepEqual(decoded.modes,['cool','heat']);assert.equal(decodeClimate({}).temperature,null);
});
test('Vestel şeması yürütme durumunu çözer; aşama bilgisi çalışıyor anlamına gelmez',()=>{
 const device={name:'Yıkayıcı',type:'WD',status:{WDDCPST:'00000',WDMCHST:'00011'},discovery:{status:[{commandName:'WDDCPST',key:'LaundryCare.WasherDryer.Status.ExecutionState',values:[{commandValue:0,value:'ExecutionState.Selection'}]}]}};
 assert.equal(decodeVestel(device).running,false);assert.equal(decodeVestel(device).state,'Program seçimi');
});
test('İlk gözlenen tamamlanma geçmiş kayıt üretmez',()=>assert.equal(trackCompletion(null,{kind:'washer',completed:true,stateKey:'EndMode'},'2026-01-01T00:00:00Z').event,null));
test('Gözlenen çalışma sonrası bitiş tek kayıt üretir',()=>{
 const first=trackCompletion(null,{kind:'washer',running:true},'2026-01-01T00:00:00Z');
 const end=trackCompletion(first.next,{kind:'washer',completed:true,program:'Eco'},'2026-01-01T00:01:00Z');
 assert.equal(end.event.source,'vestel');assert.equal(end.event.observedStartedAt,'2026-01-01T00:00:00Z');
 assert.equal(trackCompletion(end.next,{kind:'washer',completed:true},'2026-01-01T00:02:00Z').event,null);
});
test('Kesintiden sonraki bitiş kaydedilir; iptal tek başına kayıt üretmez',()=>{
 const previous={at:'2026-01-01T00:00:00Z',active:true,startedAt:'2026-01-01T00:00:00Z'};
 assert.equal(trackCompletion(previous,{kind:'dishwasher',completed:true},'2026-01-01T00:10:00Z').event.observationGapMinutes,10);
 const cancel=trackCompletion(previous,{kind:'dishwasher',stateKey:'PreProgram'},'2026-01-01T00:01:00Z');
 assert.equal(cancel.event,null);assert.equal(cancel.next.active,false);
});
test('Geçmiş bilinmiyorsa uyarı çıkmaz',()=>assert.deepEqual(alerts(defaults,[]),[]));
test('Eşik son tamamlanma üzerinden hesaplanır',()=>{
 const events=[{device:'washer',kind:'completed',at:'2026-01-01T00:00:00.000Z'},{device:'washer',kind:'completed',at:'2026-01-05T00:00:00.000Z'}];
 assert.deepEqual(alerts(defaults,events,Date.parse('2026-01-11T23:59:00Z')),[]);
 assert.deepEqual(alerts(defaults,events,Date.parse('2026-01-12T00:00:00Z')),[{device:'washer',days:7}]);
});
test('Cihaz ve gelecek tarih doğrulanır',()=>{
 assert.throws(()=>validateEvent({device:'ac'}));
 assert.throws(()=>validateEvent({device:'washer',kind:'completed',eventId:'a',at:'2999-01-01'}));
 assert.equal(validateEvent({device:'washer',kind:'completed',eventId:'a',at:'2025-01-01'}).source,'manual');
});

test('Başlangıç kaçırılsa da bilinen durumdan bitişe geçiş kaydedilir',()=>{const result=trackCompletion({at:'2026-01-01T00:00:00Z',stateKey:'PreProgram',active:false},{kind:'dishwasher',completed:true,stateKey:'End'},'2026-01-01T02:00:00Z');assert.equal(result.event.device,'dishwasher');assert.equal(result.event.observedStartedAt,null);assert.equal(trackCompletion(result.next,{kind:'dishwasher',completed:true,stateKey:'End'},'2026-01-01T03:00:00Z').event,null);});
import {formatRemaining} from '../static/remaining.js';
test('Kalan süre saat dakika biçiminde gösterilir',()=>{assert.equal(formatRemaining(125),'02:05');assert.equal(formatRemaining(0),'00:00');assert.equal(formatRemaining(null),'—:—');assert.equal(formatRemaining(-1),'—:—');});
import {activityTransition,internetQuality} from '../activity.mjs';
test('Çalıştırma hemen sayılır, yinelenmez; duraklatma tamamlanma değildir',()=>{const a=activityTransition(null,{running:true},'2026-01-01','washer');assert.equal(a.events[0].kind,'started');assert.equal(activityTransition(a.next,{running:true},'2026-01-02','washer').events.length,0);assert.equal(activityTransition(a.next,{running:false},'2026-01-02','washer').events.length,0);assert.equal(activityTransition(a.next,{completed:true},'2026-01-02','washer').events[0].kind,'completed');});
test('Robot şarjı bitiş sayılmaz; sayaç artışı sayılır',()=>{const a={running:true,completed:false,totalCycles:10};assert.equal(activityTransition(a,{totalCycles:10},'2026-01-01','vacuum').events.length,0);assert.equal(activityTransition(a,{totalCycles:11},'2026-01-01','vacuum').events[0].kind,'completed');});
test('Hatırlatma son başlatmadan hesaplanır',()=>{assert.deepEqual(alerts(defaults,[{device:'washer',kind:'started',at:'2026-01-10T00:00:00Z'},{device:'washer',kind:'completed',at:'2026-01-11T00:00:00Z'}],Date.parse('2026-01-17T00:00:00Z')),[{device:'washer',days:7}]);});
test('İnternet ilk kötü veya başarısız ölçümde alarm üretir; iyi ölçümde temizlenir',()=>{const good={downloadMbps:100,uploadMbps:20,latencyMs:40};const slow={downloadMbps:2,uploadMbps:.5,latencyMs:600};assert.equal(internetQuality([slow,good]).bad,true);assert.equal(internetQuality([slow,slow]).bad,true);assert.equal(internetQuality([slow]).bad,true);assert.equal(internetQuality([{error:'offline'}]).bad,true);assert.equal(internetQuality([good,slow]).bad,false);assert.equal(internetQuality([]).bad,false);assert.equal(internetQuality([{error:'offline'},{error:'offline'}]).bad,true);});

test('Duraklatıp sürdürmek ikinci yıkama sayılmaz',()=>{const a=activityTransition(null,{running:true},'a','washer');const p=activityTransition(a.next,{running:false},'b','washer');assert.equal(activityTransition(p.next,{running:true},'c','washer').events.length,0);});
import {validateLayout,validateInternetInterval} from '../layout.mjs';
test('Oda eşleştirmeleri yalnız mevcut odalara ve cihazlara yapılır',()=>{const valid={rooms:[{id:'room-salon',name:'Salon'}],assignments:{vacuum:'room-salon',washer:null}};assert.deepEqual(validateLayout(valid),valid);assert.throws(()=>validateLayout({...valid,assignments:{vacuum:'room-yok'}}));assert.throws(()=>validateLayout({...valid,rooms:[...valid.rooms,{id:'room-other',name:'salon'}]}));assert.throws(()=>validateLayout({...valid,assignments:{unknown:'room-salon'}}));});
test('İnternet aralığı izin verilen değerlerden seçilir',()=>{assert.equal(validateInternetInterval(60),60);assert.throws(()=>validateInternetInterval(0));assert.throws(()=>validateInternetInterval('15'));});
test('Robot temizliği de kullanılmama hatırlatmasına dahildir',()=>{assert.deepEqual(alerts(defaults,[{device:'vacuum',kind:'started',at:'2026-01-01T00:00:00Z'}],Date.parse('2026-01-04T00:00:00Z')),[{device:'vacuum',days:3}]);assert.equal(validateEvent({device:'vacuum',kind:'completed',eventId:'robot-manual',at:'2025-01-01'}).device,'vacuum');});
import {validateDevice} from '../devices.mjs';
test('Cihaz kaydı desteklenen adaptör ve geçerli oda gerektirir',()=>{const rooms=[{id:'room-salon',name:'Salon'}];assert.equal(validateDevice({type:'vacuum',name:' Marcel ',roomId:'room-salon'},[],rooms).name,'Marcel');assert.throws(()=>validateDevice({type:'unknown',name:'TV'},[],rooms));assert.match(validateDevice({type:'vacuum',name:'Robot'},[{id:'vacuum'}],rooms).id,/^device-/);assert.throws(()=>validateDevice({type:'light',name:'Işık',roomId:'room-yok'},[],rooms));assert.throws(()=>validateDevice({type:'light',name:'   '},[],rooms));});
import {createAuth,authorize} from '../auth.mjs';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {validateConnection} from '../device-engine.mjs';
test('Aynı türden cihazlar ayrı kimlik ve ayrı oda atamaları alır',()=>{const a=validateDevice({type:'light',name:'Bir'},[],[]),b=validateDevice({type:'light',name:'İki'},[a],[]);assert.notEqual(a.id,b.id);const result=validateLayout({rooms:[{id:'room-salon',name:'Salon'}],assignments:{[a.id]:'room-salon',[b.id]:null}},[a,b]);assert.equal(result.assignments[a.id],'room-salon');assert.equal(a.legacy,false);});
test('Yeni bağlantı yalnız doğrulanan özel IP ve adaptör alanlarını saklar',()=>{const d={adapter:'tuya-local'};const good={ip:'192.168.0.30',deviceId:'abcdef123456',localKey:'0123456789abcdef',version:'3.3',unexpected:'ignore'};const c=validateConnection(d,good);assert.equal(c.key,good.localKey);assert.equal(c.unexpected,undefined);assert.throws(()=>validateConnection(d,{...good,ip:'8.8.8.8'}));assert.throws(()=>validateConnection(d,{...good,localKey:'bad'}));assert.throws(()=>validateConnection({...d,legacy:true},good));});
test('Yönetici, üye, güvenli parola ve oturum iptali',async()=>{const directory=await mkdtemp(tmpdir()+'/ev-auth-test-');try{const a=createAuth(pathToFileURL(directory+'/'));assert.equal(await a.needsSetup(),true);await assert.rejects(a.setup({username:'admin',password:'short'}));const admin=await a.setup({username:'admin',password:'test-only-long-password'});await assert.rejects(a.setup({username:'other',password:'another-test-password'}));const member=await a.create({username:'member',password:'test-member-long-password',role:'member'});const login=await a.login({username:'member',password:'test-member-long-password'},'test');const session=await a.session('ev_session='+login.token);assert.equal(session.user.id,member.id);assert.equal(authorize(session.user.role,true),false);assert.equal(authorize(session.user.role,false),true);assert.equal(authorize('admin',true),true);assert.equal(authorize(undefined),false);const stored=await readFile(directory+'/users.json','utf8');assert.equal(stored.includes('test-only-long-password'),false);assert.equal(JSON.stringify(await a.list()).includes('hash'),false);await a.update({id:member.id,role:'member',enabled:false});assert.equal(await a.session('ev_session='+login.token),null);await assert.rejects(a.update({id:admin.id,role:'member',enabled:true}));await assert.rejects(a.login({username:'member',password:'test-member-long-password'},'test'));}finally{await rm(directory,{recursive:true,force:true});}});
test('Bootstrap admin/admin ilk oturumda parola değişimi ister',async()=>{const directory=await mkdtemp(tmpdir()+'/ev-bootstrap-test-');try{const a=createAuth(pathToFileURL(directory+'/'),{bootstrap:true});assert.equal(await a.needsSetup(),false);assert.equal(await a.needsPasswordSetup(),true);const login=await a.login({username:'admin',password:'admin'},'test');assert.equal(login.user.mustChangePassword,true);const session=await a.session('ev_session='+login.token);await assert.rejects(a.changePassword(session,{currentPassword:'admin',password:'short'}));await a.changePassword(session,{currentPassword:'admin',password:'new-test-password-only'});assert.equal(await a.needsPasswordSetup(),false);await assert.rejects(a.login({username:'admin',password:'admin'},'test'));assert.equal((await a.session('ev_session='+login.token)).user.mustChangePassword,false);}finally{await rm(directory,{recursive:true,force:true});}});
import {validateAutomation,evaluateAutomation} from '../automations.mjs';
const automationDevices=[{id:'light',type:'light',enabled:true},{id:'fryer',type:'fryer',enabled:true}];
const clockRule=()=>validateAutomation({name:'Akşam ışığı',enabled:true,trigger:{type:'time',at:'20:00'},conditions:{},action:{deviceId:'light',command:{power:true}}},automationDevices);
test('Otomasyon yalnız desteklenen cihaz komutlarını kabul eder',()=>{assert.equal(clockRule().action.command.power,true);assert.throws(()=>validateAutomation({...clockRule(),action:{deviceId:'fryer',command:{power:true}}},automationDevices));assert.throws(()=>validateAutomation({...clockRule(),trigger:{type:'time',at:'25:99'}},automationDevices));assert.throws(()=>validateAutomation({...clockRule(),action:{deviceId:'light',command:{power:true,exec:'unsafe'}}},automationDevices));});
test('Saat kuralı evin saat diliminde günde bir çalışır; geçmişi topluca çalıştırmaz',()=>{const r=clockRule(),now=Date.parse('2026-01-01T17:00:10Z'),ctx={timezone:'Europe/Istanbul'};const a=evaluateAutomation(r,ctx,{},now);assert.equal(a.due,true);assert.equal(evaluateAutomation(r,ctx,{key:a.key},now+20000).due,false);assert.equal(evaluateAutomation(r,ctx,{},now+60000).due,false);assert.equal(evaluateAutomation({...r,enabled:false},ctx,{},now).due,false);});
test('Eksik tetikleyici verisi otomasyon başlatmaz; sıcaklık geçişi ve bekleme korunur',()=>{const r={...clockRule(),trigger:{type:'temperature',source:'outdoor',operator:'above',value:25}};assert.equal(evaluateAutomation(r,{}).due,false);const now=Date.parse('2026-01-01T17:00:00Z');assert.equal(evaluateAutomation(r,{outdoor:30},{},now).due,true);assert.equal(evaluateAutomation(r,{outdoor:30},{matched:true},now).due,false);assert.equal(evaluateAutomation(r,{outdoor:30},{matched:false,attemptAt:new Date(now-1000).toISOString()},now).due,false);assert.equal(evaluateAutomation({...r,trigger:{type:'dusk',offsetMinutes:0}},{},{},now).due,false);});
test('Ek koşullar API doğrulamasında reddedilir; eski koşullar değerlendirmeyi etkilemez',()=>{const input={name:'Tek tetikleyici',enabled:true,trigger:{type:'dusk',offsetMinutes:-10},action:{deviceId:'light',command:{power:true}}};for(const conditions of [{temperature:{source:'indoor',operator:'below',value:22}},{daylight:'night'}])assert.throws(()=>validateAutomation({...input,conditions},automationDevices),/Ek koşullar/);const r=validateAutomation(input,automationDevices);assert.equal('conditions' in r,false);const now=Date.parse('2026-01-01T14:50:10Z');assert.equal(evaluateAutomation({...r,conditions:{temperature:{source:'indoor',operator:'below',value:22}}},{sun:{dusk:'2026-01-01T15:00:00Z'}},{},now).due,true);});
test('Sekiz karakterli parola kabul edilir, yedi reddedilir',async()=>{const directory=await mkdtemp(tmpdir()+'/ev-password-test-');try{const a=createAuth(pathToFileURL(directory+'/'));await assert.rejects(a.setup({username:'admin',password:'1234567'}));await a.setup({username:'admin',password:'12345678'});assert.equal((await a.login({username:'admin',password:'12345678'},'test')).user.role,'admin');}finally{await rm(directory,{recursive:true,force:true});}});
import {validatePublicOrigin,isPrivateSetupPath} from '../public-proxy.mjs';
test('Funnel geçidi kurulum uçlarını dış erişime kapatır',()=>{assert.equal(validatePublicOrigin('https://example.test-tailnet.ts.net'),'https://example.test-tailnet.ts.net');assert.throws(()=>validatePublicOrigin('http://example.test-tailnet.ts.net'));assert.throws(()=>validatePublicOrigin('https://evil.invalid'));assert.equal(isPrivateSetupPath('/api/auth/setup'),true);assert.equal(isPrivateSetupPath('/api/vestel/login'),true);assert.equal(isPrivateSetupPath('/api/devices'),false);});
import {validateRoomSelection} from '../rooms.mjs';
import {createPushService,validateSubscription} from '../push.mjs';
test('Oda otomasyonu yalnız seçilen robotun haritasını kabul eder',()=>{const devices=[{id:'vacuum',type:'vacuum',enabled:true}],map={mapId:2,rooms:[{id:1,name:'Salon'},{id:4,name:'Mutfak'}]};const input={...clockRule(),action:{deviceId:'vacuum',command:{command:'rooms',rooms:[4],mapId:2}}};assert.deepEqual(validateAutomation(input,devices,{vacuum:map}).action.command.rooms,[4]);assert.throws(()=>validateAutomation({...input,action:{deviceId:'vacuum',command:{command:'rooms',rooms:[99]}}},devices,{vacuum:map}));assert.throws(()=>validateAutomation({...input,action:{deviceId:'vacuum',command:{command:'rooms',rooms:[4],mapId:3}}},devices,{vacuum:map}));assert.throws(()=>validateRoomSelection(map,[1,1],2));});
const fakeSubscription=()=>({subscription:{endpoint:'https://web.push.apple.com/QPush/test-only',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}}});
test('Push aboneliği yerel veya keyfi URL kabul etmez',()=>{assert.ok(validateSubscription(fakeSubscription()));assert.throws(()=>validateSubscription({subscription:{...fakeSubscription().subscription,endpoint:'http://127.0.0.1/private'}}));assert.throws(()=>validateSubscription({subscription:{...fakeSubscription().subscription,endpoint:'https://foreign.invalid/push'}}));});
test('Push yalnız abone kullanıcıya yeni olayları bir kez gönderir; süresi biteni temizler',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-push-test-');try{const sent=[];const p=createPushService({directory:pathToFileURL(dir+'/'),send:async(_s,payload)=>sent.push(JSON.parse(payload)),subject:'https://example.test.ts.net'});await p.subscribe('user1',fakeSubscription());const feed=[{id:'event1',at:new Date(Date.now()+1000).toISOString(),category:'activity',text:'Makine çalıştırıldı.'}];await p.deliver(feed,['user1']);await p.deliver(feed,['user1']);assert.equal(sent.length,1);assert.equal((await p.status('user2')).count,0);const raw=await readFile(dir+'/push.json','utf8');assert.equal(raw.includes('privateKey'),true);await p.unsubscribe('user2',fakeSubscription().subscription.endpoint);assert.equal((await p.status('user1')).count,1);const broken=createPushService({directory:pathToFileURL(dir+'/'),send:async()=>{throw {statusCode:410};}});await broken.test('user1',fakeSubscription().subscription.endpoint);await broken.deliver([],['user1']);assert.equal((await broken.status('user1')).count,0);}finally{await rm(dir,{recursive:true,force:true});}});
import {cleaningHistory} from '../history.mjs';
import {vacationTransition} from '../vacation.mjs';
test('Tatil modunda temizlik hatırlatmaları kapanır',()=>{assert.deepEqual(alerts({...defaults,vacationMode:true},[{device:'washer',kind:'started',at:'2026-01-01T00:00:00Z'}],Date.parse('2026-02-01T00:00:00Z')),[]);});
test('Tatil izleme bilinmeyen durumu açılma saymaz ve açık kalan cihazı tekrarlamaz',()=>{const a=vacationTransition(null,'light',{dps:{'20':true}},'a');assert.equal(a.alert,true);assert.equal(a.initial,true);assert.equal(vacationTransition(a.next,'light',{dps:{'20':true}},'b').alert,false);const off=vacationTransition(a.next,'light',{dps:{'20':false}},'c');assert.equal(vacationTransition(off.next,'light',{dps:{'20':true}},'d').alert,true);assert.equal(vacationTransition(null,'climate',{power:null},'a').alert,false);});
test('Temizlik geçmişi filtrelenir, sayfalanır ve marka/entegrasyon kaynağı taşımaz',()=>{const state={settings:{devices:[{id:'washer',type:'washer',name:'Çamaşır'}]},events:Array.from({length:45},(_,i)=>({device:'washer',kind:'completed',source:'vestel',eventId:'e'+i,at:new Date(Date.UTC(2026,0,1,0,i)).toISOString()}))};const a=cleaningHistory(state);assert.equal(a.events.length,20);assert.equal(a.pages,3);assert.equal(a.events[0].id,'e44');assert.equal(cleaningHistory(state,{page:3}).events.length,5);assert.equal(a.events[0].source,undefined);assert.equal(cleaningHistory(state,{device:'unknown'}).total,0);assert.throws(()=>cleaningHistory(state,{pageSize:999}));});
test('Beni hatırla oturumu yeniden başlatmada kalır; normal oturum kalmaz; çıkış kalıcıdır',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-remember-test-');try{const url=pathToFileURL(dir+'/');const a=createAuth(url);await a.setup({username:'admin',password:'remember-test-password'});const remembered=await a.login({username:'admin',password:'remember-test-password',remember:true},'test');const normal=await a.login({username:'admin',password:'remember-test-password'},'test');assert.equal(remembered.maxAge,2592000);assert.equal(normal.maxAge,null);const saved=await readFile(dir+'/sessions.json','utf8');assert.equal(saved.includes(remembered.token),false);const b=createAuth(url);assert.ok(await b.session('ev_session='+remembered.token));assert.equal(await b.session('ev_session='+normal.token),null);await b.logout(await b.session('ev_session='+remembered.token));const c=createAuth(url);assert.equal(await c.session('ev_session='+remembered.token),null);}finally{await rm(dir,{recursive:true,force:true});}});
test('Hatırlanan oturumlar rol değişikliğinden sonra diskten geri açılamaz',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-remember-revoke-');try{const url=pathToFileURL(dir+'/'),a=createAuth(url);await a.setup({username:'admin',password:'test-admin-password'});const member=await a.create({username:'member',password:'test-member-password',role:'member'});const login=await a.login({username:'member',password:'test-member-password',remember:true},'test');await a.update({id:member.id,role:'member',enabled:false});assert.equal(await createAuth(url).session('ev_session='+login.token),null);}finally{await rm(dir,{recursive:true,force:true});}});
test('Tatil dönüşünde geçmiş dakika ve gün ışığı işi yakalanmaz',()=>{const rule=clockRule(),now=Date.parse('2026-01-01T17:00:30Z');assert.equal(evaluateAutomation(rule,{timezone:'Europe/Istanbul',resumeAfter:'2026-01-01T17:00:20Z'},{},now).due,false);const sun={...rule,trigger:{type:'dusk',offsetMinutes:0}};assert.equal(evaluateAutomation(sun,{sun:{dusk:'2026-01-01T17:00:00Z'},resumeAfter:'2026-01-01T17:00:20Z'},{},now).due,false);});

import {notificationSettings,validateNotificationSettings} from '../notification-settings.mjs';
import {notificationFeed} from '../notifications.mjs';
test('Bildirim tercihleri cihaz örneğine özeldir, yeni cihaz varsayılanları ve tür sınırları korunur',()=>{
 const devices=[{id:'one',type:'washer',enabled:true},{id:'two',type:'washer',enabled:true},{id:'lamp',type:'light',enabled:true}];
 const settings={devices,thresholds:{washer:4},notifications:{devices:{one:{started:false,days:2}}}};
 const prefs=notificationSettings(settings);assert.equal(prefs.devices.one.started,false);assert.equal(prefs.devices.two.started,true);assert.equal(prefs.devices.two.days,4);
 const valid=validateNotificationSettings(prefs,devices);assert.equal(valid.devices.lamp.started,false);assert.equal(valid.devices.lamp.reminder,false);
 assert.throws(()=>validateNotificationSettings({...prefs,devices:{unknown:prefs.devices.one}},devices));assert.throws(()=>validateNotificationSettings({...prefs,devices:{one:{...prefs.devices.one,days:0}}},devices));
});
test('Bildirimleri kapatmak geçmişi silmez; başlangıç, bitiş, hatırlatma ve internet ayrı filtrelenir',()=>{
 const now=Date.now(),devices=[{id:'one',name:'Makine',type:'washer',enabled:true}],events=[{eventId:'start',device:'one',kind:'started',at:new Date(now-5*86400000).toISOString()},{eventId:'end',device:'one',kind:'completed',at:new Date(now-4*86400000).toISOString()}];
 const state={settings:{devices,thresholds:{washer:2},notifications:{internet:false,devices:{one:{started:false,completed:true,reminder:false}}}},events};
 const slow={downloadMbps:1,uploadMbps:1,latencyMs:40};let feed=notificationFeed(state,{history:[slow,slow]},now);
 assert.deepEqual(feed.notifications.map(n=>n.id),['end']);assert.equal(events.length,2);
 state.settings.notifications={internet:true,reminders:true,devices:{one:{days:6}}};feed=notificationFeed(state,{history:[slow,slow]},now);assert.equal(feed.notifications.some(n=>n.category==='internet'),true);assert.equal(feed.notifications.some(n=>n.category==='reminder'),false);
 state.settings.notifications.devices.one.days=3;assert.equal(notificationFeed(state,{history:[]},now).notifications.some(n=>n.category==='reminder'),true);
});
test('Üç dakikalık ölçüm aralığı doğrulanır',()=>{assert.equal(validateInternetInterval(3),3);assert.throws(()=>validateInternetInterval(2));});
test('Kapatılan cihaz bildiriminin bekleyen tekrar denemesi iptal edilir',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-push-preferences-');try{let attempts=0;const push=createPushService({directory:pathToFileURL(dir+'/'),send:async()=>{attempts++;throw Error('offline');}});await push.subscribe('u',fakeSubscription());await push.deliver([{id:'start',at:new Date(Date.now()+1000).toISOString(),category:'activity',text:'Başladı'}],['u']);assert.equal((await push.status('u')).queued,1);await push.deliver([],['u'],{now:Date.now()+900000});assert.equal((await push.status('u')).queued,0);assert.equal(attempts,1);}finally{await rm(dir,{recursive:true,force:true});}
});

import {createVestelClientStore,validateVestelClient} from '../vestel-client.mjs';
import {stat} from 'node:fs/promises';
test('Vestel servis formu bilgileri özel saklar; durum API’si anahtar döndürmez',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-vestel-client-');try{const directory=pathToFileURL(dir+'/'),store=await createVestelClientStore({directory,env:{}});assert.equal(store.status().configured,false);await store.save({clientId:'fixtureClient',clientSecret:'fixtureSecret'});assert.equal(store.status().configured,true);assert.equal(JSON.stringify(store.status()).includes('fixtureSecret'),false);assert.equal((await stat(dir+'/vestel-client.json')).mode&0o777,0o600);const restarted=await createVestelClientStore({directory,env:{}});assert.equal(restarted.credentials().clientSecret,'fixtureSecret');const envStore=await createVestelClientStore({directory,env:{VESTEL_CLIENT_ID:'envClient',VESTEL_CLIENT_SECRET:'envSecret'}});assert.equal(envStore.status().managedByEnvironment,true);await assert.rejects(envStore.save({clientId:'new',clientSecret:'new'}),/ortam/);for(const bad of [{},{clientId:4,clientSecret:'x'},{clientId:'a',clientSecret:''},{clientId:'a',clientSecret:'x\ny'}])assert.throws(()=>validateVestelClient(bad));}finally{await rm(dir,{recursive:true,force:true});}
});

import {distanceKm,validateEarthquakeSettings,normalizeEarthquake,mergeEarthquakes,createEarthquakeStore} from '../earthquakes.mjs';
import {selectWeatherAlerts,weatherAdvice,provinceFor} from '../weather-info.mjs';
const quakeFixture=(id,at,magnitude='3.1',latitude='40.1',longitude='29')=>({eventID:id,date:at,magnitude,latitude,longitude,type:'ML',location:'Sentetik olay'});
test('Deprem eşik, mesafe, UTC, mükerrer kayıt ve eski olay bildirimi sınırları',()=>{
 const now=Date.parse('2026-11-06T12:00:00Z'),config={enabled:true,minMagnitude:3,radiusKm:100,since:'2026-11-06T11:00:00Z'},place={latitude:40,longitude:29};
 assert.ok(distanceKm(place,{latitude:41,longitude:29})>110);assert.equal(distanceKm(place,place),0);assert.equal(normalizeEarthquake(quakeFixture('1','2026-11-06T11:30:00')).at,'2026-11-06T11:30:00.000Z');assert.equal(normalizeEarthquake({}),null);
 const rows=[quakeFixture('1','2026-11-06T11:30:00'),quakeFixture('2','2026-11-06T10:30:00'),quakeFixture('3','2026-11-06T11:30:00','3.0'),quakeFixture('4','2026-11-06T11:30:00','4','45')];
 const events=mergeEarthquakes([],rows,config,place,now);assert.equal(events.length,2);assert.equal(events.find(e=>e.id==='afad:1').notify,true);assert.equal(events.find(e=>e.id==='afad:2').notify,false);const again=mergeEarthquakes(events,rows,config,place,now+60000);assert.equal(again.length,2);assert.equal(again[0].observedAt,events[0].observedAt);
 assert.throws(()=>validateEarthquakeSettings({enabled:true,minMagnitude:2,radiusKm:100}));assert.throws(()=>validateEarthquakeSettings({enabled:true,minMagnitude:3,radiusKm:1000}));
 const state={settings:{devices:[],thresholds:{},earthquakes:config},events:[]};assert.equal(notificationFeed(state,{history:[]},now,{events}).notifications.filter(e=>e.category==='earthquake').length,1);state.settings.earthquakes.enabled=false;assert.equal(notificationFeed(state,{history:[]},now,{events}).notifications.length,0);
});
test('AFAD kesintisinde kayıt korunur ve kaynak hatası görünür',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-quakes-');try{let failed=false;const store=await createEarthquakeStore({directory:pathToFileURL(dir+'/'),fetchEvents:async()=>{if(failed)throw Error();return [quakeFixture('1',new Date().toISOString())];}});const config={enabled:true,minMagnitude:3,radiusKm:100,since:new Date(Date.now()-10000).toISOString()};await store.poll(config,{latitude:40,longitude:29});assert.equal(store.status().events.length,1);failed=true;await store.poll(config,{latitude:40,longitude:29});assert.ok(store.status().error);assert.equal(store.status().events.length,1);assert.ok(store.status().checkedAt);}finally{await rm(dir,{recursive:true,force:true});}});
test('MGM yalnız eşleşen ildeki geçerli uyarıyı seçer; eski ve ilgisiz uyarıyı kullanmaz',()=>{
 const now=Date.parse('2026-11-06T12:00:00Z'),place={label:'Cevizli / Maltepe / İstanbul / Türkiye'},row={alertNo:1,begin:'2026-11-06T10:00:00Z',end:'2026-11-06T18:00:00Z',towns:{yellow:[93401]},text:{yellow:'Sentetik rüzgar uyarısı'}};
 assert.equal(provinceFor(place)[0],'İstanbul');assert.equal(selectWeatherAlerts([row],place,now).alerts.length,1);assert.equal(selectWeatherAlerts([row],{label:'Ankara / Türkiye'},now).alerts.length,0);assert.equal(selectWeatherAlerts([row],place,now+86400000).alerts.length,0);assert.equal(selectWeatherAlerts([row],{label:'Bilinmeyen'},now).province,null);assert.throws(()=>selectWeatherAlerts({},place,now));
 assert.match(weatherAdvice({weather:{temperature_2m:20,weather_code:61},weatherAt:new Date(now).toISOString()},now),/şemsiye/);assert.match(weatherAdvice({weather:{temperature_2m:35,weather_code:0},weatherAt:new Date(now-3600000).toISOString()},now),/bekleniyor/);
});

import {validateLGConnection,validateLGCommand,createLGService,decodeLGAudio} from '../lg.mjs';
import {EventEmitter} from 'node:events';
test('LG bağlantısı özel IP ile sınırlıdır; komutlar izin listesine bağlıdır',()=>{assert.equal(validateLGConnection({ip:'192.168.1.20',secure:true}).secure,true);assert.deepEqual(validateLGConnection(validateLGConnection({ip:'192.168.1.20',secure:true})),{ip:'192.168.1.20',secure:true,mac:null});for(const c of [{ip:'8.8.8.8',secure:true},{ip:'127.0.0.1',secure:false},{ip:'192.168.1.20',secure:'true'},{ip:'192.168.1.20',secure:true,mac:'bad'}])assert.throws(()=>validateLGConnection(c));assert.deepEqual(validateLGCommand({volume:10}),{volume:10});for(const c of [{volume:101},{volume:1,power:false},{uri:'ssap://arbitrary'},{power:'on'}])assert.throws(()=>validateLGCommand(c));});
test('LG eşleştirme anahtarı örneğe özel ve özel izinlerle saklanır; okuma otomatik eşleştirme yapmaz',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-lg-');try{const calls=[];class FakeTV extends EventEmitter{constructor(options){super();calls.push(options);queueMicrotask(()=>{if(!options.clientKey)options.saveKey('fixtureLGKey',()=>this.emit('connect'));else this.emit('connect');});}async disconnect(){}async getPowerState(){return {state:'unknown'};}async request(uri){return {volume:12,muted:false};}}const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeTV}),d={id:'device-11111111-1111-1111-1111-111111111111'},other={id:'device-22222222-2222-2222-2222-222222222222'},c={ip:'192.168.1.20',secure:true};await assert.rejects(service.status(d,c),/eşleştirin/);assert.equal(calls.length,0);service.startPair(d,c);for(let i=0;i<50&&service.pairStatus(d).status!=='paired';i++)await new Promise(r=>setTimeout(r,5));assert.equal(service.pairStatus(d).status,'paired');assert.equal((await stat(dir+'/'+d.id+'/client.key')).mode&0o777,0o600);assert.equal(await service.paired(d),true);assert.equal(await service.paired(other),false);const status=await service.status(d,c);assert.equal(status.power,'unknown');assert.equal(status.volume,12);assert.equal(JSON.stringify(status).includes('fixtureLGKey'),false);assert.equal(calls.at(-1).verifyCert,'lg');}finally{await rm(dir,{recursive:true,force:true});}});

test('LG QNED iç içe ses yanıtını okur; bilinmeyen ses/mute uydurulmaz',()=>{assert.deepEqual(decodeLGAudio({volumeStatus:{volume:15,muteStatus:false}}),{volume:15,muted:false});assert.deepEqual(decodeLGAudio({volume:20,muted:true}),{volume:20,muted:true});assert.deepEqual(decodeLGAudio({}),{volume:null,muted:null});});

import {archiveDevice,restoreDevice} from '../device-lifecycle.mjs';
import {panelLGRegistration} from '../lg.mjs';
test('Cihaz kaldırma otomasyonları durdurur, geçmişi korur; geri alma etkinleştirmez',()=>{const state={settings:{devices:[{id:'tv-one',type:'tv',name:'TV',enabled:true}],layout:{rooms:[{id:'room-one'}],assignments:{'tv-one':'room-one'}},indoorTemperatureSource:'tv-one'},events:[{device:'tv-one',kind:'started'}],automations:[{id:'rule',enabled:true,action:{deviceId:'tv-one'}}],automationTracking:{rule:{matched:true}},activityTracking:{'tv-one':{}},vacationTracking:{'tv-one':{}}};archiveDevice(state,'tv-one');assert.equal(state.settings.devices.length,0);assert.equal(state.automations[0].enabled,false);assert.equal(state.events.length,1);assert.equal(state.settings.indoorTemperatureSource,null);assert.equal(state.settings.layout.assignments['tv-one'],undefined);restoreDevice(state,'tv-one');assert.equal(state.settings.devices[0].enabled,false);assert.equal(state.settings.layout.assignments['tv-one'],'room-one');assert.equal(state.automations[0].enabled,false);assert.equal(state.archivedDevices.length,0);assert.throws(()=>archiveDevice(state,'missing'));});
test('LG oynat/duraklat izin listesi ve medya uçları',async()=>{assert.deepEqual(validateLGCommand({launchApp:'netflix'}),{launchApp:'netflix'});assert.throws(()=>validateLGCommand({media:'stop'}));const registration=panelLGRegistration({'client-key':'fixture'});assert.equal(registration['client-key'],'fixture');assert.ok(registration.manifest.permissions.includes('CONTROL_INPUT_MEDIA_PLAYBACK'));assert.equal(registration.manifest.permissions.includes('READ_INSTALLED_APPS'),true);const dir=await mkdtemp(tmpdir()+'/ev-lg-media-');try{const calls=[];class FakeMedia extends EventEmitter{constructor(){super();queueMicrotask(()=>this.emit('connect'));}async disconnect(){}async request(uri){calls.push(uri);return {returnValue:true};}}const d={id:'device-11111111-1111-1111-1111-111111111111'},c={ip:'192.168.1.20',secure:true};await mkdir(dir+'/'+d.id,{recursive:true});await writeFile(dir+'/'+d.id+'/client.key','fixture-key',{mode:0o600});const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeMedia});await service.command(d,c,{media:'play'});await service.command(d,c,{media:'pause'});assert.deepEqual(calls,['ssap://media.controls/play','ssap://media.controls/pause']);}finally{await rm(dir,{recursive:true,force:true});}});

import {validatePointerURL,pointerMessage,validLGPeer} from '../lg-pointer.mjs';
import {LG_ISSUER_FINGERPRINTS} from 'lgtv2';
test('LG imleç hedefi TV IP/protokol/portu ile sınırlıdır; komutlar ve sertifika zinciri doğrulanır',()=>{const c={ip:'192.168.1.20',secure:true};assert.ok(validatePointerURL('wss://192.168.1.20:3001/resources/control?key=fixture',c));for(const url of ['wss://127.0.0.1:3001/x','ws://192.168.1.20:3000/x','wss://192.168.1.20:9999/x'])assert.throws(()=>validatePointerURL(url,c));assert.equal(validLGPeer({fingerprint256:'unknown'}),false);assert.equal(validLGPeer({fingerprint256:LG_ISSUER_FINGERPRINTS[0]}),true);assert.equal(pointerMessage(validateLGCommand({pointer:{action:'click'}})),'type:click\n\n');assert.equal(pointerMessage(validateLGCommand({remoteKey:'HOME'})),'type:button\nname:HOME\n\n');for(const cmd of [{remoteKey:'ARBITRARY'},{pointer:{action:'move',dx:1000,dy:0}},{pointer:{action:'click',extra:true}}])assert.throws(()=>validateLGCommand(cmd));});
test('LG imleç bağlantısı tekrar kullanılır; gönderimler sıralıdır ve kapanabilir',async()=>{const dir=await mkdtemp(tmpdir()+'/ev-lg-pointer-');try{let opens=0;const sent=[];class FakeClient extends EventEmitter{constructor(){super();queueMicrotask(()=>this.emit('connect'));}async disconnect(){}async request(){return {socketPath:'wss://192.168.1.20:3001/resources/control'};}}class FakeSocket extends EventEmitter{readyState=1;send(data,cb){sent.push(data);cb();}close(){this.readyState=3;this.emit('close');}}const d={id:'device-11111111-1111-1111-1111-111111111111'},c={ip:'192.168.1.20',secure:true};await mkdir(dir+'/'+d.id,{recursive:true});await writeFile(dir+'/'+d.id+'/client.key','fixture',{mode:0o600});const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeClient,PointerOpener:async()=>{opens++;return new FakeSocket();}});await service.command(d,c,{pointer:{action:'prepare'}});assert.equal(sent.length,0);await service.command(d,c,{pointer:{action:'move',dx:20,dy:-10}});await service.command(d,c,{remoteKey:'BACK'});assert.equal(opens,1);assert.equal(sent.length,2);assert.ok(sent[0].includes('dx:20'));await service.close(d);}finally{await rm(dir,{recursive:true,force:true});}});

import {buildRoomAction} from '../vacuum-room-command.mjs';
import {parseNeighbors,createNetworkService} from '../network.mjs';
test('P2140P oda komutu harita ve mevcut emiş/su ayarlarıyla modelin genişletilmiş eylemini kurar',()=>{const d={model:'dreame.vacuum.p2140p',did:'fixture'},map={mapId:7,rooms:[{id:1},{id:3}]};const action=buildRoomAction(d,map,[3,1],7,{suction:2,water:1});assert.equal(action.siid,4);assert.equal(action.aiid,1);assert.deepEqual(action.in[0],{piid:1,value:18});assert.deepEqual(JSON.parse(action.in[1].value),{selects:[[3,1,2,1,1],[1,1,2,1,2]]});for(const args of [[[99],7,{suction:2,water:1}],[[1],8,{suction:2,water:1}],[[1],undefined,{suction:2,water:1}],[[1],7,{suction:null,water:1}]])assert.throws(()=>buildRoomAction(d,map,...args));});
test('Oda içi cihaz sırası benzersiz mevcut cihazlarla sınırlıdır',()=>{const devices=[{id:'a'},{id:'b'}],layout={rooms:[],assignments:{a:null,b:null},deviceOrder:['b','a']};assert.deepEqual(validateLayout(layout,devices).deviceOrder,['b','a']);assert.throws(()=>validateLayout({...layout,deviceOrder:['a','a']},devices));assert.throws(()=>validateLayout({...layout,deviceOrder:['unknown']},devices));});
test('Ağ komşuları private IP ile sınırlıdır; ping başarısızlığı çevrimdışı diye sunulmaz',async()=>{const rows=parseNeighbors('? (192.168.1.2) at a:b:c:d:e:f on en0\n? (8.8.8.8) at aa:bb:cc:dd:ee:ff on en0\n? (192.168.1.3) at (incomplete) on en0','darwin');assert.deepEqual(rows,[{ip:'192.168.1.2',mac:'0a:0b:0c:0d:0e:0f'}]);assert.equal(parseNeighbors(JSON.stringify([{dst:'192.168.1.4',lladdr:'aa:bb:cc:dd:ee:ff'}]),'linux').length,1);const dir=await mkdtemp(tmpdir()+'/ev-network-');try{const service=createNetworkService({file:pathToFileURL(dir+'/network.json'),neighbors:async()=>rows,probe:async()=> 'no_reply',resolveName:async()=> 'laptop.home.arpa'});await service.scan();const state=await service.status();assert.equal(state.devices[0].reachability,'no_reply');assert.equal(state.devices[0].hostname,'laptop.home.arpa');assert.equal(state.usage.available,false);}finally{await rm(dir,{recursive:true,force:true});}});

import {createMiioRequester} from '../miio-local.mjs';
test('Xiaomi istekleri cihaz başına sıralıdır; yalnız okuma zaman aşımı bir kez tekrarlanır',async()=>{const calls=[];let active=0,max=0,first=true;const request=createMiioRequester(async(_d,method)=>{calls.push(method);active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;if(first){first=false;throw Object.assign(Error('timeout'),{code:'MIIO_TIMEOUT'});}if(method==='action')throw Object.assign(Error('timeout'),{code:'MIIO_TIMEOUT'});return 'ok';});const d={localip:'192.168.1.20'};const results=await Promise.allSettled([request(d,'get_properties'),request(d,'action'),request(d,'get_properties')]);assert.equal(max,1);assert.equal(results[0].value,'ok');assert.equal(results[1].status,'rejected');assert.equal(results[2].value,'ok');assert.equal(calls.filter(x=>x==='action').length,1);assert.equal(calls.filter(x=>x==='get_properties').length,3);});

test('LG klavye girdisi sınırlıdır, Türkçe metin desteklenir ve metin/Enter/sil ayrı komutlardır',async()=>{assert.deepEqual(validateLGCommand({text:{value:'köpek videosu',replace:false}}),{text:{value:'köpek videosu',replace:false}});for(const input of [{text:{value:'',replace:false}},{text:{value:'x'.repeat(501),replace:true}},{text:{value:'a\nb',replace:false}},{keyboard:'arbitrary'}])assert.throws(()=>validateLGCommand(input));const dir=await mkdtemp(tmpdir()+'/ev-lg-keyboard-');try{let connects=0;const calls=[];class FakeClient extends EventEmitter{connected=true;constructor(){super();connects++;queueMicrotask(()=>this.emit('connect'));}async disconnect(){this.connected=false;}async getPowerState(){return {state:'on'};}async request(uri,payload){calls.push({uri,payload});return uri==='ssap://audio/getVolume'?{volume:15,muted:false}:{returnValue:true};}}const d={id:'device-11111111-1111-1111-1111-111111111111'},c={ip:'192.168.1.20',secure:true};await mkdir(dir+'/'+d.id,{recursive:true});await writeFile(dir+'/'+d.id+'/client.key','fixture',{mode:0o600});const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeClient});const states=await Promise.all([service.status(d,c),service.status(d,c)]);assert.equal(connects,1);assert.equal(calls.filter(c=>c.uri==='ssap://audio/getVolume').length,1);await service.command(d,c,{text:{value:'köpek videosu',replace:true}});await service.command(d,c,{keyboard:'enter'});await service.command(d,c,{keyboard:'backspace'});assert.equal(connects,1);assert.ok(calls.some(c=>c.uri==='ssap://com.webos.service.ime/insertText'&&c.payload.text==='köpek videosu'&&c.payload.replace===1));assert.ok(calls.some(c=>c.uri.endsWith('sendEnterKey')));assert.ok(calls.some(c=>c.uri.endsWith('deleteCharacters')&&c.payload.count===1));assert.equal(JSON.stringify(states).includes('köpek'),false);await service.close(d);}finally{await rm(dir,{recursive:true,force:true});}});

import {advanceRemaining,remainingView,createRemainingStore} from '../remaining-tracker.mjs';
import {cleaningCycles,weeklyCleaning} from '../history.mjs';
import {cleaningIntent,annotateActivity} from '../cleaning-context.mjs';
test('Sabit bulut süresi sayacı sıfırlamaz; yeni süre, duraklatma ve sıfıra iniş uzlaşır',()=>{
 const base={remainingMinutes:20,running:true,program:'Eco',stateKey:'Run'};
 let t=advanceRemaining(null,base,'2026-01-01T00:00:00Z');
 for(let minute=1;minute<=5;minute++)t=advanceRemaining(t,base,`2026-01-01T00:0${minute}:00Z`);
 assert.equal(remainingView(t,Date.parse('2026-01-01T00:05:00Z')).remainingMinutes,15);
 t=advanceRemaining(t,{...base,remainingMinutes:12},'2026-01-01T00:06:00Z');assert.equal(t.anchorMinutes,12);
 t=advanceRemaining(t,{...base,remainingMinutes:12,running:false,stateKey:'Pause'},'2026-01-01T00:07:00Z');assert.equal(remainingView(t,Date.parse('2026-01-01T00:08:00Z')).remainingMinutes,11);
 t=advanceRemaining(t,{...base,remainingMinutes:12},'2026-01-01T00:08:00Z');
 assert.equal(remainingView(t,Date.parse('2026-01-01T00:19:00Z')).estimatedCompletion,true);
 t=advanceRemaining(t,{...base,running:false,completed:true,remainingMinutes:0},'2026-01-01T00:20:00Z');assert.equal(remainingView(t).estimatedCompletion,false);assert.equal(t.cycleId,'2026-01-01T00:00:00Z');
});
test('Robot oda seçimi başlangıç ve bitişe taşınır; dışarıdan başlangıç için oda uydurulmaz',()=>{
 const state={events:[],vacuumIntents:{r:cleaningIntent({command:'rooms',rooms:[2]},{rooms:[{id:2,name:'Örnek oda'}]},'2026-01-01T00:00:00Z')}};
 const d={id:'r',type:'vacuum'};
 const start=annotateActivity(state,d,{},[{kind:'started'}],'2026-01-01T00:01:00Z');assert.deepEqual(start[0].rooms,[{id:2,name:'Örnek oda'}]);
 assert.equal(annotateActivity(state,d,{},[{kind:'completed'}],'2026-01-01T00:02:00Z')[0].scope,'rooms');
 assert.equal(annotateActivity(state,d,{},[{kind:'started'}],'2026-01-01T00:03:00Z')[0].scope,undefined);
});
test('Temizlik çalışması tek satır ve haftada bir aktivitedir; haftalar ev saat dilimindedir',()=>{
 const state={settings:{devices:[{id:'r',type:'vacuum',name:'Örnek robot'}]},events:[
 {device:'r',kind:'started',at:'2026-11-01T22:30:00Z',eventId:'s',scope:'rooms',rooms:[{id:1,name:'Örnek oda'}]},
 {device:'r',kind:'completed',at:'2026-11-02T00:00:00Z',eventId:'e'}]};
 const rows=cleaningCycles(state);assert.equal(rows.length,1);assert.equal(rows[0].rooms[0].name,'Örnek oda');assert.equal(rows[0].status,'completed');
 const week=weeklyCleaning(rows,{now:Date.parse('2026-11-03T00:00:00Z')});assert.equal(week.start,'2026-11-02');assert.equal(week.days[0].counts.vacuum,1);assert.equal(week.total,1);
 assert.equal(weeklyCleaning(rows,{now:Date.parse('2026-11-03T00:00:00Z'),weekOffset:-1}).total,0);
});
test('Gerçek bitiş tahmini kaydı yerinde onaylar; yeni olay veya bildirim kimliği üretmez',()=>{
 const state={events:[{eventId:'stable',device:'w',kind:'completed',timerCycleId:'cycle',estimated:true}]};
 assert.deepEqual(annotateActivity(state,{id:'w',type:'washer'},{completed:true,remainingTimer:{cycleId:'cycle'}},[],'2026-01-01T00:30:00Z'),[]);
 assert.equal(state.events.length,1);assert.equal(state.events[0].eventId,'stable');assert.equal(state.events[0].estimated,false);
});
test('Sayaç yeniden başlatmada kalır ve ilk kurulumda gözlem günlüğünden devam eder',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-timer-');try{
  const file=pathToFileURL(dir+'/timers.json'),d={id:'fixture',kind:'dishwasher',readable:true,program:'Eco',remainingMinutes:30,running:true,stateKey:'Run'};
  const store=await createRemainingStore({file,seed:async()=>[{at:'2026-01-01T00:00:00Z',devices:[d]},{at:'2026-01-01T00:01:00Z',devices:[d]}]});
  assert.equal(store.decorate(d,Date.parse('2026-01-01T00:02:00Z')).remainingMinutes,28);
  await store.observe([d],'2026-01-01T00:02:00Z');const restored=await createRemainingStore({file});
  assert.equal(restored.decorate(d,Date.parse('2026-01-01T00:03:00Z')).remainingMinutes,27);
  const zero=restored.decorate(d,Date.parse('2026-01-01T00:30:00Z'));assert.equal(zero.completed,true);assert.equal(zero.estimatedCompletion,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Tahmini bitişten sonra cihaz süreyi uzatırsa aynı yıkama ikinci kez sayılmaz',()=>{
 const state={events:[{device:'w',eventId:'once',kind:'completed',timerCycleId:'cycle',estimated:true}]},device={id:'w',type:'washer'};
 const running={running:true,completed:false,remainingTimer:{cycleId:'cycle'}};
 const transition=activityTransition({completed:true,cycleOpen:false,timerCycleId:'cycle'},running,'2026-01-01T00:01:00Z','washer');assert.equal(transition.events.length,0);
 const finish=activityTransition(transition.next,{completed:true,remainingTimer:{cycleId:'cycle'}},'2026-01-01T00:02:00Z','washer');
 assert.equal(annotateActivity(state,device,{completed:true,remainingTimer:{cycleId:'cycle'}},finish.events,'2026-01-01T00:02:00Z').length,0);assert.equal(state.events[0].estimated,false);
});

import {parseHello,createAddressRecovery} from '../xiaomi-discovery.mjs';
test('Xiaomi keşfi yalnız özel ağdaki geçerli DID yanıtlarını kabul eder',()=>{
 const packet=Buffer.alloc(32,255);packet.writeUInt16BE(0x2131);packet.writeUInt16BE(32,2);packet.writeUInt32BE(12345,8);
 assert.deepEqual(parseHello(packet,{address:'192.168.1.25',port:54321}),{did:'12345',localip:'192.168.1.25'});
 assert.equal(parseHello(packet,{address:'8.8.8.8',port:54321}),null);assert.equal(parseHello(packet,{address:'192.168.1.25',port:1}),null);
});
test('IP kurtarma DID eşleşmesi ve anahtarla okuma doğrulaması olmadan adresi kaydetmez',async()=>{
 let scans=0,saved=0,time=0;const device={did:'12345',localip:'192.168.1.2',token:'fixture'};
 const recover=createAddressRecovery({now:()=>time,discover:async()=>{scans++;return [{did:'999',localip:'192.168.1.8'},{did:'12345',localip:'192.168.1.9'}];}});
 await assert.rejects(recover(device,async()=>{throw Error('authentication');},async()=>saved++));assert.equal(saved,0);
 await assert.rejects(recover(device,async()=>true,async()=>saved++));assert.equal(scans,1);
 time=120001;assert.equal(await recover(device,async d=>{assert.equal(d.localip,'192.168.1.9');assert.equal(d.token,'fixture');return 'verified';},async()=>saved++),'verified');assert.equal(saved,1);
 const ambiguous=createAddressRecovery({discover:async()=>[{did:'12345',localip:'192.168.1.8'},{did:'12345',localip:'192.168.1.9'}]});await assert.rejects(ambiguous(device,async()=>true,async()=>saved++));assert.equal(saved,1);
});

import {createLocalAddressService,localProbeTargets,persistLocalAddress} from '../local-address.mjs';
test('Yerel adres kurtarma kayıtlı MAC ve başarılı okumadan sonra tek cihazı günceller',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-address-');try{let saved=0,refreshes=0;const mac='aa:bb:cc:dd:ee:01',rows=[{ip:'192.168.1.20',mac}],file=pathToFileURL(dir+'/pins.json');
 const service=createLocalAddressService({file,neighbors:async()=>rows,refresh:async()=>refreshes++});
 const config={ip:'192.168.1.20'};
 await service.read({id:'fixture',config,read:async()=>({connected:true}),persist:async()=>saved++});
 rows[0]={ip:'192.168.1.30',mac};const value=await service.read({id:'fixture',config,read:async c=>{if(c.ip===config.ip)throw Error('offline');return c.ip;},persist:async c=>{assert.equal(c.ip,'192.168.1.30');saved++;}});
 assert.equal(value,'192.168.1.30');assert.equal(saved,1);assert.equal(refreshes,1);
 const restarted=createLocalAddressService({file,neighbors:async()=>rows,refresh:async()=>{}});await assert.rejects(restarted.read({id:'fixture',config,read:async()=>{throw Error('wrong key');},persist:async()=>saved++}));assert.equal(saved,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Bilinmeyen kimlik veya başka MAC adresi LG/Samsung kurtarmada seçilmez',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-address-');try{let calls=0,discovered=0;const service=createLocalAddressService({file:pathToFileURL(dir+'/pins.json'),neighbors:async()=>[{ip:'192.168.1.30',mac:'aa:bb:cc:dd:ee:02'}],refresh:async()=>{}});
 await assert.rejects(service.read({id:'unknown',config:{ip:'192.168.1.20'},read:async()=>{throw Error('offline');},discover:async()=>{discovered++;return [{ip:'192.168.1.30'}];},persist:async()=>calls++}));assert.equal(discovered,0);
 await assert.rejects(service.read({id:'known',config:{ip:'192.168.1.20',mac:'aa:bb:cc:dd:ee:01'},read:async()=>{throw Error('offline');},discover:async()=>[{ip:'192.168.1.30'}],persist:async()=>calls++}));assert.equal(calls,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Yerel ping keşfi yalnız doğrudan bağlı özel /24 ağında sınırlıdır',()=>{
 const interfaces={fixture:[{family:'IPv4',internal:false,address:'192.168.1.10',netmask:'255.255.255.0'}]};
 assert.equal(localProbeTargets('192.168.1.20',interfaces).length,254);assert.equal(localProbeTargets('192.168.2.20',interfaces).length,0);assert.equal(localProbeTargets('8.8.8.8',interfaces).length,0);
});

import {createStatusCoordinator} from '../device-status.mjs';
import {createDeviceStreams} from '../device-events.mjs';
test('Ortak durum okuması eşzamanlı telefonları ve arka planı tek sorguda birleştirir',async()=>{
 let time=0,calls=0,release;const hub=createStatusCoordinator({now:()=>time});const loader=async()=>{calls++;return new Promise(r=>release=r);};
 const a=hub.read('fixture',loader),b=hub.read('fixture',loader);release({power:'off'});assert.deepEqual(await a,await b);assert.equal(calls,1);
 await hub.read('fixture',loader);assert.equal(calls,1);time=30001;const c=hub.read('fixture',loader);release({power:'on'});assert.equal((await c).power,'on');assert.equal(calls,2);
});
test('Cihaz hatası geri çekilir; yeni TV bildirimi eski okumayla ezilmez; komut önbelleği iptal eder',async()=>{
 let time=0,calls=0;const hub=createStatusCoordinator({now:()=>time});const fail=async()=>{calls++;throw Error('offline');};await assert.rejects(hub.read('fixture',fail));await assert.rejects(hub.read('fixture',fail));assert.equal(calls,1);
 hub.invalidate('fixture');await hub.read('fixture',async()=>({volume:10}));let release;time=30001;const pending=hub.read('fixture',()=>new Promise(r=>release=r));hub.patch('fixture',{volume:20});release({volume:10});await pending;assert.equal((await hub.read('fixture',fail)).volume,20);
 hub.invalidate('fixture');assert.equal((await hub.read('fixture',async()=>({volume:30}))).volume,30);
});
test('Canlı akış yalnız cihaz kimliği yollar, iptal edilen oturumu keser ve bağlantı sınırı uygular',async()=>{
 let valid=true;const session={key:'fixture-session',user:{id:'fixture-user'}};const streams=createDeviceStreams({authenticate:async()=>valid?session:null,allowedDevice:id=>id==='fixture',maxPerUser:1});
 class Response extends EventEmitter{chunks=[];writeHead(code,headers){this.code=code;this.headers=headers;}write(s){this.chunks.push(s);return true;}end(s){if(s)this.chunks.push(s);this.ended=true;}flushHeaders(){}}
 const res=new Response();streams.open({headers:{cookie:'fixture-cookie'}},res,session);assert.equal(res.code,200);assert.match(res.headers['Content-Type'],/event-stream/);assert.equal(streams.size,1);
 await streams.notify('not-allowed');assert.equal(res.chunks.length,1);await streams.notify('fixture');assert.match(res.chunks.at(-1),/"id":"fixture"/);assert.equal(res.chunks.at(-1).includes('cookie'),false);
 const second=new Response();streams.open({headers:{}},second,session);assert.equal(second.code,429);
 valid=false;await streams.notify('fixture');assert.equal(res.ended,true);assert.equal(streams.size,0);streams.close();
});
test('LG durum aboneliği bağlantı başına bir kez kurulur ve gelen ses değişikliği yayınlanır',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-lg-live-');try{const callbacks=new Map(),updates=[];let subscriptions=0;
 class FakeTV extends EventEmitter{connected=true;constructor(){super();queueMicrotask(()=>this.emit('connect'));}async disconnect(){this.connected=false;}async getPowerState(){return {state:'on'};}async request(){return {volume:10,muted:false};}subscribe(uri,callback){subscriptions++;callbacks.set(uri,callback);}subscribePowerState(callback){subscriptions++;callbacks.set('power',callback);}}
 const d={id:'device-11111111-1111-1111-1111-111111111111'},c={ip:'192.168.1.20',secure:true};await mkdir(dir+'/'+d.id,{recursive:true});await writeFile(dir+'/'+d.id+'/client.key','fixture',{mode:0o600});const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeTV});service.onStatus((id,value)=>updates.push({id,value}));await service.status(d,c);callbacks.get('ssap://audio/getVolume')(null,{volume:25,muted:true});assert.equal(updates[0].value.volume,25);assert.equal((await service.status(d,c)).muted,true);assert.equal(subscriptions,2);await service.close(d);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {createExternalData} from '../external-data.mjs';
test('Dış veri GET okumaları ağ çağırmaz; zamanlayıcı eşzamanlı işleri birleştirir ve kaynakları ayrı zamanlar',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-external-');try{let clock=Date.parse('2026-01-01T10:00:00Z'),weatherCalls=0,sunCalls=0,warningCalls=0,release;const settings={externalWeatherConsent:true,place:{latitude:40,longitude:29,timezone:'Europe/Istanbul',label:'Örnek / İstanbul / Türkiye'}};
 const store=await createExternalData({file:pathToFileURL(dir+'/cache.json'),now:()=>clock,weather:async()=>{weatherCalls++;await new Promise(r=>release=r);return {weather:{temperature_2m:20,weather_code:0},weatherAt:new Date(clock).toISOString()};},sun:async()=>{sunCalls++;return {dawn:'example'};},warnings:async()=>{warningCalls++;return [];}});
 for(let i=0;i<20;i++)store.read(settings);assert.equal(weatherCalls,0);const a=store.poll(settings),b=store.poll(settings);release();await Promise.all([a,b]);assert.equal(weatherCalls,1);assert.equal(sunCalls,1);assert.equal(warningCalls,1);for(let i=0;i<20;i++)assert.equal(store.read(settings).weather.temperature_2m,20);assert.equal(weatherCalls,1);
 await store.poll(settings);assert.equal(weatherCalls,1);clock+=600001;const c=store.poll(settings);release();await c;assert.equal(weatherCalls,2);assert.equal(sunCalls,1);assert.equal(warningCalls,1);
 const restored=await createExternalData({file:pathToFileURL(dir+'/cache.json'),now:()=>clock,weather:async()=>{throw Error('should not fetch');}});assert.equal(restored.read(settings).weather.temperature_2m,20);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Dış veri hata beklemesi, eski veri etiketi, konum/izin değişimi ve gece yarısı ayrılır',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-external-');try{let clock=Date.parse('2026-01-01T20:59:00Z'),calls=0,fail=false;const settings={externalWeatherConsent:true,place:{latitude:40,longitude:29,timezone:'Europe/Istanbul',label:'Örnek'}};
 let sunCalls=0;const store=await createExternalData({file:pathToFileURL(dir+'/cache.json'),now:()=>clock,weather:async()=>{calls++;if(fail)throw Error();return {weather:{temperature_2m:20,weather_code:0},weatherAt:new Date(clock).toISOString()};},sun:async()=>{sunCalls++;return {};},warnings:async()=>[]});await store.poll(settings);clock+=600001;fail=true;await store.poll(settings);assert.equal(store.read(settings).stale,true);assert.equal(store.read(settings).weather.temperature_2m,20);assert.equal(sunCalls,2);await store.poll(settings);assert.equal(calls,2);
 const moved={...settings,place:{...settings.place,latitude:41}};assert.equal(store.read(moved).weather,null);store.configure({...settings,externalWeatherConsent:false});assert.equal(store.read({...settings,externalWeatherConsent:false}).needsConsent,true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Soundbar için göreli ses uçları izin listelidir ve mutlak ses güvenli biçimde reddedilir',async()=>{
 assert.deepEqual(validateLGCommand({volumeStep:'up'}),{volumeStep:'up'});assert.throws(()=>validateLGCommand({volumeStep:'arbitrary'}));
 const dir=await mkdtemp(tmpdir()+'/ev-lg-volume-');try{const calls=[];class FakeTV extends EventEmitter{connected=true;constructor(){super();queueMicrotask(()=>this.emit('connect'));}async disconnect(){}async request(uri){calls.push(uri);return uri.includes('getSoundOutput')?{soundOutput:'external_arc'}:{returnValue:true};}}
 const d={id:'device-11111111-1111-1111-1111-111111111111'},c={ip:'192.168.1.20',secure:true};await mkdir(dir+'/'+d.id,{recursive:true});await writeFile(dir+'/'+d.id+'/client.key','fixture',{mode:0o600});const service=createLGService({directory:pathToFileURL(dir+'/'),Client:FakeTV});await service.command(d,c,{volumeStep:'up'});assert.ok(calls.includes('ssap://audio/volumeUp'));await assert.rejects(service.command(d,c,{volume:30}));assert.equal(calls.includes('ssap://audio/setVolume'),false);await service.close(d);
 }finally{await rm(dir,{recursive:true,force:true});}
});

import {validateCamera,cameraInput,jpegFrames,createCameraService} from '../camera.mjs';
test('Kamera bağlantısı yerel IP ile sınırlıdır; giriş bilgisi komut satırı yerine güvenli stdin içeriğidir',()=>{
 assert.throws(()=>validateCamera({ip:'8.8.8.8',username:'fixture',password:'fixture'}));assert.throws(()=>validateCamera({ip:'192.168.1.5',username:'fixture',password:'x\ny'}));
 const input=cameraInput({ip:'192.168.1.5',username:"fixture'",password:"fixture'\"!"});assert.match(input,/stream2/);assert.match(input,/%27/);assert.equal(input.split('\n').length,5);
 const frames=[],consume=jpegFrames(frame=>frames.push(Buffer.from(frame)));consume(Buffer.from([0,255]));consume(Buffer.from([216,1,2,255]));consume(Buffer.from([217,255,216,3,255,217]));assert.equal(frames.length,2);assert.deepEqual([...frames[0]],[255,216,1,2,255,217]);
});
test('İki kamera izleyicisi tek FFmpeg sürecini paylaşır; son çıkışta süreç kapanır, kullanıcı iptali denetlenir',async()=>{
 const children=[],session={key:'fixture',user:{id:'fixture',role:'admin'}};let allowed=true;class Child extends EventEmitter{constructor(){super();this.stdout=new EventEmitter();this.stdin=new EventEmitter();this.stdin.end=value=>this.source=value;this.killed=0;}kill(){this.killed++;}}
 const service=createCameraService({Spawn:(_file,args)=>{assert.equal(args.some(v=>v.includes('fixture-password')),false);const child=new Child();children.push(child);return child;},authenticate:async()=>allowed?session:null});
 class Response extends EventEmitter{headersSent=false;chunks=[];writeHead(code){this.code=code;this.headersSent=true;}write(data){this.chunks.push(data);return true;}end(){this.ended=true;}}
 const d={id:'fixture-camera',enabled:true,adapter:'tapo-rtsp'},c={ip:'192.168.1.5',username:'fixture-user',password:'fixture-password'},a=new Response(),b=new Response();service.open(d,c,{headers:{cookie:'fixture'}},a,session);service.open(d,c,{headers:{cookie:'fixture'}},b,session);assert.equal(children.length,1);assert.match(children[0].source,/fixture-password/);
 children[0].stdout.emit('data',Buffer.from([255,216,1,255,217]));await new Promise(r=>setImmediate(r));assert.equal(a.code,200);assert.equal(b.code,200);assert.equal(a.chunks.length,1);a.emit('close');assert.equal(children[0].killed,0);allowed=false;children[0].stdout.emit('data',Buffer.from([255,216,2,255,217]));await new Promise(r=>setImmediate(r));assert.equal(b.ended,true);assert.equal(children[0].killed,1);service.close();
});

import {createShutdown} from '../shutdown.mjs';
test('Yeni bildirim bekleyen eski sorguyu ezer; yeni okuyucu eski sorgunun bitmesini beklemez',async()=>{
 let clock=0,release,calls=0;const hub=createStatusCoordinator({now:()=>clock});await hub.read('fixture',async()=>({volume:10}));clock=30001;
 const old=hub.read('fixture',()=>{calls++;return new Promise(r=>release=r);});hub.publish('fixture',{volume:20});
 assert.equal((await hub.read('fixture',async()=>{throw Error('Yeni sorgu gerekmiyor');})).volume,20);release({volume:10});assert.equal((await old).volume,20);assert.equal(calls,1);
});
test('Komutla iptal edilen devam eden sorgu eski sonucu döndürmez; okuyucular taze sorguyu paylaşır',async()=>{
 let release,calls=0;const hub=createStatusCoordinator();const loader=async()=>{calls++;return calls===1?new Promise(r=>release=r):{power:'on'};};
 const a=hub.read('fixture',loader),b=hub.read('fixture',loader);hub.invalidate('fixture');release({power:'off'});assert.equal((await a).power,'on');assert.equal((await b).power,'on');assert.equal(calls,2);
});
test('Konum değişimi eski işi paylaşmaz; eski sorgu bitince yeni konum beklemeden okunur',async()=>{
 const dir=await mkdtemp(tmpdir()+'/ev-external-change-');try{let release,calls=0;const settings={externalWeatherConsent:true,place:{latitude:40,longitude:29,timezone:'Europe/Istanbul',label:'Fixture'}};
 const store=await createExternalData({file:pathToFileURL(dir+'/cache.json'),weather:async place=>{calls++;if(calls===1)await new Promise(r=>release=r);return {weather:{temperature_2m:place.latitude,weather_code:0},weatherAt:new Date().toISOString()};},sun:async()=>({}),warnings:async()=>[]});
 const old=store.poll(settings);const moved={...settings,place:{...settings.place,latitude:41}};const next=store.poll(moved);release();await Promise.all([old,next]);assert.equal(calls,2);assert.equal(store.read(moved).weather.temperature_2m,41);assert.equal(store.read(settings).weather,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Büyük kamera karesi geçici backpressure sırasında bağlantıyı kapatmaz; drain sonrası devam eder',async()=>{
 let child;class Child extends EventEmitter{constructor(){super();this.stdout=new EventEmitter();this.stdin=new EventEmitter();this.stdin.end=()=>{};}kill(){}}
 class Response extends EventEmitter{headersSent=false;writes=0;blocked=true;writeHead(){this.headersSent=true;}write(){this.writes++;return !this.blocked;}end(){this.ended=true;}}
 const session={key:'fixture',user:{id:'fixture',role:'admin'}},service=createCameraService({Spawn:()=>child=new Child(),authenticate:async()=>session});const res=new Response();service.open({id:'fixture',enabled:true,adapter:'tapo-rtsp'},{ip:'192.168.1.5',username:'fixture',password:'fixture'},{headers:{cookie:'fixture'}},res,session);
 assert.equal(service.status('fixture').state,'Kameraya bağlanılıyor');const frame=Buffer.concat([Buffer.from([255,216]),Buffer.alloc(100000),Buffer.from([255,217])]);child.stdout.emit('data',frame);await new Promise(r=>setImmediate(r));assert.equal(res.ended,undefined);assert.equal(res.writes,1);child.stdout.emit('data',frame);await new Promise(r=>setImmediate(r));assert.equal(res.writes,1);
 res.blocked=false;res.emit('drain');child.stdout.emit('data',frame);await new Promise(r=>setImmediate(r));assert.equal(res.writes,2);assert.equal(service.status('fixture').connected,true);service.close();
});
test('Kapanış bir kez çalışır; HTTP kapanması canlı akış temizliğini beklerken kilitlenmez',async()=>{
 let release,stops=0,cleans=0;const exits=[];const shutdown=createShutdown({stopAccepting:()=>{stops++;return new Promise(r=>release=r);},cleanups:[()=>{cleans++;release();}],exit:code=>exits.push(code)});
 const a=shutdown(),b=shutdown();assert.equal(a,b);await a;assert.equal(stops,1);assert.equal(cleans,1);assert.deepEqual(exits,[0]);
});
test('Takılan kapanış zaman sınırında çıkar; geç tamamlanma ikinci çıkış üretmez',async()=>{
 const exits=[];let release;const shutdown=createShutdown({stopAccepting:()=>new Promise(r=>release=r),exit:code=>exits.push(code),timeoutMs:10});const job=shutdown();await new Promise(r=>setTimeout(r,20));assert.deepEqual(exits,[1]);release();await job;assert.deepEqual(exits,[1]);
});
test('Bir kapanış adımı hata verirse diğer kaynaklar yine temizlenir ve başarısız çıkış bildirilir',async()=>{
 let cleaned=false;const exits=[];const shutdown=createShutdown({stopAccepting:()=>{},cleanups:[()=>{throw Error('fixture');},()=>{cleaned=true;}],exit:code=>exits.push(code)});await shutdown();assert.equal(cleaned,true);assert.deepEqual(exits,[1]);
});
test('Sunucu kapanışı son izleyiciden sonra da kamera alt sürecinin gerçekten kapanmasını bekler',async()=>{
 let child;class Child extends EventEmitter{constructor(){super();this.stdout=new EventEmitter();this.stdin=new EventEmitter();this.stdin.end=()=>{};}kill(){}}
 class Response extends EventEmitter{headersSent=false;writeHead(){this.headersSent=true;}end(){}}
 const session={key:'fixture',user:{id:'fixture',role:'admin'}},service=createCameraService({Spawn:()=>child=new Child(),authenticate:async()=>session});const res=new Response();service.open({id:'fixture',enabled:true,adapter:'tapo-rtsp'},{ip:'192.168.1.5',username:'fixture',password:'fixture'},{headers:{}},res,session);res.emit('close');let done=false;const closing=service.close().then(()=>done=true);await new Promise(r=>setImmediate(r));assert.equal(done,false);child.emit('close',0);await closing;assert.equal(done,true);
});

import {createCameraPtz} from '../camera-ptz.mjs';
test('Tapo yön kontrolü PTZ profilini seçer ve kısa hareketi durdurur',async()=>{
 const ip='192.168.50.2',origin='http://'+ip+':2020',calls=[];
 const config={ip,username:'fixture-user',password:'fixture-password'};
 let rejectMove=false;
 const move=createCameraPtz({
  wait:async ms=>assert.equal(ms,500),
  request:async (url,{body,headers,redirect})=>{
   const action=headers['Content-Type'].match(/\/(\w+)"$/)[1];
   calls.push(action);
   assert.equal(new URL(url).origin,origin);
   assert.equal(redirect,'error');
   assert.match(body,/#PasswordDigest/);
   assert.ok(!body.includes(config.password));
   const contents={
    GetCapabilities:`<tt:Media><tt:XAddr>${origin}/onvif/media</tt:XAddr></tt:Media><tt:PTZ><tt:XAddr>${origin}/onvif/ptz</tt:XAddr></tt:PTZ>`,
    GetProfiles:'<trt:Profiles token="other"><tt:VideoSourceConfiguration/></trt:Profiles><trt:Profiles token="camera-profile"><tt:PTZConfiguration token="ptz"><tt:DefaultContinuousPanTiltVelocitySpace>http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace</tt:DefaultContinuousPanTiltVelocitySpace></tt:PTZConfiguration></trt:Profiles>'
   };
   if(action==='ContinuousMove'){
    assert.match(body,/<o:ProfileToken>camera-profile<\/o:ProfileToken>/);
    assert.match(body,/<t:PanTilt x="-0.75" y="0" space="[^"]+VelocityGenericSpace"\/>/);
    assert.match(body,/<o:Timeout>PT1S<\/o:Timeout>/);
    if(rejectMove)return new Response('',{status:500});
   }
   return new Response(`<m:${action}Response>${contents[action]||''}</m:${action}Response>`);
  }
 });
 await assert.rejects(move('camera',config,'invalid'),/Geçerli bir kamera yönü/);
 assert.deepEqual(await move('camera',config,'left'),{ok:true});
 assert.deepEqual(calls.splice(0),['GetCapabilities','GetProfiles','ContinuousMove','Stop']);
 rejectMove=true;
 await assert.rejects(move('camera',config,'left'),/Hareket komutu doğrulanamadı/);
 assert.deepEqual(calls,['GetCapabilities','GetProfiles','ContinuousMove','Stop']);
});
