import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

export function mapGeometry(map, encoded){
 if(typeof encoded!=='string'||encoded.length>2_000_000)return null;
 try{
  const raw=inflateSync(Buffer.from(encoded,'base64url'),{maxOutputLength:2_000_000});
  const grid=raw.readInt16LE(17),width=raw.readInt16LE(19),height=raw.readInt16LE(21);
  if(raw.readInt16LE(0)!==map.mapId||width!==map.width||height!==map.height||
   width<=0||height<=0||grid<=0||27+width*height>raw.length||!map.runs?.length)return null;
  for(const [x,y,length,id] of map.runs){
   if(x<0||y<0||y>=height||length<=0||x+length>width)return null;
   const offset=27+y*width+x;
   if(!raw.subarray(offset,offset+length).every(value=>value===id))return null;
  }
  return {
   left:raw.readInt16LE(23),top:raw.readInt16LE(25),grid,
   revision:createHash('sha256').update(raw.subarray(17,27+width*height)).digest('hex')
  };
 }catch{return null;}
}

export function zoneCoordinates(map,geometry,selection,revision){
 if(!geometry||revision!==geometry.revision)throw Error('Robot haritasını yenileyip alanı tekrar seçin.');
 if(!Array.isArray(selection)||selection.length!==4||!selection.every(Number.isFinite))
  throw Error('Haritada bir dikdörtgen seçin.');
 const [x1,y1,x2,y2]=selection;
 const left=Math.min(x1,x2),right=Math.max(x1,x2),top=Math.min(y1,y2),bottom=Math.max(y1,y2);
 if(left<0||right>map.width||top<0||bottom>map.height||right-left<=2||bottom-top<=2)
  throw Error('Haritanın içinde daha büyük bir dikdörtgen seçin.');
 if(!map.runs.some(([x,y,length])=>x<right&&x+length>left&&y<bottom&&y+1>top))
  throw Error('Dikdörtgen temizlenebilir bir alanı kapsamalı.');
 return [
  Math.round(geometry.left+left*geometry.grid),
  Math.round(geometry.top+top*geometry.grid),
  Math.round(geometry.left+right*geometry.grid),
  Math.round(geometry.top+bottom*geometry.grid)
 ];
}

export function buildZoneAction(device,coordinates,{suction,water}){
 if(!Number.isInteger(suction)||suction<0||suction>3||!Number.isInteger(water)||water<1||water>3)
  throw Error('Robotun mevcut temizlik ayarları okunamadı.');
 return {did:device.did,siid:4,aiid:1,in:[
  {piid:1,value:19},
  {piid:10,value:JSON.stringify({areas:[[...coordinates,1,suction,water]]})}
 ]};
}
