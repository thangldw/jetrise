import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,context,forecast,Engine,dayCashRequired} from '../src/game.js';
import {maintenanceWindows,suggestMaintenance,weeklySegments,displayAt} from '../src/maintenance.js';
import {repairCost} from '../src/hq.js';
import {scheduleGaps} from '../src/opportunities.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
function empty(){const s=createGame();s.setupComplete=true;s.cash=1e8;s.tycoon.schedules=[];return s;}
test('old saves retain all balances/slots and receive a seven-day grace deadline once',()=>{
 const old=createGame();for(const p of old.fleet){delete p.servicePlan;delete p.serviceDueAt;p.hoursSinceService=80;}
 const migrated=restoreGame(JSON.stringify(old));assert.equal(migrated.cash,old.cash);assert.deepEqual(migrated.tycoon.schedules,old.tycoon.schedules);assert.equal(migrated.fleet[0].serviceDueAt,168);
 migrated.day=3;assert.equal(restoreGame(JSON.stringify(migrated)).fleet[0].serviceDueAt,168);
 for(const bad of [{servicePlan:{start:168,activeFrom:168}},{servicePlan:{start:1,activeFrom:2}},{serviceDueAt:NaN}]){const s=structuredClone(migrated);Object.assign(s.fleet[0],bad);assert.throws(()=>restoreGame(JSON.stringify(s)));}
});
test('manual weekly maintenance blocks overlaps but permits adjacent flights, preserving schedule on rejection',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:8});assert.equal(s.cash,1e8);
 assert(transition(s,{type:'add',plane:id,route:1,start:7}).error);assert(transition(s,{type:'add',plane:id,route:1,start:12.75}).error);
 s=act(s,{type:'add',plane:id,route:1,start:13});assert.equal(forecast(s).flights,2);
 const r=transition(s,{type:'service-plan',plane:id,start:14});assert(r.error);assert.strictEqual(r.game,s);
 assert(scheduleGaps(context(s),s.tycoon,id).some(g=>g.start===0&&g.end===8));
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('midnight and Sunday-to-Monday service windows render across the week boundary',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:167});const p=s.fleet[0];
 assert.deepEqual(maintenanceWindows(p,160,180).map(w=>[w.start,w.end]),[[167,172]]);
 assert.deepEqual(weeklySegments(p,7).map(w=>[w.start,w.end]),[[167,168]]);
 assert.deepEqual(weeklySegments(p,8).map(w=>[w.start,w.end]),[[0,4],[167,168]]);
 s.day=8;assert(transition(s,{type:'add',plane:id,route:1,start:2}).error);assert(!transition(s,{type:'add',plane:id,route:1,start:4}).error);
});
test('light service completes at its exact hour and retains hours from later same-day flights',()=>{
 let s=empty(),id=s.fleet[0].id;s.fleet[0].hoursSinceService=86;s=act(s,{type:'service-plan',plane:id,start:0});s=act(s,{type:'add',plane:id,route:1,start:5});
 const report=forecast(s);assert.equal(report.cancelled,0);assert.equal(report.serviceState[id].hoursSinceService,5.25);
 s=act(s,{type:'advance'});assert.equal(s.fleet[0].hoursSinceService,5.25);assert.equal(s.fleet[0].serviceDueAt,173);
});
test('weekly expense is charged exactly at start; forecasts are read-only and cash bridge reconciles',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:23});const before=JSON.stringify(s),r=forecast(s),cost=Math.round(repairCost(s,id)*.35);
 assert.equal(r.maintenanceCash,cost);assert.equal(r.maintenancePrepaid,0);assert.equal(r.maintenanceCost,cost);assert.equal(JSON.stringify(s),before);assert.equal(forecast(s).maintenanceCash,cost);
 assert.equal(dayCashRequired(r),r.overhead+cost);const cash=s.cash;s=act(s,{type:'advance'});assert.equal(s.cash,cash+r.cashDelta);assert.equal(forecast(s).maintenanceCash,0);
 const bridge=r.profit+r.fuelCost+r.co2Cost-r.fuelPurchase-r.co2Purchase+r.maintenancePrepaid+r.prepaidRent-r.principal+r.leaseRefunds;assert(Math.abs(bridge-r.cashDelta)<1e-7);
 s=act(s,{type:'advance'});assert.equal(s.fleet[0].serviceDueAt,196);
});
test('missing a weekly deadline grounds a round; overdue aircraft can resume after its check',()=>{
 let s=empty(),id=s.fleet[0].id;s.fleet[0].serviceDueAt=10;
 assert(transition(s,{type:'add',plane:id,route:1,start:8}).error);
 s=act(s,{type:'service-plan',plane:id,start:12});s=act(s,{type:'add',plane:id,route:1,start:17});assert.equal(forecast(s).flights,2);
});
test('auto suggestion prefers a legal night gap before the due time without altering flights',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'add',plane:id,route:1,start:0});const snapshot=JSON.stringify(s),p=s.fleet[0],duration=x=>Engine.duration(context(s),id,x.route),found=suggestMaintenance(s,p,duration,'night');
 assert(found);assert(found.start%24>=22||found.start%24<=1);assert.equal(JSON.stringify(s),snapshot);
 s=act(s,{type:'service-plan',plane:id,start:found.start});assert.equal(s.tycoon.schedules.length,1);
});
test('hangar capacity prevents simultaneous excess jobs at the same hub',()=>{
 let s=empty(),[a,b]=s.fleet;s=act(s,{type:'service-plan',plane:a.id,start:0});const r=transition(s,{type:'service-plan',plane:b.id,start:0});assert(r.error.includes('Hangar'));assert.strictEqual(r.game,s);
 s=act(s,{type:'hangar',hub:'HAN'});s=act(s,{type:'service-plan',plane:b.id,start:0});assert(s.fleet[1].servicePlan);
});
test('major service supports clock time, clears faults, and skips overlapping light fees',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:6});s=act(s,{type:'maintenance',plane:id,day:1,hour:1});
 assert.equal(s.fleet[0].maintenance.startAt,1);assert.equal(s.fleet[0].maintenance.endAt,25);assert.equal(forecast(s).maintenanceCash,0);
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);s=act(s,{type:'advance'});assert(s.fleet[0].maintenance);s=act(s,{type:'advance'});assert.equal(s.fleet[0].maintenance,null);assert.equal(s.fleet[0].serviceDueAt,193);
 s.fleet[0].fault='Fault';assert(transition(s,{type:'service-plan',plane:id,start:70}).error);assert(transition(s,{type:'maintenance',plane:id,day:s.day+1}).error);
 s=act(s,{type:'repair',plane:id});s=act(s,{type:'advance'});s=act(s,{type:'advance'});assert.equal(s.fleet[0].fault,null);
});
test('maintenance end exactly at departure is available, and report/state remain consistent after a week',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:0});s=act(s,{type:'add',plane:id,route:1,start:5});
 for(let i=0;i<8;i++){const f=forecast(s);const cash=s.cash;s=act(s,{type:'advance'});assert(Math.abs(s.cash-cash-f.cashDelta)<1e-7);assert.deepEqual(restoreGame(JSON.stringify(s)),s);}
 assert.equal(s.tycoon.history.filter(h=>h.maintenanceCash>0).length,2);assert.equal(s.tycoon.history.filter(h=>h.flights===2).length,2);
 assert.match(displayAt(172),/Thứ Hai 04:00/);
});
test('an active recurring check cannot be moved or cancelled to bypass downtime',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:0});
 for(const a of [{type:'service-plan',start:24},{type:'service-plan-remove'}]){const r=transition(s,{...a,plane:id});assert(r.error);assert.strictEqual(r.game,s);}
});
test('major jobs respect shared hangar capacity and invalid clock input is atomic',()=>{
 let s=empty(),[a,b]=s.fleet;s=act(s,{type:'maintenance',plane:a.id,day:1,hour:1});
 const blocked=transition(s,{type:'maintenance',plane:b.id,day:1,hour:2});assert(blocked.error.includes('Hangar'));assert.strictEqual(blocked.game,s);
 const bad=transition(s,{type:'maintenance',plane:b.id,day:2,hour:1.1});assert(bad.error);assert.strictEqual(bad.game,s);
});
test('insufficient cash on a recurring check day prevents partial settlement',()=>{
 let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:0});s.cash=forecast(s).overhead;
 const r=transition(s,{type:'advance'});assert(r.error);assert.strictEqual(r.game,s);assert.equal(s.day,1);
});
test('automatic flight allocation retains the maintenance plan and leaves its blocks empty',async()=>{
 const {proposeSchedule}=await import('../src/planner.js');let s=empty(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:0});
 const before=JSON.stringify(s),proposal=proposeSchedule(context(s),s.tycoon);assert.equal(JSON.stringify(s),before);assert(proposal.added>0);
 for(const slot of proposal.state.schedules.filter(x=>x.plane===id)){const end=slot.start+Engine.duration(context(s),id,slot.route);assert.equal(maintenanceWindows(s.fleet[0],slot.start,end).length,0);}
});
