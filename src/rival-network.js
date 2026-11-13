import {RIVAL_LEASE,aiLevel} from './rival-terms.js';
import {airportList,getAirport,routeQuote} from './network.js';
import {validMigrationId} from './live-leg-economy.js';
import {expandRoundTrip} from './connection-core.js';
import {legSettlement} from './leg-settlement.js';
import {quoteRivalRights,rivalSlotNeed,controlledMovements,SLOT_TERMS,sharedSlotDaily} from './slot-market.js';
import {projectedWeekReports} from './planner.js';

export const RIVAL_NETWORK_TERMS=Object.freeze({maxFleet:3,maxRoutes:4,shortlist:12,...RIVAL_LEASE,overhead:2500,reserveDays:7});
const sum=xs=>xs.reduce((a,b)=>a+b,0),cent=n=>Math.round(n*100),half=(n,i)=>i?Math.floor(n/2):Math.ceil(n/2);
export const rivalMarketKey=r=>[r.from,r.to].sort().join('|');
const hours=(ctx,r)=>Math.ceil((1+(r.cycle-1)*800/ctx.types.A320.speed)*4)/4;
const cabin=r=>r.id==='swift'?[180,0,0]:[130,20,3];
const dailyRights=rights=>sum(Object.values(rights).map(r=>r.quantity))*SLOT_TERMS.daily;
export function canonicalRivalRoute(ctx,pair){const known=ctx.routes.find(r=>rivalMarketKey(r)===rivalMarketKey(pair));return {...(known||routeQuote(ctx,pair.from,pair.to)),from:pair.from,to:pair.to};}
export const rivalRoute=(ctx,r,key)=>{const p=r.network.routes.find(p=>rivalMarketKey(p)===key);return p?canonicalRivalRoute(ctx,p):null;};
export function rivalShortlist(ctx){
 const hub=ctx.airline.origin,all=airportList(ctx).filter(b=>b.iata!==hub&&b.major).flatMap(b=>{try{const q=routeQuote(ctx,hub,b.iata);return q.km<=ctx.types.A320.range&&hours(ctx,q)<=18?[q]:[];}catch{return [];}});
 const existing=ctx.strategy.rivals.flatMap(r=>r.route===null?[]:[ctx.routes[r.route]]),near=[...all].sort((a,b)=>a.km-b.km||a.to.localeCompare(b.to)).slice(0,4),yieldEstimate=q=>Math.min(360,q.demand)*q.baseFare-ctx.types.A320.nonfuel-ctx.types.A320.burn*hours(ctx,q)/6*(ctx.fuelPrice+3160*ctx.co2Price),yieldRank=[...all].sort((a,b)=>yieldEstimate(b)-yieldEstimate(a)||a.to.localeCompare(b.to));
 return [...new Map([...existing,...near,...yieldRank].map(r=>[rivalMarketKey(r),{from:r.from,to:r.to}])).values()].slice(0,RIVAL_NETWORK_TERMS.shortlist);
}
export function enableRivalNetwork(s,a,ctx){
 if(!s.legEconomy||!s.strategy||!s.slotMarket)throw Error('Bật JET-201, cạnh tranh AI và thị trường slot chung JET-204 trước.');
 if(s.strategy.expansion)throw Error('JET-206 đã được bật.');if(!validMigrationId(a.migrationId))throw Error('Mã chuyển đổi không hợp lệ.');
 const shortlist=rivalShortlist(ctx);if(!shortlist.length)throw Error('Không có tuyến ứng viên hợp lệ trong tầm bay.');
 s.strategy.expansion={version:1,migrationId:a.migrationId,enabledDay:s.day,nextReviewDay:s.day+7,shortlist};
 for(const r of s.strategy.rivals){const pair=r.route===null?null:ctx.routes[r.route],routes=pair?[{from:pair.from,to:pair.to,openedDay:s.day,fee:0,inherited:true}]:[],due=s.day+((6-((s.day-s.strategy.startDay)%7)+7)%7),key=pair?rivalMarketKey(pair):null;
  const fleet=[null,...(r.leases||[])].map((lease,i)=>({id:r.id+'-'+(i+1),model:'A320',route:key,joinedDay:s.day,serviceDueDay:due,weekProfit:0,weekPax:0,weekSeats:0,...(lease?{lease:{remaining:lease.remaining,deposit:lease.deposit}}:{})}));
  r.network={routes,fleet,nextId:fleet.length+1,through:(s.day-1)*24,reviews:[]};delete r.leases;
 }
 return 'Đã bật JET-206; giữ vốn, đội bay và tiền cọc của AI. Xét mở rộng sau 7 ngày, bằng vốn riêng và slot dùng chung.';
}
function fixedReserve(ctx,r){const t=ctx.types.A320;return sum(r.network.fleet.map(p=>7*(RIVAL_NETWORK_TERMS.overhead+(p.lease?RIVAL_NETWORK_TERMS.rent:0)+t.nonfuel+t.burn*3*(ctx.fuelPrice+3160*ctx.co2Price)+360*4)+Math.round(t.nonfuel*.35)))+7*dailyRights(ctx.slotMarket.rights[r.id]);}
function candidate(strategy,ctx,id,key,day,planeId){
 const next=structuredClone(strategy),r=next.rivals.find(r=>r.id===id),pair=next.expansion.shortlist.find(p=>rivalMarketKey(p)===key);if(!pair)return null;
 let routeFee=0;const owns=r.network.routes.some(p=>rivalMarketKey(p)===key);
 if(!owns){if(r.network.routes.length>=RIVAL_NETWORK_TERMS.maxRoutes)return null;routeFee=routeQuote(ctx,pair.from,pair.to).price;r.network.routes.push({...pair,openedDay:day,fee:routeFee,inherited:false});}
 const lease=!planeId;if(lease&&r.network.fleet.length>=3)return null;
 if(lease){const id=r.id+'-'+r.network.nextId++;r.network.fleet.push({id,model:'A320',route:key,joinedDay:day,serviceDueDay:day+6,weekProfit:0,weekPax:0,weekSeats:0,lease:{remaining:RIVAL_LEASE.term,deposit:RIVAL_LEASE.deposit}});}else r.network.fleet.find(p=>p.id===planeId).route=key;
 const deposit=lease?RIVAL_LEASE.deposit:0;r.cash-=routeFee+deposit;if(r.cash<fixedReserve(ctx,r))return null;
 return {strategy:next,routeFee,deposit,key,plane:planeId||r.network.fleet.at(-1).id};
}
export function reviewRivalNetwork(ctx,state,strategy,day){
 if(ctx.noRivalReview||day!==strategy.expansion.nextReviewDay)return {};
 if(day>9992){strategy.expansion.nextReviewDay=day+7;return {};}
 const actions={};strategy.expansion.nextReviewDay=day+7;
 // The same canonical seven-day simulation prices all candidates; nested reviews are disabled.
 const project=a=>projectedWeekReports({...ctx,strategy:a,noRivalReview:true},state,false,7,day);
 for(const index of [day%2,(day+1)%2]){
  let r=strategy.rivals[index];const cashBefore=r.cash,oldFill=r.weekSeats?r.weekPax/r.weekSeats:0;
  r.fare=Math.round(Math.max(.65,Math.min(1.5,r.fare+(oldFill>.85?.05:oldFill<.55?-.08:0)))*100)/100;
  const returns=r.network.fleet.filter(p=>p.lease&&day-p.joinedDay>=7&&p.weekProfit<0);let refund=sum(returns.map(p=>p.lease.deposit));r.cash+=refund;r.network.fleet=r.network.fleet.filter(p=>!returns.includes(p));
  const weak=r.network.fleet.filter(p=>p.weekProfit<0||!p.route).sort((a,b)=>a.weekProfit-b.weekProfit||a.id.localeCompare(b.id))[0];
  for(const p of r.network.fleet){p.weekProfit=0;p.weekPax=0;p.weekSeats=0;}r.weekProfit=0;r.weekPax=0;r.weekSeats=0;
  const baseline=project(strategy),score=days=>sum(days.map(d=>{const x=d.report.competition.rivals.find(x=>x.id===r.id);return x.profit-(x.slotSigning||0);})),before=score(baseline);
  let best=null,considered=0;
  for(const pair of strategy.expansion.shortlist){const key=rivalMarketKey(pair);
   // At most one acquisition or reassignment per rival per review, from the public shortlist.
   const trial=candidate(strategy,ctx,r.id,key,day,weak?.id);if(!trial)continue;considered++;
   const days=project(trial.strategy),delta=score(days)-before-trial.routeFee,flights=sum(days.map(d=>d.report.competition.rivals.find(x=>x.id===r.id).aircraft.find(p=>p.id===trial.plane)?.flights||0));
   if(delta>0&&flights>=6&&(!best||delta>best.delta+.001))best={...trial,delta};
  }
  if(best){strategy.rivals[index]=best.strategy.rivals[index];r=strategy.rivals[index];}
  const decision={day,kind:best?(best.deposit?'lease':'reroute'):refund?'return':'hold',plane:best?.plane||null,market:best?.key||null,incrementalProfit:best?Math.round(best.delta*100)/100:0,routeFee:best?.routeFee||0,depositPaid:best?.deposit||0,depositRefund:refund,returned:returns.map(p=>p.id),considered,cashBefore,cashAfter:r.cash};
  r.network.reviews=[decision,...r.network.reviews].slice(0,28);
  r.notice=best?`${best.deposit?'Thuê A320':'Đổi tuyến'} ${best.key.replace('|',' ↔ ')}; dự kiến tăng $${Math.round(best.delta)} / 7 ngày sau phí mở tuyến và slot.`:refund?'Trả máy bay thuê lỗ tuần trước; hoàn cọc. Chưa có phương án mở rộng đủ điều kiện.':`Giữ đội bay; ${considered} phương án đủ vốn nhưng chưa có tăng trưởng sinh lời và đủ slot.`;
  actions[r.id]=decision;
 }
 return actions;
}
export function prepareRivalNetwork(ctx,state,strategy,day){
 if(strategy.rivals.some(r=>r.network.through!==(day-1)*24))throw Error('Rival leg ledger cursor mismatch');
 const reviews=reviewRivalNetwork(ctx,state,strategy,day),market=structuredClone(ctx.slotMarket),operations={},receipts={};
 for(const index of [day%2,(day+1)%2]){const r=strategy.rivals[index],t=ctx.types.A320;let refund=0;
  // Early returns happen before any new departure and reimburse only paid deposits.
  while(r.network.fleet.some(p=>p.lease)&&r.cash<sum(r.network.fleet.map(p=>2500+(p.lease?RIVAL_LEASE.rent:0)))+dailyRights(market.rights[r.id])){const p=r.network.fleet.findLast(p=>p.lease);refund+=p.lease.deposit;r.cash+=p.lease.deposit;r.network.fleet=r.network.fleet.filter(x=>x!==p);}
  let forfeited=false;if(r.cash<dailyRights(market.rights[r.id])){market.rights[r.id]={};forfeited=true;}
  const ops=[],need=new Map();let fixed=0,flightBudget=0,chosen=quoteRivalRights(market,r.id,need,day),signing=0;
  for(const p of r.network.fleet){const rent=p.lease?RIVAL_LEASE.rent:0,overhead=Math.min(2500,Math.max(0,r.cash-chosen.daily-fixed-rent)),base=rent+overhead,maintenance=day>=p.serviceDueDay&&r.cash-chosen.daily-fixed-base>=Math.round(t.nonfuel*.35)?Math.round(t.nonfuel*.35):0,rest=day>=p.serviceDueDay;
   fixed+=base+maintenance;if(maintenance)p.serviceDueDay=day+7;const route=p.route?rivalRoute(ctx,r,p.route):null;
   ops.push({plane:p.id,route,rest,maintenance,rent,fixed:base+maintenance,hours:route?hours(ctx,route):0,legs:[],hour:null,booked:[0,0,0]});
  }
  for(const op of ops){if(op.rest||!op.route||op.route.km>t.range||op.hours>18)continue;
   const burn=t.burn*op.hours/6,fuel=cent(burn*ctx.fuelPrice),co2=cent(Math.ceil(burn*3160)*ctx.co2Price),nonfuel=t.nonfuel*100,maximum=(nonfuel+fuel+co2)/100+sum(cabin(r))*2*(r.id==='aurelia'?4:1);
   let bestSlot=null;
   for(const clock of Array.from({length:24},(_,i)=>(i+6)%24).filter(h=>h+op.hours<=24)){
    const legs=expandRoundTrip({id:`${r.id}:${op.plane}:${day}`,plane:op.plane,route:op.route,from:op.route.from,to:op.route.to,start:(day-1)*24+clock,hours:op.hours,capacity:cabin(r)}),needs=new Map(need);
    for(const [key,n] of rivalSlotNeed(market,legs))needs.set(key,(needs.get(key)||0)+n);
    const quote=quoteRivalRights(market,r.id,needs,day);if(!quote||r.cash<fixed+flightBudget+maximum+quote.signing+quote.daily)continue;
    const cost=quote.signing+7*quote.daily;if(!bestSlot||cost<bestSlot.cost)bestSlot={cost,needs,quote,legs,clock};
   }
   if(bestSlot){need.clear();for(const [key,n] of bestSlot.needs)need.set(key,n);chosen=bestSlot.quote;flightBudget+=maximum;Object.assign(op,{legs:bestSlot.legs,hour:bestSlot.clock,fuel,co2,nonfuel});}
  }
  market.rights[r.id]=chosen.rights;signing=chosen.signing;
  const movements=ops.flatMap(op=>controlledMovements(market,op.legs).map(m=>({...m,count:1}))),rotations=ops.filter(op=>op.legs.length).length;
  receipts[r.id]={id:r.id,network:true,signing,daily:chosen.daily,rotations,hour:rotations?Math.min(...ops.filter(o=>o.legs.length).map(o=>o.hour)):null,forfeited,movements};
  operations[r.id]={ops,refund,reviews:reviews[r.id],fixed,status:rotations?`${rotations}/${ops.length} máy bay khai thác tuyến riêng`:ops.some(o=>o.rest)?'Bảo dưỡng hoặc chờ đủ phí bảo dưỡng':'Tạm dừng · thiếu slot, vốn hoặc tuyến'};
 }
 market.spent.player.daily+=sharedSlotDaily(ctx);for(const id of ['swift','aurelia']){market.spent[id].signing+=receipts[id].signing;market.spent[id].daily+=receipts[id].daily;}
 return {operations,slots:{state:market,receipts:['swift','aurelia'].map(id=>receipts[id])}};
}
export function rivalNetworkOffers(ctx,strategy,network){
 return strategy.rivals.flatMap(r=>network.operations[r.id].ops.filter(op=>op.legs.length).map(op=>{const fare=Math.round(op.route.baseFare*r.fare);return {owner:r.id,plane:op.plane,route:ctx.routes.findIndex(x=>rivalMarketKey(x)===rivalMarketKey(op.route)),routeData:op.route,capacity:cabin(r).map(n=>n*2),fares:[fare,Math.round(fare*2.5),fare*5],comfort:r.comfort,hour:op.hour,reliability:aiLevel(strategy).reliability,booked:[0,0,0]};}));
}
export function settleRivalNetwork(ctx,strategy,network,offers,day){
 const start=(day-1)*24,end=start+24;
 return strategy.rivals.map(r=>{
  const operation=network.operations[r.id],receipt=network.slots.receipts.find(x=>x.id===r.id),aircraft=[],legs=[];let revenue=0,cost=0,pax=0,seats=0,refund=operation.refund+(operation.reviews?.depositRefund||0);
  for(const op of operation.ops){const p=r.network.fleet.find(p=>p.id===op.plane),offer=offers.find(o=>o.owner===r.id&&o.plane===op.plane),booked=offer?.booked||[0,0,0],count=sum(booked),ticket=sum(booked.map((n,k)=>n*(offer?.fares[k]||0)))*100,serviceCost=count*(r.id==='aurelia'?4:1)*100;
   let earned=0,expense=0;
   for(const [i,l] of op.legs.entries()){const passengers=booked.map(n=>half(n,i)),ticketCents=sum(passengers.map((n,k)=>n*offer.fares[k]))*100,manifest={...l,passengers,ticketCents,nonfuelCents:half(op.nonfuel+serviceCost,i),fuelCents:half(op.fuel,i),co2Cents:half(op.co2,i)},event=legSettlement(manifest,start,end);
    earned+=event.revenue;expense+=event.nonfuel+event.fuel+event.co2;legs.push({id:l.id,plane:p.id,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,pax:sum(passengers),revenueCents:event.revenue,costCents:event.nonfuel+event.fuel+event.co2});
   }
   if(earned!==ticket)throw Error('Rival ticket ledger does not reconcile');
   const assigned=(receipt.daily/operation.ops.length),profit=(earned-expense)/100-op.fixed-assigned,capacity=op.legs.length?sum(cabin(r))*2:0;
   p.weekProfit+=profit;p.weekPax+=count;p.weekSeats+=capacity;revenue+=earned/100;cost+=expense/100+op.fixed;pax+=count;seats+=capacity;
   aircraft.push({id:p.id,market:p.route,hour:op.hour,flights:op.legs.length,pax:count,seats:capacity,revenue:earned/100,cost:expense/100+op.fixed+assigned,profit,overhead:op.fixed-op.rent-op.maintenance,rent:op.rent,maintenance:op.maintenance,serviceDueDay:p.serviceDueDay});
   if(p.lease)p.lease.remaining--;
  }
  const expired=r.network.fleet.filter(p=>p.lease?.remaining===0);refund+=sum(expired.map(p=>p.lease.deposit));r.network.fleet=r.network.fleet.filter(p=>!expired.includes(p));
  cost+=receipt.daily;const profit=Math.round((revenue-cost)*100)/100;
  r.cash=Math.round((r.cash+profit-receipt.signing+sum(expired.map(p=>p.lease.deposit)))*100)/100;if(r.cash<0)throw Error('Rival cash reserve exceeded');
  r.profit+=profit;r.weekProfit+=profit;r.weekPax+=pax;r.weekSeats+=seats;r.network.through=end;
  const before=ctx.strategy.rivals.find(x=>x.id===r.id).cash,depositPaid=operation.reviews?.depositPaid||0,routeFee=operation.reviews?.routeFee||0;
  if(Math.abs(r.cash-(before+profit-receipt.signing-depositPaid-routeFee+refund))>.001)throw Error('Rival cash bridge does not reconcile');
  return {id:r.id,route:r.route,pax,revenue,cost,profit,cash:r.cash,cashBefore:before,cashDelta:r.cash-before,depositRefund:refund,depositPaid,routeFee,slotSigning:receipt.signing,slotDaily:receipt.daily,seats,hour:receipt.hour,rotations:receipt.rotations,status:operation.status,network:true,aircraft,legs,review:operation.reviews||null};
 });
}
export function validateRivalNetwork(s,ctx){
 const e=s.strategy?.expansion,fail=()=>{throw Error('Invalid rival network expansion');},int=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b,num=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
 if(e===undefined){if(s.strategy?.rivals.some(r=>r.network!==undefined))fail();return;}
 if(!e||e.version!==1||!s.legEconomy||!s.slotMarket||!validMigrationId(e.migrationId)||!int(e.enabledDay,Math.max(s.legEconomy.enabledDay,s.slotMarket.enabledDay,s.strategy.startDay),s.day)||!int(e.nextReviewDay,s.day,s.day+7)||(e.nextReviewDay-e.enabledDay)%7||!Array.isArray(e.shortlist)||!e.shortlist.length||e.shortlist.length>12||new Set(e.shortlist.map(rivalMarketKey)).size!==e.shortlist.length)fail();
 const pairOK=p=>p&&p.from===s.airline.origin&&!!getAirport(ctx,p.to)&&p.from!==p.to;
 for(const p of e.shortlist)if(!pairOK(p)||routeQuote(ctx,p.from,p.to).km>ctx.types.A320.range||hours(ctx,canonicalRivalRoute(ctx,p))>18)fail();
 for(const r of s.strategy.rivals){const n=r.network;if(!n||r.leases!==undefined||!Array.isArray(n.fleet)||n.fleet.length<1||n.fleet.length>3||!Array.isArray(n.routes)||n.routes.length>4||new Set(n.routes.map(rivalMarketKey)).size!==n.routes.length||!int(n.nextId,2,10000)||n.through!==(s.day-1)*24||!Array.isArray(n.reviews)||n.reviews.length>28)fail();
  for(const p of n.routes)if(!pairOK(p)||!e.shortlist.some(x=>rivalMarketKey(x)===rivalMarketKey(p))||!int(p.openedDay,e.enabledDay,s.day)||typeof p.inherited!=='boolean'||p.fee!==(p.inherited?0:routeQuote(ctx,p.from,p.to).price))fail();
  const seen=new Set();for(const [i,p] of n.fleet.entries()){
   const serial=Number(p?.id?.split('-').at(-1));if(!p||p.id!==r.id+'-'+serial||!int(serial,1,n.nextId-1)||seen.has(p.id)||p.model!=='A320'||!int(p.joinedDay,e.enabledDay,s.day)||!int(p.serviceDueDay,e.enabledDay,s.day+7)||!num(p.weekProfit,-1e10,1e10)||!int(p.weekPax,0,1e8)||!int(p.weekSeats,0,1e8)||p.weekPax>p.weekSeats||!(p.route===null||n.routes.some(x=>rivalMarketKey(x)===p.route)))fail();seen.add(p.id);
   if(i===0){if(serial!==1||p.lease!==undefined)fail();}else if(!p.lease||!int(p.lease.remaining,1,14)||p.lease.deposit!==500000)fail();
  }
  for(const [i,d] of n.reviews.entries())if(!d||!int(d.day,e.enabledDay+7,s.day-1)||(d.day-e.enabledDay)%7||(i&&d.day>=n.reviews[i-1].day)||!['hold','return','lease','reroute'].includes(d.kind)||!num(d.incrementalProfit,0,1e10)||!int(d.routeFee,0,1e9)||![0,500000].includes(d.depositPaid)||!int(d.depositRefund,0,1000000)||d.depositRefund%500000||!int(d.considered,0,12)||!Array.isArray(d.returned)||d.returned.length>2||!num(d.cashBefore,0,1e10)||!num(d.cashAfter,0,1e10)||Math.abs(d.cashAfter-d.cashBefore+d.routeFee+d.depositPaid-d.depositRefund)>.01||(d.market!==null&&!e.shortlist.some(x=>rivalMarketKey(x)===d.market))||(d.plane!==null&&!new RegExp('^'+r.id+'-[1-9][0-9]*$').test(d.plane)))fail();
 }
 for(const h of s.tycoon?.history||[]){if(h.day<e.enabledDay)continue;const c=h.competition;if(!c||new Set(c.markets.map(m=>m.key)).size!==c.markets.length)fail();
  for(const m of c.markets){if(!pairOK({from:m.from===s.airline.origin?m.from:m.to,to:m.from===s.airline.origin?m.to:m.from})&&(!getAirport(ctx,m.from)||!getAirport(ctx,m.to)))fail();if(m.key!==[m.from,m.to].sort().join('|')||m.from===m.to||!int(m.outsideY,0,m.outside)||!Array.isArray(m.segments)||m.segments.length!==3)fail();for(const seg of m.segments)if(!['total','player','swift','aurelia','outside'].every(k=>int(seg[k],0,1e9))||seg.player+seg.swift+seg.aurelia+seg.outside!==seg.total)fail();}
  for(const [i,r] of c.rivals.entries()){
   if(r.id!==s.strategy.rivals[i].id||r.network!==true||!['pax','revenue','cost','cash','cashBefore','depositRefund','depositPaid','routeFee','slotSigning','slotDaily','seats'].every(k=>num(r[k],0,1e11))||!num(r.profit,-1e11,1e11)||!num(r.cashDelta,-1e11,1e11)||Math.abs(r.revenue-r.cost-r.profit)>.001||Math.abs(r.cash-r.cashBefore-r.cashDelta)>.001||Math.abs(r.cashDelta-r.profit+r.slotSigning+r.depositPaid+r.routeFee-r.depositRefund)>.001||!Array.isArray(r.aircraft)||r.aircraft.length<1||r.aircraft.length>3||new Set(r.aircraft.map(a=>a.id)).size!==r.aircraft.length||!Array.isArray(r.legs)||r.legs.length>6||new Set(r.legs.map(l=>l.id)).size!==r.legs.length)fail();
   for(const a of r.aircraft)if(!a||typeof a.id!=='string'||![0,2].includes(a.flights)||!int(a.pax,0,a.seats)||!int(a.seats,0,360)||!num(a.profit,-1e9,1e9)||!num(a.revenue,0,1e9)||!num(a.cost,0,1e9)||Math.abs(a.revenue-a.cost-a.profit)>.001||!num(a.overhead,0,2500)||![0,10000].includes(a.rent)||![0,Math.round(ctx.types.A320.nonfuel*.35)].includes(a.maintenance))fail();
   for(const l of r.legs)if(!l||!r.aircraft.some(a=>a.id===l.plane)||!['out','back'].some(d=>l.id===`${r.id}:${l.plane}:${h.day}:${d}`)||!getAirport(ctx,l.from)||!getAirport(ctx,l.to)||l.from===l.to||!num(l.departure,(h.day-1)*24,h.day*24-.5)||!num(l.arrival,l.departure+.01,h.day*24-.5)||!int(l.pax,0,180)||!int(l.revenueCents,0,1e11)||!int(l.costCents,0,1e11))fail();
   for(const a of r.aircraft){const legs=r.legs.filter(l=>l.plane===a.id);if(legs.length!==a.flights||sum(legs.map(l=>l.pax))!==a.pax||cent(a.revenue)!==sum(legs.map(l=>l.revenueCents))||Math.abs(a.cost-sum(legs.map(l=>l.costCents))/100-a.overhead-a.rent-a.maintenance-r.slotDaily/r.aircraft.length)>.001)fail();}
   const receipt=h.sharedSlots?.rivals.find(x=>x.id===r.id),moves=controlledMovements(s.slotMarket,r.legs).map(m=>({...m,count:1}));
   if(!receipt||receipt.network!==true||receipt.signing!==r.slotSigning||receipt.daily!==r.slotDaily||receipt.rotations!==r.legs.length/2||JSON.stringify(receipt.movements)!==JSON.stringify(moves))fail();
   if(sum(r.legs.map(l=>l.pax))!==r.pax||Math.abs(sum(r.legs.map(l=>l.revenueCents))/100-r.revenue)>.001||Math.abs(sum(r.aircraft.map(a=>a.cost))-r.cost)>.001)fail();
  }
 }
}
