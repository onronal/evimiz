import {createCameraPtz} from './camera-ptz.mjs';
import http from 'node:http';
import {createShutdown} from './shutdown.mjs';
import {createCameraService,discoverCameras} from './camera.mjs';
import {deviceStatuses} from './device-status.mjs';
import {createDeviceStreams} from './device-events.mjs';
import {createNetworkService,networkDeviceNames} from './network.mjs';
const network=createNetworkService();
import {archiveDevice,restoreDevice} from './device-lifecycle.mjs';
import {lgService,discoverLG,validateLGConnection} from './lg.mjs';
import {createEarthquakeStore,validateEarthquakeSettings,distanceKm} from './earthquakes.mjs';
import {createExternalData} from './external-data.mjs';
import {addLocalDevice} from './local-setup.mjs';
import {notificationSettings,validateNotificationSettings} from './notification-settings.mjs';
import {cleaningHistory} from './history.mjs';
import {cleaningIntent,annotateActivity} from './cleaning-context.mjs';
import {cleaningTypes,vacationTransition} from './vacation.mjs';
import {createPushService} from './push.mjs';
import {notificationFeed} from './notifications.mjs';
import {validateAutomation,evaluateAutomation} from './automations.mjs';
import {hasConnection,saveConnection,readConnection,deviceStatus,deviceCommand,deviceApps} from './device-engine.mjs';
import {createAuth,authorize} from './auth.mjs';
const auth=createAuth(undefined,{bootstrap:true});
import {deviceCatalog,validateDevice,configuredDevices} from './devices.mjs';
import {validateLayout} from './layout.mjs';
import {readRooms,saveRooms} from './rooms.mjs';
import {activityTransition,internetQuality} from './activity.mjs';
import {readFile,mkdir,writeFile,rename,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {defaults,alerts,validateEvent} from './model.mjs';
import {searchLocations} from './environment.mjs';
import {bulbOperation} from './bulb.mjs';
import {internetState,runInternetTest,enableInternet} from './internet.mjs';
import {loginVestel,readVestel,vestelSummary,vestelClientStatus,configureVestelClient} from './vestel.mjs';
import {connectSmartThings,selectClimate} from './smartthings.mjs';
import {climateStatus,commandClimate} from './local-climate.mjs';
import {xiaomiStatus,vacuumCommand} from './xiaomi.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
await mkdir(root+'data',{recursive:true,mode:0o700});
let publicOrigin=process.env.PUBLIC_ORIGIN;try{publicOrigin||=JSON.parse(await readFile(root+'data/public-access.json','utf8')).origin;}catch(e){if(e.code!=='ENOENT')throw e;}
const push=createPushService({subject:publicOrigin||'https://evimiz.invalid/notifications'});
const earthquakeStore=await createEarthquakeStore();
let state;
try {state=JSON.parse(await readFile(root+'data/state.json','utf8'));}
catch(e){if(e.code!=='ENOENT')throw e;state={settings:structuredClone(defaults),events:[]};}
state.settings.thresholds={...defaults.thresholds,...state.settings.thresholds};
state.settings.layout||={rooms:[],assignments:{}};
if(!state.settings.devices){const configured=await configuredDevices();state.settings.devices=deviceCatalog.filter(d=>configured[d.id]).map(d=>({id:d.id,type:d.id,adapter:d.adapter,name:({light:'Yatak odası ışığı',climate:'Samsung WindFree',washer:'Çamaşır makinesi',dishwasher:'Bulaşık makinesi',vacuum:'Robot süpürge',fryer:'Airfryer'}[d.id]),enabled:true}));}
for(const d of state.settings.devices)if(d.legacy===undefined)d.legacy=!d.id.startsWith('device-');
if(state.settings.indoorTemperatureSource===undefined)state.settings.indoorTemperatureSource=state.settings.devices.find(d=>d.type==='climate')?.id||null;
state.vacationEvents||=[];state.vacationTracking||={};state.settings.vacationMode||=false;
state.automations||=[];for(const rule of state.automations)delete rule.conditions;state.automationTracking||={};state.automationLog||=[];
state.settings.earthquakes||={enabled:!!state.settings.place,minMagnitude:3,radiusKm:100,since:new Date().toISOString()};
async function save(){await writeFile(root+'data/state.tmp',JSON.stringify(state,null,2),{mode:0o600});await rename(root+'data/state.tmp',root+'data/state.json');}
await save();
let queue=Promise.resolve();
let shuttingDown=false;
const moveCamera=createCameraPtz();
const cameraService=createCameraService({authenticate:cookie=>auth.session(cookie),active:id=>state.settings.devices.some(d=>d.id===id&&d.enabled&&d.adapter==='tapo-rtsp')});
const externalData=await createExternalData({onUpdate:()=>deviceStreams.notify('environment').catch(()=>{})});
const deviceStreams=createDeviceStreams({authenticate:cookie=>auth.session(cookie),allowedDevice:id=>id==='environment'||state.settings.devices.some(d=>d.id===id&&d.enabled)});
externalData.configure(state.settings);
async function pollEnvironment(){if(shuttingDown)return;await externalData.poll(state.settings);}
setTimeout(()=>pollEnvironment().catch(()=>{}),500).unref();setInterval(()=>pollEnvironment().catch(()=>{}),30000).unref();
deviceStatuses.onUpdate(id=>deviceStreams.notify(id).catch(()=>{}));
const sharedPolling=new Set();
async function pollSharedDevices(){if(shuttingDown)return;const flags=await configuredDevices();for(const d of state.settings.devices.filter(d=>d.enabled)){if(sharedPolling.has(d.id))continue;sharedPolling.add(d.id);(async()=>{try{if(await hasConnection(d,flags))await deviceStatus(d);}catch{}finally{sharedPolling.delete(d.id);}})();}}
setTimeout(()=>pollSharedDevices().catch(()=>{}),1500).unref();setInterval(()=>pollSharedDevices().catch(()=>{}),15000).unref();
function legacyStatus(type){const d=state.settings.devices.find(d=>d.legacy&&d.type===type&&d.enabled);if(!d)throw Error('Etkin cihaz bulunamadı.');return deviceStatus(d);}
let vestelAttempts=[],vestelLoginBusy=false;
let vestelPollError=null;
let vestelPollBusy=false;
async function pollVestel(){if(shuttingDown)return;
 if(vestelPollBusy||vestelLoginBusy)return;
 vestelPollBusy=true;
 try{if(!(await vestelSummary()).connected)return;const snapshot=await readVestel();const operation=queue.then(async()=>{
  state.vestelTracking||={};
  state.activityTracking||={};
  for(const device of snapshot.devices){if(!device.kind||!device.readable||!device.stateKey||!state.settings.devices.some(d=>d.legacy&&d.id===device.kind))continue;const {next,events}=activityTransition(state.activityTracking[device.kind],{...device,resetCycle:['Selection','PreProgram'].includes(device.stateKey)},snapshot.at,device.kind);state.activityTracking[device.kind]=next;annotateActivity(state,{id:device.kind,type:device.kind},device,[],snapshot.at);for(const event of events)if(!state.events.some(e=>e.eventId===event.eventId))state.events.unshift(...annotateActivity(state,{id:device.kind,type:device.kind},device,[event],snapshot.at));}
  await appendFile(root+'data/vestel-observations-'+snapshot.at.slice(0,10)+'.jsonl',JSON.stringify({at:snapshot.at,devices:snapshot.devices})+'\n',{mode:0o600});
  await save();
 });queue=operation.catch(()=>{});await operation;vestelPollError=null;for(const d of state.settings.devices.filter(d=>['washer','dishwasher'].includes(d.type)))deviceStatuses.invalidate(d.id);
 }catch{vestelPollError='Vestel verileri güncellenemedi; son alınan bilgi gösteriliyor.';}
 finally{vestelPollBusy=false;}
}
setInterval(()=>pollVestel(),60000).unref();setTimeout(()=>pollVestel(),1000).unref();
let xiaomiPollBusy=false;
async function pollXiaomi(){if(shuttingDown)return;if(xiaomiPollBusy)return;xiaomiPollBusy=true;try{for(const kind of ['vacuum','fryer']){if(!state.settings.devices.some(d=>d.legacy&&d.id===kind))continue;try{const current=await legacyStatus(kind);const operation=queue.then(async()=>{if(!state.settings.devices.some(d=>d.legacy&&d.id===kind))return;state.activityTracking||={};const result=activityTransition(state.activityTracking[kind],current,current.at,kind);state.activityTracking[kind]=result.next;state.events.unshift(...annotateActivity(state,{id:kind,type:kind},current,result.events,current.at));await save();});queue=operation.catch(()=>{});await operation;}catch{}}}finally{xiaomiPollBusy=false;}}
setTimeout(pollXiaomi,2000).unref();setInterval(pollXiaomi,30000).unref();
let instancePollBusy=false;
async function pollInstances(){if(shuttingDown)return;if(instancePollBusy)return;instancePollBusy=true;try{for(const d of state.settings.devices.filter(d=>!d.legacy&&d.enabled&&['washer','dishwasher','vacuum','fryer'].includes(d.type))){try{if(!await hasConnection(d,{}))continue;const current=await deviceStatus(d);const operation=queue.then(async()=>{if(!state.settings.devices.some(current=>current.id===d.id&&current.enabled))return;state.activityTracking||={};const previous=state.activityTracking[d.id];const transition=activityTransition(previous,current,current.at||new Date().toISOString(),d.type);state.activityTracking[d.id]=transition.next;state.events.unshift(...annotateActivity(state,d,current,transition.events.map(e=>({...e,eventId:e.eventId+':'+d.id,source:d.adapter==='vestel-cloud'?'vestel':'xiaomi'})),current.at||new Date().toISOString()));await save();});queue=operation.catch(()=>{});await operation;}catch{}}}finally{instancePollBusy=false;}}
setTimeout(pollInstances,3000).unref();setInterval(pollInstances,60000).unref();
async function automationContext(){const active=state.automations.filter(r=>r.enabled);const useSun=active.some(r=>['dawn','dusk'].includes(r.trigger.type));const useOutdoor=useSun||active.some(r=>r.trigger.source==='outdoor');const useIndoor=active.some(r=>r.trigger.source==='indoor');let outside=null,sun=null;if(useOutdoor&&state.settings.externalWeatherConsent&&state.settings.place){try{const e=externalData.read(state.settings);if(Date.now()-Date.parse(e.updatedAt)<15*60000){const age=Date.now()-Date.parse(e.weatherAt);outside=age>=-120000&&age<20*60000?e.weather?.temperature_2m??null:null;sun=e.sun;}}catch{}}let indoor=null;const source=state.settings.devices.find(d=>d.id===state.settings.indoorTemperatureSource);if(useIndoor&&source)try{const s=await deviceStatus(source);if(Date.now()-Date.parse(s.temperatureAt||s.at)<5*60000)indoor=s.temperature??null;}catch{}return {timezone:state.settings.place?.timezone||'Europe/Istanbul',outdoor:outside,indoor,sun};}
async function rememberVacuum(device,input){if(device.type!=='vacuum'||!['rooms','start'].includes(input.command))return;if(input.command==='start'&&state.activityTracking?.[device.id]?.cycleOpen)return;const intent=cleaningIntent(input,await readRooms(device));const op=queue.then(async()=>{state.vacuumIntents||={};state.vacuumIntents[device.id]=intent;await save();});queue=op.catch(()=>{});await op;}
async function instanceCommand(device,input){const result=await deviceCommand(device,input);await rememberVacuum(device,input);return result;}
async function legacyVacuum(input){const result=await vacuumCommand(input.command,input.rooms,undefined,'vacuum',input.mapId);await rememberVacuum({id:'vacuum',type:'vacuum',legacy:true},input);return result;}
async function settleTimers(){if(shuttingDown)return;try{const snapshot=await vestelSummary();const mapping=[];for(const d of state.settings.devices.filter(d=>d.enabled&&['washer','dishwasher'].includes(d.type))){let physical=d.legacy?snapshot.devices.find(x=>x.kind===d.type):null;if(!d.legacy){try{const c=await readConnection(d);physical=snapshot.devices.find(x=>x.id===c?.deviceId);}catch{continue;}}if(physical)mapping.push([d,physical]);}const op=queue.then(async()=>{state.activityTracking||={};let changed=false;for(const [d,current]of mapping){annotateActivity(state,d,current,[],snapshot.at);if(!current.estimatedCompletion||!current.remainingTimer?.cycleId)continue;const cycleId=current.remainingTimer.cycleId;if(state.events.some(e=>e.device===d.id&&e.kind==='completed'&&e.timerCycleId===cycleId))continue;const at=new Date(Date.parse(current.remainingTimer.anchorAt)+current.remainingTimer.anchorMinutes*60000).toISOString();state.events.unshift(...annotateActivity(state,d,current,[{kind:'completed',at,observedAt:new Date().toISOString(),eventId:'timer:'+d.id+':'+cycleId}],at));state.activityTracking[d.id]={...state.activityTracking[d.id],running:false,completed:true,cycleOpen:false,timerCycleId:cycleId};changed=true;}if(changed)await save();});queue=op.catch(()=>{});await op;}catch{}}
setInterval(settleTimers,15000).unref();
async function automationCommand(device,input){if(!device.legacy)return instanceCommand(device,input);if(device.type==='light')return bulbOperation({'20':input.power});if(device.type==='climate')return commandClimate(input);if(device.type==='vacuum')return legacyVacuum(input);throw Error('Cihaz komutu desteklenmiyor.');}
let automationBusy=false;
async function pollAutomations(){if(shuttingDown)return;if(automationBusy||state.settings.vacationMode||!state.automations.some(r=>r.enabled))return;automationBusy=true;try{const context=await automationContext();for(const candidate of [...state.automations]){let run=null;const operation=queue.then(async()=>{const rule=state.automations.find(r=>r.id===candidate.id);if(!rule?.enabled||state.settings.vacationMode)return;const previous=state.automationTracking[rule.id]||{},result=evaluateAutomation(rule,{...context,resumeAfter:state.settings.automationsResumeAfter},previous);const resumeAfter=state.settings.automationsResumeAfter;const rebaseline=rule.trigger.type==='temperature'&&resumeAfter&&previous.resumeAfter!==resumeAfter;state.automationTracking[rule.id]={...previous,matched:result.matched,resumeAfter};if(result.due&&!rebaseline){const device=state.settings.devices.find(d=>d.id===rule.action.deviceId&&d.enabled);state.automationTracking[rule.id]={matched:result.matched,resumeAfter,key:result.key,attemptAt:new Date().toISOString()};run={rule:structuredClone(rule),device};}await save();});queue=operation.catch(()=>{});await operation;if(run&&!shuttingDown&&!state.settings.vacationMode&&state.settings.devices.some(d=>d.id===run.device?.id&&d.enabled)&&state.automations.some(r=>r.id===run.rule.id&&r.enabled)){let success=false;try{if(!run.device)throw Error();await automationCommand(run.device,run.rule.action.command);success=true;}catch{}const update=queue.then(async()=>{state.automationLog.unshift({id:run.rule.id,name:run.rule.name,at:new Date().toISOString(),success,message:success?'Komut gönderildi; cihaz durumunu kontrol edin.':'Komut tamamlanamadı; cihaz bağlantısını kontrol edin.'});state.automationLog=state.automationLog.slice(0,100);await save();});queue=update.catch(()=>{});await update;}}}finally{automationBusy=false;}}
setTimeout(()=>pollAutomations().catch(()=>{}),5000).unref();setInterval(()=>pollAutomations().catch(()=>{}),30000).unref();
function nearbyEarthquakes(){const config=state.settings.earthquakes,place=state.settings.place,snapshot=earthquakeStore.status();return {...snapshot,config,needsLocation:!place,events:place?snapshot.events.map(e=>({...e,distanceKm:distanceKm(place,e)})).filter(e=>e.magnitude>config.minMagnitude&&e.distanceKm<=config.radiusKm).map(e=>({...e,distanceKm:Math.round(e.distanceKm*10)/10})):[]};}
function buildNotificationFeed(){return notificationFeed(state,internetState(),Date.now(),nearbyEarthquakes());}
async function pollEarthquakes(){if(shuttingDown)return;await earthquakeStore.poll(state.settings.earthquakes,state.settings.place);}
setTimeout(()=>pollEarthquakes(),7000).unref();setInterval(()=>pollEarthquakes(),120000).unref();
let pushBusy=false;
async function pollPush(){if(shuttingDown)return;if(pushBusy)return;pushBusy=true;try{const feed=buildNotificationFeed();const users=(await auth.list()).filter(u=>u.enabled&&!u.mustChangePassword).map(u=>u.id);await push.deliver(feed.notifications.filter(e=>e.category!=='vacation'||state.settings.vacationMode&&e.at>=state.settings.vacationSince),users,{badInternet:feed.quality.bad,episodeAt:internetState().history[0]?.at});}catch{}finally{pushBusy=false;}}
setTimeout(pollPush,10000).unref();setInterval(pollPush,30000).unref();
let vacationBusy=false;
async function pollVacation(){if(shuttingDown)return;if(vacationBusy||!state.settings.vacationMode)return;vacationBusy=true;const since=state.settings.vacationSince;try{for(const d of state.settings.devices.filter(d=>!cleaningTypes.has(d.type))){try{if(!await hasConnection(d,await configuredDevices()))continue;const status=await deviceStatus(d);const at=new Date().toISOString();const job=queue.then(async()=>{if(!state.settings.vacationMode||state.settings.vacationSince!==since||!state.settings.devices.some(current=>current.id===d.id&&current.enabled))return;const result=vacationTransition(state.vacationTracking[d.id],d.type,status,at);if(result.next)state.vacationTracking[d.id]=result.next;if(result.alert){state.vacationEvents.unshift({id:'vacation:'+d.id+':'+at,at,device:d.id,text:'Tatil modunda '+d.name+(result.initial?' açık/çalışıyor görüldü.':' çalıştırıldı.')});state.vacationEvents=state.vacationEvents.slice(0,100);}await save();});queue=job.catch(()=>{});await job;}catch{}}}finally{vacationBusy=false;}}
setTimeout(()=>pollVacation().catch(()=>{}),6000).unref();setInterval(()=>pollVacation().catch(()=>{}),30000).unref();
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(data.length>8192)throw Error('İstek çok büyük');}return JSON.parse(data);}
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
const server=http.createServer(async(req,res)=>{
 try{
  if(shuttingDown){res.setHeader('Connection','close');return json(res,503,{error:'Sunucu yeniden başlatılıyor. Kısa süre sonra tekrar deneyin.'});}
  const url=new URL(req.url,'http://localhost');const path=url.pathname;
  const isLocal=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)&&[`127.0.0.1:${process.env.PORT||4173}`,`localhost:${process.env.PORT||4173}`].includes(req.headers.host);
  const allowedOrigins=new Set([`http://${req.headers.host}`,...(publicOrigin?[publicOrigin]:[])]);
  if(req.method==='POST'&&(!req.headers.origin||!allowedOrigins.has(req.headers.origin)))return json(res,403,{error:'Kaynak reddedildi'});
  if(req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON gerekli'});
  const session=await auth.session(req.headers.cookie);
  if(req.method==='GET'&&path==='/api/auth/me')return json(res,200,{user:session?.user||null,csrf:session?.csrf||null,needsSetup:await auth.needsSetup()});
  if(req.method==='POST'&&['/api/auth/setup','/api/auth/login'].includes(path)){
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON gerekli'});
   const input=await body(req);
   if(path.endsWith('/setup')){if(!isLocal||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin))return json(res,403,{error:'İlk yöneticiyi bu bilgisayarda 127.0.0.1:4173 adresinden oluşturun.'});return json(res,200,await auth.setup(input));}
   if(await auth.needsPasswordSetup()&&(!isLocal||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)))return json(res,403,{error:'İlk parolayı bu bilgisayarda 127.0.0.1 adresinden değiştirin.'});
   try{const result=await auth.login(input,req.socket.remoteAddress);const secure=req.headers.origin?.startsWith('https:')?'; Secure':'';res.setHeader('Set-Cookie','ev_session='+result.token+'; HttpOnly; SameSite=Strict; Path=/'+(result.maxAge?'; Max-Age='+result.maxAge:'')+secure);return json(res,200,{user:result.user});}catch(e){return json(res,401,{error:e.message});}
  }
  const pages=['/','/network','/devices','/history','/earthquakes','/internet','/notifications','/admin','/automations','/help','/lg-setup','/integration-setup','/vestel-setup','/smartthings-setup'];
  if((path.startsWith('/api/')||pages.includes(path))&&!session){if(path.startsWith('/api/'))return json(res,401,{error:'Giriş yapmanız gerekiyor.'});res.writeHead(302,{Location:'/login','Cache-Control':'no-store'});return res.end();}
  const adminPage=['/admin','/lg-setup','/integration-setup','/vestel-setup','/smartthings-setup'].includes(path);
  const memberPost=['/api/bulb','/api/climate','/api/xiaomi/vacuum','/api/events','/api/auth/logout','/api/auth/password','/api/push/subscribe','/api/push/unsubscribe','/api/push/test'].includes(path)||/^\/api\/devices\/[^/]+\/commands$/.test(path);
  const adminOnly=adminPage||path.startsWith('/api/lg/')||path.startsWith('/api/vestel/')||(path.startsWith('/api/users')||(path.startsWith('/api/automations')&&req.method!=='GET'))||(req.method==='POST'&&!memberPost);
  if(session?.user.mustChangePassword&&!['/api/auth/password','/api/auth/logout'].includes(path)&&(pages.includes(path)||path.startsWith('/api/'))){if(path.startsWith('/api/'))return json(res,403,{error:'Önce başlangıç parolasını değiştirin.'});res.writeHead(302,{Location:'/login'});return res.end();}
  if(session&&adminOnly&&!authorize(session.user.role,true))return json(res,403,{error:'Bu işlem için yönetici yetkisi gerekli.'});
  if(req.method==='POST'&&(!session||req.headers['x-csrf-token']!==session.csrf))return json(res,403,{error:'Oturum doğrulaması başarısız. Sayfayı yenileyin.'});
  if(req.method==='GET'&&path==='/api/device-events')return deviceStreams.open(req,res,session);
  if(req.method==='POST'&&path==='/api/auth/password')return json(res,200,{user:await auth.changePassword(session,await body(req))});
  if(req.method==='POST'&&path==='/api/auth/logout'){await auth.logout(session);res.setHeader('Set-Cookie','ev_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
  if(req.method==='GET'&&path==='/api/network'){const data=await network.status(),names=await networkDeviceNames(state.settings.devices);return json(res,200,{...data,devices:data.devices.map(d=>({...d,name:names.get(d.ip)||d.hostname||null}))});}
  if(req.method==='GET'&&path==='/api/automations')return json(res,200,{rules:state.automations,log:state.automationLog});
  if(req.method==='GET'&&path==='/api/push')return json(res,200,{publicKey:await push.publicKey(),...await push.status(session.user.id)});
  if(req.method==='POST'&&path.startsWith('/api/push/')){const input=await body(req);if(path==='/api/push/subscribe')return json(res,200,await push.subscribe(session.user.id,input));if(path==='/api/push/unsubscribe')return json(res,200,await push.unsubscribe(session.user.id,input.endpoint));if(path==='/api/push/test')return json(res,200,await push.test(session.user.id,input.endpoint));return json(res,404,{error:'Adres bulunamadı.'});}
  if(req.method==='GET'&&path==='/api/users')return json(res,200,{users:await auth.list()});
  if(req.method==='POST'&&['/api/users','/api/users/update'].includes(path)){const input=await body(req);return json(res,200,path.endsWith('/update')?await auth.update(input):await auth.create(input));}
  if(req.method==='GET'&&['/api/xiaomi/vacuum','/api/xiaomi/fryer'].includes(path))return json(res,200,await legacyStatus(path.split('/').at(-1)));
  const local=req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::1'||req.socket.remoteAddress==='::ffff:127.0.0.1';
  const setupAccess=local&&['127.0.0.1:4173','localhost:4173'].includes(req.headers.host);
  if((path==='/smartthings-setup'||path.startsWith('/api/smartthings/'))&&!setupAccess)return json(res,403,{error:'SmartThings kurulumu yalnızca bu bilgisayardan yapılabilir.'});
  if(req.method==='GET'&&path==='/api/temperature'){const d=state.settings.devices.find(d=>d.id===state.settings.indoorTemperatureSource);if(!d)return json(res,200,{enabled:false});try{const status=await deviceStatus(d);return json(res,200,{enabled:true,deviceId:d.id,source:d.name,temperature:status.temperature??null,unit:status.unit||'C',at:status.temperatureAt||status.at||null});}catch{return json(res,200,{enabled:true,deviceId:d.id,source:d.name,temperature:null,unit:'C',at:null});}}
  if(req.method==='GET'&&path==='/api/climate')return json(res,200,await legacyStatus('climate'));
  if((path==='/lg-setup'||path.startsWith('/api/lg/'))&&!setupAccess)return json(res,403,{error:'LG kurulumunu bu bilgisayarda http://127.0.0.1:4173 adresinden açın.'});
  if(req.method==='GET'&&path==='/api/lg/pair-status'){const d=state.settings.devices.find(d=>d.id===url.searchParams.get('deviceId')&&d.adapter==='lg-webos');if(!d)return json(res,404,{error:'TV bulunamadı.'});return json(res,200,{...lgService.pairStatus(d),paired:await lgService.paired(d)});}
  if((path==='/integration-setup'||path==='/api/local-setup')&&!setupAccess)return json(res,403,{error:'Bu kurulumu sunucuda http://127.0.0.1:4173 adresinden açın.'});
  if((path==='/vestel-setup'||path.startsWith('/api/vestel/'))&&!setupAccess)return json(res,403,{error:'Bu işlem yalnızca bilgisayarda http://127.0.0.1:4173 adresinden yapılabilir.'});
  if(req.method==='GET'&&path==='/api/vestel/client')return json(res,200,{...vestelClientStatus(),connected:(await vestelSummary()).connected});
  if(req.method==='GET'&&path==='/api/xiaomi/rooms')return json(res,200,await readRooms());
  if(req.method==='GET'&&path==='/api/notification-settings'){if(session.user.role!=='admin')return json(res,403,{error:'Yönetici yetkisi gerekli.'});return json(res,200,notificationSettings(state.settings));}
  if(req.method==='GET'&&path==='/api/earthquakes'){const data=nearbyEarthquakes(),page=Math.max(1,Math.min(50,Math.floor(Number(url.searchParams.get('page')))||1));return json(res,200,{...data,events:data.events.slice((page-1)*20,page*20),total:data.events.length,page});}
  if(req.method==='GET'&&path==='/api/notifications')return json(res,200,{...buildNotificationFeed(),pushAvailable:true});
  if(req.method==='GET'&&path==='/api/vestel')return json(res,200,{...await vestelSummary(),pollError:vestelPollError});
  if(req.method==='GET'&&path==='/api/internet')return json(res,200,internetState());
  if(req.method==='GET'&&path==='/api/bulb'){
   try{return json(res,200,await legacyStatus('light'));}
   catch{return json(res,503,{error:'Ampule ulaşılamadı. Elektriğini ve ağ bağlantısını kontrol edin.'});}
  }
  if(req.method==='GET'&&path==='/api/locations'){
   if(!state.settings.externalWeatherConsent)return json(res,403,{error:'Önce konum paylaşımı iznini açıp kaydedin.'});
   return json(res,200,{results:await searchLocations(url.searchParams.get('q')||'')});
  }
  if(req.method==='GET'&&path==='/api/environment'){
   if(!state.settings.externalWeatherConsent)return json(res,200,{needsConsent:true});
   if(!state.settings.place)return json(res,200,{needsLocation:true});
   return json(res,200,externalData.read(state.settings));
  }
  if(req.method==='GET'&&path==='/api/help'){const guides={tuya:'integrations/tuya.md',vestel:'integrations/vestel.md',samsung:'integrations/samsung.md',xiaomi:'integrations/xiaomi.md',lg:'integrations/lg.md',tapo:'integrations/tapo.md',raspberry:'raspberry-pi.md',notifications:'notifications.md',access:'external-access-options.md'};const key=url.searchParams.get('guide');const name=Object.hasOwn(guides,key)?guides[key]:null;if(!name)return json(res,404,{error:'Rehber bulunamadı.'});return json(res,200,{text:await readFile(root+'docs/'+name,'utf8')});}
  if(req.method==='GET'&&path==='/api/devices/archived'){if(session.user.role!=='admin')return json(res,403,{error:'Yönetici yetkisi gerekli.'});return json(res,200,{devices:(state.archivedDevices||[]).map(e=>({id:e.device.id,name:e.device.name,archivedAt:e.archivedAt}))});}
  if(req.method==='GET'&&path==='/api/devices'){const configured=await configuredDevices();const devices=await Promise.all(state.settings.devices.map(async d=>({...d,configured:await hasConnection(d,configured),automationCount:state.automations.filter(r=>r.action.deviceId===d.id).length})));return json(res,200,{catalog:deviceCatalog,devices});}
  if(req.method==='POST'&&path==='/api/cameras/discover')return json(res,200,{devices:await discoverCameras()});
  const cameraRoute=path.match(/^\/api\/devices\/([^/]+)\/camera-stream$/);if(cameraRoute&&req.method==='GET'){if(session.user.role!=='admin')return json(res,403,{error:'Kamera görüntüsü yalnız yöneticiye açık.'});const d=state.settings.devices.find(d=>d.id===cameraRoute[1]&&d.adapter==='tapo-rtsp'&&d.enabled);if(!d)return json(res,404,{error:'Etkin kamera bulunamadı.'});cameraService.open(d,await readConnection(d),req,res,session);return;}
  const instanceRoute=path.match(/^\/api\/devices\/([^/]+)\/(status|commands|connection|rooms|apps)$/);
  if(instanceRoute){if((req.method==='GET'&&!['status','rooms','apps'].includes(instanceRoute[2]))||(req.method==='POST'&&instanceRoute[2]==='status'))return json(res,405,{error:'Yöntem desteklenmiyor.'});const d=state.settings.devices.find(d=>d.id===instanceRoute[1]);if(!d)return json(res,404,{error:'Cihaz bulunamadı.'});if(instanceRoute[2]==='apps'){if(req.method!=='GET')return json(res,405,{error:'Yöntem desteklenmiyor.'});return json(res,200,await deviceApps(d));}if(d.type==='vacuum'&&req.method==='GET'&&instanceRoute[2]==='rooms')return json(res,200,await readRooms(d));if(d.type==='vacuum'&&req.method==='POST'&&instanceRoute[2]==='rooms')return json(res,200,await saveRooms((await body(req)).rooms,d));if(req.method==='GET'&&instanceRoute[2]==='status'){if(d.type==='camera'&&session.user.role!=='admin')return json(res,403,{error:'Kamera durumu yalnız yöneticiye açık.'});try{if(!d.enabled)throw Error('Cihaz devre dışı.');return json(res,200,d.type==='camera'?cameraService.status(d.id):await deviceStatus(d));}catch{return json(res,503,{error:'Cihaz durumu okunamadı. Bağlantı ve kurulum bilgilerini kontrol edin.'});}}if(req.method==='POST'){const input=await body(req);if(instanceRoute[2]==='connection')return json(res,200,await saveConnection(d,input));if(instanceRoute[2]==='commands'&&!d.enabled)return json(res,403,{error:'Cihaz devre disi. Once yonetimden etkinlestirin.'});if(instanceRoute[2]==='commands')return json(res,200,await instanceCommand(d,input));}}
  if(req.method==='GET'&&path==='/api/history')return json(res,200,cleaningHistory(state,{page:url.searchParams.get('page')||1,pageSize:20,device:url.searchParams.get('device')||'all',weekOffset:url.searchParams.get('weekOffset')||0}));
  if(req.method==='GET'&&path==='/api/state'){if(url.searchParams.get('summary')==='1')return json(res,200,{settings:state.settings,alerts:alerts(state.settings,state.events),eventCount:state.events.length,cleaningCount:cleaningHistory(state).total});return json(res,200,{...state,alerts:alerts(state.settings,state.events)});}
  if(req.method==='POST'){
   const allowedOrigins=new Set([`http://${req.headers.host}`,...(publicOrigin?[publicOrigin]:[])]);
   if(req.headers.origin && !allowedOrigins.has(req.headers.origin))return json(res,403,{error:'Kaynak reddedildi'});
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON gerekli'});
   const input=await body(req);
   const legacyType=({'/api/bulb':'light','/api/climate':'climate','/api/xiaomi/vacuum':'vacuum'})[path];if(legacyType&&!state.settings.devices.some(d=>d.legacy&&d.id===legacyType&&d.enabled))return json(res,404,{error:'Etkin cihaz kaydı bulunamadı.'});
   const cameraMove=path.match(/^\/api\/devices\/([^/]+)\/camera-move$/);
   if(cameraMove){
    const camera=state.settings.devices.find(d=>d.id===cameraMove[1]&&d.adapter==='tapo-rtsp'&&d.enabled);
    if(!camera)return json(res,404,{error:'Etkin kamera bulunamadı.'});
    return json(res,200,await moveCamera(camera.id,await readConnection(camera),input?.direction));
   }
   if(path==='/api/network/scan')return json(res,200,await network.scan());
   if(path==='/api/lg/discover')return json(res,200,{devices:await discoverLG()});
   if(path==='/api/lg/pair'){const d=state.settings.devices.find(d=>d.id===input.deviceId&&d.adapter==='lg-webos'&&d.enabled);if(!d)throw Error('Etkin TV kaydını seçin.');return json(res,200,lgService.startPair(d,await readConnection(d)));}
   if(path==='/api/xiaomi/vacuum')return json(res,200,await legacyVacuum(input));
   if(path.startsWith('/api/smartthings/')&&!['http://127.0.0.1:4173','http://localhost:4173'].includes(req.headers.origin))return json(res,403,{error:'Yerel kurulum ekranını kullanın.'});
   if(path==='/api/smartthings/connect')return json(res,200,await connectSmartThings(input.token));
   if(path==='/api/smartthings/select')return json(res,200,await selectClimate(input.deviceId));
   if(path==='/api/climate')return json(res,200,await commandClimate(input));
   if(path==='/api/vestel/client'){
    if(vestelLoginBusy||vestelPollBusy)return json(res,409,{error:'Vestel bağlantısı kullanılıyor. Biraz sonra tekrar deneyin.'});
    vestelLoginBusy=true;try{return json(res,200,await configureVestelClient(input));}finally{vestelLoginBusy=false;input.clientSecret='';}
   }
   if(path==='/api/vestel/login'){
    if(req.headers.origin!=='http://127.0.0.1:4173'&&req.headers.origin!=='http://localhost:4173')return json(res,403,{error:'Yerel giriş ekranını kullanın.'});
    if(typeof input.email!=='string'||input.email.length>254||typeof input.password!=='string'||!input.password||input.password.length>1024)throw Error('Giriş bilgilerini kontrol edin.');
    vestelAttempts=vestelAttempts.filter(t=>Date.now()-t<60000);
    if(vestelLoginBusy||vestelAttempts.length>=3)return json(res,429,{error:'Giriş sürüyor veya çok deneme yapıldı. Bir dakika bekleyin.'});
    vestelAttempts.push(Date.now());vestelLoginBusy=true;
    try{return json(res,200,await loginVestel(input.email,input.password));}finally{vestelLoginBusy=false;input.password='';}
   }
   if(path==='/api/xiaomi/rooms')return json(res,200,await saveRooms(input.rooms));
   if(path==='/api/vestel/refresh')return json(res,200,await readVestel());
   if(path==='/api/internet/settings'){
    if(typeof input.enabled!=='boolean')throw Error('Geçersiz internet testi ayarı');
    return json(res,200,await enableInternet(input.enabled,input.intervalMinutes));
   }
   if(path==='/api/internet/test'){
    if(!internetState().enabled)return json(res,403,{error:'Önce Cloudflare ölçümünü etkinleştirin.'});
    if(internetState().running)return json(res,409,{error:'Bir ölçüm zaten devam ediyor.'});
    const last=internetState().history[0];if(last&&Date.now()-Date.parse(last.at)<60000)return json(res,429,{error:'Yeni test için bir dakika bekleyin.'});
    return json(res,200,await runInternetTest());
   }
   if(path==='/api/bulb'){
    const data={};
    if(typeof input.power==='boolean')data['20']=input.power;
    if(input.brightness!==undefined){if(!Number.isInteger(input.brightness)||input.brightness<1||input.brightness>100)throw Error('Parlaklık 1–100 arasında olmalı');data['22']=Math.max(10,input.brightness*10);data['21']='white';}
    if(input.temperature!==undefined){if(!Number.isInteger(input.temperature)||input.temperature<0||input.temperature>100)throw Error('Renk ayarı 0–100 arasında olmalı');data['23']=input.temperature*10;data['21']='white';}
    if(!Object.keys(data).length)throw Error('Geçerli bir ampul komutu gerekli');
    try{return json(res,200,{connected:true,dps:(await bulbOperation(data)).dps});}
    catch{return json(res,503,{error:'Komut doğrulanamadı. Ampul durumunu yenileyin.'});}
   }
   const operation=queue.then(async()=>{
    if(path==='/api/lg/setup'){validateLGConnection(input.connection);let d;if(input.id){d=state.settings.devices.find(d=>d.id===input.id&&d.adapter==='lg-webos');if(!d)throw Error('TV bulunamadı.');const checked=validateDevice({...input,type:'tv'},state.settings.devices.filter(x=>x.id!==d.id),state.settings.layout.rooms);await saveConnection(d,input.connection);d.name=checked.name;d.model=checked.model;}else{d=validateDevice({...input,type:'tv'},state.settings.devices,state.settings.layout.rooms);await saveConnection(d,input.connection);state.settings.devices.push(d);}state.settings.layout.assignments[d.id]=input.roomId||null;await save();return {id:d.id};
    }else if(path==='/api/earthquake-settings'){
const config=validateEarthquakeSettings(input);if(config.enabled&&!state.settings.place)throw Error('Önce ev konumunu seçin.');const old=state.settings.earthquakes;state.settings.earthquakes={...config,since:old.enabled===config.enabled&&old.minMagnitude===config.minMagnitude&&old.radiusKm===config.radiusKm?old.since:new Date().toISOString()};
    }else if(path==='/api/local-setup'){await addLocalDevice(input,state.settings);
    }else if(path==='/api/notification-settings'){state.settings.notifications=validateNotificationSettings(input,state.settings.devices);
    }else if(path==='/api/vacation'){if(typeof input.enabled!=='boolean')throw Error('Geçersiz tatil modu.');if(state.settings.vacationMode!==input.enabled){state.settings.vacationMode=input.enabled;state.settings.automationsResumeAfter=new Date().toISOString();state.settings.vacationSince=input.enabled?new Date().toISOString():null;state.vacationTracking={};}
    }else if(path==='/api/automations'){const rule=validateAutomation(input,state.settings.devices,Object.fromEntries(await Promise.all(state.settings.devices.filter(d=>d.type==='vacuum').map(async d=>[d.id,await readRooms(d)]))));if(state.automations.length>=100)throw Error('En fazla 100 kural eklenebilir.');state.automations.push(rule);
    }else if(path==='/api/automations/update'){const i=state.automations.findIndex(r=>r.id===input.id);if(i<0)throw Error('Kural bulunamadı.');const rule=validateAutomation(input,state.settings.devices,Object.fromEntries(await Promise.all(state.settings.devices.filter(d=>d.type==='vacuum').map(async d=>[d.id,await readRooms(d)]))));state.automations[i]={...rule,id:input.id};state.automationTracking[input.id]={};
    }else if(path==='/api/automations/delete'){state.automations=state.automations.filter(r=>r.id!==input.id);delete state.automationTracking[input.id];
    }else if(path==='/api/temperature-source'){const source=input.deviceId;if(source!==null&&!state.settings.devices.some(d=>d.id===source&&deviceCatalog.find(s=>s.id===d.type)?.capabilities.includes('temperature')))throw Error('Sıcaklık kaynağını kontrol edin.');state.settings.indoorTemperatureSource=source;
    }else if(path==='/api/devices'){const device=validateDevice(input,state.settings.devices,state.settings.layout.rooms);state.settings.devices.push(device);state.settings.layout.assignments[device.id]=input.roomId||null;
    }else if(path==='/api/devices/archive'){const d=state.settings.devices.find(d=>d.id===input.id);if(d?.adapter==='lg-webos')await lgService.close(d);if(d?.adapter==='tapo-rtsp')cameraService.stop(d.id);archiveDevice(state,input.id);
    }else if(path==='/api/devices/restore'){restoreDevice(state,input.id);
    }else if(path==='/api/devices/update'){const d=state.settings.devices.find(d=>d.id===input.id);if(!d||typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>60||typeof input.enabled!=='boolean')throw Error('Cihaz bilgilerini kontrol edin.');d.name=input.name.trim();d.enabled=input.enabled;
    }else if(path==='/api/home-layout'){state.settings.layout=validateLayout({...input,deviceOrder:input.deviceOrder??state.settings.layout.deviceOrder},state.settings.devices);
    }else if(path==='/api/settings'){
     const {home,location,thresholds}=input;
     if(typeof home!=='string'||home.length<1||home.length>80||typeof location!=='string'||location.length>120||!['washer','dishwasher','vacuum'].every(k=>Number.isInteger(thresholds?.[k])&&thresholds[k]>=1&&thresholds[k]<=365))throw Error('Ayarları kontrol edin');
     const externalWeatherConsent=input.externalWeatherConsent===true;
     let place=state.settings.place;
     if(input.place){
      const p=input.place;
      if(!externalWeatherConsent||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180||typeof p.label!=='string'||p.label.length>300||typeof p.timezone!=='string')throw Error('Geçersiz konum');
      new Intl.DateTimeFormat('tr-TR',{timeZone:p.timezone});
      place={latitude:p.latitude,longitude:p.longitude,label:p.label,timezone:p.timezone};
     }else if(location!==state.settings.location)place=null;
     if(place?.latitude!==state.settings.place?.latitude||place?.longitude!==state.settings.place?.longitude)state.settings.earthquakes.since=new Date().toISOString();
     state.settings={...state.settings,home,location,thresholds,externalWeatherConsent,place};
    }else if(path==='/api/events'){
     const event=validateEvent(input,state.settings.devices);
     if(state.events.some(e=>e.eventId===event.eventId))return {duplicate:true};
     state.events.unshift(event);
    }else throw Error('Adres bulunamadı');
    await save();if(path==='/api/settings'){externalData.configure(state.settings);setImmediate(()=>pollEnvironment().catch(()=>{}));}return {ok:true};
   });queue=operation.catch(()=>{});return json(res,200,await operation);
  }
  const files={'/tv-joystick.js':'tv-joystick.js','/device-live.js':'device-live.js','/network':'network.html','/network.js':'network.js','/lg-setup':'lg-setup.html','/lg-setup.js':'lg-setup.js','/earthquakes':'earthquakes.html','/earthquakes.js':'earthquakes.js','/integration-setup':'integration-setup.html','/integration-setup.js':'integration-setup.js','/help':'help.html','/help.js':'help.js','/push-client.js':'push-client.js','/automations':'automations.html','/automations.js':'automations.js','/internet-graph.js':'internet-graph.js','/login':'login.html','/login.js':'login.js','/session.js':'session.js','/devices':'devices.html','/history':'history.html','/internet':'internet.html','/notifications':'notifications.html','/overview.js':'overview.js','/history.js':'history.js','/light.js':'light.js','/device-list.js':'device-list.js','/admin':'admin.html','/admin.js':'admin.js','/layout.js':'layout.js','/remaining.js':'remaining.js','/xiaomi.js':'xiaomi.js','/smartthings-setup':'smartthings-setup.html','/smartthings-setup.js':'smartthings-setup.js','/climate.js':'climate.js','/':'index.html','/app.js':'app.js','/style.css':'style.css','/install.js':'install.js','/manifest.webmanifest':'manifest.webmanifest','/icon.svg':'icon.svg','/sw.js':'sw.js','/offline.html':'offline.html','/vestel-setup':'vestel-setup.html','/vestel-setup.js':'vestel-setup.js','/internet.js':'internet.js'};
  if(req.method!=='GET'||!files[path])return json(res,404,{error:'Bulunamadı'});
  const mime=path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';
  res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; frame-ancestors 'none'"});res.end(await readFile(root+'static/'+files[path]));
 }catch(e){json(res,400,{error:e.message});}
});
server.listen(Number(process.env.PORT||4173),process.env.HOST||'127.0.0.1',()=>console.log('Ev paneli: http://'+(process.env.HOST||'127.0.0.1')+':'+(process.env.PORT||4173)));

const shutdown=createShutdown({
 stopAccepting:()=>{shuttingDown=true;return new Promise(resolve=>{const sweep=setInterval(()=>server.closeIdleConnections?.(),100);sweep.unref();server.close(()=>{clearInterval(sweep);resolve();});server.closeIdleConnections?.();});},
 cleanups:[()=>deviceStreams.close(),()=>cameraService.close(),async()=>{await Promise.allSettled(state.settings.devices.filter(d=>d.adapter==='lg-webos').map(d=>lgService.close(d)));},()=>queue],
 exit:code=>process.exit(code),
 timeoutMs:5000
});
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
