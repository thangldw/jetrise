import {journeyExperience,syntheticJourneySegments,customerOutcome,queueCustomerRefund} from './customer-strategy.js';
import {datedRound,timedLegs} from './dated-legs.js';
// JET-202: dated through-ticket reservations and their settlement. No wall-clock state.
import {findConnections,allocateJourneys,journeyMarket,expandRoundTrip} from './connection-core.js';
import {distance,getAirport} from './network.js';
import {connectionBoardingCost,CONNECTION_FEE} from './network-economy.js';
import {validMigrationId} from './live-leg-economy.js';
import {applyCompletedService} from './maintenance.js';
import {flightUnavailable} from './fleet.js';

export const MAX_JOURNEYS=480;
const sum=xs=>xs.reduce((a,b)=>a+b,0),cent=n=>Math.round(n*100),integer=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const inDay=(at,start,end)=>at>=start&&at<end;
const pending=l=>l.status==='reserved';
export const overnightMode=ctx=>!!ctx.legEconomy?.overnight;
export const journeySeats=(ctx,id)=>sum((ctx.legEconomy?.overnight?.journeys||[]).flatMap(j=>j.legs.filter(l=>l.id===id&&l.status!=='refunded').map(()=>j.pax)));
export const roundJourneySeats=(ctx,day,slot)=>['out','back'].map(dir=>journeySeats(ctx,`${day}:${slot}:${dir}`));
export function journeyBalances(overnight,through){
 const legs=(overnight?.journeys||[]).flatMap(j=>j.legs.filter(pending));
 return {deferredCents:sum(legs.map(l=>l.fareCents)),prepaidCents:sum(legs.filter(l=>l.departure>=through).map(l=>l.costCents))};
}
export function enableOvernight(s,a){
 if(!s.legEconomy)throw Error('Bật kinh tế theo chặng JET-201 trước.');
 if(s.legEconomy.overnight)throw Error('JET-202 đã được bật.');
 if(!validMigrationId(a.migrationId))throw Error('Mã chuyển đổi không hợp lệ.');
 s.legEconomy.overnight={version:1,migrationId:a.migrationId,enabledDay:s.day,journeys:[],refundsPaidToday:0};
 s.connectionProgram={...s.connectionProgram,mode:'overnight',enabled:true,minimum:60,maximum:1440};
 return 'Đã bật vé nối chuyến qua đêm · giữ ghế hai chặng, phí $3.500/ngày khi mở bán.';
}

export function occurrence(ctx,state,l){
 const r=datedRound(ctx,state,l.day,l.slot);if(!r||r.cancelled)return null;
 return {leg:r.legs.find(x=>x.id===l.id),plane:ctx.fleet.find(p=>p.id===r.plane),route:r.route,start:r.legs[0].departure,hours:r.legs[1].arrival+.5-r.legs[0].departure,round:r};
}

export function guardJourneyChanges(ctx,state,operability=false){
 const now=(ctx.day-1)*24,groups=new Map();
 for(const j of ctx.legEconomy?.overnight?.journeys||[])for(const l of j.legs){
  if(!pending(l)||l.roundStart<now)continue;
  const o=occurrence(ctx,state,l);
  if(!o||o.plane.id!==l.plane||o.route!==l.route||['departure','arrival','from','to'].some(k=>o.leg?.[k]!==l[k]))throw Error('Chặng đã giữ ghế nối chuyến. Hoàn phần vé còn lại trong Thiết kế mạng trước khi đổi/xóa lịch hoặc đổi máy bay.');
  const count=(groups.get(l.id)||0)+j.pax;groups.set(l.id,count);
  if(count>state.cabins[l.plane][0])throw Error('Cabin mới không đủ ghế Y đã giữ cho vé nối chuyến. Hoàn vé trước khi giảm ghế.');
  if(operability){const p=structuredClone(o.plane);applyCompletedService(p,now-1e-7,o.start);if((p.reserve&&!state.exceptions?.some(e=>e.day===l.day&&e.slot===l.slot&&e.plane===p.id))||p.hub!==ctx.routes[l.route].from||ctx.routes[l.route].km>ctx.types[p.type].range||p.wear>=90||flightUnavailable(p,l.day,o.start%24,o.hours,ctx.day))throw Error('Thay đổi làm chặng đã giữ ghế không khai thác được. Hoàn phần vé còn lại trước.');}
 }
}

