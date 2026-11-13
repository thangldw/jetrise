import test from 'node:test';
import assert from 'node:assert/strict';
import {studyBase,CELLS} from '../scripts/slot-balance-matched.mjs';
import {context,forecast,transition,SAVE_KEY,restoreGame} from '../src/game.js';
import {enableConditional,enableUtilization,addStudyFlight,cancelStudyOccurrence} from '../scripts/experiments/slot-utilization-actions.mjs';
import {maintainFleet} from './fixtures/long-run.mjs';
import {exportSaveFile,importSaveFile,slotUtilizationBackupKey,restoreSaveEntry,readSaveEntry,persistGame} from '../src/save-store.js';
import {memoryStorage} from './fixtures/save-manager.mjs';
import {projectedWeekReports} from '../src/planner.js';
const network={hub:'LHR',feeder:'EDI',onward:'CDG'};
const fixture=()=>{const run=studyBase(CELLS.find(c=>c.id==='LHR-e2-f2-d1'));run.apply(enableConditional);return run;};
const step=(run,f,cancel)=>{if(cancel)cancelStudyOccurrence(run,f);maintainFleet(run);return run.apply({type:'advance'});};

test('repeated real occurrence cancellations expire only post-opt-in rights; timetable stays readable and old terms stay held',()=>{
 for(const enabled of [false,true]){
  const run=fixture();if(enabled)run.apply(enableUtilization);const f=addStudyFlight(run,network),schedule=structuredClone(run.game.tycoon.schedules),old=run.game.slotMarket.conditional.grandfathered;
  for(let i=0;i<14;i++)step(run,f,true);assert(f.keys.every(k=>run.game.slotMarket.rights.player[k]));
  const raw=run.storage.getItem(SAVE_KEY),p=forecast(run.game);assert.equal(run.storage.getItem(SAVE_KEY),raw);assert.equal(p.conditionalSlotReturns.length,enabled?4:0);
  step(run,f,false);assert.deepEqual(run.game.tycoon.schedules,schedule);assert(restoreGame(run.storage.getItem(SAVE_KEY)));
  assert.equal(f.keys.filter(k=>run.game.slotMarket.rights.player[k]).length,enabled?0:4);
  for(const [k,r]of Object.entries(old))assert.deepEqual(run.game.slotMarket.rights.player[k],r);
  if(enabled){assert(p.cancellations.some(c=>c.slot===f.slot&&c.reason.includes('slot')));const clone={type:'add',plane:f.plane,route:schedule.find(x=>x.id===f.slot).route,start:f.start};assert(transition(run.game,clone).error);}
 }
});

test('physical movement receipts renew usage in actual and projected transitions without renewing on cancellation',()=>{
 const run=fixture();run.apply(enableUtilization);const f=addStudyFlight(run,network);
 step(run,f,false);assert(f.keys.every(k=>run.game.slotMarket.utilization.tracked[k].lastUsedDay===1));
 for(let i=0;i<13;i++)step(run,f,true);
 assert.equal(run.game.day,15);assert.equal(forecast(run.game).conditionalSlotReturns.length,0,'current weekday gets its opportunity after only 13 complete idle days');
 const before=run.game,projected=projectedWeekReports(context(before),before.tycoon,false,2);step(run,f,false);assert(f.keys.every(k=>run.game.slotMarket.utilization.tracked[k].lastUsedDay===15));
 assert.deepEqual(run.game.slotMarket.utilization,projected[0].report.slotMarketState.utilization);
 step(run,f,false);assert.deepEqual(run.game.slotMarket.utilization,projected[1].report.slotMarketState.utilization);
});

