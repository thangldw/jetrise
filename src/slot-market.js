import {datedRounds,datedRound,roundHours} from './dated-legs.js';
import {expandRoundTrip} from './connection-core.js';
import {validMigrationId} from './live-leg-economy.js';

// Synthetic recurring rights for one weekday/hour, not real airport capacity.
export const SLOT_TERMS=Object.freeze({capacity:4,signing:500,daily:20,commitment:7});
// Existing ownership is grandfathered; only additional acquisitions are capped.
export const playerSlotPurchaseLimit=(owned,aiOwned)=>Math.max(owned,Math.min(1,SLOT_TERMS.capacity-aiOwned));
export const SLOT_USAGE_DAYS=14;
export const SLOT_OWNERS=['player','swift','aurelia'];
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const weekHour=t=>((Math.floor(t)%168)+168)%168;
const keyAt=(airport,t)=>airport+':'+weekHour(t);
const total=rights=>Object.values(rights).reduce((n,r)=>n+r.quantity,0);
export const sharedSlotDaily=s=>s.slotMarket?total(s.slotMarket.rights.player)*SLOT_TERMS.daily:0;
export const slotAirports=ctx=>[...new Set([ctx.airline.origin,...ctx.openedRoutes.flatMap(i=>[ctx.routes[i].from,ctx.routes[i].to])])];
const movements=legs=>legs.flatMap(l=>[{airport:l.from,at:l.departure},{airport:l.to,at:l.arrival}]);
function add(map,key,n=1){map.set(key,(map.get(key)||0)+n);}
function selected(market,legs){return movements(legs).filter(m=>market.airports.includes(m.airport));}
function requiredActual(ctx,state,market){
 const now=(ctx.day-1)*24,counts=new Map();
 // Two weeks include delayed returns and the following unchanged recurrence.
 for(const r of datedRounds(ctx,state,14))if(!r.cancelled)for(const m of selected(market,r.legs))if(m.at>=now)add(counts,m.airport+':'+Math.floor(m.at));
 return counts;
}
export function slotRequirements(ctx,state=ctx.tycoon,market=ctx.slotMarket){
 if(!market)return new Map();
 const required=new Map();
 for(const x of state.schedules){const p=ctx.fleet.find(p=>p.id===x.plane);if(!p)continue;const route=ctx.routes[x.route],legs=expandRoundTrip({id:String(x.id),plane:p.id,route:x.route,from:route.from,to:route.to,start:x.start,hours:roundHours(ctx,p,x.route),capacity:state.cabins[p.id]});for(const m of selected(market,legs))add(required,keyAt(m.airport,m.at));}
 for(const [key,count] of requiredActual(ctx,state,market)){const [airport,hour]=key.split(':'),weekly=keyAt(airport,Number(hour));required.set(weekly,Math.max(required.get(weekly)||0,count));}
 return required;
}
export function sharedSlotConflict(ctx,state){
 if(!ctx.slotMarket)return '';
 for(const [key,used] of slotRequirements(ctx,state)){const owned=ctx.slotMarket.rights.player[key]?.quantity||0;if(used>owned&&!expiredTemplateOnly(ctx,state,key)){const [airport,hour]=key.split(':');return `${airport}: cần ${used} quyền slot vào thứ ${Math.floor(Number(hour)/24)+2}, ${String(Number(hour)%24).padStart(2,'0')}:00; đang có ${owned}. Mua quyền theo giờ trong Thiết kế mạng trước khi sửa lịch hoặc cứu chuyến.`;}}
 return '';
}
export function sharedOccurrenceError(ctx,state,day,slot){
 if(!ctx.slotMarket)return '';
 const r=datedRound(ctx,state,day,slot);if(!r||r.cancelled)return '';
 const actual=requiredActual({...ctx,day},state,ctx.slotMarket);
 for(const m of selected(ctx.slotMarket,r.legs))if((actual.get(m.airport+':'+Math.floor(m.at))||0)>(ctx.slotMarket.rights.player[keyAt(m.airport,m.at)]?.quantity||0))return ctx.slotMarket.utilization?.expired[keyAt(m.airport,m.at)]?'Quyền slot mới tại '+m.airport+' đã bị thu hồi vì không khai thác; mua lại khi hết thời gian chờ.':'Thiếu quyền slot theo giờ tại '+m.airport+'.';
 return '';
}
export function slotMarketRows(ctx,airport,weekday){
 const market=ctx.slotMarket,required=slotRequirements(ctx);if(!market)return [];
 return Array.from({length:24},(_,clock)=>{const hour=weekday*24+clock,key=airport+':'+hour,owned=Object.fromEntries(SLOT_OWNERS.map(o=>[o,market.rights[o][key]?.quantity||0]));return {key,hour,clock,...owned,required:required.get(key)||0,available:SLOT_TERMS.capacity-Object.values(owned).reduce((a,b)=>a+b,0),purchaseLimit:playerSlotPurchaseLimit(owned.player,owned.swift+owned.aurelia),unlockDay:market.rights.player[key]?.unlockDay};});
}
export function quoteSlotActivation(ctx,airports){
 if(ctx.slotMarket)throw Error('Thị trường slot đã được bật.');
 if(!ctx.legEconomy||!ctx.strategy)throw Error('Bật kinh tế theo chặng JET-201 và cạnh tranh AI trước.');
 if(!Array.isArray(airports)||airports.length!==3||new Set(airports).size!==3||!airports.includes(ctx.airline.origin)||airports.some(a=>!slotAirports(ctx).includes(a)))throw Error('Chọn ba sân bay khác nhau trong mạng, gồm hub chính.');
 if(airports.some(a=>ctx.slotRights?.[a]))throw Error('Kết thúc gói slot cũ tại sân bay đã chọn trước khi chuyển sang thị trường chung; không thu hai gói tại cùng sân bay.');
 const needs=slotRequirements(ctx,ctx.tycoon,{airports});
 for(const [key,n] of needs)if(n>SLOT_TERMS.capacity)throw Error(`${key}: lịch hiện tại cần ${n} lượt/giờ, vượt công suất chung ${SLOT_TERMS.capacity}. Điều chỉnh lịch trước; chưa thu tiền.`);
 const units=[...needs.values()].reduce((a,b)=>a+b,0),fee=units*SLOT_TERMS.signing,daily=units*SLOT_TERMS.daily;
 if(ctx.cash<fee)throw Error('Không đủ tiền mua quyền bảo toàn lịch hiện tại.');
 return {needs,units,fee,daily,minimum:fee+daily*SLOT_TERMS.commitment};
}
export function sharedSlotAction(s,a,ctx){
 if(a.type==='slot-utilization-enable'){
  if(s.slotMarket?.version!==2||s.slotMarket.utilization||!validMigrationId(a.migrationId)||a.acceptTerms!==true)throw Error('Bật điều khoản quyền mới trước và xác nhận điều kiện khai thác thực tế.');
  s.slotMarket.version=3;s.slotMarket.utilization={version:1,migrationId:a.migrationId,enabledDay:s.day,grandfathered:structuredClone(s.slotMarket.rights.player),tracked:{},expired:{},returnedUnits:0};
  return 'Đã bật điều kiện 14 ngày không khai thác, chỉ cho quyền mua từ bây giờ; quyền đã mua giữ nguyên điều khoản.';
 }
 if(a.type==='slot-reservation-enable'){
  if(!s.slotMarket||s.slotMarket.version!==1||s.slotMarket.conditional)throw Error('Cần thị trường slot cũ chưa bật điều khoản quyền mới.');
  if(!validMigrationId(a.migrationId)||a.acceptTerms!==true)throw Error('Xác nhận điều khoản quyền mua mới trước khi bật.');
  s.slotMarket.version=2;s.slotMarket.conditional={version:1,migrationId:a.migrationId,enabledDay:s.day,grandfathered:structuredClone(s.slotMarket.rights.player),protected:Object.fromEntries(Object.entries(s.slotMarket.rights.player).map(([k,r])=>[k,r.quantity])),newRights:{},returnedUnits:0};
  return 'Đã bật điều khoản quyền mua mới; mọi quyền đã sở hữu được bảo lưu, chưa thu phí.';
 }
 if(a.type==='slot-market-enable'){
  const q=quoteSlotActivation(ctx,a.airports);if(!validMigrationId(a.migrationId))throw Error('Invalid slot migration ID');
  if(a.quotedFee!==q.fee)throw Error('Chi phí chuyển đổi đã đổi. Xem lại báo giá trước khi bật.');
  const player=Object.fromEntries([...q.needs].sort(([a],[b])=>a.localeCompare(b)).map(([key,quantity])=>[key,{quantity,startedDay:s.day,unlockDay:s.day+SLOT_TERMS.commitment}]));
  s.slotMarket={version:1,migrationId:a.migrationId,enabledDay:s.day,airports:[...a.airports],rights:{player,swift:{},aurelia:{}},spent:{player:{signing:q.fee,daily:0},swift:{signing:0,daily:0},aurelia:{signing:0,daily:0}}};s.cash-=q.fee;
  return `Đã bật thị trường slot chung; mua ${q.units} quyền giữ nguyên lịch, trả $${q.fee}, duy trì $${q.daily}/ngày.`;
 }
 if(a.type!=='slot-market-buy')return null;
 const market=s.slotMarket;if(!market||!market.airports.includes(a.airport)||!int(a.hour,0,167)||!int(a.quantity,0,SLOT_TERMS.capacity))throw Error('Chọn sân bay, thứ, giờ và số quyền hợp lệ.');
 const key=a.airport+':'+a.hour,rights=market.rights.player,old=rights[key],owned=old?.quantity||0;
 if(a.quantity===owned)throw Error('Số quyền chưa thay đổi.');
 if(a.quantity<owned&&s.day<old.unlockDay)throw Error('Quyền còn cam kết đến ngày '+old.unlockDay+'.');
 const others=market.rights.swift[key]?.quantity||0,other=market.rights.aurelia[key]?.quantity||0;
 if(a.quantity+others+other>SLOT_TERMS.capacity)throw Error('Giờ này không còn đủ quyền: AI đang sở hữu '+(others+other)+'/'+SLOT_TERMS.capacity+' lượt. Chọn giờ khác.');
 const needed=slotRequirements({...ctx,slotMarket:market},s.tycoon).get(key)||0;
 if(a.quantity<needed)throw Error('Cần giữ '+needed+' quyền cho lịch tuần hoặc chặng đã cam kết. Sửa lịch/hoàn vé và chờ chuyến về trước khi trả quyền.');
 if(a.quantity>playerSlotPurchaseLimit(owned,others+other))throw Error('Mỗi thứ/giờ chỉ mua mới tối đa 1 quyền. Quyền đã sở hữu được giữ nguyên; đổi giờ bay hoặc chọn máy bay lớn hơn để tăng năng lực.');
 if(a.quantity>owned&&market.utilization?.expired[key]&&s.day<market.utilization.expired[key].day+7)throw Error('Quyền bị thu hồi vì không khai thác; có thể mua lại từ ngày '+(market.utilization.expired[key].day+7)+'. AI có thể mua trong thời gian này.');
 const fee=Math.max(0,a.quantity-owned)*SLOT_TERMS.signing;if(s.cash<fee)throw Error('Không đủ tiền mua quyền slot.');
 if(a.quantity)rights[key]={quantity:a.quantity,startedDay:a.quantity>owned?s.day:old.startedDay,unlockDay:a.quantity>owned?s.day+SLOT_TERMS.commitment:old.unlockDay};else delete rights[key];
 if(market.conditional){const p=market.conditional;if(a.quantity>owned)p.newRights[key]=structuredClone(rights[key]);else{if(p.protected[key]){if(a.quantity)p.protected[key]=a.quantity;else delete p.protected[key];}if(p.newRights[key])delete p.newRights[key];}}
 if(market.utilization){const u=market.utilization;if(a.quantity>owned){const previous=u.tracked[key];u.tracked[key]=!previous||(previous.releasedDay!==null&&s.day-previous.releasedDay>=7)?{startedDay:s.day,lastUsedDay:null,releasedDay:null}:{...previous,releasedDay:null};delete u.expired[key];}else if(u.tracked[key])u.tracked[key].releasedDay=s.day;}
 s.cash-=fee;market.spent.player.signing+=fee;return a.quantity>owned?`Đã mua thêm ${a.quantity-owned} quyền · $${fee}; duy trì phần này $${a.quantity*SLOT_TERMS.daily}/ngày.`:'Đã trả quyền trống; dừng phí tương ứng, không hoàn phí mua.';
}
export function validateSlotMarket(s,ctx){
 const m=s.slotMarket;if(m===undefined)return;
 if(!m||![1,2,3].includes(m.version)||!s.legEconomy||!s.strategy||!validMigrationId(m.migrationId)||!int(m.enabledDay,Math.max(s.legEconomy.enabledDay,s.strategy.startDay),s.day)||!Array.isArray(m.airports)||m.airports.length!==3||new Set(m.airports).size!==3||!m.airports.includes(s.airline.origin)||m.airports.some(a=>!slotAirports(ctx).includes(a)||s.slotRights?.[a])||!m.rights||Object.keys(m.rights).length!==3)throw Error('Invalid shared slot market');
 validateConditionalSlots(s);validateSlotUtilization(s,ctx);
 const counts=new Map();
 if(!m.spent||Object.keys(m.spent).length!==3)throw Error('Invalid slot spending');
 for(const owner of SLOT_OWNERS){const paid=m.spent[owner];if(!paid||Object.keys(paid).sort().join(',')!=='daily,signing'||!int(paid.signing,0,1e11)||!int(paid.daily,0,1e11))throw Error('Invalid slot spending');}
 for(const owner of SLOT_OWNERS){const rights=m.rights[owner];if(!rights||Array.isArray(rights)||typeof rights!=='object'||Object.keys(rights).length>504)throw Error('Invalid slot owner');for(const [key,r] of Object.entries(rights)){const [airport,hour,...rest]=key.split(':');if(rest.length||!m.airports.includes(airport)||String(Number(hour))!==hour||!int(Number(hour),0,167)||!r||Object.keys(r).sort().join(',')!=='quantity,startedDay,unlockDay'||!int(r.quantity,1,SLOT_TERMS.capacity)||!int(r.startedDay,m.enabledDay,s.day)||r.unlockDay!==r.startedDay+SLOT_TERMS.commitment)throw Error('Invalid shared slot right');add(counts,key,r.quantity);}}
 if([...counts.values()].some(n=>n>SLOT_TERMS.capacity))throw Error('Overallocated shared slot capacity');
 for(const h of s.tycoon?.history||[]){const report=h.sharedSlots;if(report===undefined)continue;
  if(!int(h.day,m.enabledDay,s.day-1)||!int(report.playerDaily,0,504*SLOT_TERMS.capacity*SLOT_TERMS.daily)||!Array.isArray(report.rivals)||report.rivals.length!==2||!Array.isArray(report.movements)||report.movements.length>72)throw Error('Invalid shared slot report');
  const seen=new Set();for(const row of report.movements){const key=row?.airport+':'+row?.hour;if(!row||!m.airports.includes(row.airport)||!int(row.hour,(h.day-1)*24,h.day*24-1)||seen.has(key)||!SLOT_OWNERS.every(o=>int(row[o],0,SLOT_TERMS.capacity))||SLOT_OWNERS.reduce((n,o)=>n+row[o],0)>SLOT_TERMS.capacity)throw Error('Invalid shared slot movement');seen.add(key);}
  for(const [i,r] of report.rivals.entries())if(!r||r.id!==SLOT_OWNERS[i+1]||!int(r.signing,0,504*4*SLOT_TERMS.signing)||!int(r.daily,0,504*4*SLOT_TERMS.daily)||!int(r.rotations,0,3)||(r.rotations?!int(r.hour,0,23):r.hour!==null)||typeof r.forfeited!=='boolean'||!Array.isArray(r.movements)||r.movements.length>(r.network?12:4)||r.movements.some(v=>!v||!m.airports.includes(v.airport)||!Number.isFinite(v.at)||v.at<(h.day-1)*24||v.at>=h.day*24||!int(v.count,1,3)||(r.network?v.count!==1:v.count!==r.rotations)))throw Error('Invalid rival slot receipt');
 }
}

