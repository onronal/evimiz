// One SSE connection per visible page; listeners only fetch the shared server cache.
const listeners=new Map();let source=null,connected=false;
function connectionState(value){connected=value==='connected';document.documentElement.dataset.deviceLive=value;}
function notify(id){if(document.hidden)return;for(const [key,callbacks]of listeners)if(id===null||key===id||key==='*')for(const callback of callbacks)Promise.resolve().then(callback).catch(()=>{});}
function open(){if(document.hidden||source||!listeners.size)return;connectionState('connecting');source=new EventSource('/api/device-events');source.addEventListener('ready',()=>{connectionState('connected');notify(null);});source.addEventListener('device',event=>{try{const data=JSON.parse(event.data);if(typeof data.id==='string')notify(data.id);}catch{}});source.onerror=()=>{connectionState('reconnecting');};}
export function watchDevice(id,callback){if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(callback);open();return()=>{listeners.get(id)?.delete(callback);if(!listeners.get(id)?.size)listeners.delete(id);if(!listeners.size){source?.close();source=null;connectionState('paused');}};}
document.addEventListener('visibilitychange',()=>{if(document.hidden){source?.close();source=null;connectionState('paused');}else{open();notify(null);}});
window.addEventListener('pagehide',()=>{source?.close();source=null;connectionState('paused');});window.addEventListener('pageshow',open);
// Poll only when the live connection is unavailable. This still uses server-side caching.
setInterval(()=>{if(!connected)notify(null);},30000);
