import {datedRound,datedRounds,roundEnd} from './dated-legs.js';
import Engine,{dailySlots} from './engine.js';
import {atDay,applyCompletedService,maintenanceWindows} from './maintenance.js';
import {flightUnavailable,normalizePlane} from './fleet.js';
import {reserveAircraftId} from './registration.js';
import {leaseDailyRate} from './economy.js';

export function recoveryLeaseQuote(ctx,plane){const t=ctx.types[plane.type],rate=Math.round(leaseDailyRate(ctx,t.price)*4),deposit=Math.round(t.price*.01);return {rate,deposit,upfront:rate+deposit,term:3,total:rate*3};}
// Validate actual dated occurrences, including adjacent-day and Sunday continuations.
export function validateRecoveries(ctx,state,availability=true){
 const now=atDay(ctx.day),rounds=datedRounds(ctx,state),changed=rounds.filter(r=>r.timing||(state.exceptions||[]).some(e=>e.slot===r.slot&&e.day===r.day));
 for(const r of changed){
  if(r.cancelled)continue;
  const original=ctx.fleet.find(p=>p.id===r.plane);if(!original)throw Error('Máy bay thay thế không còn trong đội bay.');
  const p=structuredClone(original),route=ctx.routes[r.route],start=r.legs[0].departure,end=roundEnd(r);
  if(p.hub!==route.from||ctx.types[p.type].range<route.km)throw Error('Máy bay thay thế phải cùng hub và đủ tầm bay.');
  if(r.departed){
   if(p.lease&&end>atDay(p.lease.paidDay+(p.lease.term||14)))throw Error('Chặng trễ vượt thời hạn lease.');
   if(availability&&(end>p.serviceDueAt||maintenanceWindows(p,now,end).some(w=>w.start<end&&w.end>now)))throw Error('Chặng trễ xung đột hạn hoặc ca bảo dưỡng.');
  }else{
   applyCompletedService(p,now-1e-7,start);
   const error=flightUnavailable(p,r.day,start%24,end-start,ctx.day);
   if(availability&&(error||p.wear>=90))throw Error(error||'Máy bay thay thế cần bảo dưỡng.');
  }
  for(const other of rounds){
   if(other.id===r.id||other.cancelled||other.plane!==r.plane)continue;
   if(start<roundEnd(other)-1e-7&&other.legs[0].departure<end-1e-7)throw Error('Phương án trùng chuyến khác của '+p.id+'.');
  }
 }
}

export function recoverFlight(s,ctx,a){
 if(!Number.isInteger(a.day)||a.day<s.day||a.day>s.day+6)throw Error('Chỉ xử lý lượt bay trong 7 ngày tới.');
 const base=s.tycoon.schedules.find(x=>x.id===a.slot&&Math.floor(x.start/24)===(a.day-1)%7);if(!base)throw Error('Không tìm thấy lượt bay.');
 s.tycoon.exceptions??=[];
 if(s.tycoon.exceptions.some(e=>e.slot===a.slot&&e.day===a.day))throw Error('Lượt này đã có phương án. Không áp dụng lần hai.');
 const original=s.fleet.find(p=>p.id===base.plane);
 const e={slot:base.id,day:a.day,fee:0};let message='';
 if(a.mode==='cancel'){
  e.cancel=true;e.fee=(s.tycoon.cabins[base.plane]||[]).reduce((n,v)=>n+v*2,0)*15;message='Đã huỷ riêng lượt ngày '+a.day+'. Bồi hoàn '+e.fee+' USD khi chốt ngày; lịch tuần giữ nguyên.';
 }else if(a.mode==='swap'||a.mode==='move'){
  if(a.mode==='swap'){if(!s.fleet.some(p=>p.id===a.plane)||a.plane===base.plane)throw Error('Chọn máy bay khác trong đội bay.');e.plane=a.plane;}
  else {if(!Number.isFinite(a.hour)||a.hour<0||a.hour>=24||a.hour%.25||a.hour<=base.start%24)throw Error('Chọn giờ muộn hơn trong cùng ngày, theo mốc 15 phút.');e.start=a.hour;}
  message='Đã '+(a.mode==='swap'?'đổi sang '+a.plane:'dời giờ khởi hành')+' riêng lượt ngày '+a.day+'. Lịch tuần giữ nguyên.';
 }else if(a.mode==='lease'){
  if(s.fleet.length+s.orders.length>=8)throw Error('Đội bay và đơn đặt đã đủ 8 chiếc.');
  const q=recoveryLeaseQuote(ctx,original);if(s.cash<q.upfront)throw Error('Không đủ tiền cọc và phí lease ngày đầu.');
  const id=reserveAircraftId(s),p=normalizePlane({id,type:original.type,hub:original.hub,wear:0,ageDays:365,lease:{deposit:q.deposit,rate:q.rate,remaining:3,paidDay:s.day,term:3}},s.day);
  s.cash-=q.upfront;s.hq.prepaidRent+=q.rate;s.fleet.push(p);s.tycoon.cabins[id]=[...s.tycoon.cabins[original.id]];e.plane=id;message='Đã thuê '+id+' trong 3 ngày và cứu lượt ngày '+a.day+'. Phí '+q.rate+' USD/ngày, hoàn cọc khi trả máy bay.';
 }else throw Error('Chọn phương án xử lý.');
 s.tycoon.exceptions.push(e);validateRecoveries({...ctx,fleet:s.fleet},s.tycoon);return message;
}
export function pruneRecoveries(s){s.tycoon.exceptions=(s.tycoon.exceptions||[]).filter(e=>e.day>=s.day&&s.tycoon.schedules.some(x=>x.id===e.slot)&&(!e.plane||s.fleet.some(p=>p.id===e.plane)));}
