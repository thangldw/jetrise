import {marketPrices} from './gameplay.js';
import Engine from './engine.js';
import {modifiers,repairCost} from './hq.js';
import {atDay,WEEK,nextPlanStart,planConflict,maintenanceWindows,serviceDue,oneOff} from './maintenance.js';
import {guardJourneyChanges} from './overnight-connections.js';
import {validateRecoveries} from './recovery.js';

// Project accumulated hours, wear, booked maintenance and lease expiry; future incidents remain unknown.
export function projectedWeekReports(ctx,state,details=true,horizon=7,startDay=ctx.day){
 state=structuredClone(state);let fleet=structuredClone(ctx.fleet),fuel=ctx.fuel,co2=ctx.co2;const days=[],gameplay=structuredClone(ctx.gameplay);let strategy=structuredClone(ctx.strategy),legEconomy=structuredClone(ctx.legEconomy),slotMarket=structuredClone(ctx.slotMarket),customerStrategy=structuredClone(ctx.customerStrategy);
 for(let i=0;i<horizon;i++){
  const day=startDay+i;fleet=fleet.filter(p=>!p.lease||day<p.lease.paidDay+(p.lease.term||14));const present=new Set(fleet.map(p=>p.id));state.schedules=state.schedules.filter(x=>present.has(x.plane));state.exceptions=(state.exceptions||[]).filter(e=>e.day>=day&&state.schedules.some(x=>x.id===e.slot)&&(!e.plane||present.has(e.plane)));
  const report=Engine.evaluate({...ctx,projecting:true,fleet,gameplay,strategy,legEconomy,slotMarket,customerStrategy,fuel,co2,...marketPrices(ctx,day,true),modifiers:modifiers({...ctx,tycoon:state,day})},state,day);days.push({report,...(details?{demands:ctx.routes.map((_,ri)=>Engine.demand({...ctx,gameplay,legEconomy,projecting:true,modifiers:modifiers({...ctx,tycoon:state,day})},state,ri,day)),capacities:ctx.routes.map((_,ri)=>Engine.capacity({...ctx,day,fleet},state,ri,day))}:{})});
  fuel=Math.max(0,fuel-(report.fuelAllocated??report.burn));co2=Math.max(0,co2-(report.co2Allocated??report.co2));if(gameplay)gameplay.contracts=report.contractState;if(strategy)strategy=report.strategyState;if(legEconomy)legEconomy=report.legEconomyState;if(slotMarket)slotMarket=report.slotMarketState;if(customerStrategy)customerStrategy=report.customerStrategyState;
  for(const p of fleet){
   Object.assign(p,report.serviceState[p.id]);p.ageDays++;const landing=Math.max(p.airborneUntilAt||0,...(report.operatedRounds||report.rows).filter(r=>r.plane===p.id).map(r=>(day-1)*24+r.start+r.hours));p.airborneUntilAt=landing>day*24?landing:null;
   if(p.maintenance&&day+1>=p.maintenance.untilDay)p.maintenance=null;
  }
 }
 return days;
}
export function projectedCohortProfit(days){let profit=days.reduce((n,d)=>n+d.report.profit,0);const pending=days.at(-1)?.report.legEconomyState;for(const r of pending?.rounds||[])for(const l of r.legs){if(l.arrival>=pending.through)profit+=(l.ticketCents+l.serviceCents)/100;if(l.departure>=pending.through)profit-=(l.nonfuelCents+l.fuelCents+l.co2Cents)/100;}for(const j of pending?.overnight?.journeys||[])for(const l of j.legs)if(l.status==='reserved'){profit+=l.fareCents/100;if(l.departure>=pending.through)profit-=l.costCents/100;}return profit;}
export function projectedWeekProfit(ctx,state){return projectedCohortProfit(projectedWeekReports(ctx,state,false));}
// These are explicit proposed service plans, never a mutation of the input fleet.
function maintenanceContext(ctx,state,plans){
 if(!Array.isArray(plans))throw Error('Phương án thiếu ca bảo dưỡng. Tính lại phương án.');
 const fleet=structuredClone(ctx.fleet),seen=new Set(),trial={...ctx,fleet,tycoon:state};
 for(const plan of plans){
  const p=fleet.find(p=>p.id===plan.plane);
  if(!p||seen.has(p.id)||p.reserve||p.servicePlan||p.fault||p.wear>=90||plan.activeFrom!==nextPlanStart(ctx.day,plan.start))throw Error('Ca bảo dưỡng đề xuất không hợp lệ.');
  seen.add(p.id);const error=planConflict(trial,p,plan.start,x=>Engine.duration(trial,p.id,x.route));if(error)throw Error(error);
  p.servicePlan={start:plan.start,activeFrom:plan.activeFrom};
  if(!timelyCheck(trial,p))throw Error('Ca bảo dưỡng phải hoàn tất trước hạn hoặc sau bảo dưỡng lớn đã đặt.');
 }
 guardJourneyChanges(trial,state,true);if(ctx.legEconomy?.disruptions)validateRecoveries(trial,state);
 return trial;
}
function timelyCheck(ctx,p){
 const now=atDay(ctx.day),w=maintenanceWindows(p,now,now+WEEK*2).find(w=>w.kind==='light');
 return !!w&&w.end<=serviceDue(p,now,w.start)+1e-9&&(!p.lease||w.end<=atDay(p.lease.paidDay+(p.lease.term||14)));
}
function maintenanceFee(ctx){
 const now=atDay(ctx.day);return ctx.fleet.reduce((sum,p)=>sum+maintenanceWindows(p,now,now+WEEK).filter(w=>w.kind==='light'&&w.start>=now&&(!p.fault||(oneOff(p)?.end??Infinity)<=w.start)&&(!p.lease||w.start<atDay(p.lease.paidDay+(p.lease.term||14)))).length*Math.round(repairCost(ctx,p.id)*.35),0);
}
function prepareMaintenance(ctx,state){
 const plans=[],blocked=[],ready=new Set();let trial={...ctx,fleet:structuredClone(ctx.fleet),tycoon:state};
 for(const p of [...trial.fleet].sort((a,b)=>a.id.localeCompare(b.id))){
  if(p.reserve)continue;
  if(p.fault||p.wear>=90){blocked.push({plane:p.id,reason:'Cần sửa sự cố hoặc bảo dưỡng lớn trước.'});continue;}
  if(p.servicePlan){
   const error=planConflict(trial,p,p.servicePlan.start,x=>Engine.duration(trial,p.id,x.route));
   if(!error&&timelyCheck(trial,p))ready.add(p.id);else blocked.push({plane:p.id,reason:error||'Ca hiện tại chưa đáp ứng hạn bảo dưỡng; chỉnh ca trước khi bổ sung chuyến.'});
   continue;
  }
  let chosen=null;
  // Earliest legal quarter-hour gap; planConflict owns weekly wrap and hangar capacity.
  for(let offset=0;offset<672;offset++){
   const start=(atDay(ctx.day)+offset*.25)%WEEK,plan={plane:p.id,start,activeFrom:nextPlanStart(ctx.day,start)};
   try{const candidate=maintenanceContext(ctx,state,[...plans,plan]);chosen=plan;trial=candidate;break;}catch{/* Try the next legal gap without moving any flight. */}
  }
  if(chosen){plans.push(chosen);ready.add(p.id);}else blocked.push({plane:p.id,reason:'Không có ca 5 giờ hợp lệ trước hạn. Giữ lịch cũ; dời chuyến hoặc đặt bảo dưỡng lớn trước.'});
 }
 return {ctx:trial,plans,blocked,ready};
}
function greedySchedule(ctx,original,planes,prepared,late=false){
 const state=structuredClone(original),planning=prepared.ctx,date=weekday=>ctx.day+((weekday-(ctx.day-1)%7+7)%7),beforeMaintenanceCost=maintenanceFee(ctx),before=projectedWeekProfit(ctx,state)-beforeMaintenanceCost;let added=0,currentProfit=projectedWeekProfit(planning,state);
 for(const plane of planes.filter(p=>prepared.ready.has(p.id))){
  for(let step=0;step<672&&added<80&&state.schedules.length<480;step++){const start=late?167.75-step*.25:step*.25;
   const day=date(Math.floor(start/24));let best=null;
   for(const route of ctx.openedRoutes){
    if(Engine.slotError(planning,state,plane.id,route,start))continue;
    const target=ctx.hq?.targets?.[route];if(target){const offered=Engine.capacity(planning,state,route,day),need=Engine.demand(planning,state,route,day);if(target.every((n,i)=>offered[i]>=Math.min(n,need[i])))continue;}
    const trial={...state,schedules:[...state.schedules,{id:state.nextId,plane:plane.id,route,start}]},after=projectedWeekProfit(planning,trial),gain=after-currentProfit,score=gain/Engine.duration(planning,plane.id,route);
    if(gain>1&&(!best||score>best.score))best={route,score,after};
   }
   if(best){Engine.add(planning,state,plane.id,best.route,start);currentProfit=best.after;added++;}
  }
 }
 const addedPlanes=new Set(state.schedules.slice(original.schedules.length).map(s=>s.plane)),maintenance=prepared.plans.filter(p=>addedPlanes.has(p.plane)),final=maintenanceContext(ctx,state,maintenance),maintenanceCost=maintenanceFee(final),after=projectedWeekProfit(final,state)-maintenanceCost;
 const checks=final.fleet.filter(p=>addedPlanes.has(p.id)).map(p=>{const w=maintenanceWindows(p,atDay(ctx.day),atDay(ctx.day)+WEEK*2).find(w=>w.kind==='light');return {plane:p.id,start:w.start,end:w.end,existing:!!ctx.fleet.find(x=>x.id===p.id).servicePlan,fee:Math.round(repairCost(final,p.id)*.35)};});
 return {state,added,before,after,beforeMaintenanceCost,maintenanceCost,maintenance,checks,blocked:prepared.blocked};
}

