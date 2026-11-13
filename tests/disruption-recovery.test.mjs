import test from 'node:test';
import assert from 'node:assert/strict';
import {context,transition,restoreGame,forecast,dayCashRequired,createGame,SAVE_KEY} from '../src/game.js';
import {previewDisruption,disruptionCandidates} from '../src/disruption-recovery.js';
import {datedRound,roundEnd} from '../src/dated-legs.js';
import {projectedWeekReports,plannerBasis} from '../src/planner.js';
import {weeklyAircraftEconomics} from '../src/aircraft-economics.js';
import {persistGame,readSession,BACKUP_KEY,rollbackOvernight,overnightBackupKey,legBackupKey} from '../src/save-store.js';
import {disruptionFixture,act} from './fixtures/disruption.mjs';
const approx=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const request=(s,mode='wait',extra={})=>({leg:s.legEconomy.overnight.journeys[0].legs[0].id,kind:'weather',delay:3,mode,reservePlane:s.fleet[1].id,...extra});
const quote=(s,mode='wait',extra={})=>previewDisruption(s,context(s),request(s,mode,extra));
const apply=(s,p)=>act(s,{type:'disruption-apply',preview:p});
const close=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);r.game=restoreGame(JSON.stringify(r.game));return r;};
const bridge=r=>approx(r.profit+r.fuelCost+r.co2Cost-r.fuelPurchase-r.co2Purchase+(r.deferredRevenueDelta||0)-(r.prepaidNonfuelDelta||0)+r.maintenancePrepaid+r.prepaidRent-r.principal+r.leaseRefunds+(r.disruptionPrepaid||0),r.cashDelta);

test('old saves do not acquire scenarios; previews are read-only and stale/tampered plans fail atomically',()=>{
 const legacy=createGame();assert.equal(restoreGame(JSON.stringify(legacy)).legEconomy,undefined);assert.throws(()=>previewDisruption(legacy,context(legacy),{}),/JET-201/);
 const s=disruptionFixture(),bytes=JSON.stringify(s),p=quote(s);assert.equal(JSON.stringify(s),bytes);assert.equal(restoreGame(bytes).legEconomy.disruptions,undefined);
 for(const next of [act(s,{type:'prices',route:2,values:[350,550,1100]}),{...s,cash:s.cash-1}]){const r=transition(next,{type:'disruption-apply',preview:p});assert.match(r.error,/cũ/);assert.equal(r.game,next);}
 const bad=structuredClone(p);bad.summary.feeCents=0;const result=transition(s,{type:'disruption-apply',preview:bad});assert(result.error);assert.equal(result.game,s);assert.equal(JSON.stringify(s),bytes);
});

test('waiting propagates aircraft continuity, preserves weekly slots and sold ticket cents',()=>{
 const s=disruptionFixture({competing:true}),j=structuredClone(s.legEconomy.overnight.journeys[0]),p=quote(s),next=apply(s,p);
 assert.deepEqual(next.tycoon.schedules,s.tycoon.schedules);assert(p.summary.changes.length>=4);assert.equal(p.summary.missedPax,j.pax);assert.equal(p.summary.refundCents,0);assert.equal(p.summary.compensationCents,50000);
 const saved=restoreGame(JSON.stringify(next)),ticket=saved.legEconomy.overnight.journeys[0];assert.equal(ticket.fareCents,j.fareCents);assert.deepEqual(ticket.legs.map(l=>[l.fareCents,l.costCents]),j.legs.map(l=>[l.fareCents,l.costCents]));assert(ticket.legs[1].departure>=ticket.legs[0].arrival+1);
 assert.equal(saved.legEconomy.rounds[0].legs[0].arrival,s.legEconomy.rounds[0].legs[0].arrival);assert.equal(saved.legEconomy.rounds[0].legs[1].arrival,28);assert.equal(saved.fleet[2].airborneUntilAt,28.5);
 const day2=close(saved);assert.equal(day2.report.connections.ticketCash,0);assert.equal(day2.report.connections.journeys,j.pax);bridge(day2.report);const day3=close(day2.game);bridge(day3.report);
 assert.equal(day2.report.disruptionPrepaid,p.summary.feeCents/100);assert.equal(day3.report.disruptionPrepaid,0);assert.equal(day2.report.punctuality.missedCustomers,j.pax);assert(day2.report.punctuality.late>0);
});

