// Pointer Events joystick: local UI only; transport stays in the existing bounded queue.
export function createJoystick({move,stopMovement,ready,sensitivity=()=>1,label='Analog imleç · basılı tutup yön verin'}){
 const zone=document.createElement('div'),knob=document.createElement('span');zone.className='tv-joystick';zone.tabIndex=0;zone.setAttribute('role','application');zone.setAttribute('aria-label',label);knob.className='tv-joystick-knob';zone.append(knob);let touch=null,x=0,y=0,timer;
 function stop(){clearInterval(timer);timer=null;touch=null;x=y=0;knob.style.transform='translate(0px,0px)';stopMovement();}
 function update(event){const box=zone.getBoundingClientRect(),radius=Math.min(box.width,box.height)*.32,dx=event.clientX-(box.left+box.width/2),dy=event.clientY-(box.top+box.height/2),length=Math.hypot(dx,dy),scale=length>radius?radius/length:1;x=dx*scale/radius;y=dy*scale/radius;knob.style.transform=`translate(${x*radius}px,${y*radius}px)`;}
 zone.addEventListener('pointerdown',event=>{if(!ready()||touch!==null||event.button!==0)return;event.preventDefault();touch=event.pointerId;zone.setPointerCapture(event.pointerId);update(event);timer=setInterval(()=>{if(document.hidden||!zone.isConnected||zone.hidden||!ready()){stop();return;}if(Math.hypot(x,y)>.15)move(Math.round(x*22*sensitivity()),Math.round(y*22*sensitivity()));},60);});
 zone.addEventListener('pointermove',event=>{if(touch===event.pointerId){event.preventDefault();update(event);}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(name,stop);
 zone.addEventListener('keydown',event=>{const direction={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[event.key];if(direction&&ready()){event.preventDefault();move(...direction);}});
 window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return {element:zone,stop};
}