// Shared atomic rights quote used by both legacy and per-aircraft AI operations.
export function quoteRivalRights(market,owner,need,day){
 if([...need].some(([key,n])=>n+SLOT_OWNERS.filter(o=>o!==owner).reduce((v,o)=>v+(market.rights[o][key]?.quantity||0),0)>SLOT_TERMS.capacity))return null;
 const rights=structuredClone(market.rights[owner]),weekday=(day-1)%7;
 for(const [key,r] of Object.entries(rights))if(Math.floor(Number(key.split(':')[1])/24)===weekday&&day>=r.unlockDay){const n=need.get(key)||0;if(!n)delete rights[key];else if(n<r.quantity)r.quantity=n;}
 let extra=0;for(const [key,n] of need)if(n>(rights[key]?.quantity||0)){extra+=n-(rights[key]?.quantity||0);rights[key]={quantity:n,startedDay:day,unlockDay:day+SLOT_TERMS.commitment};}
 return {rights,signing:extra*SLOT_TERMS.signing,daily:total(rights)*SLOT_TERMS.daily};
}
export const rivalSlotNeed=(market,legs)=>{const need=new Map();for(const m of selected(market,legs))add(need,keyAt(m.airport,m.at));return need;};
export const controlledMovements=(market,legs)=>selected(market,legs);