test('operate refunds only missed onward fare and unused handling; no replay or first-leg revenue loss',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0],p=quote(s,'operate'),next=apply(s,p);
 assert.equal(p.summary.refundCents,j.legs[1].fareCents);assert.equal(p.summary.handlingRefundCents,j.legs[1].costCents);approx(next.cash-s.cash,(-p.summary.feeCents-j.legs[1].fareCents+j.legs[1].costCents)/100);
 assert.equal(next.legEconomy.deferredCents,s.legEconomy.deferredCents-j.legs[1].fareCents);
 const first=close(next);approx(first.report.connections.revenue,j.legs[0].fareCents/100);assert.equal(first.report.connections.refund,0);assert.equal(first.report.connections.ticketCash,0);assert.equal(first.report.connections.journeys,0);bridge(first.report);
 const second=close(first.game);assert.equal(second.report.connections.revenue,0);assert.equal(second.report.disruptionPrepaid,0);bridge(second.report);
 assert(transition(next,{type:'disruption-apply',preview:p}).error);
});

test('rebooking moves held capacity to an actual alternative while retaining original fare and one receipt',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0],p=quote(s,'rebook'),next=restoreGame(JSON.stringify(apply(s,p))),rebooked=next.legEconomy.overnight.journeys[0];
 assert.notEqual(rebooked.legs[1].id,j.legs[1].id);assert.equal(rebooked.legs[1].departure,40);assert.equal(rebooked.rebookedFrom,j.legs[1].id);assert.equal(rebooked.id,j.id);assert.equal(rebooked.legs[1].fareCents,j.legs[1].fareCents);assert.equal(p.summary.rebookedPax,j.pax);
 for(const action of [{type:'remove',id:rebooked.legs[1].slot},{type:'cabin',plane:rebooked.legs[1].plane,values:[1,0,0]}])assert(transition(next,action).error);
 const day=close(next);assert.equal(day.report.connections.ticketCash,0);approx(day.report.connections.revenue,j.fareCents/100);assert.equal(day.report.connections.boardings,2*j.pax);bridge(day.report);
});

test('rebooking cannot displace direct or contracted passengers and fails without a legal alternative',()=>{
 const s=disruptionFixture({alternative:false});assert.throws(()=>quote(s,'rebook'),/Không có chặng thay thế/);
 const crowded=disruptionFixture();crowded.tycoon.prices[2][0]=20;assert.throws(()=>quote(crowded,'rebook'),/Không có chặng thay thế/);
 const contracted=disruptionFixture();contracted.gameplay.contracts=[{id:'contract-0-0',route:2,start:2,end:3,target:2000,fare:149,penalty:1000,bonus:200,delivered:0,status:'active'}];assert.throws(()=>quote(contracted,'rebook'),/Không có chặng thay thế/);
});

test('reserve dispatch is explicit, uses its cabin and flight time and cannot teleport an aircraft',()=>{
 const s=disruptionFixture(),p=quote(s,'reserve'),next=restoreGame(JSON.stringify(apply(s,p))),j=next.legEconomy.overnight.journeys[0];
 assert.equal(j.legs[1].plane,s.fleet[1].id);assert.equal(j.legs[1].capacity,s.tycoon.cabins[s.fleet[1].id][0]);assert(next.fleet[1].reserve);assert.deepEqual(next.tycoon.schedules,s.tycoon.schedules);
 const r=close(next);assert(r.report.connections.journeys>0);assert.equal(r.report.connections.ticketCash,0);assert(r.report.aircraft[s.fleet[1].id].pax>0);bridge(r.report);
 assert.throws(()=>quote(s,'reserve',{reservePlane:s.fleet[0].id}),/dự phòng/);
 for(const mutate of [x=>x.fleet[1].hub='DAD',x=>x.fleet[1].fault='Hydraulic fault',x=>x.fleet[1].airborneUntilAt=40,x=>x.tycoon.cabins[x.fleet[1].id]=[1,0,0]]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>quote(bad,'reserve'));}
 assert.throws(()=>quote(s,'cancel'),/Vòng đã khởi hành/);assert.throws(()=>quote(s,'wait',{kind:'technical'}),/đã cất cánh/);
});

test('technical departure rescue and cancellation operate on only the chosen dated round',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0],leg=j.legs[1].id;
 const p=quote(s,'reserve',{leg,kind:'technical'}),next=apply(s,p);assert.equal(next.legEconomy.overnight.journeys[0].legs[1].plane,s.fleet[1].id);close(next);
 const cancelled=apply(s,quote(s,'cancel',{leg,kind:'technical'}));assert.deepEqual(cancelled.tycoon.schedules,s.tycoon.schedules);assert.equal(cancelled.legEconomy.overnight.journeys[0].legs[1].status,'refunded');
 const r=close(cancelled);assert.equal(r.report.cancelled,2);assert.equal(r.report.connections.journeys,0);bridge(r.report);assert.equal(r.game.tycoon.exceptions.length,0);
});

