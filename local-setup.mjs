import {validateDevice} from './devices.mjs';
import {validateConnection,saveConnection} from './device-engine.mjs';
export async function addLocalDevice(input,settings){
 const expected={tuya:['light'],xiaomi:['vacuum','fryer']};
 if(!expected[input?.brand]?.includes(input.type))throw Error('Marka ve desteklenen cihaz türünü seçin.');
 const device=validateDevice(input,settings.devices,settings.layout.rooms);
 validateConnection(device,input.connection);
 await saveConnection(device,input.connection);
 settings.devices.push(device);settings.layout.assignments[device.id]=input.roomId||null;
 return {id:device.id};
}
