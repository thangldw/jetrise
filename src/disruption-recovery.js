import {queueCustomerRefund} from './customer-strategy.js';
// JET-203: bounded, player-confirmed disruption decisions on the existing dated ledger.
import {datedRound,datedRounds,timedLegs,roundEnd} from './dated-legs.js';
import {validateRecoveries} from './recovery.js';
import {guardJourneyChanges,legSupply,journeyBalances,validateOvernight} from './overnight-connections.js';
import {validateLegEconomy} from './live-leg-economy.js';
import {slotConflict} from './airport-slots.js';
import {projectedWeekReports,plannerBasis} from './planner.js';

export const DISRUPTION_TERMS=Object.freeze({delayPerHour:500,compensationPerCustomer:50,rebookPerCustomer:25,reserveDispatch:2000,maxDelay:12,maxPropagation:24});
const sum=xs=>xs.reduce((a,b)=>a+b,0),nowOf=s=>(s.day-1)*24,quarter=n=>Math.ceil((n-1e-7)*4)/4;
const pending=l=>l.status==='reserved';
const ctxFor=(ctx,s)=>({...ctx,...s});
export const disruptionBasis=(ctx,state)=>JSON.stringify([ctx.cash,plannerBasis(ctx,state)]);
const modes=['operate','wait','rebook','cancel','reserve'];
export const RECOVERY_MODES={operate:'Bay khi sẵn sàng · hoàn nối chuyến bị lỡ',wait:'Chờ khách nối chuyến',rebook:'Đổi khách sang chuyến khác',cancel:'Hủy lượt chưa khởi hành',reserve:'Điều máy bay dự phòng'};

export function disruptionCandidates(ctx,state){
 const now=nowOf(ctx);
 return datedRounds(ctx,state).filter(r=>!r.cancelled&&!r.timing).flatMap(r=>r.legs.filter(l=>l.arrival>=now).map(l=>({id:l.id,plane:r.plane,route:r.route,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,airborne:l.departure<now})));
}

