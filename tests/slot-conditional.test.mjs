import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_KEY,context,forecast,transition,restoreGame} from '../src/game.js';
import {slotRequirements} from '../src/slot-market.js';
import {slotFixture} from './fixtures/slot-market.mjs';
import {longRunFixture} from './fixtures/long-run.mjs';
import {memoryStorage} from './fixtures/save-manager.mjs';
import {persistGame,exportSaveFile,importSaveFile,slotReservationBackupKey,restoreSaveEntry,readSaveEntry} from '../src/save-store.js';
import {campaign} from '../scripts/production-stability.mjs';
import {runSlotAttack} from '../scripts/experiments/slot-schedule-attacks.mjs';
import {disruptionFixture} from './fixtures/disruption.mjs';
import {enableSlots} from './fixtures/slot-market.mjs';
import {projectedWeekReports} from '../src/planner.js';
const enable={type:'slot-reservation-enable',migrationId:'conditionalterms0123456789',acceptTerms:true};
const fixture=()=>longRunFixture({historicalRaw:JSON.stringify(slotFixture({active:true}))});

test('conditional opt-in preserves paid legacy rights and requires consent and immutable backup',()=>{
 const run=fixture(),before=run.game,raw=run.storage.getItem(SAVE_KEY);
 assert(transition(before,{...enable,acceptTerms:false}).error);assert.equal(run.storage.getItem(SAVE_KEY),raw);
 run.apply(enable);const after=run.game;assert.equal(after.slotMarket.version,2);assert.equal(run.storage.getItem(slotReservationBackupKey(enable.migrationId)),raw);
 for(const k of ['cash','fleet','tycoon','legEconomy','strategy'])assert.deepEqual(after[k],before[k]);
 assert.deepEqual(after.slotMarket.rights,before.slotMarket.rights);assert.deepEqual(after.slotMarket.spent,before.slotMarket.spent);
 assert.deepEqual(restoreGame(JSON.stringify(after)),after);assert(transition(after,enable).error);
 const stripped=structuredClone(after);stripped.slotMarket.version=1;delete stripped.slotMarket.conditional;
 assert.throws(()=>persistGame(run.storage,stripped,run.storage.getItem(SAVE_KEY)),/điều khoản quyền mới/);
});

test('unused new reservations release before AI and daily billing; forecast remains read-only',()=>{
 const run=fixture();run.apply(enable);const baseline=forecast(run.game),cash=run.game.cash;
 run.apply({type:'slot-market-buy',airport:'HAN',hour:12,quantity:1});const raw=run.storage.getItem(SAVE_KEY),before=run.game,p=forecast(before);
 assert.equal(run.game.cash,cash-500);assert.equal(run.storage.getItem(SAVE_KEY),raw);assert.equal(run.game.slotMarket.conditional.returnedUnits,0);
 assert.deepEqual(p.conditionalSlotReturns,[{key:'HAN:12',quantity:1}]);assert.equal(p.slotFee,baseline.slotFee);
 const projected=projectedWeekReports(context(before),before.tycoon,false,1)[0].report;assert.deepEqual(projected.sharedSlots,p.sharedSlots);
 const actual=run.apply({type:'advance'});assert.deepEqual(actual.report.sharedSlots,p.sharedSlots);assert.equal(run.game.slotMarket.rights.player['HAN:12'],undefined);assert.equal(run.game.slotMarket.conditional.returnedUnits,1);
 assert.equal(run.game.slotMarket.spent.player.daily-before.slotMarket.spent.player.daily,baseline.slotFee);
 assert.equal(run.game.cash,before.cash+p.cashDelta);
});

test('actual edit/revert returns new idle rights immediately and leaves old schedules and rights intact',()=>{
 const run=campaign({hub:'LHR',feeder:'EDI',onward:'CDG'},'required',{economy:2,fares:[200,200]});run.apply(enable);const before=run.game;
 const attack=runSlotAttack(run,'edit-revert',{hub:'LHR',feeder:'EDI',onward:'CDG'});
 assert.equal(attack.completed,3);assert.equal(attack.signing,6000);assert.equal(run.game.slotMarket.conditional.returnedUnits,12);
 assert.deepEqual(run.game.slotMarket.rights.player,before.slotMarket.rights.player);assert.deepEqual(run.game.tycoon.schedules,before.tycoon.schedules);assert.deepEqual(run.game.slotMarket.conditional.newRights,{});
});