export function validateOvernight(ctx,state){
 const o=ctx.legEconomy?.overnight;if(o===undefined){if(ctx.connectionProgram?.mode==='overnight')throw Error('Missing overnight ledger');return;}
 const fail=()=>{throw Error('Invalid overnight connections');},now=(ctx.day-1)*24;
 if(!o||o.version!==1||!validMigrationId(o.migrationId)||!integer(o.enabledDay,ctx.legEconomy.enabledDay,ctx.day)||ctx.connectionProgram?.mode!=='overnight'||!integer(o.refundsPaidToday,0,1e12)||!Array.isArray(o.journeys)||o.journeys.length>MAX_JOURNEYS)fail();
 const seen=new Set(),held=new Map();
 for(const j of o.journeys){
  if(!j||typeof j.id!=='string'||j.id.length>100||seen.has(j.id)||!integer(j.pax,1,40)||!integer(j.fareCents,1,1e10)||!Number.isFinite(j.bookedAt)||j.bookedAt<(o.enabledDay-1)*24||j.bookedAt>=now||!integer(j.minimum,60,180)||j.minimum%15||!integer(j.maximum,j.minimum,1440)||j.maximum%15||!Array.isArray(j.legs)||j.legs.length!==2||!j.legs.some(pending))fail();seen.add(j.id);
  for(const [index,l] of j.legs.entries()){
   const r=ctx.routes[l?.route];if(!l||!r||!integer(l.slot,1,state.nextId-1)||!integer(l.day,ctx.legEconomy.enabledDay,ctx.day+6)||!Number.isFinite(l.roundStart)||Math.floor(l.roundStart/24)+1!==l.day||l.roundStart%.25||!Number.isFinite(l.hours)||l.hours<=1||l.hours>=168||l.hours%.25||typeof l.plane!=='string'||!['out','back'].some(d=>l.id===`${l.day}:${l.slot}:${d}`)||!integer(l.capacity,1,1000)||!integer(l.fareCents,0,j.fareCents)||!integer(l.costCents,0,1e10)||!['reserved','arrived','refunded'].includes(l.status))fail();
   const canonical=timedLegs({id:`${l.day}:${l.slot}`,plane:l.plane,route:l.route,start:l.roundStart,hours:l.hours,capacity:[l.capacity,0,0],...(l.timing?{timing:l.timing}:{})},r).find(a=>a.id===l.id);
   if(l.timing&&!ctx.legEconomy.disruptions)fail();
   if(['from','to','departure','arrival'].some(k=>canonical[k]!==l[k])||l.departure<j.bookedAt||l.departure>j.bookedAt+108||l.arrival>j.bookedAt+192||l.status==='arrived'&&l.arrival>=now||pending(l)&&l.arrival<now||l.status==='refunded'&&(!Number.isFinite(l.refundedAt)||l.refundedAt<j.bookedAt||l.refundedAt>now||l.refundedAt>l.departure))fail();
   if(index===0&&(l.departure<j.bookedAt||l.departure!==j.bookedAt&&!l.timing))fail();
   if(l.status!=='refunded'){
    const count=(held.get(l.id)||0)+j.pax;held.set(l.id,count);if(count>l.capacity)fail();
    const round=ctx.legEconomy.rounds.find(r=>r.id===`${l.day}:${l.slot}`),manifest=round?.legs.find(a=>a.id===l.id);
    if(pending(l)&&l.roundStart<now&&!round)fail();
    if(manifest&&(round.plane!==l.plane||['departure','arrival','from','to'].some(k=>manifest[k]!==l[k])||manifest.passengers[0]+count>round.capacity[0]))fail();
   }
  }
  const [a,b]=j.legs,wait=(b.departure-a.arrival)*60;
  if(j.rebookedFrom!==undefined&&(!ctx.legEconomy.disruptions||typeof j.rebookedFrom!=='string'||!/^\d+:\d+:(out|back)$/.test(j.rebookedFrom)))fail();
  if(j.id!==a.id+'>'+(j.rebookedFrom??b.id)||a.to!==b.from||a.from===b.to||a.day===b.day&&a.slot===b.slot||!ctx.hq.hubs[a.to]||(b.status!=='refunded'&&(wait<j.minimum-1e-7||wait>j.maximum+1e-7))||a.fareCents+b.fareCents!==j.fareCents)fail();
 }
 guardJourneyChanges(ctx,state);
}

