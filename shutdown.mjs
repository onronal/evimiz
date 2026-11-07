// Idempotent bounded shutdown: stop accepting first, release streams/children, then exit.
export function createShutdown({stopAccepting,cleanups=[],exit,timeoutMs=5000}) {
 let running;
 return function shutdown() {
  if(running)return running;
  running=(async()=>{
   let finished=false;
   const finish=code=>{if(finished)return;finished=true;clearTimeout(deadline);exit(code);};
   const deadline=setTimeout(()=>finish(1),timeoutMs);
   try {
    const stopped=Promise.resolve().then(stopAccepting);
    // Run cleanups before waiting for HTTP connections; streams would keep them open.
    const results=await Promise.allSettled([stopped,...cleanups.map(cleanup=>Promise.resolve().then(cleanup))]);
    finish(results.some(result=>result.status==='rejected')?1:0);
   }catch{finish(1);}
  })();
  return running;
 };
}