function build(s,ctx,a){
 if(!s.legEconomy?.overnight)throw Error('Bật sổ chặng JET-201 và vé nối chuyến JET-202 trước.');
 if(!a||!modes.includes(a.mode)||!['weather','technical'].includes(a.kind)||!Number.isFinite(a.delay)||a.delay<.25||a.delay>12||a.delay%.25||typeof a.leg!=='string'||!/^\d+:\d+:(out|back)$/.test(a.leg))throw Error('Chọn chặng, nguyên nhân, độ trễ và phương án hợp lệ.');
 const originalCtx=structuredClone(ctxFor(ctx,s));
 const now=nowOf(s),[day,slot,direction]=a.leg.split(':'),c=()=>ctxFor(ctx,s);
 let target=datedRound(c(),s.tycoon,Number(day),Number(slot));const index=direction==='out'?0:1;
 if(!target||target.cancelled||target.timing||target.legs[index].arrival<now||Number(day)>s.day+6)throw Error('Chặng đã hoàn tất, đã có phương án hoặc ngoài 7 ngày tới. Tính lại.');
 if(a.kind==='technical'&&target.legs[index].departure<now)throw Error('Chặng đã cất cánh. Chỉ mô phỏng trễ đến do thời tiết; không thay máy bay giữa chuyến.');
 const initial=structuredClone(target),before=new Map(datedRounds(c(),s.tycoon).map(r=>[r.id,r])),changed=new Set(),reserved=new Set(),missed=new Set(),refunded=new Set(),rebooked=new Set();
 let refund=0,costRefund=0;
 const record=s.legEconomy.disruptions??={version:1,events:[],paidTodayCents:0};
 if(record.events.some(e=>e.id===a.leg))throw Error('Sự cố của chặng này đã được xử lý.');
 const journeys=s.legEconomy.overnight.journeys;
 const sync=r=>{for(const j of journeys)for(const l of j.legs)if(pending(l)&&l.day===r.day&&l.slot===r.slot){const actual=r.legs.find(x=>x.id===l.id);Object.assign(l,{plane:r.plane,route:r.route,roundStart:r.start,hours:r.hours,capacity:r.capacity[0],departure:actual.departure,arrival:actual.arrival,timing:structuredClone(r.timing)});}};
 const write=r=>{
  if(s.tycoon.exceptions.length>=480&&!s.tycoon.exceptions.some(e=>e.day===r.day&&e.slot===r.slot)&&!r.departed)throw Error('Đã đạt giới hạn ngoại lệ.');
  if(changed.size>=64&&!changed.has(r.id))throw Error('Tối đa 64 lượt bị ảnh hưởng trong một phương án.');
  r.timing=r.legs.map(({departure,arrival})=>({departure,arrival}));timedLegs(r,ctx.routes[r.route]);
  const stored=s.legEconomy.rounds.find(x=>x.id===r.id);
  if(stored){
   const oldEnd=roundEnd(stored);
   for(let i=0;i<2;i++)for(const key of ['departure','arrival'])if(stored.legs[i][key]<now&&stored.legs[i][key]!==r.legs[i][key])throw Error('Không thể sửa chặng đã ghi nhận.');
   stored.timing=structuredClone(r.timing);stored.recovery=true;stored.legs.forEach((l,i)=>Object.assign(l,r.timing[i]));
   const p=s.fleet.find(p=>p.id===r.plane);p.airborneUntilAt=roundEnd(r);p.hoursSinceService+=roundEnd(r)-oldEnd;
  }else{
   let e=s.tycoon.exceptions.find(e=>e.day===r.day&&e.slot===r.slot);
   if(!e){e={day:r.day,slot:r.slot,fee:0};s.tycoon.exceptions.push(e);}
   e.plane=r.plane;e.timing=structuredClone(r.timing);
  }
  changed.add(r.id);sync(r);
 };
 const shift=(r,i,delay,arrivalOnly=false)=>{
  if(delay<=0)return;
  if(!arrivalOnly){if(r.legs[i].departure<now)throw Error('Không thể dời giờ cất cánh đã qua.');r.legs[i].departure+=delay;}
  r.legs[i].arrival+=delay;
  if(i===0){const extra=Math.max(0,r.legs[0].arrival+.5-r.legs[1].departure);r.legs[1].departure+=extra;r.legs[1].arrival+=extra;}
  write(r);
 };
 const swap=r=>{
  const p=s.fleet.find(p=>p.id===a.reservePlane);
  if(r.departed||!p?.reserve||p.id===r.plane||p.hub!==ctx.routes[r.route].from)throw Error('Chọn máy bay dự phòng cùng hub; chỉ thay cả lượt chưa khởi hành.');
  let e=s.tycoon.exceptions.find(e=>e.day===r.day&&e.slot===r.slot);if(!e){e={day:r.day,slot:r.slot,fee:0};s.tycoon.exceptions.push(e);}
  const old=structuredClone(r);e.plane=p.id;delete e.timing;
  const next=datedRound(c(),s.tycoon,r.day,r.slot);
  for(let i=0;i<2;i++){
   const delta=quarter(Math.max(0,old.legs[i].departure-next.legs[i].departure,i===1?next.legs[0].arrival+.5-next.legs[1].departure:0));
   next.legs[i].departure+=delta;next.legs[i].arrival+=delta;
  }
  reserved.add(r.id);write(next);return next;
 };
 const cascade=()=>{
  // Delays only move forward. Keep the same aircraft home before its next dated rotation.
  for(let pass=0;pass<64;pass++){
   let moved=false;const endByPlane=new Map();
   for(const r of datedRounds(c(),s.tycoon)){
    if(r.cancelled)continue;
    const end=endByPlane.get(r.plane);
    if(end!==undefined&&r.legs[0].departure<end-1e-7){if(r.departed)throw Error('Hai lượt đang bay bị trùng.');shift(r,0,quarter(end-r.legs[0].departure));moved=true;}
    endByPlane.set(r.plane,roundEnd(r));
   }
   if(!moved)return;
  }
  throw Error('Chuỗi trễ vượt giới hạn phương án.');
 };
 const refundLeg=(j,l)=>{
  if(!pending(l))return;if(l.departure<now)throw Error('Chặng đã cất cánh, không thể hoàn phần đang bay.');
  refund+=l.fareCents;costRefund+=l.costCents;l.status='refunded';l.refundedAt=now;refunded.add(j.id);
 };
 const rebookCancelled=a.mode==='rebook'&&!target.departed&&journeys.some(j=>pending(j.legs[1])&&j.legs[1].day===target.day&&j.legs[1].slot===target.slot);
 if(a.mode==='cancel'||rebookCancelled){
  if(target.departed)throw Error('Vòng đã khởi hành; giữ chuyến bay và hoàn/đổi chặng nối tiếp.');
  let e=s.tycoon.exceptions.find(e=>e.day===target.day&&e.slot===target.slot);if(!e){e={day:target.day,slot:target.slot,fee:0};s.tycoon.exceptions.push(e);}e.cancel=true;
  changed.add(target.id);
  for(const j of journeys){const hit=j.legs.findIndex(l=>pending(l)&&l.day===target.day&&l.slot===target.slot);if(hit>=0){missed.add(j.id);if(!rebookCancelled)for(let i=hit;i<2;i++)refundLeg(j,j.legs[i]);}}
 }else if(a.mode==='reserve'&&!target.departed&&a.kind==='technical'){
  target=swap(target);
 }else{
  if(a.mode==='reserve'&&!target.departed&&a.kind==='weather')throw Error('Thay máy bay không tránh được thời tiết tại sân bay. Chọn chờ, đổi chuyến hoặc hủy.');
  shift(target,index,a.delay,target.legs[index].departure<now);
 }
 cascade();
 const risk=()=>journeys.filter(j=>pending(j.legs[1])&&(datedRound(c(),s.tycoon,j.legs[1].day,j.legs[1].slot)?.cancelled||j.legs[0].status==='refunded'||(j.legs[1].departure-j.legs[0].arrival)*60<j.minimum-1e-7||(j.legs[1].departure-j.legs[0].arrival)*60>j.maximum+1e-7));
 for(let pass=0;pass<64;pass++){
  const atRisk=risk();if(!atRisk.length)break;
  atRisk.forEach(j=>missed.add(j.id));
  if(a.mode==='wait'||a.mode==='reserve'){
   for(const j of atRisk){const [first,last]=j.legs;
    if(first.status==='refunded'||last.departure>first.arrival+j.maximum/60)throw Error('Không thể chờ trong cửa sổ nối chuyến của vé. Chọn đổi chuyến hoặc hoàn vé.');
    let r=datedRound(c(),s.tycoon,last.day,last.slot);
    if(a.mode==='reserve'&&!reserved.has(r.id))r=swap(r);
    const i=last.id.endsWith(':out')?0:1,delay=quarter(first.arrival+j.minimum/60-r.legs[i].departure);
    shift(r,i,delay);
   }
   cascade();
  }else if(a.mode==='rebook'){
   // Use the canonical forecast with just the released onward seats removed. No second demand model.
   const trial=structuredClone(s);
   for(const j of trial.legEconomy.overnight.journeys)if(atRisk.some(x=>x.id===j.id))j.legs[1].status='refunded';
   const old=journeyBalances(s.legEconomy.overnight,now),next=journeyBalances(trial.legEconomy.overnight,now);
   trial.legEconomy.deferredCents+=next.deferredCents-old.deferredCents;trial.legEconomy.prepaidCents+=next.prepaidCents-old.prepaidCents;
   const tc={...ctxFor(ctx,trial),noNewConnectionSales:true},supply=legSupply(tc,projectedWeekReports(tc,trial.tycoon,false));
   supply.sort((a,b)=>a.departure-b.departure||a.id.localeCompare(b.id));
   for(const j of atRisk){const [first,last]=j.legs;
    const l=supply.find(l=>l.id!==last.id&&l.from===last.from&&l.to===last.to&&l.departure>=now&&l.departure>=first.arrival+j.minimum/60&&l.departure<=first.arrival+j.maximum/60&&l.departure<=j.bookedAt+108&&l.arrival<=j.bookedAt+192&&l.capacity[0]>=j.pax);
    if(!l)throw Error('Không có chặng thay thế đủ ghế sau khách trực tiếp/hợp đồng trong cửa sổ vé. Chọn chờ hoặc hoàn vé.');
    j.rebookedFrom??=last.id;
    const {fareCents,costCents}=last;
    j.legs[1]={id:l.id,plane:l.plane,route:l.route,slot:l.slot,day:l.day,roundStart:l.roundStart,hours:l.hours,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,capacity:l.fullCapacity,fareCents,costCents,status:'reserved',...(l.timing?{timing:structuredClone(l.timing)}:{})};
    l.capacity[0]-=j.pax;rebooked.add(j.id);
   }
  }else for(const j of atRisk)refundLeg(j,j.legs[1]);
  if(pass===63)throw Error('Chuỗi nối chuyến vượt giới hạn phương án.');
 }
 if(a.mode==='reserve'&&!reserved.size)throw Error('Không có lượt chưa khởi hành cần điều dự phòng. Chọn phương án chờ hoặc đổi chuyến.');
 const changes=[...changed].map(id=>{
  const old=before.get(id),r=datedRound(c(),s.tycoon,old.day,old.slot);
  return {id,plane:r.plane,previousPlane:old.plane,route:r.route,cancelled:r.cancelled||false,before:old.legs.map(({id,departure,arrival})=>({id,departure,arrival})),after:r.legs.map(({id,departure,arrival})=>({id,departure,arrival})),extraHours:r.cancelled?0:Math.max(0,roundEnd(r)-roundEnd(old))};
 });
 const byJourney=id=>journeys.find(j=>j.id===id),missedPax=sum([...missed].map(id=>byJourney(id).pax)),rebookedPax=sum([...rebooked].map(id=>byJourney(id).pax)),refundedPax=sum([...refunded].map(id=>byJourney(id).pax));
 const delayCostCents=Math.round(sum(changes.map(x=>x.extraHours))*DISRUPTION_TERMS.delayPerHour*100),compensationCents=missedPax*DISRUPTION_TERMS.compensationPerCustomer*100,rebookCostCents=rebookedPax*DISRUPTION_TERMS.rebookPerCustomer*100,reserveCostCents=reserved.size*DISRUPTION_TERMS.reserveDispatch*100;
 const feeCents=delayCostCents+compensationCents+rebookCostCents+reserveCostCents;
 if(s.cash*100+costRefund<refund+feeCents)throw Error('Không đủ tiền chi phí xử lý, bồi hoàn và hoàn vé.');
 const charges=changes.map(x=>({plane:x.plane,route:x.route,cents:Math.round(x.extraHours*DISRUPTION_TERMS.delayPerHour*100)+(reserved.has(x.id)?DISRUPTION_TERMS.reserveDispatch*100:0)}));
 charges[0].cents+=compensationCents+rebookCostCents;
 const affected=journeys.filter(j=>j.legs.some(l=>changed.has(`${l.day}:${l.slot}`))||missed.has(j.id));
 const directBoardings=sum(changes.map(x=>{const r=s.legEconomy.rounds.find(r=>r.id===x.id);return r?sum(r.legs.filter((l,i)=>l.arrival>=now&&l.arrival!==x.before[i].arrival).map(l=>sum(l.passengers))):0;}));
 const summary={directBoardings,id:a.leg,day:s.day,kind:a.kind,delay:a.delay,mode:a.mode,changes,affectedCustomers:sum(affected.map(j=>j.pax)),missedPax,rebookedPax,refundedPax,refundCents:refund,handlingRefundCents:costRefund,delayCostCents,compensationCents,rebookCostCents,reserveCostCents,feeCents,charges,cashCostCents:feeCents+refund-costRefund,itineraries:affected.map(j=>({id:j.id,pax:j.pax,legs:structuredClone(j.legs)}))};
 s.cash+=(costRefund-refund-feeCents)/100;s.legEconomy.deferredCents-=refund;s.legEconomy.prepaidCents-=costRefund;
 for(const j of journeys)if(!j.legs.some(pending))queueCustomerRefund(s,j);
 s.legEconomy.overnight.refundsPaidToday+=refund;s.legEconomy.overnight.journeys=journeys.filter(j=>j.legs.some(pending));
 const {itineraries,...event}=summary;record.events.push(event);record.events=record.events.filter(e=>e.day>=s.day-28).slice(-60);record.paidTodayCents+=feeCents;
 if(sum(record.events.filter(e=>e.day===s.day).map(e=>e.feeCents))!==record.paidTodayCents)throw Error('Tối đa 60 phương án trong lịch sử phục hồi.');
 validateRecoveries(c(),s.tycoon);guardJourneyChanges(c(),s.tycoon);validateOvernight(c(),s.tycoon);validateLegEconomy(s,ctx.routes,ctx.types);
 const slots=slotConflict(c(),s.tycoon);if(slots)throw Error(slots);validateDisruptions(s,ctx.routes);
 const profit=(cx,state)=>sum(projectedWeekReports(cx,state,false).map(d=>d.report.profit));
 summary.outlook={before:profit(originalCtx,originalCtx.tycoon),after:profit(c(),s.tycoon)};
 return summary;
}

