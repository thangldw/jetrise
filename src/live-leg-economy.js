import {legSettlement} from './leg-settlement.js';
import {directExperiences} from './customer-strategy.js';
import {timedLegs,roundEnd} from './dated-legs.js';
import {journeyBalances} from './overnight-connections.js';
// Authoritative opt-in accounting. Weekly templates remain the operational planner.
import {expandRoundTrip} from './connection-core.js';
import {closeContracts} from './gameplay.js';
import {splitAdvance} from './advance-sales.js';

const sum = values => values.reduce((n, v) => n + v, 0);
const cent = n => Math.round(n * 100);
const half = (n, i) => i ? Math.floor(n / 2) : Math.ceil(n / 2);
const validCents = n => Number.isSafeInteger(n) && n >= 0 && n < 1e13;
const inDay = (at, start, end) => at >= start && at < end;
const moneyKeys = ['ticketCents', 'serviceCents', 'nonfuelCents', 'fuelCents', 'co2Cents', 'fuelPurchaseCents', 'co2PurchaseCents'];
export const validMigrationId = id => typeof id === 'string' && /^[a-z0-9-]{16,64}$/.test(id);

export function enableLegEconomy(s, id) {
  if (s.legEconomy) throw Error('Kinh tế theo chặng đã được bật.');
  if (!s.setupComplete || s.founding && s.founding.stage !== 'done') throw Error('Hoàn tất lập hãng trước.');
  if (s.fleet.some(p => p.airborneUntilAt > (s.day - 1) * 24)) throw Error('Chờ các vòng đang bay về hub rồi mới chuyển đổi; doanh thu cũ đã được chốt cả vòng.');
  if (!validMigrationId(id)) throw Error('Mã chuyển đổi không hợp lệ.');
  s.legEconomy = {version: 1, migrationId: id, enabledDay: s.day, through: (s.day - 1) * 24, rounds: [], deferredCents: 0, prepaidCents: 0};
}

function balances(rounds, through) {
  const legs = rounds.flatMap(r => r.legs);
  return {
    deferredCents: sum(legs.filter(l => l.arrival >= through).map(l => l.ticketCents)),
    prepaidCents: sum(legs.filter(l => l.departure >= through).map(l => l.nonfuelCents + l.fuelCents + l.co2Cents)),
  };
}

