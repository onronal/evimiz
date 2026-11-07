export function createDeviceStreams({authenticate,allowedDevice,heartbeatMs=15000,maxClients=64,maxPerUser=6}={}){
 const clients=new Set();
 async function valid(client){const session=await authenticate(client.cookie);if(!session||session.key!==client.session.key||session.user.mustChangePassword){client.close();return false;}return true;}
 return {
 open(req,res,session){if(clients.size>=maxClients||[...clients].filter(c=>c.session.user.id===session.user.id).length>=maxPerUser){res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Çok fazla canlı bağlantı.'}));return;}
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.();
  const client={res,session,cookie:req.headers.cookie,closed:false,close(){if(client.closed)return;client.closed=true;clearInterval(timer);clients.delete(client);res.end();}};
  const timer=setInterval(async()=>{try{if(await valid(client))if(!res.write(': keepalive\n\n'))client.close();}catch{client.close();}},heartbeatMs);timer.unref?.();clients.add(client);res.on('close',()=>client.close());res.write('retry: 3000\nevent: ready\ndata: {}\n\n');
 },
 async notify(id){if(!allowedDevice(id))return;await Promise.all([...clients].map(async c=>{try{if(await valid(c))if(!c.res.write('event: device\ndata: '+JSON.stringify({id})+'\n\n'))c.close();}catch{c.close();}}));},
 close(){for(const c of clients)c.close();},get size(){return clients.size;}
 };
}
