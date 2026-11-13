import assert from 'node:assert/strict';

const sum=xs=>xs.reduce((a,b)=>a+b,0),cents=n=>Math.round(n*100);
// Legacy economics permits fractional cents. Rounding two equivalent floats
// separately can straddle a half-cent boundary; tolerate only sub-micro-dollar
// arithmetic noise, far below a one-cent ledger mutation.
const eq=(a,b,label)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);
const inDay=(at,start)=>at>=start&&at<start+24;
export function createAudit(){return {departures:new Set(),arrivals:new Set(),journeyEvents:new Set(),sold:new Map(),frozen:new Map(),rivalLegs:new Set(),days:0,playerLegEvents:0,rivalLegEvents:0,connectionsSold:0,connectionsCompleted:0,connectionRefunds:0,slotMovements:0,leasesAcquired:0,leasesReturned:0};}

// Deliberately recompute from dated manifests and state changes, without calling
// settlement helpers. Report totals alone cannot establish once-only accounting.
export function auditDay(a,before,after,report,preview){
 const start=(before.day-1)*24;
 assert.equal(after.day,before.day+1);eq(after.cash-before.cash,report.cashDelta,'wallet delta');
 eq(report.revenue-report.nonfuel-report.fuelCost-report.co2Cost,report.profit,'P&L');
 eq(report.profit+report.fuelCost+report.co2Cost-report.fuelPurchase-report.co2Purchase+(report.deferredRevenueDelta||0)-(report.prepaidNonfuelDelta||0)+(report.maintenancePrepaid||0)+(report.prepaidRent||0)-report.principal+report.leaseRefunds+(report.disruptionPrepaid||0),report.cashDelta,'cash bridge');
 assert(Math.abs(after.fuel-Math.max(0,before.fuel-(report.fuelAllocated??report.burn)))<1e-7,'fuel inventory');
 assert(Math.abs(after.co2-Math.max(0,before.co2-(report.co2Allocated??report.co2)))<1e-7,'CO2 inventory');
 assert(after.tycoon.history.length<=28);assert.deepEqual(before.tycoon.schedules,after.tycoon.schedules,'day close must preserve recurring templates');
 if(before.legEconomy){
  assert.equal(after.legEconomy.through,start+24);
  let revenue=0,cost=0,boardings=0,departures=0;
  const rounds=[...before.legEconomy.rounds,...preview.departureManifests];
  for(const r of rounds)for(const l of r.legs){
   const frozen=JSON.stringify([r.plane,r.route,r.capacity,r.fares,l.ticketCents,l.serviceCents,l.nonfuelCents,l.fuelCents,l.co2Cents,l.passengers,l.contracts]);
   if(a.frozen.has(l.id))assert.equal(frozen,a.frozen.get(l.id),'sold direct financial terms');else a.frozen.set(l.id,frozen);
   if(inDay(l.departure,start)){assert(!a.departures.has(l.id),'duplicate departure '+l.id);a.departures.add(l.id);cost+=l.nonfuelCents+l.fuelCents+l.co2Cents;departures++;}
   if(inDay(l.arrival,start)){assert(!a.arrivals.has(l.id),'duplicate arrival '+l.id);a.arrivals.add(l.id);revenue+=l.ticketCents+l.serviceCents;boardings+=sum(l.passengers);}
   const row=preview.rows.find(v=>v.leg===l.id);if(row)for(let k=0;k<3;k++)assert(row.passengers[k]<=r.capacity[k],'direct plus connecting class capacity');
  }
  eq(revenue/100+(report.connections?.revenue||0)+(report.contractBonus||0),report.revenue,'manifest revenue');
  eq(cost/100+(report.connections?.handling||0)+(report.connections?.coordination||0)+(report.contractPenalty||0)+(report.recoveryCost||0)+(report.disruptionPrepaid||0)+(report.customers?.fee||0)+report.overhead+report.maintenanceCost,report.nonfuel+report.fuelCost+report.co2Cost,'manifest and company costs');
  assert.equal(boardings+(report.connections?.boardings||0),report.pax,'manifest boardings');assert.equal(departures,report.flights,'manifest departures');
  a.playerLegEvents+=report.legEvents.length;
  const e=after.legEconomy,legs=e.rounds.flatMap(r=>r.legs),pending=(e.overnight?.journeys||[]).flatMap(j=>j.legs.filter(l=>l.status==='reserved'));
  assert.equal(e.deferredCents,sum(legs.filter(l=>l.arrival>=e.through).map(l=>l.ticketCents))+sum(pending.map(l=>l.fareCents)),'deferred balance');
  assert.equal(e.prepaidCents,sum(legs.filter(l=>l.departure>=e.through).map(l=>l.nonfuelCents+l.fuelCents+l.co2Cents))+sum(pending.filter(l=>l.departure>=e.through).map(l=>l.costCents)),'prepaid balance');
  // JET-209: advance ticket liability is part of total deferred receipts; recompute it from sold lots.
  const advanceOf=g=>sum((g.legEconomy.advance?.bookings||[]).flatMap(b=>b.lots.map(l=>sum(l.passengers.map((n,k)=>n*l.fares[k]*100)))));
  if(e.advance)assert.equal(e.advance.liabilityCents,advanceOf(after),'advance liability');
  eq((e.deferredCents+advanceOf(after))/100-(before.legEconomy.deferredCents+advanceOf(before))/100,report.deferredRevenueDelta,'deferred movement');
  const resourceExpense=sum(rounds.flatMap(r=>r.legs.filter(l=>inDay(l.departure,start)).map(l=>l.fuelCents+l.co2Cents)));
  const newResourcePrepay=sum(preview.departureManifests.flatMap(r=>r.legs.map(l=>l.fuelCents+l.co2Cents)));
  eq((e.prepaidCents-before.legEconomy.prepaidCents-newResourcePrepay+resourceExpense)/100,report.prepaidNonfuelDelta,'nonfuel prepaid movement');
 }
 if(report.connections?.mode==='overnight'){
  a.connectionsSold+=report.connections.sold;a.connectionsCompleted+=report.connections.journeys;a.connectionRefunds+=report.connections.refund;
  for(const event of report.connections.events){const key=event.id+':'+event.leg+':'+event.kind;assert(!a.journeyEvents.has(key),'duplicate journey event '+key);a.journeyEvents.add(key);}
  for(const j of [...before.legEconomy.overnight.journeys,...after.legEconomy.overnight.journeys]){const terms=JSON.stringify([j.pax,j.fareCents,j.legs.map(l=>[l.fareCents,l.costCents]),j.experience]);if(a.sold.has(j.id))assert.equal(terms,a.sold.get(j.id),'sold through terms');else a.sold.set(j.id,terms);}
 }
 if(before.customerStrategy){assert.equal(after.customerStrategy.through,before.day);assert.equal(sum(after.customerStrategy.samples)-sum(before.customerStrategy.samples),report.customers.count,'terminal customer count');assert.equal(sum(report.customers.segments),report.customers.count);assert(after.customerStrategy.scores.every(n=>n>=-1&&n<=1));assert(after.customerStrategy.history.length<=28);}
 for(const market of report.competition?.markets||[]){assert.equal(market.player+market.swift+market.aurelia+market.outside,market.potential,'shared market demand');for(const s of market.segments)assert.equal(s.player+s.swift+s.aurelia+s.outside,s.total,'segment demand');}
 for(const r of report.competition?.rivals||[])if(r.legs){
  eq(r.cashBefore+r.profit-r.slotSigning-r.routeFee-r.depositPaid+r.depositRefund,r.cash,'rival cash bridge');
  assert.equal(sum(r.legs.map(l=>l.revenueCents)),cents(r.revenue),'rival leg revenue');assert.equal(sum(r.legs.map(l=>l.pax)),r.pax);eq(sum(r.aircraft.map(p=>p.cost)),r.cost,'rival costs');
  for(const l of r.legs){assert(!a.rivalLegs.has(l.id),'duplicate rival leg');a.rivalLegs.add(l.id);assert(Number.isSafeInteger(l.costCents)&&Number.isSafeInteger(l.revenueCents));assert(inDay(l.departure,start)&&inDay(l.arrival,start));a.rivalLegEvents++;}
  const old=before.strategy.rivals.find(x=>x.id===r.id).network.fleet,next=after.strategy.rivals.find(x=>x.id===r.id).network.fleet;
  const added=next.filter(p=>p.lease&&!old.some(o=>o.id===p.id)),removed=old.filter(p=>p.lease&&!next.some(o=>o.id===p.id));
  assert.equal(sum(added.map(p=>p.lease.deposit)),r.depositPaid,'paid acquisition deposits');assert.equal(sum(removed.map(p=>p.lease.deposit)),r.depositRefund,'once-only returned deposits');a.leasesAcquired+=added.length;a.leasesReturned+=removed.length;
  assert(next.length<=3&&next.filter(p=>p.lease).length<=2);assert(after.strategy.rivals.find(x=>x.id===r.id).network.routes.length<=4);
 }
 if(after.slotMarket){
  const m=after.slotMarket;
  for(const key of new Set(Object.values(m.rights).flatMap(r=>Object.keys(r))))assert(sum(Object.values(m.rights).map(r=>r[key]?.quantity||0))<=4,'shared ownership');
  for(const v of report.sharedSlots.movements){assert(v.player+v.swift+v.aurelia<=4,'movement capacity');for(const owner of ['player','swift','aurelia']){assert(v[owner]<=(m.rights[owner][v.airport+':'+(v.hour%168)]?.quantity||0),'movement without rights');a.slotMovements+=v[owner];}}
  const movements=new Map(),add=(owner,airport,at)=>{if(!m.airports.includes(airport)||!inDay(at,start))return;const key=airport+':'+Math.floor(at),row=movements.get(key)||{airport,hour:Math.floor(at),player:0,swift:0,aurelia:0};row[owner]++;movements.set(key,row);};
  for(const r of [...before.legEconomy.rounds,...preview.departureManifests])for(const l of r.legs){add('player',l.from,l.departure);add('player',l.to,l.arrival);}
  for(const r of report.competition.rivals)for(const l of r.legs||[]){add(r.id,l.from,l.departure);add(r.id,l.to,l.arrival);}
  if(before.strategy.expansion)assert.deepEqual([...movements.values()].sort((a,b)=>a.hour-b.hour||a.airport.localeCompare(b.airport)),report.sharedSlots.movements,'physical movements versus receipts');
  assert.equal(m.spent.player.daily-before.slotMarket.spent.player.daily,report.slotFee,'player slot upkeep');
  for(const r of report.sharedSlots.rivals){assert.equal(m.spent[r.id].daily-before.slotMarket.spent[r.id].daily,r.daily);assert.equal(m.spent[r.id].signing-before.slotMarket.spent[r.id].signing,r.signing);}
 }
 a.days++;
}

export function auditSummary(a){return Object.fromEntries(Object.entries(a).filter(([,v])=>typeof v==='number'));}
