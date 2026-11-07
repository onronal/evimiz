const CACHE='evimiz-shell-v2';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/icon.svg'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('evimiz-shell-')&&k!==CACHE).map(k=>caches.delete(k))))])));
// Device states and commands are never cached or replayed.
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
self.addEventListener('push',event=>{let data={title:'Evimiz',body:'Evinden yeni bir haber var.'};try{Object.assign(data,event.data?.json());}catch{}event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:data.tag,icon:'/icon.svg',badge:'/icon.svg',data:{url:data.url||'/notifications'}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data?.url||'/notifications',self.location.origin);if(target.origin!==self.location.origin)return;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{for(const win of windows)if(new URL(win.url).origin===target.origin){await win.navigate(target.href);return win.focus();}return clients.openWindow(target.href);}));});
