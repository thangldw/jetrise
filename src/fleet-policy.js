// Synthetic support contracts; absent policy preserves legacy operating costs.
export const FLEET_FAMILIES={
 A320:{name:'Airbus A320 family',models:['A320','A321']},A220:{name:'Airbus A220',models:['A223']},A330:{name:'Airbus A330',models:['A339']},A350:{name:'Airbus A350',models:['A359','A351']},A380:{name:'Airbus A380',models:['A388']},B737:{name:'Boeing 737 family',models:['B738','B38M']},B787:{name:'Boeing 787 family',models:['B788','B789']},B777:{name:'Boeing 777',models:['B77W']},E190:{name:'Embraer E190',models:['E190']}
};
export const SUPPORT_TERMS=Object.freeze({setup:25000,daily:1200,extraFamily:800,discount:.08,lockDays:7});
export const familyOf=model=>Object.keys(FLEET_FAMILIES).find(k=>FLEET_FAMILIES[k].models.includes(model));
export function fleetFamilies(fleet){return Object.entries(FLEET_FAMILIES).map(([id,f])=>({id,...f,planes:fleet.filter(p=>f.models.includes(p.type))})).filter(f=>f.planes.length);}
export function fleetSupportFee(s){if(!s.fleetProgram)return 0;return SUPPORT_TERMS.daily+SUPPORT_TERMS.extraFamily*fleetFamilies(s.fleet).filter(f=>f.id!==s.fleetProgram.family).length;}
export function operatingBase(ctx,plane){const base=ctx.types[plane.type].nonfuel;return ctx.fleetProgram?.family===familyOf(plane.type)?Math.round(base*(1-SUPPORT_TERMS.discount)):base;}
export function validateFleetPolicy(s){
 for(const p of s.fleet){if(p.reserve!==undefined&&typeof p.reserve!=='boolean')throw Error('Invalid reserve designation');if(p.reserve&&s.tycoon?.schedules?.some(x=>x.plane===p.id))throw Error('Reserve aircraft cannot have recurring flights');}
 const p=s.fleetProgram;if(p===undefined)return;
 if(!p||!Object.hasOwn(FLEET_FAMILIES,p.family)||!Number.isInteger(p.startedDay)||p.startedDay<1||p.startedDay>s.day||p.unlockDay!==p.startedDay+SUPPORT_TERMS.lockDays)throw Error('Invalid fleet support contract');
}
export function fleetPolicyAction(s,a){
 if(a.type==='fleet-reserve'){
  const p=s.fleet.find(p=>p.id===a.plane);if(!p||typeof a.enabled!=='boolean')throw Error('Chọn máy bay và vai trò hợp lệ.');
  if(!!p.reserve===a.enabled)throw Error('Vai trò máy bay chưa thay đổi.');
  if(a.enabled&&s.tycoon.schedules.some(x=>x.plane===p.id))throw Error('Gỡ hoặc chuyển lịch bay tuần của máy bay này trước khi giữ dự phòng.');
  if(a.enabled&&(p.airborneUntilAt||0)>(s.day-1)*24)throw Error('Chờ máy bay về hub trước khi giữ dự phòng.');
  p.reserve=a.enabled;return a.enabled?'Đã giữ '+p.id+' làm dự phòng. Có thể dùng để cứu từng lượt bay.':'Đã trả '+p.id+' về đội khai thác thường lệ.';
 }
 if(a.type==='fleet-program'){
  if(s.fleetProgram&&s.day<s.fleetProgram.unlockDay)throw Error('Hợp đồng hỗ trợ cam kết đến đầu ngày '+s.fleetProgram.unlockDay+'.');
  if(a.family===null){if(!s.fleetProgram)throw Error('Chưa có hợp đồng hỗ trợ.');delete s.fleetProgram;return 'Đã kết thúc hợp đồng hỗ trợ đội bay. Không hoàn phí đã trả.';}
  if(!Object.hasOwn(FLEET_FAMILIES,a.family)||!s.fleet.some(p=>familyOf(p.type)===a.family))throw Error('Chọn một dòng máy bay đang có trong đội bay.');
  if(s.fleetProgram?.family===a.family)throw Error('Dòng máy bay này đang được hỗ trợ.');
  if(s.cash<SUPPORT_TERMS.setup)throw Error('Cần $25.000 để ký hợp đồng hỗ trợ.');
  s.cash-=SUPPORT_TERMS.setup;s.fleetProgram={family:a.family,startedDay:s.day,unlockDay:s.day+SUPPORT_TERMS.lockDays};
  return 'Đã ký hỗ trợ '+FLEET_FAMILIES[a.family].name+' · giảm 8% chi phí cơ sở mỗi vòng, phí ngày tính khi chốt. Cam kết 7 ngày.';
 }
 return null;
}
