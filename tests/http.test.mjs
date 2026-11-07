import test from 'node:test';
import {request as httpRequest,createServer} from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,copyFile,cp,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {createPublicProxy} from '../public-proxy.mjs';
test('İzole HTTP: yönetici/üye yetkileri, çoklu cihaz ve anahtar gizliliği',async()=>{
 const temp=await mkdtemp(tmpdir()+'/ev-panel-http-'),root=fileURLToPath(new URL('../',import.meta.url));let child,proxy;
 try{
  for(const f of await readdir(root))if(f.endsWith('.mjs')||f.endsWith('.py'))await copyFile(root+f,temp+'/'+f);
  await copyFile(root+'mgm-provinces.json',temp+'/mgm-provinces.json');
  await cp(root+'static',temp+'/static',{recursive:true});await symlink(root+'node_modules',temp+'/node_modules','dir');
  const port=randomInt(40000,59000);child=spawn(process.execPath,['server.mjs'],{cwd:temp,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',PUBLIC_ORIGIN:'https://example.test-tailnet.ts.net',VESTEL_CLIENT_ID:'',VESTEL_CLIENT_SECRET:''},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test sunucusu başlamadı')),10000);child.stdout.on('data',chunk=>{if(chunk.toString().includes('Ev paneli:')){clearTimeout(timer);resolve();}});child.on('exit',code=>{clearTimeout(timer);reject(Error('Test sunucusu kapandı: '+code));});child.on('error',reject);});
  const base='http://127.0.0.1:'+port;let cookie='',csrf='';
  async function req(path,body,{token=true,origin=base}={}){const headers={...(cookie?{Cookie:cookie}:{})};if(body!==undefined){headers['Content-Type']='application/json';headers.Origin=origin;if(token&&csrf)headers['X-CSRF-Token']=csrf;}const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
  assert.equal((await req('/api/state')).status,401);assert.equal((await req('/api/environment')).status,401);assert.equal((await req('/api/device-events')).status,401);
  assert.equal((await req('/api/auth/me')).data.needsSetup,false);
  const admin={username:'admin',password:'admin'};assert.equal((await req('/api/auth/setup',admin)).status,400);
  const login=await req('/api/auth/login',admin);assert.equal(login.status,200);assert.equal(login.data.user.mustChangePassword,true);assert.equal(login.cookie.includes('Max-Age='),false);assert.match(login.cookie,/HttpOnly/);assert.match(login.cookie,/SameSite=Strict/);cookie=login.cookie.split(';')[0];csrf=(await req('/api/auth/me')).data.csrf;
  assert.equal((await req('/api/state')).status,403);
  assert.equal((await req('/api/auth/password',{currentPassword:'admin',password:'only-for-isolated-tests'})).status,200);
  const rememberLogin=await req('/api/auth/login',{username:'admin',password:'only-for-isolated-tests',remember:true});assert.match(rememberLogin.cookie,/Max-Age=2592000/);assert.equal((await req('/api/state')).status,200);assert.equal((await req('/api/devices')).data.devices.length,0);assert.equal((await req('/api/state')).data.settings.location,'');
  assert.equal((await req('/api/temperature')).data.enabled,false);
  function setupReq(input,path='/api/vestel/client'){return new Promise((resolve,reject)=>{const r=httpRequest(base+path,{method:input?'POST':'GET',headers:{Host:'127.0.0.1:4173',Cookie:cookie,...(input?{Origin:'http://127.0.0.1:4173','Content-Type':'application/json','X-CSRF-Token':csrf}:{})}},reply=>{let text='';reply.on('data',chunk=>text+=chunk);reply.on('end',()=>{try{resolve({status:reply.statusCode,data:JSON.parse(text)});}catch(e){reject(e);}});});r.on('error',reject);r.end(input?JSON.stringify(input):undefined);});}
  assert.equal((await setupReq()).data.configured,false);assert.equal((await setupReq({clientId:'fixtureClient',clientSecret:'fixtureSecret'})).status,200);const clientStatus=await setupReq();assert.equal(clientStatus.data.configured,true);assert.equal(clientStatus.data.clientSecret,undefined);assert.equal(JSON.stringify((await req('/api/state')).data).includes('fixtureSecret'),false);assert.equal((await setupReq({clientId:'',clientSecret:''})).status,400);

  const prefs=(await req('/api/notification-settings')).data;assert.equal(prefs.internet,true);assert.equal((await req('/api/notification-settings',{...prefs,internet:false})).status,200);assert.equal((await req('/api/notification-settings')).data.internet,false);assert.equal((await req('/api/notification-settings',{...prefs,internet:'false'})).status,400);
  assert.equal((await req('/api/devices',{type:'light',name:'Lamba 1',roomId:null},{token:false})).status,403);
  assert.equal((await req('/api/devices',{type:'light',name:'Lamba 1',roomId:null},{origin:'https://foreign.invalid'})).status,403);
  assert.equal((await req('/api/devices',{type:'light',name:'Lamba 1',roomId:null})).status,200);
  assert.equal((await req('/api/devices',{type:'light',name:'Lamba 2',roomId:null})).status,200);
  assert.equal((await req('/api/temperature-source',{deviceId:'not-a-device'})).status,400);
  const ds=(await req('/api/devices')).data.devices;assert.equal(ds.length,2);assert.notEqual(ds[0].id,ds[1].id);
  assert.equal((await req('/api/automations',{name:'Sentetik kapalı kural',enabled:false,trigger:{type:'time',at:'20:00'},conditions:{},action:{deviceId:ds[0].id,command:{power:true}}})).status,200);assert.equal((await req('/api/automations')).data.rules.length,1);assert.equal((await req('/api/automations')).data.rules[0].conditions,undefined);assert.equal((await req('/api/automations',{name:'Ek koşul',enabled:false,trigger:{type:'time',at:'20:00'},conditions:{daylight:'night'},action:{deviceId:ds[0].id,command:{power:true}}})).status,400);
  assert.equal((await req('/api/devices/'+ds[0].id+'/connection',{ip:'192.168.0.30',deviceId:'testdevice012345',localKey:'0123456789abcdef',version:'3.3'})).status,200);
  assert.equal(JSON.stringify((await req('/api/devices')).data).includes('0123456789abcdef'),false);
  assert.equal((await req('/api/devices/'+ds[0].id+'/connection')).status,405);
  const lgSetup=await setupReq({name:'Fixture LG',model:'65QNED86-test',roomId:null,connection:{ip:'192.168.1.45',secure:true,mac:''}},'/api/lg/setup');assert.equal(lgSetup.status,200);const lgId=lgSetup.data.id;assert.equal((await setupReq(undefined,'/api/lg/pair-status?deviceId='+lgId)).data.paired,false);assert.equal((await setupReq({name:'Bad LG',connection:{ip:'8.8.8.8',secure:true}},'/api/lg/setup')).status,400);
  assert.equal((await req('/api/devices/archive',{id:lgId})).status,200);assert.equal((await req('/api/devices/'+lgId+'/apps')).status,404);assert.equal((await req('/api/devices/archived')).data.devices.some(d=>d.id===lgId),true);assert.equal((await req('/api/devices/restore',{id:lgId})).status,200);assert.equal((await req('/api/devices')).data.devices.find(d=>d.id===lgId).enabled,false);
  assert.equal((await req('/api/network')).status,200);const roomLayout={rooms:[{id:'room-fixture',name:'Fixture oda'}],assignments:{[ds[0].id]:'room-fixture',[ds[1].id]:'room-fixture'},deviceOrder:[ds[1].id,ds[0].id]};assert.equal((await req('/api/home-layout',roomLayout)).status,200);assert.deepEqual((await req('/api/state?summary=1')).data.settings.layout.deviceOrder,roomLayout.deviceOrder);assert.equal((await req('/api/home-layout',{...roomLayout,deviceOrder:[ds[0].id,ds[0].id]})).status,400);
  const initialCount=(await req('/api/devices')).data.devices.length;
  assert.equal((await setupReq({brand:'tuya',type:'light',name:'Yeni Tuya',connection:{ip:'192.168.1.40',deviceId:'fixturedevice123',localKey:'abcdefghijklmnop',version:'3.3'}},'/api/local-setup')).status,200);
  assert.equal((await setupReq({brand:'xiaomi',type:'fryer',name:'Yeni Xiaomi',connection:{ip:'192.168.1.41',did:'123456789',token:'abcdef0123456789abcdef0123456789',model:'careli.fryer.maf02'}},'/api/local-setup')).status,200);
  assert.equal((await req('/api/devices')).data.devices.length,initialCount+2);assert.equal(JSON.stringify((await req('/api/devices')).data).includes('abcdefghijklmnop'),false);
  assert.equal((await setupReq({brand:'xiaomi',type:'light',name:'Hatalı'},'/api/local-setup')).status,400);assert.equal((await req('/api/devices')).data.devices.length,initialCount+2);
  assert.equal((await req('/api/earthquakes')).data.total,0);assert.equal((await req('/api/earthquake-settings',{enabled:true,minMagnitude:3,radiusKm:100})).status,400);assert.equal((await req('/api/earthquake-settings',{enabled:false,minMagnitude:3,radiusKm:120})).status,200);
  proxy=createPublicProxy('https://example.test-tailnet.ts.net',port);await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));const gateway='http://127.0.0.1:'+proxy.address().port;
  assert.equal((await fetch(gateway+'/api/auth/setup')).status,403);assert.equal((await fetch(gateway+'/integration-setup?brand=xiaomi')).status,403);assert.equal((await fetch(gateway+'/api/local-setup')).status,403);assert.equal((await fetch(gateway+'/lg-setup')).status,403);assert.equal((await fetch(gateway+'/api/lg/pair-status')).status,403);assert.equal((await fetch(gateway+'/vestel-setup')).status,403);assert.equal((await fetch(gateway+'/api/vestel/client')).status,403);
  const publicLogin=await fetch(gateway+'/api/auth/login',{method:'POST',headers:{Origin:'https://example.test-tailnet.ts.net','Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'only-for-isolated-tests'})});assert.equal(publicLogin.status,200);assert.match(publicLogin.headers.get('set-cookie'),/Secure/);
  const publicWrite=await fetch(gateway+'/api/temperature-source',{method:'POST',headers:{Origin:'https://example.test-tailnet.ts.net','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:JSON.stringify({deviceId:null})});assert.equal(publicWrite.status,200);
  assert.equal((await fetch(gateway+'/api/temperature-source',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:'{}'})).status,403);
  assert.equal((await req('/api/devices',{type:'camera',name:'Fixture kamera',model:'C200',roomId:null})).status,200);const cameraId=(await req('/api/devices')).data.devices.find(d=>d.type==='camera').id;
  assert.equal((await req('/api/devices/'+cameraId+'/camera-move',{direction:'invalid'})).status,400);
  assert.equal((await req('/api/users',{username:'test_member',password:'only-for-member-tests',role:'member'})).status,200);
  const memberLogin=await req('/api/auth/login',{username:'test_member',password:'only-for-member-tests'});cookie=memberLogin.cookie.split(';')[0];csrf=(await req('/api/auth/me')).data.csrf;assert.equal((await req('/api/devices/'+cameraId+'/status')).status,403);
  assert.equal((await req('/api/devices/'+cameraId+'/camera-move',{direction:'left'})).status,403);
  assert.equal((await req('/api/devices/device-11111111-1111-1111-1111-111111111111/camera-stream')).status,403);assert.equal((await req('/api/cameras/discover',{})).status,403);
  assert.equal((await req('/api/state')).status,200);assert.equal((await setupReq()).status,403);assert.equal((await setupReq({clientId:'illegal',clientSecret:'illegal'})).status,403);
  const streamAbort=new AbortController();const live=await fetch(base+'/api/device-events',{headers:{Cookie:cookie},signal:streamAbort.signal});assert.equal(live.status,200);assert.match(live.headers.get('content-type'),/text\/event-stream/);const reader=live.body.getReader();const first=await reader.read();assert.match(new TextDecoder().decode(first.value),/event: ready/);streamAbort.abort();await reader.cancel().catch(()=>{});
  const livePublicAbort=new AbortController();const externalLive=await fetch(gateway+'/api/device-events',{headers:{Cookie:cookie},signal:livePublicAbort.signal});assert.equal(externalLive.status,200);const externalReader=externalLive.body.getReader();assert.match(new TextDecoder().decode((await externalReader.read()).value),/event: ready/);livePublicAbort.abort();await externalReader.cancel().catch(()=>{});
  const push=await req('/api/push');assert.equal(push.status,200);assert.equal(push.data.privateKey,undefined);assert.equal(push.data.count,0);const subscription={endpoint:'https://web.push.apple.com/QPush/test-http-only',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}};assert.equal((await req('/api/push/subscribe',{subscription})).status,200);assert.equal((await req('/api/push')).data.count,1);assert.equal((await req('/api/push/test',{endpoint:subscription.endpoint})).status,200);assert.equal((await req('/api/push/unsubscribe',{endpoint:subscription.endpoint})).status,200);assert.equal((await req('/api/push')).data.count,0);
  assert.equal((await setupReq({brand:'tuya'},'/api/local-setup')).status,403);assert.equal((await req('/api/earthquake-settings',{enabled:false,minMagnitude:3,radiusKm:120})).status,403);
  assert.equal((await setupReq({},'/api/lg/setup')).status,403);assert.equal((await setupReq(undefined,'/api/lg/pair-status?deviceId='+lgId)).status,403);
  assert.equal((await req('/api/devices/archive',{id:lgId})).status,403);assert.equal((await req('/api/devices/restore',{id:lgId})).status,403);assert.equal((await req('/api/devices/archived')).status,403);
  assert.equal((await req('/api/network')).status,200);assert.equal((await fetch(base+'/network',{headers:{Cookie:cookie}})).status,200);assert.equal((await req('/api/network/scan',{})).status,403);
  for(const [path,body]of [['/api/devices',{type:'light',name:'Illegal'}],['/api/home-layout',{rooms:[],assignments:{}}],['/api/xiaomi/rooms',{rooms:[]}],['/api/users',{username:'illegal',role:'admin',password:'illegal-test-password'}],['/api/devices/'+ds[0].id+'/connection',{}]])assert.equal((await req(path,body)).status,403,path);
  assert.equal((await req('/api/notification-settings')).status,403);assert.equal((await req('/api/notification-settings',{internet:false,reminders:false,vacation:false,devices:{}})).status,403);
  assert.equal((await req('/api/automations')).status,200);const automationPage=await fetch(base+'/automations',{headers:{Cookie:cookie}});assert.equal(automationPage.status,200);assert.equal((await req('/api/vacation',{enabled:true})).status,403);assert.equal((await req('/api/automations',{name:'Yetkisiz'})).status,403);assert.equal((await req('/api/users')).status,403);const page=await fetch(base+'/admin',{headers:{Cookie:cookie}});assert.equal(page.status,403);
  const shutdownStream=await fetch(base+'/api/device-events',{headers:{Cookie:cookie}});const shutdownReader=shutdownStream.body.getReader();await shutdownReader.read();
  assert.equal((await req('/api/auth/logout',{})).status,200);assert.equal((await req('/api/state')).status,401);
  const exited=once(child,'close');child.kill('SIGTERM');const [exitCode,signal]=await exited;assert.equal(exitCode,0);assert.equal(signal,null);assert.equal((await shutdownReader.read()).done,true);
 }finally{if(proxy)await new Promise(resolve=>proxy.close(resolve));if(child&&child.exitCode===null){child.kill();await once(child,'close');}await rm(temp,{recursive:true,force:true});}
});

test('Funnel canlı bağlantısı kapandığında iç sunucu akışı da kapanır',async()=>{
 let resolveClosed;const closed=new Promise(r=>resolveClosed=r);const upstream=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('event: ready\ndata: {}\n\n');res.on('close',resolveClosed);});let proxy;
 try{upstream.listen(0,'127.0.0.1');await once(upstream,'listening');proxy=createPublicProxy('https://fixture.ts.net',upstream.address().port);proxy.listen(0,'127.0.0.1');await once(proxy,'listening');const controller=new AbortController();const response=await fetch('http://127.0.0.1:'+proxy.address().port+'/api/device-events',{signal:controller.signal});const reader=response.body.getReader();await reader.read();controller.abort();await reader.cancel().catch(()=>{});await Promise.race([closed,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('İç akış açık kaldı')),2000);t.unref();})]);
 }finally{proxy?.closeAllConnections();proxy?.close();upstream.closeAllConnections();upstream.close();}
});