export function validateLegEconomy(s, routes, types) {
  const e = s.legEconomy;
  if (e === undefined) return;
  const fail = () => { throw Error('Invalid live leg economy'); };
  if (!e || e.version !== 1 || !validMigrationId(e.migrationId) || !Number.isInteger(e.enabledDay) || e.enabledDay < 1 || e.enabledDay > s.day || e.through !== (s.day - 1) * 24 || !Array.isArray(e.rounds) || e.rounds.length > 480) fail();
  const ids = new Set(), contracts = new Map(s.gameplay.contracts.map(c => [c.id, c])), held = new Map();
  for (const r of e.rounds) {
    const route = routes[r?.route], plane = s.fleet.find(p => p.id === r?.plane);
    if (!r || !Number.isInteger(r.slot) || r.slot < 1 || r.slot >= s.tycoon.nextId || !Number.isInteger(r.day) || r.day < e.enabledDay || r.day >= s.day || r.id !== `${r.day}:${r.slot}` || ids.has(r.id) || !route || !s.openedRoutes.includes(r.route) || !plane || typeof r.recovery !== 'boolean' || !Number.isFinite(r.start) || r.start < (r.day - 1) * 24 || r.start >= r.day * 24 || r.start % .25 || !Number.isFinite(r.hours) || r.hours <= 1 || r.hours >= 168 || r.hours % .25 || !Number.isFinite(r.burn) || r.burn < 0 || r.burn > 1e5 || !Number.isSafeInteger(r.co2) || r.co2 < 0 || r.co2 > 1e9 || !Array.isArray(r.capacity) || r.capacity.length !== 3 || r.capacity.some(n => !Number.isInteger(n) || n < 0 || n > 1000) || r.capacity[0]+1.8*r.capacity[1]+4.2*r.capacity[2]>types[plane.type].seats+.001 || !Array.isArray(r.fares) || r.fares.length!==3 || r.fares.some(n=>!Number.isInteger(n)||n<20||n>10000) || !Array.isArray(r.legs) || r.legs.length !== 2) fail();
    ids.add(r.id);
    const pair = timedLegs(r,route);
    if (r.timing&&!e.disruptions)fail();
    if (pair[1].arrival < e.through || roundEnd(r) > e.through + 168 || (plane.airborneUntilAt || 0) + 1e-6 < roundEnd(r)) fail();
    for (const [i, l] of r.legs.entries()) {
      if (!l || ['id','from','to','departure','arrival'].some(k => l[k] !== pair[i][k]) || !moneyKeys.every(k => validCents(l[k])) || !Array.isArray(l.passengers) || l.passengers.length !== 3 || l.passengers.some((n,k) => !Number.isInteger(n) || n < 0 || n > r.capacity[k]) || !Number.isInteger(l.connectionPax) || l.connectionPax<0 || l.connectionPax>l.passengers[0] || !validCents(l.connectionRevenueCents) || (!l.connectionPax&&l.connectionRevenueCents!==0) || !Array.isArray(l.contracts) || l.contracts.length > 24) fail();
      const seen = new Set();
      for (const a of l.contracts) {
        const c = contracts.get(a?.id);
        if (!a || !c || seen.has(a.id) || !Number.isInteger(a.pax) || a.pax < 1 || a.pax > l.passengers[0] || a.fare !== c.fare) fail();
        seen.add(a.id);
        if (l.arrival >= e.through) held.set(a.id, (held.get(a.id) || 0) + a.pax);
      }
      const contracted=sum(l.contracts.map(a=>a.pax)),adv=l.advance;if(adv!==undefined&&(!adv||!Array.isArray(adv.passengers)||adv.passengers.length!==3||adv.passengers.some(n=>!Number.isInteger(n)||n<0)||!sum(adv.passengers)||!validCents(adv.cents)||adv.cents<sum(adv.passengers)*2000||adv.cents>sum(adv.passengers)*1000000))fail();const advPax=adv?.passengers||[0,0,0];if(contracted+l.connectionPax+advPax[0]>l.passengers[0]||advPax.some((n,k)=>n>l.passengers[k])||sum(l.passengers.map((n,k)=>(n-advPax[k]-(k===0?contracted+l.connectionPax:0))*r.fares[k]*100))+(adv?.cents||0)+sum(l.contracts.map(a=>a.pax*a.fare*100))+l.connectionRevenueCents!==l.ticketCents)fail();
    }
  }
  for (const [id, n] of held) if (contracts.get(id).delivered + n > contracts.get(id).target) fail();
  const b = balances(e.rounds, e.through);
  if (!validCents(e.deferredCents) || !validCents(e.prepaidCents) || e.deferredCents !== b.deferredCents + journeyBalances(e.overnight,e.through).deferredCents || e.prepaidCents !== b.prepaidCents + journeyBalances(e.overnight,e.through).prepaidCents) fail();
}

export function pendingContractSeats(ledger,id){return sum((ledger?.rounds||[]).flatMap(r=>r.legs.filter(l=>l.arrival>=ledger.through).flatMap(l=>l.contracts.filter(a=>a.id===id).map(a=>a.pax))));}

// Reserve already-sold contract seats without counting them as delivered.
export function reservePendingContracts(ctx, contracts) {
  if (!ctx.legEconomy) return;
  for (const r of ctx.legEconomy.rounds) for (const l of r.legs) if (l.arrival >= ctx.legEconomy.through) for (const a of l.contracts) {
    const c = contracts.find(c => c.id === a.id); if (c) c.delivered += a.pax;
  }
}

