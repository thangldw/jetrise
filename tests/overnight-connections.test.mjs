import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,context,transition,restoreGame,forecast,Engine,SAVE_KEY} from '../src/game.js';
import {persistGame,overnightBackupKey,readOvernightBackup,rollbackOvernight,readLegBackup,legBackupKey,BACKUP_KEY} from '../src/save-store.js';
import {projectedWeekReports,projectedWeekProfit} from '../src/planner.js';
import {journeySeats} from '../src/overnight-connections.js';
import {studyNetwork} from '../src/network-study.js';
import {weeklyAircraftEconomics} from '../src/aircraft-economics.js';
const LEG='0123456789abcdef0123456789abcdef',ID='abcdef0123456789abcdef0123456789';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const money=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const store=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function fixture({ai=false,sunday=false,first=19.5,second=25}={}){let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[2,3];s.fleet.forEach(p=>{p.wear=0;p.fault=null;p.serviceDueAt=300;});
 s=act(s,{type:'add',plane:s.fleet[2].id,route:3,start:sunday?first+144:first});s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:sunday?second-24:second});
 if(sunday)s.day=7;if(ai)s=act(s,{type:'strategy-enable'});s.tycoon.prices[3][0]=ai?300:200;if(!ai)s.tycoon.prices[2][0]=360;
 return act(s,{type:'leg-economy-enable',migrationId:LEG});}
const enable=s=>act(s,{type:'overnight-enable',migrationId:ID});
function advance(s){const r=transition(s,{type:'advance'});assert(!r.error,r.error);return {...r,game:restoreGame(JSON.stringify(r.game))};}
function seed(storage,s){const legacy=structuredClone(s);delete legacy.legEconomy;return persistGame(storage,s,persistGame(storage,legacy,null));}
function migrate(){const storage=store(),s=fixture(),before=seed(storage,s),game=enable(s),raw=persistGame(storage,game,before);return {storage,s,before,game,raw};}
function bridge(r){money(r.profit+r.fuelCost+r.co2Cost-r.fuelPurchase-r.co2Purchase+r.deferredRevenueDelta-r.prepaidNonfuelDelta+r.maintenancePrepaid+r.prepaidRent-r.principal+r.leaseRefunds,r.cashDelta);}

test('JET-202 is a separate opt-in and preserves all existing JET-201 data',()=>{
 const s=fixture(),before=JSON.stringify(s);assert.equal(restoreGame(before).legEconomy.overnight,undefined);assert.equal(forecast(s).connections,undefined);
 const next=enable(s),copy=structuredClone(next);delete copy.legEconomy.overnight;delete copy.connectionProgram;assert.deepEqual(copy,s);assert.equal(JSON.stringify(s),before);assert(transition(createGame(),{type:'overnight-enable',migrationId:ID}).error);assert(transition(next,{type:'overnight-enable',migrationId:ID}).error);
});

test('migration writes exact independent bytes before activation and refuses quota, silent write, stale or tampered migration',()=>{
 const {storage,before,game,raw}=migrate();assert.equal(readOvernightBackup(storage,game).raw,before);assert.equal(storage.getItem(overnightBackupKey(ID)),before);assert.throws(()=>persistGame(storage,game,before),/tab khác/);assert.equal(storage.getItem(SAVE_KEY),raw);
 for(const mode of ['quota','silent','main']){const st=store(),s=fixture(),prev=seed(st,s),wrapper={...st,setItem:(k,v)=>{if(k===(mode==='main'?SAVE_KEY:overnightBackupKey(ID))){if(mode!=='silent')throw Error('quota');return;}st.setItem(k,v);}};assert.throws(()=>persistGame(wrapper,enable(s),prev));assert.equal(st.getItem(SAVE_KEY),prev);if(mode==='main'){assert.equal(st.getItem(overnightBackupKey(ID)),prev);persistGame(st,enable(s),prev);}}
 const st=store(),s=fixture(),prev=seed(st,s),tampered=enable(s);tampered.cash+=100;assert.throws(()=>persistGame(st,tampered,prev));assert.equal(st.getItem(overnightBackupKey(ID)),null);
});

