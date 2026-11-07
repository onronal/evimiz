import {EventEmitter} from 'node:events';

// Device reads, HTTP clients and push updates share the same versioned state.
export function createStatusCoordinator({now=Date.now,ttl=30000,errorTtl=30000}={}) {
 const entries=new Map(),pending=new Map(),generation=new Map();
 const events=new EventEmitter(),superseded=Symbol('superseded');
 events.setMaxListeners(100);
 const version=id=>generation.get(id)||0;
 const emit=id=>events.emit('update',id);
 function invalidate(id){generation.set(id,version(id)+1);entries.delete(id);}
 function publish(id,value){generation.set(id,version(id)+1);entries.set(id,{value,at:now()});emit(id);}
 async function read(id,loader,{maxAge=ttl}={}) {
  // A push may already have supplied fresh data while an older read is pending.
  const cached=entries.get(id);
  if(cached&&now()-cached.at<(cached.error?errorTtl:maxAge)) {
   if(cached.error)throw cached.error;
   return cached.value;
  }
  if(pending.has(id)) {
   const existing=pending.get(id);
   await existing.catch(()=>{});
   if(pending.get(id)===existing)pending.delete(id);
   return read(id,loader,{maxAge});
  }
  const started=version(id);
  const work=(async()=>{
   try {
    const value=await loader();
    if(version(id)!==started)return superseded;
    entries.set(id,{value,at:now()});emit(id);
    return value;
   }catch(error) {
    if(version(id)!==started)return superseded;
    entries.set(id,{error,at:now()});emit(id);
    throw error;
   }
  })();
  pending.set(id,work);
  let value;
  try{value=await work;}finally{if(pending.get(id)===work)pending.delete(id);}
  // Never return the old result to the initiating caller either.
  return value===superseded?read(id,loader,{maxAge}):value;
 }
 return {
  read,invalidate,publish,
  patch(id,patch){const previous=entries.get(id);if(previous?.value)publish(id,{...previous.value,...patch});},
  onUpdate(listener){events.on('update',listener);return()=>events.off('update',listener);},
  forget(id){invalidate(id);},peek(id){return entries.get(id)?.value;}
 };
}
export const deviceStatuses=createStatusCoordinator();