test('funding, maintenance, slot conflicts and propagation bounds reject the entire proposal',()=>{
 const s=disruptionFixture();
 const broke={...structuredClone(s),cash:0};assert.throws(()=>quote(broke),/Không đủ tiền/);
 const due=structuredClone(s);due.fleet[2].serviceDueAt=27;assert.throws(()=>quote(due),/bảo dưỡng/);
 const check=structuredClone(s);check.fleet[0].servicePlan={start:36,activeFrom:36};assert.throws(()=>quote(check),/bảo dưỡng/);
 const late=disruptionFixture();late.tycoon.schedules.find(x=>x.start===40).start=47;assert.throws(()=>quote(late,'wait',{delay:12}),/timing|continuity|delay/);
 const slots=disruptionFixture();slots.slotRights={HAN:{capacity:1,startedDay:1,unlockDay:8}}; // A delayed landing and waited takeoff now share hour 28 with an extra movement.
 slots.tycoon.schedules.push({id:slots.tycoon.nextId++,plane:slots.fleet[2].id,route:3,start:28.5});
 assert.throws(()=>quote(slots),/slot/);
});

test('Sunday delays, following-day revenue and forecast/actual accounting agree after restore',()=>{
 let s=disruptionFixture({sunday:true,competing:true});const p=quote(s,'wait'),bytes=JSON.stringify(s);s=apply(s,p);assert.notEqual(plannerBasis(context(s),s.tycoon),plannerBasis(context(JSON.parse(bytes)),JSON.parse(bytes).tycoon));
 const before=JSON.stringify(s),projected=projectedWeekReports(context(s),s.tycoon,false),planes=weeklyAircraftEconomics(context(s),s.tycoon);assert.equal(JSON.stringify(s),before);
 approx(Object.values(planes).reduce((n,p)=>n+p.profit,0),projected.reduce((n,{report:r})=>n+r.profit+(r.connections?.coordination||0),0));
 for(const {report:expected} of projected){const next=close(s);approx(expected.revenue,next.report.revenue);approx(expected.nonfuel,next.report.operatingNonfuel);approx(expected.disruptionPrepaid||0,next.report.disruptionPrepaid||0);assert.deepEqual(expected.legEconomyState,next.game.legEconomy);bridge(next.report);s=next.game;}
});

test('already-paid recovery is expensed once and added back to reserve and cash bridge',()=>{
 const s=disruptionFixture(),p=quote(s),next=apply(s,p),r=forecast(next),clone=structuredClone(next);clone.legEconomy.disruptions.paidTodayCents=0;clone.legEconomy.disruptions.events=[];
 const without=forecast(clone);approx(r.nonfuel-without.nonfuel,p.summary.feeCents/100);approx(r.cashDelta,without.cashDelta);approx(dayCashRequired(r),dayCashRequired(without));assert.equal(r.disruptionPrepaid,p.summary.feeCents/100);bridge(r);
});

test('committed timed operations resist template/fleet/maintenance changes but allow future fare changes',()=>{
 const s=apply(disruptionFixture(),quote(disruptionFixture())),j=s.legEconomy.overnight.journeys[0],l=j.legs[1];
 const actions=[{type:'remove',id:l.slot},{type:'recovery-remove',slot:l.slot,day:l.day},{type:'maintenance',plane:l.plane,day:2,hour:12},{type:'cabin',plane:l.plane,values:[1,0,0]},{type:'sell',plane:l.plane}];
 for(const a of actions){const r=transition(s,a);assert(r.error,JSON.stringify(a));assert.equal(r.game,s);}
 const next=act(s,{type:'prices',route:2,values:[340,550,1100]});restoreGame(JSON.stringify(next));
});

test('corrupt timing, mismatched held legs and malformed recovery accounting fail restore',()=>{
 const s=apply(disruptionFixture(),quote(disruptionFixture()));
 for(const mutate of [x=>x.legEconomy.disruptions.version=2,x=>x.legEconomy.disruptions.paidTodayCents++,x=>x.legEconomy.rounds[0].legs[1].arrival++,x=>x.legEconomy.rounds[0].timing[1].departure=0,x=>delete x.legEconomy.disruptions,x=>x.tycoon.exceptions[0].timing[0].departure+=24,x=>x.legEconomy.overnight.journeys[0].legs[0].arrival++,x=>x.legEconomy.disruptions.events[0].charges[0].cents++]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});

test('save compare-and-write, quota failure, previous backup and JET-202 rollback preserve exact bytes',()=>{
 const s=disruptionFixture(),next=apply(s,quote(s)),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},raw=JSON.stringify(s);data.set(SAVE_KEY,raw);
 const failing={...storage,setItem:(k,v)=>{if(k===SAVE_KEY)throw Error('quota');storage.setItem(k,v);}};
 assert.throws(()=>persistGame(failing,next,raw),/quota/);assert.equal(storage.getItem(SAVE_KEY),raw);assert.equal(storage.getItem(BACKUP_KEY),raw);assert.equal(readSession(storage).blocked,false);
 const saved=persistGame(storage,next,raw);assert.equal(storage.getItem(BACKUP_KEY),raw);assert.throws(()=>persistGame(storage,next,raw),/tab khác/);assert.equal(storage.getItem(SAVE_KEY),saved);
 // Use a real pre-activation save as the immutable rollback target.
 const pre=createGame();pre.setupComplete=true;pre.tycoon.schedules=[];pre.fleet.forEach(p=>p.airborneUntilAt=null);const old=act(pre,{type:'leg-economy-enable',migrationId:s.legEconomy.migrationId}),backup=JSON.stringify(old);
 data.set(overnightBackupKey(s.legEconomy.overnight.migrationId),backup);data.set(legBackupKey(s.legEconomy.migrationId),'untouched');
 const rollback=rollbackOvernight(storage,saved);assert.equal(rollback.raw,backup);assert.equal(storage.getItem(overnightBackupKey(s.legEconomy.overnight.migrationId)+':rollback'),saved);assert.equal(storage.getItem(legBackupKey(s.legEconomy.migrationId)),'untouched');
});