export function previewDisruption(game,ctx,request){
 const copy=structuredClone(game),summary=build(copy,ctx,request);
 return {basis:disruptionBasis(ctx,game.tycoon),request:structuredClone(request),summary};
}
export function applyDisruption(s,ctx,preview){
 if(!preview||preview.basis!==disruptionBasis(ctx,s.tycoon))throw Error('Phương án đã cũ. Tính lại theo save hiện tại.');
 const summary=build(s,ctx,preview.request);
 if(JSON.stringify(summary)!==JSON.stringify(preview.summary))throw Error('Phương án đã thay đổi hoặc không hợp lệ. Tính lại trước khi xác nhận.');
 return 'Đã áp dụng phương án JET-203 cho '+summary.changes.length+' lượt; lịch tuần giữ nguyên. Chi ngay $'+(summary.cashCostCents/100).toFixed(2)+'.';
}

export function guardDisruptionChanges(current,next){
 for(const e of current.tycoon.exceptions||[])if(e.timing||current.legEconomy?.disruptions?.events.some(v=>v.changes.some(r=>r.cancelled&&r.id===`${e.day}:${e.slot}`))){
  const old=datedRound(current,current.tycoon,e.day,e.slot),updated=datedRound(next,next.tycoon,e.day,e.slot),saved=next.tycoon.exceptions.find(x=>x.day===e.day&&x.slot===e.slot);
  if(!saved||JSON.stringify(saved)!==JSON.stringify(e)||!updated||old.route!==updated.route||old.plane!==updated.plane||JSON.stringify(old.legs)!==JSON.stringify(updated.legs))throw Error('Lượt đã có phương án JET-203. Giữ lịch, máy bay và cabin đến khi lượt hoàn tất.');
 }
}