test('rollback restores exact pre-JET-202 career, archives current branch and leaves JET-201 backup intact',()=>{
 const {storage,before,game,raw}=migrate();storage.setItem(legBackupKey(LEG),'preserved-original');const next=advance(game).game,saved=persistGame(storage,next,raw);
 assert.equal(storage.getItem(overnightBackupKey(ID)),before);assert.equal(storage.getItem(BACKUP_KEY),raw);
 const result=rollbackOvernight(storage,saved);assert.equal(result.raw,before);assert.equal(storage.getItem(overnightBackupKey(ID)+':rollback'),saved);assert.equal(storage.getItem(legBackupKey(LEG)),'preserved-original');assert(result.game.legEconomy);assert.equal(result.game.legEconomy.overnight,undefined);
 for(const bad of [null,'damaged',raw]){storage.setItem(SAVE_KEY,saved);if(bad===null)storage.data.delete(overnightBackupKey(ID));else storage.setItem(overnightBackupKey(ID),bad);assert.throws(()=>rollbackOvernight(storage,saved));assert.equal(storage.getItem(SAVE_KEY),saved);}
 storage.setItem(overnightBackupKey(ID),before);assert.throws(()=>rollbackOvernight({...storage,setItem:()=>{throw Error('quota');}},saved));assert.equal(storage.getItem(SAVE_KEY),saved);assert.throws(()=>rollbackOvernight(storage,before),/tab khác/);
});

test('one fare reserves both dated legs and settles exactly once across midnight and week wrap',()=>{
 for(const sunday of [false,true]){const s=enable(fixture({sunday})),first=advance(s),j=first.game.legEconomy.overnight.journeys[0];assert(j);assert.equal(j.pax,10);assert.equal(j.legs[0].status,'arrived');assert.equal(j.legs[1].status,'reserved');assert.equal(journeySeats(context(first.game),j.legs[1].id),j.pax);
  const second=advance(first.game),third=advance(second.game);money(first.report.connections.ticketCash,j.fareCents/100);assert.equal(second.report.connections.ticketCash,0);money(first.report.connections.revenue+second.report.connections.revenue,j.fareCents/100);assert.equal(first.report.connections.boardings+second.report.connections.boardings,2*j.pax);assert.equal(second.report.connections.journeys,j.pax);assert.equal(third.report.connections.revenue,0);assert.equal(second.game.legEconomy.overnight.journeys.length,0);assert.equal(second.game.legEconomy.deferredCents,0);bridge(first.report);bridge(second.report);bridge(third.report);
 }
});

test('held seats survive lower fares and new contracts without overbooking or repricing the sold itinerary',()=>{
 let s=advance(enable(fixture())).game;const j=structuredClone(s.legEconomy.overnight.journeys[0]);s=act(s,{type:'prices',route:2,values:[20,550,1100]});
 s.gameplay.contracts=[{id:'contract-0-0',route:2,start:2,end:3,target:400,fare:149,penalty:1000,bonus:200,delivered:0,status:'active'}];
 const r=forecast(s),m=r.departureManifests.find(r=>r.slot===j.legs[1].slot);assert.equal(m.legs[0].passengers[0]+j.pax,m.capacity[0]);assert.equal(m.legs[1].passengers[0],m.capacity[0]);assert.equal(r.contractPax,m.capacity[0]*2-j.pax);money(r.connections.revenue,j.legs[1].fareCents/100);assert.deepEqual(s.legEconomy.overnight.journeys[0],j);advance(s);
});

test('edit, removal, cabin shrink and recovery cancellation reject atomically until explicit refund',()=>{
 const s=advance(enable(fixture())).game,j=s.legEconomy.overnight.journeys[0],slot=s.tycoon.schedules.find(x=>x.id===j.legs[1].slot),before=JSON.stringify(s);
 for(const a of [{type:'remove',id:slot.id},{type:'edit',id:slot.id,plane:slot.plane,route:slot.route,start:slot.start+1},{type:'cabin',plane:slot.plane,values:[1,0,0]},{type:'recover-flight',slot:slot.id,day:2,mode:'cancel'}]){const r=transition(s,a);assert(r.error,JSON.stringify(a));assert.equal(r.game,s);assert.equal(JSON.stringify(s),before);}
 const next=act(s,{type:'journey-refund',id:j.id}),l=j.legs[1];money(next.cash-s.cash,(-l.fareCents+l.costCents)/100);assert.equal(next.legEconomy.overnight.journeys.length,0);assert.equal(next.legEconomy.deferredCents,0);assert.equal(next.legEconomy.prepaidCents,0);assert(transition(next,{type:'journey-refund',id:j.id}).error);const edited=act(next,{type:'remove',id:slot.id});restoreGame(JSON.stringify(edited));const closed=advance(edited);assert.equal(closed.report.connections.refund,0);money(closed.report.connections.refundsPrepaid,l.fareCents/100);bridge(closed.report);
});

