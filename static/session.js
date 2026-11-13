(()=>{const original=window.fetch.bind(window);const ready=original('/api/auth/me').then(r=>r.json()).then(me=>{if(!me.user||me.user.mustChangePassword){location.replace('/login');throw Error('Oturum gerekli.');}window.evUser=me.user;document.documentElement.dataset.role=me.user.role;const prepare=()=>{for(const a of document.querySelectorAll('a[href^="/admin"]'))a.dataset.adminOnly='';const header=document.querySelector('main header');
if(header){
 const home=header.querySelector(':scope > a[href="/"]');
 if(home?.textContent.trim()==='Evimiz'&&document.querySelector('aside .brand'))home.remove();
 const menu=document.createElement('details');
 menu.className='account-menu';
 const summary=document.createElement('summary');
 summary.textContent=me.user.username;
 const actions=document.createElement('div');
 actions.className='account-actions';
 const password=document.createElement('a');
 password.href='/account';
 password.textContent='Parolayı değiştir';
 const logout=document.createElement('button');
 logout.type='button';
 logout.textContent='Çıkış yap';
 logout.addEventListener('click',async()=>{
  try{
   if('serviceWorker'in navigator){
    const registration=await navigator.serviceWorker.getRegistration();
    const sub=await registration?.pushManager?.getSubscription();
    if(sub){
     await window.fetch('/api/push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
     await sub.unsubscribe();
    }
   }
  }catch{}
  await window.fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  location.replace('/login');
 });
 actions.append(password,logout);
 menu.append(summary,actions);
 document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.open=false;});
 menu.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus();}
 });
 header.append(menu);
}
};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepare);else prepare();return me;});ready.catch(()=>{});window.evSession=ready;window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return original(input,options);const me=await ready;const headers=new Headers(options.headers||{});if((options.method||'GET').toUpperCase()!=='GET')headers.set('X-CSRF-Token',me.csrf);const response=await original(input,{...options,headers});if(response.status===401)location.replace('/login');return response;};})();