export function validateDisruptions(s,routes){
 const d=s.legEconomy?.disruptions;if(d===undefined)return;
 const int=(n,max=1e12)=>Number.isSafeInteger(n)&&n>=0&&n<=max,fail=()=>{throw Error('Invalid disruption recovery');};
 if(!s.legEconomy.overnight||!d||d.version!==1||!int(d.paidTodayCents)||!Array.isArray(d.events)||d.events.length>60)fail();
 const ids=new Set();
 for(const e of d.events){
  if(!e||typeof e.id!=='string'||!/^\d+:\d+:(out|back)$/.test(e.id)||ids.has(e.id)||!Number.isInteger(e.day)||e.day<1||e.day>s.day||!modes.includes(e.mode)||!['weather','technical'].includes(e.kind)||!Number.isFinite(e.delay)||e.delay<.25||e.delay>12||e.delay%.25||!Array.isArray(e.changes)||!e.changes.length||e.changes.length>64||!Array.isArray(e.charges)||e.charges.length!==e.changes.length)fail();ids.add(e.id);
  for(const k of ['directBoardings','affectedCustomers','missedPax','rebookedPax','refundedPax','refundCents','handlingRefundCents','delayCostCents','compensationCents','rebookCostCents','reserveCostCents','feeCents'])if(!int(e[k]))fail();
  for(const change of e.changes){if(!change||typeof change.id!=='string'||!/^\d+:\d+$/.test(change.id)||!routes[change.route]||typeof change.plane!=='string'||change.plane.length>20||typeof change.previousPlane!=='string'||change.previousPlane.length>20||typeof change.cancelled!=='boolean'||!Number.isFinite(change.extraHours)||change.extraHours<0||change.extraHours>24)fail();for(const pair of [change.before,change.after])if(!Array.isArray(pair)||pair.length!==2||pair.some(l=>!l||typeof l.id!=='string'||l.id.length>50||!Number.isFinite(l.departure)||!Number.isFinite(l.arrival)||l.departure<0||l.arrival<=l.departure||l.arrival>(s.day+14)*24))fail();}
  for(const charge of e.charges)if(!charge||typeof charge.plane!=='string'||!Number.isInteger(charge.route)||!routes[charge.route]||!int(charge.cents))fail();
  if(e.feeCents!==sum(e.charges.map(c=>c.cents))||e.feeCents!==e.delayCostCents+e.compensationCents+e.rebookCostCents+e.reserveCostCents||e.cashCostCents!==e.feeCents+e.refundCents-e.handlingRefundCents)fail();
 }
 if(d.paidTodayCents!==sum(d.events.filter(e=>e.day===s.day).map(e=>e.feeCents)))fail();
 const active=[...s.legEconomy.rounds.filter(r=>r.timing).map(r=>r.id),...(s.tycoon.exceptions||[]).filter(e=>e.timing).map(e=>`${e.day}:${e.slot}`)];
 if(active.some(id=>!d.events.some(e=>e.changes.some(c=>c.id===id))))fail();
}