export function cancelJourney(s,id){
 const o=s.legEconomy?.overnight,j=o?.journeys.find(j=>j.id===id),now=(s.day-1)*24;
 if(!j)throw Error('Không còn vé nối chuyến này.');
 let refund=0,prepaid=0;
 for(const l of j.legs)if(pending(l)&&l.departure>=now){refund+=l.fareCents;prepaid+=l.costCents;l.status='refunded';l.refundedAt=now;}
 if(!refund&&!prepaid)throw Error('Các chặng còn lại đã cất cánh; không thể hoàn tự nguyện.');
 s.cash+=(-refund+prepaid)/100;s.legEconomy.deferredCents-=refund;s.legEconomy.prepaidCents-=prepaid;o.refundsPaidToday+=refund;queueCustomerRefund(s,j);o.journeys=o.journeys.filter(j=>j.legs.some(pending));
 return `Đã hoàn $${(refund/100).toFixed(2)} tiền vé chưa thực hiện và $${(prepaid/100).toFixed(2)} phí phục vụ chưa dùng. Phần đã bay giữ nguyên.`;
}

export function legSupply(ctx,reports){
 const rounds=new Map((ctx.legEconomy.rounds||[]).map(r=>[r.id,r]));
 for(const {report} of reports)for(const r of report.departureManifests||[])rounds.set(r.id,r);
 return [...rounds.values()].flatMap(r=>r.legs.map(l=>({...l,plane:r.plane,route:r.route,roundTrip:r.id,slot:r.slot,day:r.day,roundStart:r.start,hours:r.hours,...(r.timing?{timing:r.timing}:{}),fullCapacity:r.capacity[0],capacity:[Math.max(0,r.capacity[0]-l.passengers[0]-journeySeats(ctx,l.id)),0,0]})));
}

