const status=document.querySelector('#install-status')||document.createElement('p');
const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
status.textContent=installed?'Uygulama olarak açıldı.':"iPhone’da Safari → Paylaş → Ana Ekrana Ekle. Ardından simgeden açın.";
if(!window.isSecureContext)status.textContent+=' Kurulum ve bildirimler için sabit HTTPS bağlantısı hazırlanıyor.';
if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{status.textContent+=' Çevrimdışı ekran kaydedilemedi; sayfayı yenileyin.';});

const legacy={devices:'/devices',history:'/history',settings:'/admin',internet:'/internet',notifications:'/notifications'};if(location.pathname==='/'&&legacy[location.hash.slice(1)])location.replace(legacy[location.hash.slice(1)]);
for(const link of document.querySelectorAll('aside nav a'))if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');