export function settleDisruptions(ctx,report){
 const d=ctx.legEconomy?.disruptions,start=(report.day-1)*24,end=start+24;
 if(!d)return;
 const events=d.events.filter(e=>e.day===report.day),paid=sum(events.map(e=>e.feeCents))/100;
 report.disruptionPrepaid=paid;report.disruptions=events;
 for(const e of events)for(const [i,c] of e.charges.entries())if(c.cents){const cost=c.cents/100;report.rows.push({leg:`recovery:${e.id}:${i}`,plane:c.plane,route:c.route,slot:0,recovery:true,departure:start,arrival:start,start:0,hours:0,flights:0,passengers:[0,0,0],pax:0,revenue:0,nonfuel:cost,fuelCost:0,co2Cost:0,profit:-cost,contractPax:0,contractRevenue:0});}
 report.nonfuel+=paid;report.profit-=paid;
 report.legEconomyState.disruptions={...d,paidTodayCents:0};
 const rounds=[...ctx.legEconomy.rounds,...report.departureManifests],arrivals=[];
 for(const r of rounds){const scheduled=d.events.flatMap(e=>e.changes).find(c=>c.id===r.id)?.before||timedLegs({...r,timing:undefined},ctx.routes[r.route]);for(let i=0;i<2;i++)if(r.legs[i].arrival>=start&&r.legs[i].arrival<end)arrivals.push(r.legs[i].arrival-scheduled[i].arrival);}
 report.punctuality={arrivals:arrivals.length,onTime:arrivals.filter(d=>d<.25-1e-7).length,late:arrivals.filter(d=>d>=.25-1e-7).length,cancelled:report.cancelled,missedCustomers:sum(events.map(e=>e.missedPax)),rebookedCustomers:sum(events.map(e=>e.rebookedPax)),refundedCustomers:sum(events.map(e=>e.refundedPax))};
}