function sellJourneys(ctx,state,report,project,publicDemand){
 const start=(report.day-1)*24,end=start+24,program=ctx.connectionProgram,allNow=legSupply(ctx,[{report}]);
 const first=allNow.filter(l=>inDay(l.departure,start,end)&&l.capacity[0]>0);
 if(!first.length||ctx.openedRoutes.length<2)return [];
 const horizon=Math.min(7,Math.max(1,Math.floor((Math.max(...first.map(l=>l.arrival))+program.maximum/60-start)/24)+1));
 const projected=project({...ctx,noNewConnectionSales:true},state,false,horizon,report.day),legs=legSupply(ctx,projected),byId=new Map(legs.map(l=>[l.id,l]));
 // Replace today's supply with actual evaluated manifests; unknown future events remain projections.
 for(const l of allNow)byId.set(l.id,l);
 const supply=[...byId.values()],links=findConnections(supply,{start,end:end+108,minMinutes:program.minimum,maxMinutes:program.maximum,limit:10000}).connections.filter(c=>inDay(c.first.departure,start,end)&&ctx.hq.hubs[c.first.to]).slice(0,256);
 const markets={},requests=[],paths=new Map();
 for(const c of links){
  const a=ctx.routes[c.first.route],b=ctx.routes[c.second.route],km=distance(getAirport(ctx,c.from),getAirport(ctx,c.to));if(km<50||a.km+b.km>km*1.8||c.second.arrival>=9998*24)continue;
  const fare=Math.max(20,Math.round((state.prices[c.first.route][0]+state.prices[c.second.route][0])*.75)),key=journeyMarket([c.first,c.second],0);
  let demand=Math.min(40,Math.max(0,Math.floor(40*(2-fare/((a.baseFare+b.baseFare)*.75)))));
  // A purchased direct OD shares its canonical Y budget. Do not add a second customer pool.
  const direct=ctx.openedRoutes.find(i=>[ctx.routes[i].from,ctx.routes[i].to].sort().join('|')===[c.from,c.to].sort().join('|'));
  const m=report.competition?.markets.find(m=>(m.key||[ctx.routes[m.route].from,ctx.routes[m.route].to].sort().join('|'))===[c.from,c.to].sort().join('|'));
  if(m){const from=m.from||ctx.routes[m.route].from,residual=from===c.from?Math.ceil(m.outsideY/2):Math.floor(m.outsideY/2);demand=Math.min(demand,residual);}
  else if(direct!==undefined){const r=ctx.routes[direct],budget=publicDemand(ctx,state,direct,report.day)[0],direction=r.from===c.from?Math.ceil(budget/2):Math.floor(budget/2),sold=sum(allNow.filter(l=>l.from===c.from&&l.to===c.to&&inDay(l.departure,start,end)).map(l=>l.passengers[0]-sum(l.contracts.map(a=>a.pax))));demand=Math.min(demand,Math.max(0,direction-sold));}
  markets[key]=Math.max(markets[key]||0,demand);
  const id=c.first.id+'>'+c.second.id;requests.push({id,legIds:[c.first.id,c.second.id],classIndex:0,requested:demand,fareCents:fare*100});paths.set(id,c);
 }
 const allocation=allocateJourneys(supply,requests,markets,{minMinutes:program.minimum,maxMinutes:program.maximum}),journeys=[];
 for(const b of allocation.bookings){if(!b.passengers)continue;const c=paths.get(b.id),path=[c.first,c.second],total=path.reduce((n,l)=>n+l.arrival-l.departure,0),firstShare=Math.floor(b.revenueCents*(path[0].arrival-path[0].departure)/total);
  const j={id:b.id,pax:b.passengers,fareCents:b.revenueCents,bookedAt:path[0].departure,minimum:program.minimum,maximum:program.maximum,legs:path.map((l,i)=>({id:l.id,plane:l.plane,route:l.route,slot:l.slot,day:l.day,roundStart:l.roundStart,hours:l.hours,...(l.timing?{timing:structuredClone(l.timing)}:{}),from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,capacity:l.fullCapacity,fareCents:i?b.revenueCents-firstShare:firstShare,costCents:cent(b.passengers*connectionBoardingCost(ctx,state,ctx.fleet.find(p=>p.id===l.plane))),status:'reserved'}))};
  if(ctx.legEconomy.overnight.journeys.length+journeys.length>=MAX_JOURNEYS)break;journeys.push(j);
 }
 // Attribute new connecting sales to the same OD choice budget, conserving player/rival/outside totals.
 for(const j of journeys){const [a,b]=j.legs,m=report.competition?.markets.find(m=>(m.key||[ctx.routes[m.route].from,ctx.routes[m.route].to].sort().join('|'))===[a.from,b.to].sort().join('|'));if(!m)continue;
  let left=j.pax;const counts=[0,0,0];m.player+=left;m.outside-=left;m.outsideY-=left;for(const [i,segment] of m.segments.entries()){const n=Math.min(left,segment.outsideY);counts[i]=n;segment.player+=n;segment.outside-=n;segment.outsideY-=n;left-=n;}if(left)throw Error('OD demand does not reconcile');if(ctx.customerStrategy?.active)j.experience=journeyExperience(ctx,state,j,counts);
 }
 for(const j of journeys)if(ctx.customerStrategy?.active&&!j.experience)j.experience=journeyExperience(ctx,state,j,syntheticJourneySegments(ctx,j));
 return journeys;
}