test('a known technical cancellation can rebook sold onward tickets atomically, without freeing the original template',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0];
 // The onward aircraft is down. Put the legal alternative on the still-healthy feeder aircraft.
 const alternate=s.tycoon.schedules.find(x=>x.start===40);alternate.plane=s.fleet[2].id;s.fleet[0].fault='Known hydraulic failure';
 const p=quote(s,'rebook',{leg:j.legs[1].id,kind:'technical'}),next=restoreGame(JSON.stringify(apply(s,p)));
 assert(p.summary.changes[0].cancelled);assert.equal(p.summary.rebookedPax,j.pax);assert.equal(p.summary.refundCents,0);
 assert.equal(next.legEconomy.overnight.journeys[0].legs[1].plane,s.fleet[2].id);assert.deepEqual(next.tycoon.schedules,s.tycoon.schedules);
 assert(transition(next,{type:'recovery-remove',day:j.legs[1].day,slot:j.legs[1].slot}).error);
 const r=close(next);assert.equal(r.report.connections.journeys,j.pax);assert.equal(r.report.cancelled,2);assert.equal(r.report.connections.ticketCash,0);bridge(r.report);
});

test('rebooking respects seats already held by another cohort on the alternative',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0];
 // A second previously sold itinerary shares the feeder but held a different onward flight.
 const second=structuredClone(j);second.legs[1].slot=s.tycoon.schedules.find(x=>x.start===40).id;second.legs[1].id=`2:${second.legs[1].slot}:out`;second.legs[1].roundStart=40;second.legs[1].departure=40;second.legs[1].arrival=44.5;second.id=second.legs[0].id+'>'+second.legs[1].id;
 s.legEconomy.overnight.journeys.push(second);s.legEconomy.deferredCents+=second.fareCents;s.legEconomy.prepaidCents+=second.legs[1].costCents;
 restoreGame(JSON.stringify(s));
 // The 15-seat cabin has 10 held seats; projected direct demand takes the other 5.
 s.tycoon.cabins[s.fleet[0].id]=[15,0,0];
 const before=JSON.stringify(s);assert.throws(()=>quote(s,'rebook'),/Không có chặng thay thế/);assert.equal(JSON.stringify(s),before);
});

test('delays across a second midnight retain liabilities until arrival and do not charge consumed handling again',()=>{
 const s=disruptionFixture(),j=s.legEconomy.overnight.journeys[0],later=s.tycoon.schedules.find(x=>x.start===40);later.start=47;
 const p=quote(s,'rebook'),next=apply(s,p),day2=close(next);assert.equal(day2.report.connections.journeys,0);assert.equal(day2.game.legEconomy.overnight.journeys[0].legs[1].status,'reserved');
 assert.equal(day2.game.legEconomy.overnight.journeys[0].legs[1].departure,47);assert(day2.game.legEconomy.overnight.journeys[0].legs[1].arrival>=48);assert.equal(day2.game.legEconomy.overnight.journeys[0].legs[0].status,'arrived');bridge(day2.report);
 const day3=close(day2.game);assert.equal(day3.report.connections.journeys,j.pax);approx(day2.report.connections.revenue+day3.report.connections.revenue,j.fareCents/100);assert.equal(day3.report.connections.handling,0);assert.equal(day3.report.disruptionPrepaid,0);bridge(day3.report);
});

test('punctuality compares the original booked aircraft timing when a slower reserve completes successfully',()=>{
 const s=disruptionFixture({onwardModel:'B788'}),j=s.legEconomy.overnight.journeys[0],p=quote(s,'reserve',{leg:j.legs[1].id,kind:'technical'}),next=apply(s,p),r=close(next).report;
 assert.equal(r.connections.journeys,j.pax);assert.equal(r.cancelled,0);assert.equal(r.punctuality.late,2);assert.equal(r.punctuality.onTime,2);bridge(r);
});