function snapshot(ctx, state, report, row) {
  const route = ctx.routes[row.route], id = `${report.day}:${row.slot}`, start = row.scheduledStart??(report.day - 1) * 24 + row.start;
  const r = {id, day:report.day, slot:row.slot, plane:row.plane, route:row.route, recovery:row.recovery, start, ...(row.timing?{timing:structuredClone(row.timing)}:{}), hours:row.scheduledHours??row.hours, burn:row.burn, co2:row.co2, capacity:[...state.cabins[row.plane]], fares:[...state.prices[row.route]], legs:[]};
  const pair = timedLegs(r,route);
  const direct = row.passengers.map((n,k)=>n-(k===0?row.connectionBoardings||0:0));
  // Seats already taken per direction: overnight holds plus same-day connecting passengers. When the old split
  // already fit, this yields the identical split; it only moves direct Y seats away from a leg that would overfill.
  const held=[0,1].map(i=>(row.connectingReserved||[0,0])[i]+(row.connectionLegs?.[i]?.pax||0)), firstY=Math.max(direct[0]-(r.capacity[0]-held[1]),Math.min(Math.ceil(direct[0]/2),r.capacity[0]-held[0]));
  const counts=[direct.map((n,k)=>k===0?firstY:half(n,0)),direct.map((n,k)=>k===0?n-firstY:half(n,1))];
  let left = Math.max(row.contractPax-counts[1][0],Math.min(Math.ceil(row.contractPax/2),counts[0][0]));
  const allocations = [[],[]];
  for (const a of row.contractAllocations) {
    const fare = ctx.gameplay.contracts.find(c=>c.id===a.id).fare, first = Math.min(left,a.pax);left-=first;
    if(first)allocations[0].push({id:a.id,pax:first,fare});
    if(a.pax-first)allocations[1].push({id:a.id,pax:a.pax-first,fare});
  }
  const advanceSeats=counts.map((c,i)=>c.map((n,k)=>n-(k===0?sum(allocations[i].map(a=>a.pax)):0))),advance=splitAdvance(row.advance,advanceSeats);
  const ticket = direct.reduce((n,count,k)=>n+(count-(k===0?row.contractPax:0)-(row.advance?.passengers[k]||0))*state.prices[row.route][k],0)+row.contractRevenue+(row.advance?.cents||0)/100;
  const service = cent(row.revenue-(row.connectionRevenue||0)-ticket), directCount=sum(direct);
  const firstPax=sum(counts[0]), firstService=directCount?Math.floor(service*firstPax/directCount):0;
  // Advance passengers keep their locked fares in the fare-value rating.
  const legFares=advance.map((adv,i)=>adv&&state.prices[row.route].map((f,k)=>advanceSeats[i][k]?((advanceSeats[i][k]-adv.passengers[k])*f*100+adv.classCents[k])/advanceSeats[i][k]/100:f));
  const experiences=directExperiences(ctx,state,row,counts,allocations,pair,legFares);
  for(const [i,l] of pair.entries()){
    const contracts=allocations[i], contractPax=sum(contracts.map(a=>a.pax)), connection=row.connectionLegs?.[i]||{pax:0,revenueCents:0};
    const passengers=[...counts[i]];
    const adv=advance[i],ticketCents=sum(passengers.map((n,k)=>(n-(k===0?contractPax:0)-(adv?.passengers[k]||0))*state.prices[row.route][k]*100))+(adv?.cents||0)+sum(contracts.map(a=>a.pax*a.fare*100))+connection.revenueCents;
    passengers[0]+=connection.pax;
    const leg={id:l.id,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,passengers,contracts,connectionPax:connection.pax,connectionRevenueCents:connection.revenueCents,ticketCents,serviceCents:i?service-firstService:firstService};
    for(const [key,value] of Object.entries({nonfuelCents:row.nonfuel,fuelCents:row.fuelCost,co2Cents:row.co2Cost,fuelPurchaseCents:row.fuelPurchase,co2PurchaseCents:row.co2Purchase}))leg[key]=half(cent(value),i);
    if(passengers.some((n,k)=>n<0||n>r.capacity[k])||!moneyKeys.every(k=>validCents(leg[k])))throw Error('Live leg manifest does not reconcile');
    if(adv)leg.advance={passengers:adv.passengers,cents:adv.cents};
    if(experiences[i])leg.experience=experiences[i];
    r.legs.push(leg);
  }
  return r;
}

