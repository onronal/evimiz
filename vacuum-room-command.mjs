import {validateRoomSelection} from './rooms.mjs';
export function buildRoomAction(device,map,roomIds,mapId,{suction,water}){
 if(device.model!=='dreame.vacuum.p2140p')throw Error('Bu model için oda komutu doğrulanmadı.');
 if(mapId===undefined||map.mapId===undefined)throw Error('Robot oda listesini yenileyip tekrar seçin.');
 const ids=validateRoomSelection(map,roomIds,mapId);
 if(!Number.isInteger(suction)||suction<0||suction>3||!Number.isInteger(water)||water<1||water>3)throw Error('Robotun mevcut temizlik ayarları okunamadı; oda komutu gönderilmedi.');
 return {did:device.did,siid:4,aiid:1,in:[{piid:1,value:18},{piid:10,value:JSON.stringify({selects:ids.map((id,i)=>[id,1,suction,water,i+1])})}]};
}