test('removing a Sunday template keeps conditional rights for its airborne return until settlement',()=>{
 const run=fixture();run.apply(enable);const g=run.game,action={type:'add',plane:g.fleet[1].id,route:3,start:166.25},trial=structuredClone(g.tycoon);trial.schedules.push({id:trial.nextId,...{plane:action.plane,route:action.route,start:action.start}});
 for(const [key,n] of slotRequirements(context(g),trial)){if(n>(run.game.slotMarket.rights.player[key]?.quantity||0)){const [airport,hour]=key.split(':');assert.equal(n,1);run.apply({type:'slot-market-buy',airport,hour:Number(hour),quantity:n});}}
 run.apply(action);const id=run.game.tycoon.nextId-1;for(let i=0;i<7;i++)run.apply({type:'advance'});assert(run.game.legEconomy.rounds.length);
 run.apply({type:'remove',id});assert.equal(Object.keys(run.game.slotMarket.conditional.newRights).length,2);assert.equal(run.game.slotMarket.conditional.returnedUnits,2);
 run.apply({type:'advance'});assert.equal(run.game.legEconomy.rounds.length,0);assert.equal(forecast(run.game).conditionalSlotReturns.length,2);
 run.apply({type:'advance'});assert.equal(Object.keys(run.game.slotMarket.conditional.newRights).length,0);assert.equal(run.game.slotMarket.conditional.returnedUnits,4);
});

test('portable package contains opt-in backup and whole-career restore returns exact pre-opt-in bytes',()=>{
 const run=campaign({hub:'HAN',feeder:'DAD',onward:'NRT'},'required'),raw=run.storage.getItem(SAVE_KEY),existing=new Map(run.storage.data);run.apply(enable);run.apply({type:'slot-market-buy',airport:'HAN',hour:12,quantity:1});
 const current=run.storage.getItem(SAVE_KEY),file=exportSaveFile(run.storage,current),target=memoryStorage(),imported=importSaveFile(target,file.text,null);assert.equal(file.snapshots,6);assert.equal(target.getItem(SAVE_KEY),current);assert.deepEqual(transition(imported.game,{type:'advance'}),transition(run.game,{type:'advance'}));
 for(const [key,bytes] of existing)if(key!==SAVE_KEY&&!key.endsWith(':backup'))assert.equal(run.storage.getItem(key),bytes);
 const entry=readSaveEntry(target,slotReservationBackupKey(enable.migrationId)),restored=restoreSaveEntry(target,entry.key,entry.stored,current);assert.equal(restored.raw,raw);assert.equal(restored.game.slotMarket.version,1);assert.equal(restored.game.slotMarket.conditional,undefined);
});

test('quota failure or corrupt conditional provenance never replaces old main save',()=>{
 const raw=fixture().storage.getItem(SAVE_KEY),next=transition(restoreGame(raw),enable).game;
 for(const badKey of [SAVE_KEY,slotReservationBackupKey(enable.migrationId)]){const storage=memoryStorage([[SAVE_KEY,raw]]),write=storage.setItem;storage.setItem=(k,v)=>{if(k===badKey)throw Error('quota');write(k,v);};assert.throws(()=>persistGame(storage,next,raw),/quota/);assert.equal(storage.getItem(SAVE_KEY),raw);}
 for(const mutate of [s=>delete s.slotMarket.conditional,s=>s.slotMarket.version=1,s=>s.slotMarket.conditional.protected={},s=>s.slotMarket.conditional.newRights['HAN:12']={quantity:1,startedDay:1,unlockDay:8}]){const bad=structuredClone(next);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});


test('opting in during sold overnight travel never releases existing rights or cancels promised tickets',()=>{
 let g=disruptionFixture();g=transition(g,{type:'strategy-enable'}).game;g=enableSlots(g);
 const run=longRunFixture({historicalRaw:JSON.stringify(g)});run.apply(enable);const before=run.game,raw=run.storage.getItem(SAVE_KEY),ticket=before.legEconomy.overnight.journeys[0];assert(ticket);
 assert.throws(()=>run.apply({type:'remove',id:ticket.legs[1].slot}));assert.equal(run.storage.getItem(SAVE_KEY),raw);
 assert.deepEqual(run.game.slotMarket.rights.player,before.slotMarket.rights.player);assert.equal(run.game.slotMarket.conditional.returnedUnits,0);
 const r=forecast(run.game);assert.deepEqual(r.conditionalSlotReturns,[]);assert.deepEqual(run.game.legEconomy.overnight.journeys,before.legEconomy.overnight.journeys);
});