test('usage opt-in is free, preserves previously purchased conditional rights and adds an exact portable rollback',()=>{
 const run=fixture(),f=addStudyFlight(run,network),before=run.game,raw=run.storage.getItem(SAVE_KEY);
 assert(transition(before,{...enableUtilization,acceptTerms:false}).error);run.apply(enableUtilization);assert.equal(run.game.cash,before.cash);assert.deepEqual(run.game.slotMarket.rights,before.slotMarket.rights);assert.deepEqual(run.game.tycoon,before.tycoon);assert.deepEqual(run.game.slotMarket.utilization.tracked,{});
 for(let i=0;i<16;i++)step(run,f,true);assert(f.keys.every(k=>run.game.slotMarket.rights.player[k]));assert.equal(run.game.slotMarket.utilization.returnedUnits,0);
 const current=run.storage.getItem(SAVE_KEY),file=exportSaveFile(run.storage,current),storage=memoryStorage();assert.equal(file.snapshots,7);const imported=importSaveFile(storage,file.text,null);assert.deepEqual(transition(imported.game,{type:'advance'}),transition(run.game,{type:'advance'}));
 const key=slotUtilizationBackupKey(enableUtilization.migrationId),entry=readSaveEntry(storage,key),restored=restoreSaveEntry(storage,key,entry.stored,current);assert.equal(restored.raw,raw);assert.equal(restored.game.slotMarket.version,2);
 const stripped=structuredClone(run.game);delete stripped.slotMarket.utilization;stripped.slotMarket.version=2;assert.throws(()=>persistGame(run.storage,stripped,current),/điều kiện khai thác/);
 for(const target of [SAVE_KEY,key]){const st=memoryStorage([[SAVE_KEY,raw]]),write=st.setItem;st.setItem=(k,v)=>{if(k===target)throw Error('quota');write(k,v);};assert.throws(()=>persistGame(st,transition(before,enableUtilization).game,raw),/quota/);assert.equal(st.getItem(SAVE_KEY),raw);}
});

test('removing and readding a timetable cannot reset the idle clock; expiry has a seven-day reacquisition wait',()=>{
 const run=fixture();run.apply(enableUtilization);let f=addStudyFlight(run,network);
 for(let i=0;i<7;i++)step(run,f,true);
 cancelStudyOccurrence(run,f);const original=run.game.tycoon.schedules.find(x=>x.id===f.slot);run.apply({type:'remove',id:f.slot});
 for(const key of f.keys){const [airport,hour]=key.split(':');run.apply({type:'slot-market-buy',airport,hour:Number(hour),quantity:1});assert.equal(run.game.slotMarket.utilization.tracked[key].startedDay,1);}
 run.apply({type:'add',plane:original.plane,route:original.route,start:original.start});f={...f,slot:run.game.tycoon.nextId-1};
 for(let i=0;i<8;i++)step(run,f,true);assert.equal(run.game.day,16);assert.equal(run.game.slotMarket.utilization.returnedUnits,4);
 const key=f.keys[0],[airport,hour]=key.split(':'),raw=run.storage.getItem(SAVE_KEY),r=transition(run.game,{type:'slot-market-buy',airport,hour:Number(hour),quantity:1});assert.match(r.error,/ngày 22/);assert.equal(run.storage.getItem(SAVE_KEY),raw);
});

test('an actual Sunday return survives the idle deadline and renews rights on its arrival day',async()=>{
 const {slotFixture}=await import('./fixtures/slot-market.mjs'),{longRunFixture}=await import('./fixtures/long-run.mjs'),{slotRequirements}=await import('../src/slot-market.js');
 const run=longRunFixture({historicalRaw:JSON.stringify(slotFixture({active:true}))});run.apply(enableConditional);run.apply(enableUtilization);const plane=run.game.fleet[1].id;
 run.apply({type:'service-plan',plane,start:4});const g=run.game,state=structuredClone(g.tycoon),action={type:'add',plane,route:3,start:166.25};state.schedules.push({id:state.nextId,plane,route:3,start:166.25});const keys=[];
 for(const [key,n]of slotRequirements(context(g),state))if(n>(g.slotMarket.rights.player[key]?.quantity||0)){assert.equal(n,1);const [airport,hour]=key.split(':');run.apply({type:'slot-market-buy',airport,hour:Number(hour),quantity:1});keys.push(key);}
 run.apply(action);const f={slot:run.game.tycoon.nextId-1,plane,start:166.25};for(let i=0;i<14;i++)step(run,f,i<7);
 assert.equal(run.game.day,15);assert(run.game.legEconomy.rounds.length>0);const stale=keys.filter(k=>run.game.slotMarket.utilization.tracked[k].lastUsedDay===null);assert.equal(stale.length,2);assert.equal(forecast(run.game).conditionalSlotReturns.length,0);
 step(run,f,false);for(const k of stale){assert(run.game.slotMarket.rights.player[k]);assert.equal(run.game.slotMarket.utilization.tracked[k].lastUsedDay,15);}
});