// The existing AI operation remains authoritative. Only time and operable fleet
// count are constrained here, with all four movements purchased atomically.
export function allocateRivalSlots(ctx,strategy,operations,day){
 if(!ctx.slotMarket)return null;
 const market=structuredClone(ctx.slotMarket),receipts={};
 for(const i of [day%2,(day+1)%2]){
  const rival=strategy.rivals[i],op=operations[i],rights=market.rights[rival.id],size=1+(rival.leases?.length||0),weekday=(day-1)%7;
  let chosen=null,signing=0,daily=total(rights)*SLOT_TERMS.daily;
  if(op.flies){const route=ctx.routes[rival.route],clocks=Array.from({length:24},(_,i)=>(i+op.hour)%24).filter(h=>h+op.hours<=24);
   for(let count=size;count>=1&&!chosen;count--)for(const clock of clocks){const legs=expandRoundTrip({id:rival.id,plane:rival.id,route:rival.route,from:route.from,to:route.to,start:(day-1)*24+clock,hours:op.hours,capacity:[0,0,0]}),need=new Map();for(const m of selected(market,legs))add(need,keyAt(m.airport,m.at),count);
    const quote=quoteRivalRights(market,rival.id,need,day);if(!quote)continue;
    const trial=quote.rights,fee=quote.signing,maintenance=quote.daily;
    if(rival.cash<op.fixed+op.cost/size*count+360*4*count+fee+maintenance)continue;
    chosen={clock,count,legs,rights:trial};signing=fee;daily=maintenance;break;
   }
  }
  if(!chosen){for(const [key,r] of Object.entries(rights))if(Math.floor(Number(key.split(':')[1])/24)===weekday&&day>=r.unlockDay)delete rights[key];daily=total(rights)*SLOT_TERMS.daily;}
  let forfeited=false;
  if(rival.cash<daily){market.rights[rival.id]={};daily=0;chosen=null;forfeited=true;}
  if(chosen)market.rights[rival.id]=chosen.rights;
  op.fixed=Math.min(Math.max(0,rival.cash-signing-daily),op.fixed);
  op.cost=(chosen?op.cost/size*chosen.count:0)+daily;
  op.seats=chosen?op.seats.map(n=>n/size*chosen.count):[0,0,0];op.flies=!!chosen;op.hour=chosen?.clock??6;
  op.status=forfeited?'Mất quyền slot vì không đủ phí duy trì':chosen?`Khai thác ${chosen.count}/${size} vòng · ${String(chosen.clock).padStart(2,'0')}:00 · slot chung`:op.status==='Đang khai thác'?'Tạm dừng · thiếu slot hoặc vốn mua quyền':op.status;
  receipts[rival.id]={id:rival.id,signing,daily,rotations:chosen?.count||0,hour:chosen?.clock??null,forfeited,movements:chosen?selected(market,chosen.legs).map(m=>({...m,count:chosen.count})):[]};
 }
 market.spent.player.daily+=sharedSlotDaily(ctx);
 for(const id of SLOT_OWNERS.slice(1)){market.spent[id].signing+=receipts[id].signing;market.spent[id].daily+=receipts[id].daily;}
 return {state:market,receipts:SLOT_OWNERS.slice(1).map(id=>receipts[id])};
}
export function recordSlotMovements(ctx,report){
 if(!ctx.slotMarket)return;
 const counts=new Map(),now=(report.day-1)*24;
 const addMovement=(owner,airport,at,n=1)=>{if(at<now||at>=now+24||!ctx.slotMarket.airports.includes(airport))return;const key=airport+':'+Math.floor(at),row=counts.get(key)||{airport,hour:Math.floor(at),player:0,swift:0,aurelia:0};row[owner]+=n;counts.set(key,row);};
 const rounds=new Map([...(ctx.legEconomy?.rounds||[]),...(report.departureManifests||[])].map(r=>[r.id,r]));
 for(const r of rounds.values())for(const m of movements(r.legs))addMovement('player',m.airport,m.at);
 for(const r of report.sharedSlots.rivals)for(const m of r.movements)addMovement(r.id,m.airport,m.at,m.count);
 report.sharedSlots.movements=[...counts.values()].sort((a,b)=>a.hour-b.hour||a.airport.localeCompare(b.airport));
 const usage=report.slotMarketState?.utilization;
 if(usage)for(const row of report.sharedSlots.movements)if(row.player>0){const record=usage.tracked[keyAt(row.airport,row.hour)];if(record)record.lastUsedDay=report.day;}

}


