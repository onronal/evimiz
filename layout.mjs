export const deviceNames={vacuum:'Robot süpürge',light:'Yatak odası ışığı',climate:'Samsung klima',washer:'Çamaşır makinesi',dishwasher:'Bulaşık makinesi',fryer:'Airfryer'};
export function validateLayout(input,devices=Object.keys(deviceNames).map(id=>({id}))){
 if(!Array.isArray(input.rooms)||input.rooms.length>40)throw Error('En fazla 40 oda ekleyebilirsiniz.');
 const rooms=input.rooms.map(r=>{if(typeof r.id!=='string'||!/^room-[a-zA-Z0-9-]{1,70}$/.test(r.id)||typeof r.name!=='string'||!r.name.trim()||r.name.trim().length>50)throw Error('Oda bilgileri geçersiz.');return {id:r.id,name:r.name.trim()};});
 if(new Set(rooms.map(r=>r.id)).size!==rooms.length||new Set(rooms.map(r=>r.name.toLocaleLowerCase('tr-TR'))).size!==rooms.length)throw Error('Oda adları ve kimlikleri benzersiz olmalı.');
 const assignments={};for(const [device,room]of Object.entries(input.assignments||{})){if(!devices.some(d=>d.id===device)||!(room===null||rooms.some(r=>r.id===room)))throw Error('Cihaz oda eşleştirmesi geçersiz.');assignments[device]=room;}
 const output={rooms,assignments};if(input.deviceOrder!==undefined){const ids=input.deviceOrder;if(!Array.isArray(ids)||ids.length>devices.length||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!devices.some(d=>d.id===id)))throw Error('Cihaz sırası geçersiz.');output.deviceOrder=[...ids];}return output;
}
export const internetIntervals=[3,5,15,30,60,180,360,1440];
export function validateInternetInterval(value){if(!internetIntervals.includes(value))throw Error('Geçersiz ölçüm aralığı.');return value;}