export const plannerBasis=(ctx,state)=>JSON.stringify({day:ctx.day,legEconomy:ctx.legEconomy,gameplay:ctx.gameplay,strategy:ctx.strategy,fleetProgram:ctx.fleetProgram,connectionProgram:ctx.connectionProgram,slotRights:ctx.slotRights,slotMarket:ctx.slotMarket,customerStrategy:ctx.customerStrategy,fleet:ctx.fleet,routes:ctx.routes,openedRoutes:ctx.openedRoutes,hq:ctx.hq,fuel:ctx.fuel,co2:ctx.co2,average:ctx.average,co2Average:ctx.co2Average,modifiers:ctx.modifiers,state});
export function proposeSchedule(ctx,original){
 const prepared=prepareMaintenance(ctx,original),ordered=ctx.fleet.filter(p=>!p.reserve).sort((a,b)=>ctx.types[b.type].seats-ctx.types[a.type].seats||a.id.localeCompare(b.id)),strategies=[['capacity-first',ordered,false],['small-first',[...ordered].reverse(),false],['late-departures',ordered,true]];
 const proposals=strategies.map(([name,planes,late])=>({...greedySchedule(ctx,original,planes,prepared,late),name}));
 proposals.sort((a,b)=>b.after-a.after||a.name.localeCompare(b.name));const best=proposals[0];
 return {...best,basis:plannerBasis(ctx,original),alternatives:proposals.map(p=>({name:p.name,added:p.added,profit:p.after}))};
}
export function applyProposal(ctx,original,proposal){
 if(!proposal||proposal.basis!==plannerBasis(ctx,original))throw Error('Phương án đã cũ. Tính lại theo tiến độ mới nhất.');
 const planning=maintenanceContext(ctx,original,proposal.maintenance),state=structuredClone(original),existing=new Set(original.schedules.map(s=>s.id)),extra=proposal.state?.schedules?.filter(s=>!existing.has(s.id));
 if(!Array.isArray(extra)||!extra.length||extra.length>80||proposal.state.schedules.length!==original.schedules.length+extra.length||original.schedules.some(s=>!proposal.state.schedules.some(x=>JSON.stringify(x)===JSON.stringify(s))))throw Error('Phương án không hợp lệ.');
 if(proposal.maintenance.some(p=>!extra.some(s=>s.plane===p.plane)))throw Error('Ca bảo dưỡng không thuộc máy bay được bổ sung chuyến.');
 for(const s of extra){const p=planning.fleet.find(p=>p.id===s.plane);if(!p?.servicePlan||!timelyCheck(planning,p)||planConflict({...planning,tycoon:original},p,p.servicePlan.start,x=>Engine.duration(planning,p.id,x.route)))throw Error('Máy bay chưa có ca bảo dưỡng tuần hợp lệ.');if(s.id!==state.nextId)throw Error('Mã chuyến đề xuất không hợp lệ.');const result=Engine.add(planning,state,s.plane,s.route,s.start);if(result.error)throw Error(result.error);}
 maintenanceContext(ctx,state,proposal.maintenance);
 if(projectedWeekProfit(planning,state)-maintenanceFee(planning)<=projectedWeekProfit(ctx,original)-maintenanceFee(ctx))throw Error('Phương án không tăng lợi nhuận dự kiến.');
 return {state,fleet:planning.fleet};
}