// A separate opt-in contract: no retrospective changes to held permanent rights.
export function reconcileConditionalSlots(ctx,state=ctx.tycoon){
 const m=ctx.slotMarket,p=m?.conditional;if(!p||!Object.keys(p.newRights).length)return [];
 const required=slotRequirements(ctx,state,m),released=[];
 const pending=committedSlotKeys(ctx),usage=m.utilization;
 for(const [key,r] of Object.entries(p.newRights)){
  const tracked=usage?.tracked[key],expired=tracked&&ctx.day-(tracked.lastUsedDay??tracked.startedDay)>=SLOT_USAGE_DAYS+(tracked.lastUsedDay===null?0:1)&&!pending.has(key);
  if(!(required.get(key)>0)||expired){
  if(tracked){tracked.releasedDay=ctx.day;if(expired){usage.expired[key]={day:ctx.day,templates:state.schedules.filter(x=>templateKeys(ctx,x,state).includes(key)).map(x=>({...x}))};usage.returnedUnits+=r.quantity;}}

  // Pending/committed legs are included by slotRequirements, even after a
  // template is removed or a flight crosses Sunday. Never release their rights.
  delete m.rights.player[key];delete p.newRights[key];p.returnedUnits+=r.quantity;released.push({key,quantity:r.quantity});
 }}
 return released;
}