test('disabling sales honors existing tickets without another fee; unknown future faults refund only unflown share once',()=>{
 const start=advance(enable(fixture())).game,j=start.legEconomy.overnight.journeys[0];let off=act(start,{type:'connection-program',enabled:false,minimum:60,maximum:1440});assert.equal(forecast(off).connections.coordination,0);assert.equal(advance(off).report.connections.journeys,j.pax);
 off.fleet.find(p=>p.id===j.legs[1].plane).fault='Hydraulic pressure fault';off=restoreGame(JSON.stringify(off));const cancelled=advance(off);assert.equal(cancelled.report.connections.journeys,0);money(cancelled.report.connections.refund,j.legs[1].fareCents/100);money(cancelled.report.connections.costRefund,j.legs[1].costCents/100);assert.equal(cancelled.game.legEconomy.overnight.journeys.length,0);bridge(cancelled.report);assert.equal(advance(cancelled.game).report.connections.refund,0);
});

test('known unavailable downstream flights and too-short or too-long connections sell no tickets',()=>{
 const s=enable(fixture());s.fleet[0].fault='Known fault';assert.equal(forecast(s).connections.sold,0);
 for(const maximum of [60,120]){const s=act(enable(fixture()),{type:'connection-program',enabled:true,minimum:60,maximum});assert.equal(forecast(s).connections.sold,0);}
 const next=act(enable(fixture()),{type:'connection-program',enabled:true,minimum:180,maximum:1440});assert.equal(forecast(next).connections.sold,0);
});

test('AI cannot allocate a reserved through seat twice',()=>{
 let s=advance(enable(fixture({ai:true}))).game;const j=s.legEconomy.overnight.journeys[0];assert(j?.pax>0);s.tycoon.prices[2][0]=20;const r=forecast(s),m=r.departureManifests.find(x=>x.slot===j.legs[1].slot);assert(m.legs[0].passengers[0]+j.pax<=m.capacity[0]);assert(m.legs[1].passengers[0]<=m.capacity[0]);money(r.connections.revenue,j.legs[1].fareCents/100);advance(s);
});

test('forecasts, aircraft contribution and cohort scoring include connecting leg economics without saving',()=>{
 let s=enable(fixture());const bytes=JSON.stringify(s),days=projectedWeekReports(context(s),s.tycoon,false),planes=weeklyAircraftEconomics(context(s),s.tycoon);assert.equal(JSON.stringify(s),bytes);assert.equal(studyNetwork(context(s),s.tycoon,days).metrics.pax,days.reduce((n,d)=>n+d.report.pax,0));
 money(Object.values(planes).reduce((n,p)=>n+p.profit,0),days.reduce((n,d)=>n+d.report.profit+d.report.connections.coordination,0));
 for(const d of days){const r=advance(s);money(d.report.revenue,r.report.revenue);money(d.report.nonfuel,r.report.operatingNonfuel);assert.deepEqual(d.report.legEconomyState,r.game.legEconomy);s=r.game;}
 const tail=enable(fixture({first:163.5,second:1})),projections=projectedWeekReports(context(tail),tail.tycoon,false);assert(projections.at(-1).report.legEconomyState.overnight.journeys.length);assert(projectedWeekProfit(context(tail),tail.tycoon)>projections.reduce((n,d)=>n+d.report.profit,0));
});

test('corrupt reservations, duplicate identifiers, balances and missing future schedule fail restore',()=>{
 const s=advance(enable(fixture())).game;
 const mutations=[x=>x.legEconomy.overnight.version=2,x=>x.legEconomy.overnight.journeys.push(structuredClone(x.legEconomy.overnight.journeys[0])),x=>x.legEconomy.overnight.journeys[0].pax=999,x=>x.legEconomy.overnight.journeys[0].legs[1].arrival++,x=>x.legEconomy.deferredCents++,x=>x.legEconomy.prepaidCents++,x=>x.legEconomy.overnight.journeys[0].fareCents++,x=>x.tycoon.schedules=[],x=>delete x.legEconomy.overnight];
 for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});

