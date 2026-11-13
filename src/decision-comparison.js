import {advanceLiability} from './advance-sales.js';
import {routeLabel} from './network.js';
import {repairCost} from './hq.js';
import {displayAt,nextPlanStart,LIGHT_HOURS} from './maintenance.js';
import {transition,context,routesFor,forecast,dayCashRequired} from './game.js';

export const DECISION_NAMES={fares:'Đổi giá vé',frequency:'Đổi tần suất',lease:'Thuê máy bay & xếp lịch',route:'Mở tuyến & xếp lịch'};
const fail=message=>{throw Error(message);};
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function weekly(spec){
 if(!Array.isArray(spec.days)||spec.days.length>7||new Set(spec.days).size!==spec.days.length||spec.days.some(d=>!integer(d,0,6))||!Number.isFinite(spec.at)||spec.at<0||spec.at>=24||spec.at%.25)fail('Chọn thứ và giờ khởi hành theo mốc 15 phút.');
 return {days:[...spec.days].sort((a,b)=>a-b),at:spec.at};
}
function prepare(game,spec){
 if(!spec||!Object.hasOwn(DECISION_NAMES,spec.kind))fail('Loại phương án không hợp lệ.');
 let draft=game;const actions=[];
 const step=action=>{const r=transition(draft,action);if(r.error)fail(r.error);draft=r.game;actions.push(action);};
 const routes=routesFor(game);
 if(spec.kind==='fares'){
  if(!integer(spec.percent,50,200)||!game.openedRoutes.includes(spec.route))fail('Chọn tuyến đã mở và mức giá 50–200%.');
  const values=game.tycoon.prices[spec.route].map(v=>Math.max(20,Math.min(10000,Math.round(v*spec.percent/100))));
  if(JSON.stringify(values)===JSON.stringify(game.tycoon.prices[spec.route]))fail('Bảng giá không thay đổi.');
  step({type:'prices',route:spec.route,values});
 }else if(spec.kind==='frequency'){
  const {days,at}=weekly(spec);if(!game.fleet.some(p=>p.id===spec.plane)||!game.openedRoutes.includes(spec.route))fail('Chọn máy bay và tuyến đã mở.');
  const group=game.tycoon.schedules.filter(x=>x.plane===spec.plane&&x.route===spec.route&&x.start%24===at);
  for(const x of group.filter(x=>!days.includes(Math.floor(x.start/24))))step({type:'remove',id:x.id});
  const missing=days.filter(d=>!group.some(x=>Math.floor(x.start/24)===d));
  if(missing.length)step({type:'add-weekly',plane:spec.plane,route:spec.route,days:missing,at});
 }else {
  const {days,at}=weekly(spec);if(!days.length)fail('Chọn ít nhất một ngày khai thác.');
  let plane=spec.plane,route=spec.route;
  if(spec.kind==='lease'){
   if(!Object.hasOwn(context(game).types,spec.model))fail('Chọn mẫu máy bay thuê.');
   step({type:'lease',model:spec.model});plane=draft.fleet.find(p=>!game.fleet.some(old=>old.id===p.id)).id;
   if(!Number.isFinite(spec.serviceStart)||spec.serviceStart<0||spec.serviceStart>=168||spec.serviceStart%.25)fail('Chọn ca bảo dưỡng tuần cho máy bay thuê.');
   const delivered=draft.fleet.find(p=>p.id===plane);
   if(nextPlanStart(game.day,spec.serviceStart)+LIGHT_HOURS>delivered.serviceDueAt)fail('Ca bảo dưỡng đầu tiên phải hoàn tất trước hạn của máy bay thuê. Chọn ca sớm hơn.');
   step({type:'service-plan',plane,start:spec.serviceStart});
  }else{
   const p=game.fleet.find(p=>p.id===plane);if(!p)fail('Chọn máy bay khai thác tuyến mới.');
   const index=routes.findIndex(r=>r.from===p.hub&&r.to===spec.to);
   if(index>=0){if(game.openedRoutes.includes(index))fail('Tuyến này đã mở. Dùng phương án tần suất.');step({type:'unlock',route:index});route=index;}
   else {step({type:'route-create',from:p.hub,to:spec.to});route=routesFor(draft).length-1;}
  }
  if(!draft.openedRoutes.includes(route))fail('Chọn tuyến đã mở để khai thác máy bay thuê.');
  step({type:'add-weekly',plane,route,days,at});
 }
 if(!actions.length)fail('Lịch không thay đổi; chọn tần suất khác.');
 return {game:draft,actions};
}
function replay(game){
 let state=game;const total={days:0,revenue:0,profit:0,pax:0,cancelled:0,maintenance:0,slotFees:0,leaseExpense:0,incidents:0,cashAfter:game.cash,cashMinimum:game.cash,reservePeak:0,error:null};
 for(let i=0;i<7;i++){
  try{
   total.reservePeak=Math.max(total.reservePeak,dayCashRequired(forecast(state)));
   const r=transition(state,{type:'advance'});if(r.error)fail(r.error);state=r.game;const h=r.report;
   total.days++;for(const key of ['revenue','profit','pax','cancelled'])total[key]+=h[key]||0;
   total.maintenance+=h.maintenanceCost||0;total.slotFees+=h.slotFee||0;total.leaseExpense+=h.leaseExpense||0;total.incidents+=h.incidents?.length||0;
   total.cashAfter=state.cash;total.cashMinimum=Math.min(total.cashMinimum,state.cash);
  }catch(e){total.error=`Ngày ${state.day}: ${e.message}`;break;}
 }
 total.deferredRevenue=((state.legEconomy?.deferredCents||0)+advanceLiability(state.legEconomy?.advance))/100;
 return total;
}
export function compareDecisions(game,specs){
 if(!Array.isArray(specs)||!specs.length||specs.length>4||specs.some(s=>!s||!Object.hasOwn(DECISION_NAMES,s.kind))||new Set(specs.map(s=>s.kind)).size!==specs.length)fail('Chọn từ 1 đến 4 phương án khác loại.');
 const basis=JSON.stringify(game),baseline=replay(game);
 const options=specs.map(input=>{
  const spec=structuredClone(input);
  try{
   const ready=prepare(game,spec),metrics=replay(ready.game),newPlane=ready.game.fleet.find(p=>!game.fleet.some(old=>old.id===p.id));
   const lease=newPlane?.lease?{plane:newPlane.id,deposit:newPlane.lease.deposit,daily:newPlane.lease.rate,term:14,remainingFees:13*newPlane.lease.rate,checkFee:Math.round(repairCost(ready.game,newPlane.id)*.35)}:null;
   const details=ready.actions.map(a=>a.type==='prices'?`Giá Y/J/F: ${a.values.join(' / ')} USD · ${routeLabel(ready.game,routesFor(ready.game)[a.route])}`:a.type==='remove'?`Gỡ vòng #${a.id} khỏi lịch tuần; giữ các nhóm giờ khác.`:a.type==='lease'?`Nhận ${context(game).types[a.model].name} thuê 14 ngày.`:a.type==='service-plan'?`Ca tuần 5 giờ: ${displayAt(nextPlanStart(game.day,a.start))}; phí thu khi ca bắt đầu.`:a.type==='unlock'||a.type==='route-create'?'Mua quyền mở tuyến; chưa tự mua quyền slot.':`Xếp ${a.days.length} vòng/tuần · ${routeLabel(ready.game,routesFor(ready.game)[a.route])} · ${a.plane}.`);
   return {kind:spec.kind,name:DECISION_NAMES[spec.kind],spec,details,lease,actions:ready.actions,upfront:game.cash-ready.game.cash,cashAfterAction:ready.game.cash,metrics,
    profitDelta:metrics.days===7&&baseline.days===7?metrics.profit-baseline.profit:null,
    cashDelta:metrics.days===7&&baseline.days===7?metrics.cashAfter-baseline.cashAfter:null};
  }catch(e){return {kind:spec.kind,name:DECISION_NAMES[spec.kind],spec,error:e.message};}
 });
 return {basis,day:game.day,baseline,options};
}
export function applyDecisionComparison(game,proposal){
 if(!proposal||proposal.basis!==JSON.stringify(game))fail('Snapshot đã thay đổi. So sánh lại trước khi áp dụng.');
 const verified=compareDecisions(game,[proposal.option?.spec]).options[0];
 if(JSON.stringify(verified)!==JSON.stringify(proposal.option))fail('Phương án không khớp bản kiểm chứng. So sánh lại.');
 if(verified.error||verified.metrics.days!==7)fail('Phương án chưa hoàn tất mô phỏng 7 ngày. Điều chỉnh và so sánh lại.');
 return prepare(game,verified.spec).game;
}