export function validateConditionalSlots(s){
 const m=s.slotMarket,p=m?.conditional;
 if(m.version===1){if(p!==undefined)throw Error('Conditional slot policy requires market version 2');return;}
 const fail=()=>{throw Error('Invalid conditional slot terms');};
 if(!p||Object.keys(p).sort().join(',')!=='enabledDay,grandfathered,migrationId,newRights,protected,returnedUnits,version'||p.version!==1||!validMigrationId(p.migrationId)||!int(p.enabledDay,m.enabledDay,s.day)||!int(p.returnedUnits,0,1e9))fail();
 const keyValid=k=>{const [a,h,...rest]=k.split(':');return !rest.length&&m.airports.includes(a)&&String(Number(h))===h&&int(Number(h),0,167);};
 for(const map of [p.grandfathered,p.protected,p.newRights])if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>504||Object.keys(map).some(k=>!keyValid(k)))fail();
 for(const [key,r] of Object.entries(p.grandfathered))if(!r||Object.keys(r).sort().join(',')!=='quantity,startedDay,unlockDay'||!int(r.quantity,1,4)||!int(r.startedDay,m.enabledDay,p.enabledDay)||r.unlockDay!==r.startedDay+7)fail();
 for(const [key,n] of Object.entries(p.protected)){
  const old=p.grandfathered[key],held=m.rights.player[key];if(!old||!int(n,1,old.quantity)||!held||held.quantity!==n||held.startedDay!==old.startedDay||held.unlockDay!==old.unlockDay||p.newRights[key])fail();
 }
 for(const [key,r] of Object.entries(p.newRights))if(!r||r.quantity!==1||!int(r.startedDay,p.enabledDay,s.day)||r.unlockDay!==r.startedDay+7||JSON.stringify(r)!==JSON.stringify(m.rights.player[key])||p.protected[key])fail();
 for(const key of Object.keys(m.rights.player))if(!p.protected[key]&&!p.newRights[key])fail();
 for(const h of s.tycoon?.history||[])if(h.conditionalSlotReturns!==undefined){const rows=h.conditionalSlotReturns;if(h.day<p.enabledDay||!Array.isArray(rows)||rows.length>504||new Set(rows.map(r=>r?.key)).size!==rows.length||rows.some(r=>!r||Object.keys(r).sort().join(',')!=='key,quantity'||!keyValid(r.key)||r.quantity!==1))fail();}
}