test('known contracts take priority before new sales and two feeders cannot reuse a downstream seat',()=>{
 let s=enable(fixture());s.gameplay.contracts=[{id:'contract-0-0',route:2,start:1,end:3,target:400,fare:149,penalty:1000,bonus:200,delivered:0,status:'active'}];assert.equal(forecast(s).connections.sold,0);
 s=enable(fixture());s=act(s,{type:'add',plane:s.fleet[1].id,route:3,start:19});s.tycoon.cabins[s.fleet[1].id]=[4,0,0];s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=340;const r=forecast(s);const bookings=r.connections.bookings;assert.equal(bookings.length,2);const held=new Map();for(const b of bookings)for(const l of b.legs)held.set(l.id,(held.get(l.id)||0)+b.pax);
 const projected=projectedWeekReports({...context(s),noNewConnectionSales:true},s.tycoon,false,2).flatMap(d=>d.report.departureManifests);for(const round of projected)for(const l of round.legs)assert(l.passengers[0]+(held.get(l.id)||0)<=round.capacity[0]);assert(bookings.reduce((n,b)=>n+b.pax,0)<=40);
});

test('purchased direct OD shares demand with connecting offers, including AI outside-option conservation',()=>{
 for(const ai of [false,true]){let s=fixture({ai});s.hq.hubs.DAD={level:1,hangar:1};s=act(s,{type:'route-create',from:'DAD',to:'NRT'});const ri=s.openedRoutes.at(-1);s.fleet[1].hub='DAD';s=act(s,{type:'add',plane:s.fleet[1].id,route:ri,start:0});s=enable(s);
  const withConnections=forecast(s),off=structuredClone(s);off.connectionProgram.enabled=false;const without=forecast(off);assert(withConnections.connections.sold>0);
  if(ai){const a=withConnections.competition.markets.find(m=>m.route===ri),b=without.competition.markets.find(m=>m.route===ri);assert.equal(a.potential,b.potential);assert.equal(a.swift,b.swift);assert.equal(a.aurelia,b.aurelia);assert.equal(a.player-b.player,withConnections.connections.sold);assert.equal(b.outside-a.outside,withConnections.connections.sold);assert.equal(a.player+a.swift+a.aurelia+a.outside,a.potential);assert(a.outsideY>=0);}
  else {const direct=without.departureManifests.find(r=>r.route===ri).legs[0].passengers[0];const budget=Engine.demand(context(s),s.tycoon,ri,s.day)[0];assert(direct+withConnections.connections.sold<=Math.ceil(budget/2));}
  advance(s);
 }
});

test('JET-202 can activate over a departed JET-201 round and reserve its later return without rewriting the manifest',()=>{
 let s=fixture();s.tycoon.schedules=[];s.openedRoutes=[0,2];s=act(s,{type:'add',plane:s.fleet[2].id,route:0,start:22});s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:48});s.tycoon.prices[0][0]=290;s.tycoon.prices[2][0]=360;s=advance(s).game;const original=structuredClone(s.legEconomy.rounds);s=enable(s);assert.deepEqual(s.legEconomy.rounds,original);
 const day2=advance(s);assert(day2.report.connections.sold>0);assert.equal(day2.game.legEconomy.overnight.journeys[0].legs[0].day,1);assert.equal(day2.game.legEconomy.overnight.enabledDay,2);const day3=advance(day2.game);assert.equal(day3.report.connections.journeys,day2.report.connections.sold);bridge(day2.report);bridge(day3.report);
});

test('future capacity-affecting actions are atomic, and a refund does not change historical feeder earnings',()=>{
 const s=advance(enable(fixture())).game,j=s.legEconomy.overnight.journeys[0],p=j.legs[1].plane;
 for(const action of [{type:'service-plan',plane:p,start:24},{type:'repair',plane:p},{type:'maintenance',plane:p,day:2,hour:0},{type:'sell',plane:p},{type:'recover-flight',slot:j.legs[1].slot,day:2,mode:'lease'}]){const r=transition(s,action);assert(r.error,JSON.stringify(action));assert.equal(r.game,s);}
 const refunded=act(s,{type:'journey-refund',id:j.id});assert.deepEqual(refunded.tycoon.history,s.tycoon.history);assert.equal(forecast(refunded).connections.revenue,0);
});