export function settleLegEconomy(ctx, state, report) {
  const previous=ctx.legEconomy,start=(report.day-1)*24,end=start+24;
  if(previous.through!==start)throw Error('Sổ chặng không khớp ngày chốt. Tải lại bản lưu.');
  const fresh=report.rows.map(row=>snapshot(ctx,state,report,row)), rounds=[...structuredClone(previous.rounds),...fresh];
  const contracts=structuredClone(ctx.gameplay?.contracts||[]), rows=[];
  let ticketCash=0,serviceCash=0,nonfuelPaid=0,fuelPurchase=0,co2Purchase=0;
  for(const r of fresh)for(const l of r.legs){ticketCash+=l.ticketCents-(l.advance?.cents||0);nonfuelPaid+=l.nonfuelCents;fuelPurchase+=l.fuelPurchaseCents;co2Purchase+=l.co2PurchaseCents;}
  let ticketRevenue=0;
  report.fuelAllocated=report.burn;report.co2Allocated=report.co2;report.burn=0;report.co2=0;
  for(const r of rounds)for(const [index,l] of r.legs.entries()){
    const {departing,arriving,revenue,nonfuel,fuel,co2}=legSettlement(l,start,end);
    if(!departing&&!arriving)continue;if(departing){report.burn+=r.burn/2;report.co2+=half(r.co2,index);}
    if(arriving){ticketRevenue+=l.ticketCents;serviceCash+=l.serviceCents;for(const a of l.contracts){const c=contracts.find(c=>c.id===a.id);if(c)c.delivered+=a.pax;}}
    rows.push({leg:l.id,plane:r.plane,route:r.route,slot:r.slot,recovery:r.recovery,departure:l.departure,arrival:l.arrival,start:l.departure-start,hours:0,flights:departing?1:0,passengers:arriving?[...l.passengers]:[0,0,0],pax:arriving?sum(l.passengers):0,revenue:revenue/100,nonfuel:nonfuel/100,fuelCost:fuel/100,co2Cost:co2/100,profit:(revenue-nonfuel-fuel-co2)/100,contractPax:arriving?sum(l.contracts.map(a=>a.pax)):0,contractRevenue:arriving?sum(l.contracts.map(a=>a.pax*a.fare)):0});
  }
  // Only arriving passengers count toward a deadline. Late arrivals never reopen an award.
  const close=closeContracts(contracts,report.day), fees=cent(report.recoveryCost+(report.connections?.coordination||0));
  report.departureManifests=fresh;report.operatedRounds=report.rows;report.rows=rows;
  for(const key of ['revenue','nonfuel','fuelCost','co2Cost','profit','pax','flights','contractPax','contractRevenue'])report[key]=sum(rows.map(r=>r[key]));
  report.nonfuel+=(fees/100)+close.penalty;report.revenue+=close.bonus;report.profit+=close.bonus-close.penalty-fees/100;
  report.fuelPurchase=fuelPurchase/100;report.co2Purchase=co2Purchase/100;
  report.cashDelta=(ticketCash+serviceCash-nonfuelPaid-fuelPurchase-co2Purchase-fees)/100+close.bonus-close.penalty;
  report.contractState=contracts;report.contractResults=close.results;report.contractBonus=close.bonus;report.contractPenalty=close.penalty;
  report.deferredRevenueDelta=(ticketCash-ticketRevenue)/100;
  report.prepaidNonfuelDelta=(nonfuelPaid-sum(rows.map(r=>cent(r.nonfuel))))/100;
  report.legAccounting=true;
  report.legEconomyState={...previous,through:end,rounds:rounds.filter(r=>r.legs.some(l=>l.arrival>=end))};
  Object.assign(report.legEconomyState,balances(report.legEconomyState.rounds,end));
  report.deferredRevenue=report.legEconomyState.deferredCents/100;report.prepaidFlightCost=report.legEconomyState.prepaidCents/100;
  report.legEvents=rows.map(({leg,plane,route,departure,arrival,revenue,nonfuel,fuelCost,co2Cost,pax,flights})=>({leg,plane,route,departure,arrival,revenue,cost:nonfuel+fuelCost+co2Cost,pax,flights}));
  return report;
}