function templateKeys(ctx,x,state){
 const p=ctx.fleet.find(p=>p.id===x.plane);if(!p)return [];
 const route=ctx.routes[x.route],legs=expandRoundTrip({id:String(x.id),plane:p.id,route:x.route,from:route.from,to:route.to,start:x.start,hours:roundHours(ctx,p,x.route),capacity:state.cabins[p.id]});
 return selected(ctx.slotMarket,legs).map(m=>keyAt(m.airport,m.at));
}
function expiredTemplateOnly(ctx,state,key){
 const expired=ctx.slotMarket?.utilization?.expired[key];if(!expired||ctx.slotMarket.rights.player[key])return false;
 const templates=state.schedules.filter(x=>templateKeys(ctx,x,state).includes(key));
 return templates.every(x=>expired.templates.some(old=>old.id===x.id&&old.plane===x.plane&&old.route===x.route&&old.start===x.start))&&!committedSlotKeys(ctx).has(key);
}
function committedSlotKeys(ctx){
 const keys=new Set(),now=(ctx.day-1)*24;
 for(const r of ctx.legEconomy?.rounds||[])for(const m of selected(ctx.slotMarket,r.legs))if(m.at>=now)keys.add(keyAt(m.airport,m.at));
 for(const j of ctx.legEconomy?.overnight?.journeys||[])for(const l of j.legs)if(['reserved','airborne'].includes(l.status))for(const m of [{airport:l.from,at:l.departure},{airport:l.to,at:l.arrival}])if(m.at>=now&&ctx.slotMarket.airports.includes(m.airport))keys.add(keyAt(m.airport,m.at));
 return keys;
}
function validateSlotUtilization(s,ctx){
 const m=s.slotMarket,u=m.utilization;if(m.version!==3){if(u!==undefined)throw Error('Utilization terms require market version 3');return;}
 const fail=()=>{throw Error('Invalid slot utilization terms');},keyValid=k=>{const [a,h,...rest]=k.split(':');return !rest.length&&m.airports.includes(a)&&String(Number(h))===h&&int(Number(h),0,167);};
 if(!u||Object.keys(u).sort().join(',')!=='enabledDay,expired,grandfathered,migrationId,returnedUnits,tracked,version'||u.version!==1||!validMigrationId(u.migrationId)||!int(u.enabledDay,m.conditional.enabledDay,s.day)||!int(u.returnedUnits,0,m.conditional.returnedUnits))fail();
 for(const map of [u.grandfathered,u.tracked,u.expired])if(!map||Array.isArray(map)||typeof map!=='object'||Object.keys(map).length>504||Object.keys(map).some(k=>!keyValid(k)))fail();
 for(const r of Object.values(u.grandfathered))if(!r||Object.keys(r).sort().join(',')!=='quantity,startedDay,unlockDay'||!int(r.quantity,1,4)||!int(r.startedDay,m.enabledDay,u.enabledDay)||r.unlockDay!==r.startedDay+7)fail();
 for(const [key,r]of Object.entries(u.tracked))if(!r||Object.keys(r).sort().join(',')!=='lastUsedDay,releasedDay,startedDay'||!int(r.startedDay,u.enabledDay,s.day)||(r.releasedDay===null?(!m.conditional.newRights[key]||r.startedDay>m.rights.player[key]?.startedDay):(!int(r.releasedDay,r.startedDay,s.day)||!!m.rights.player[key]))||(r.lastUsedDay!==null&&!int(r.lastUsedDay,r.startedDay,s.day-1))||(u.expired[key]&&r.releasedDay===null))fail();
 for(const [key,r]of Object.entries(u.expired))if(!r||Object.keys(r).sort().join(',')!=='day,templates'||!int(r.day,u.enabledDay+SLOT_USAGE_DAYS,s.day)||m.rights.player[key]||!Array.isArray(r.templates)||r.templates.length>480||r.templates.some(x=>!x||Object.keys(x).sort().join(',')!=='id,plane,route,start'||!int(x.id,1,s.tycoon.nextId-1)||typeof x.plane!=='string'||!int(x.route,0,ctx.routes.length-1)||!Number.isFinite(x.start)||x.start<0||x.start>=168||x.start%.25))fail();
}