export function settleOvernight(ctx,state,report,project,publicDemand){
 const previous=ctx.legEconomy.overnight,start=(report.day-1)*24,end=start+24,oldBalances=journeyBalances(previous,start);
 const fresh=ctx.connectionProgram.enabled&&!ctx.noNewConnectionSales?sellJourneys(ctx,state,report,project,publicDemand):[],journeys=[...structuredClone(previous.journeys),...fresh];
 const sales=sum(fresh.map(j=>j.fareCents)),paid=sum(fresh.flatMap(j=>j.legs.map(l=>l.costCents)));
 let earned=0,expense=0,refund=0,costRefund=0,boardings=0,completed=0;
 const events=[];
 for(const j of journeys){let finished=false;
  for(const l of j.legs){if(!pending(l))continue;
   if((j.legs[0].status==='refunded'&&l!==j.legs[0])||(inDay(l.roundStart,start,end)&&!report.operatedRounds.some(r=>`${report.day}:${r.slot}`===`${l.day}:${l.slot}`))){
    l.status='refunded';l.refundedAt=l!==j.legs[0]&&j.legs[0].status==='refunded'?start:l.roundStart;refund+=l.fareCents;costRefund+=l.costCents;events.push({id:j.id,leg:l.id,kind:'refund',pax:j.pax,amount:l.fareCents/100});continue;
   }
   const departing=inDay(l.departure,start,end),arriving=inDay(l.arrival,start,end);
   if(departing)expense+=l.costCents;
   if(arriving){earned+=l.fareCents;boardings+=j.pax;l.status='arrived';finished=true;events.push({id:j.id,leg:l.id,kind:'arrival',pax:j.pax,amount:l.fareCents/100});}
   if(departing||arriving){let row=report.rows.find(r=>r.leg===l.id);if(!row)throw Error('Missing operated connecting leg');const revenue=arriving?l.fareCents/100:0,cost=departing?l.costCents/100:0;
    row.revenue+=revenue;row.nonfuel+=cost;row.profit+=revenue-cost;row.pax+=arriving?j.pax:0;row.passengers[0]+=arriving?j.pax:0;
   }
  }
  if(finished&&j.legs.every(l=>l.status==='arrived'))completed+=j.pax;
  if(j.experience&&!j.legs.some(pending)){report.customerOutcomes??=[];report.customerOutcomes.push(customerOutcome(j.experience,j.legs[1].arrival,j.legs.every(l=>l.status==='arrived')));}
 }
 const fee=ctx.connectionProgram.enabled?CONNECTION_FEE:0;
 report.revenue+=earned/100;report.nonfuel+=expense/100+fee;report.profit+=(earned-expense)/100-fee;report.pax+=boardings;
 report.cashDelta+=(sales-paid-refund+costRefund)/100-fee;
 report.deferredRevenueDelta+=(sales-earned-refund)/100;report.prepaidNonfuelDelta+=(paid-expense-costRefund)/100;
 const next={...previous,journeys:journeys.filter(j=>j.legs.some(pending)),refundsPaidToday:0},balance=journeyBalances(next,end);
 // Core JET-201 recomputes its own balances; add only this ledger's remaining liabilities/assets.
 report.legEconomyState.overnight=next;report.legEconomyState.deferredCents+=balance.deferredCents;report.legEconomyState.prepaidCents+=balance.prepaidCents;
 report.deferredRevenue=report.legEconomyState.deferredCents/100;report.prepaidFlightCost=report.legEconomyState.prepaidCents/100;
 if(oldBalances.deferredCents+sales-earned-refund!==balance.deferredCents||oldBalances.prepaidCents+paid-expense-costRefund!==balance.prepaidCents)throw Error('Connecting ledger does not reconcile');
 report.connections={mode:'overnight',journeys:completed,sold:sum(fresh.map(j=>j.pax)),boardings,revenue:earned/100,ticketCash:sales/100,coordination:fee,handling:expense/100,refund:refund/100,costRefund:costRefund/100,refundsPrepaid:previous.refundsPaidToday/100,deferred:balance.deferredCents/100,events,bookings:fresh.map(j=>({from:j.legs[0].from,hub:j.legs[0].to,to:j.legs[1].to,first:j.legs[0].plane,second:j.legs[1].plane,departure:j.legs[0].departure,arrival:j.legs[1].arrival,wait:(j.legs[1].departure-j.legs[0].arrival)*60,pax:j.pax,revenue:j.fareCents/100,legs:j.legs}))};
 report.legEvents=report.rows.map(({leg,plane,route,departure,arrival,revenue,nonfuel,fuelCost,co2Cost,pax,flights})=>({leg,plane,route,departure,arrival,revenue,cost:nonfuel+fuelCost+co2Cost,pax,flights}));
 return report;
}
