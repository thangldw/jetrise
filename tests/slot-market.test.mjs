import {legacySlotRights} from './fixtures/legacy-slot-rights.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,context,forecast,transition,restoreGame,SAVE_KEY,Engine} from '../src/game.js';
import {SLOT_TERMS,slotRequirements,quoteSlotActivation,sharedSlotDaily,sharedSlotConflict} from '../src/slot-market.js';
import {plannerBasis,projectedWeekReports,applyProposal} from '../src/planner.js';
import {persistGame,slotMarketBackupKey,readSlotMarketBackup,rollbackSlotMarket,BACKUP_KEY} from '../src/save-store.js';
import {previewDisruption} from '../src/disruption-recovery.js';
import {disruptionFixture} from './fixtures/disruption.mjs';
import {slotFixture,enableSlots,act,SLOT_AIRPORTS} from './fixtures/slot-market.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function memory(raw){const data=new Map([[SAVE_KEY,raw]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
function purchaseNeeds(s,trial){for(const [key,quantity] of slotRequirements(context(trial))){const [airport,hour]=key.split(':');if(quantity>(s.slotMarket.rights.player[key]?.quantity||0))s=act(s,{type:'slot-market-buy',airport,hour:Number(hour),quantity});}return s;}

test('shared slots are opt-in, require live ledger and AI, and preserve legacy uniform rights',()=>{
 const old=createGame(),restored=restoreGame(JSON.stringify(old));assert.equal(restored.slotMarket,undefined);
 assert(transition(old,{type:'slot-market-enable',airports:SLOT_AIRPORTS,migrationId:'abcdefghijklmnop',quotedFee:0}).error);
 let s=slotFixture();s=act(s,{type:'slot-contract',hub:'HAN',capacity:4});const before=JSON.stringify(s);
 assert.throws(()=>quoteSlotActivation(context(s),SLOT_AIRPORTS),/gói slot cũ/);assert.equal(JSON.stringify(s),before);assert.deepEqual(restoreGame(before),s);
});
test('activation quotes exact dated and recurring movements and changes only cash and optional market',()=>{
 const s=slotFixture(),before=structuredClone(s),q=quoteSlotActivation(context(s),SLOT_AIRPORTS),n=enableSlots(s);
 assert(q.units===4);assert.equal(q.needs.get('DAD:7'),2);assert.equal(q.fee,2000);assert.equal(sharedSlotDaily(n),80);
 near(n.cash,s.cash-q.fee);assert.deepEqual(n.tycoon,s.tycoon);assert.deepEqual(n.fleet,s.fleet);assert.deepEqual(n.legEconomy,s.legEconomy);assert.deepEqual(n.strategy,s.strategy);assert.deepEqual(s,before);assert.deepEqual(restoreGame(JSON.stringify(n)),n);
 const strip=structuredClone(n);delete strip.slotMarket;strip.cash=s.cash;assert.equal(strip.hq.ledger[0].amount,-q.fee);strip.hq.ledger=s.hq.ledger;assert.deepEqual(strip,s);
 for(const airports of [['HAN','DAD','DAD'],['DAD','NRT','SGN'],['HAN','DAD'],['HAN','DAD','XXX']])assert.throws(()=>quoteSlotActivation(context(s),airports));
 const stale=transition(s,{type:'slot-market-enable',airports:SLOT_AIRPORTS,migrationId:'abcdefghijklmnop',quotedFee:q.fee+1});assert(stale.error);assert.equal(stale.game,s);
});
test('overfull migration and purchases reject atomically before any charge',()=>{
 const s=slotFixture();s.tycoon.schedules=[...s.tycoon.schedules,...s.fleet.slice(1).map((p,i)=>({id:i+2,plane:p.id,route:3,start:6}))];s.tycoon.nextId=4;
 // Three rotations each require an arrival and departure at DAD within one hour.
 s.fleet.forEach(p=>p.type=s.fleet[0].type);assert.throws(()=>quoteSlotActivation(context(s),SLOT_AIRPORTS),/vượt công suất/);
 const poor=slotFixture();poor.cash=1;assert.throws(()=>quoteSlotActivation(context(poor),SLOT_AIRPORTS),/Không đủ tiền/);
 const active=slotFixture({active:true}),before=JSON.stringify(active);assert(transition(active,{type:'slot-market-buy',airport:'DAD',hour:7,quantity:0}).error);assert.equal(JSON.stringify(active),before);
 for(const a of [{airport:'XXX',hour:0,quantity:1},{airport:'HAN',hour:168,quantity:1},{airport:'HAN',hour:1.5,quantity:1},{airport:'HAN',hour:10,quantity:5}])assert(transition(active,{type:'slot-market-buy',...a}).error);
});
test('AI buys from the same finite pool, shifts time, spends only its own cash and records actual use',()=>{
 const s=slotFixture({active:true}),before=structuredClone(s),f=forecast(s);assert.deepEqual(s,before);assert.deepEqual(f.sharedSlots,forecast(s).sharedSlots);
 assert(f.sharedSlots.rivals.every(r=>r.rotations===1));assert.equal(new Set(f.sharedSlots.rivals.map(r=>r.hour)).size,2);
 for(const m of f.sharedSlots.movements)assert(m.player+m.swift+m.aurelia<=SLOT_TERMS.capacity);
 for(const [i,r] of f.competition.rivals.entries()){assert(r.slotSigning>0);assert(r.slotDaily>0);near(r.cash,s.strategy.rivals[i].cash+r.profit-r.slotSigning-r.depositPaid+r.depositRefund);}
 const n=act(s,{type:'advance'});near(n.cash,s.cash+f.cashDelta);assert.equal(n.slotMarket.spent.player.signing,2000);assert.equal(n.slotMarket.spent.player.daily,80);assert.deepEqual(n.slotMarket,f.slotMarketState);assert.deepEqual(restoreGame(JSON.stringify(n)),n);
 const blocked=transition(n,{type:'slot-market-buy',airport:'DAD',hour:7,quantity:4});assert.match(blocked.error,/AI đang sở hữu/);assert.equal(blocked.game,n);
});
test('manual, bulk and planner edits need both endpoint rights and never buy them implicitly',()=>{
 let s=slotFixture({active:true});const a={type:'add-weekly',plane:s.fleet[1].id,route:3,days:[1,2],at:6.25},failed=transition(s,a);assert(failed.error);assert.equal(failed.game,s);
 const trial=structuredClone(s);trial.tycoon.schedules.push(...[1,2].map((d,i)=>({id:2+i,plane:s.fleet[1].id,route:3,start:d*24+6.25})));trial.tycoon.nextId=4;
 s=purchaseNeeds(s,trial);const n=act(s,a);assert.equal(n.tycoon.schedules.length,3);assert.deepEqual(n.slotMarket,s.slotMarket);
 assert(Engine.slotError(context(s),s.tycoon,s.fleet[1].id,3,80));
 const plan={basis:plannerBasis(context(s),s.tycoon),state:structuredClone(s.tycoon)};
 const changed=act(s,{type:'slot-market-buy',airport:'HAN',hour:90,quantity:1});assert.notEqual(plannerBasis(context(changed),changed.tycoon),plan.basis);assert.throws(()=>applyProposal(context(changed),changed.tycoon,plan));
});
test('seven-day projection carries AI ownership, cash and fees without mutating the source',()=>{
 let s=act(slotFixture({active:true}),{type:'market-research',id:'event-0'});const before=structuredClone(s),projection=projectedWeekReports(context(s),s.tycoon,false,8);assert.deepEqual(s,before);
 for(const expected of projection){const f=forecast(s);assert.deepEqual(f.competition,expected.report.competition);assert.deepEqual(f.sharedSlots,expected.report.sharedSlots);assert.deepEqual(f.slotMarketState,expected.report.slotMarketState);s=act(s,{type:'advance'});s=restoreGame(JSON.stringify(s));}
 assert.equal(s.slotMarket.spent.player.daily,8*80);assert.equal(s.tycoon.schedules.length,1);
});
test('commitment ending never expires rights; returning unused rights stops fees and keeps paid history',()=>{
 let s=slotFixture({active:true});s=legacySlotRights(s,[['HAN',130,2]]);const initial=s.cash;
 assert(transition(s,{type:'slot-market-buy',airport:'HAN',hour:130,quantity:0}).error);
 for(let i=0;i<7;i++)s=act(s,{type:'advance'});
 assert.equal(s.slotMarket.rights.player['HAN:130'].quantity,2);assert.equal(s.slotMarket.rights.player['HAN:130'].unlockDay,8);
 assert(transition(s,{type:'slot-market-buy',airport:'HAN',hour:6,quantity:0}).error);
 const daily=sharedSlotDaily(s),paid=structuredClone(s.slotMarket.spent.player),cash=s.cash;s=act(s,{type:'slot-market-buy',airport:'HAN',hour:130,quantity:0});assert.equal(s.cash,cash);assert.deepEqual(s.slotMarket.spent.player,paid);assert.equal(sharedSlotDaily(s),daily-40);assert.equal(s.slotMarket.rights.player['HAN:130'],undefined);assert(initial>0);
});
test('Sunday arrivals retain rights after template removal and are counted only on actual dates',()=>{
 let s=slotFixture({sunday:true});s.day=1;s.strategy.startDay=1;s.legEconomy.enabledDay=1;s.legEconomy.through=0;s=enableSlots(s);for(let i=0;i<6;i++)s=act(s,{type:'advance'});const f=forecast(s);assert(f.sharedSlots.movements.every(m=>m.hour<168));s=act(s,{type:'advance'});assert(s.legEconomy.rounds.length);
 const slots=structuredClone(s.slotMarket);s=act(s,{type:'remove',id:1});assert.deepEqual(s.slotMarket,slots);
 const needs=slotRequirements(context(s));assert(needs.size>0);assert([...needs.keys()].some(k=>k==='HAN:1'));
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const refusal=transition(s,{type:'slot-market-buy',airport:'HAN',hour:1,quantity:0});assert.match(refusal.error,/chặng đã cam kết/);assert.equal(refusal.game,s);
 const next=forecast(s);assert.equal(next.sharedSlots.movements.reduce((n,m)=>n+m.player,0),1);s=act(s,{type:'advance'});assert.equal(s.legEconomy.rounds.length,0);assert.equal(slotRequirements(context(s)).size,0);
});
test('recovery delays require newly occupied hours before charging and preserve sold tickets',()=>{
 let s=disruptionFixture();s=act(s,{type:'strategy-enable'});s=enableSlots(s);const before=structuredClone(s),request={leg:s.legEconomy.rounds[0].legs[1].id,kind:'weather',delay:3,mode:'wait'};
 assert.throws(()=>previewDisruption(s,context(s),request),/slot/);assert.deepEqual(s,before);
 // A grandfathered career already owns these recovery hours; sold tickets remain unchanged.
 s=legacySlotRights(s,SLOT_AIRPORTS.flatMap(airport=>Array.from({length:20},(_,i)=>[airport,24+i,4])));
 const preview=previewDisruption(s,context(s),request),oldCash=s.cash;s=act(s,{type:'disruption-apply',preview});assert(s.cash<oldCash);assert.deepEqual(s.legEconomy.overnight.journeys.map(j=>j.fareCents),before.legEconomy.overnight.journeys.map(j=>j.fareCents));assert.equal(sharedSlotConflict(context(s),s.tycoon),'');assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('sold overnight itineraries cannot lose required rights even after the commitment',()=>{
 let s=slotFixture({sunday:true});s.day=1;s.strategy.startDay=1;s.legEconomy.enabledDay=1;s.legEconomy.through=0;
 s=act(s,{type:'add',plane:s.fleet[2].id,route:2,start:2});s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=360;
 s=act(s,{type:'overnight-enable',migrationId:'heldslots0123456789012345'});s=enableSlots(s);for(let i=0;i<7;i++)s=act(s,{type:'advance'});assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const held=s.legEconomy.overnight.journeys[0].legs[1],hour=Math.floor(held.departure)%168;
 const result=transition(s,{type:'slot-market-buy',airport:held.from,hour,quantity:0});assert(result.error);assert.equal(result.game,s);
});
test('AI cannot exceed capacity with leased growth and forfeits rights when unable to fund upkeep',()=>{
 let s=slotFixture({active:true});s=act(s,{type:'rival-growth'});for(const r of s.strategy.rivals)r.leases=[{remaining:10,deposit:500000},{remaining:10,deposit:500000}];
 const f=forecast(s);for(const m of f.sharedSlots.movements)assert(m.player+m.swift+m.aurelia<=4);assert(f.sharedSlots.rivals.every(r=>r.rotations<3));
 s=act(s,{type:'advance'});s.strategy.growth=false;for(const r of s.strategy.rivals){delete r.leases;r.cash=0;}
 const poor=forecast(s);assert(poor.sharedSlots.rivals.every(r=>r.forfeited&&r.rotations===0&&r.daily===0));assert(poor.competition.rivals.every(r=>r.cash===0));assert.deepEqual(poor.slotMarketState.rights.swift,{});
});
test('restore rejects malformed rights, foreign ownership, over-allocation and changed cursors',()=>{
 const s=slotFixture({active:true});for(const mutate of [n=>n.slotMarket.rights.player['HAN:6'].quantity=5,n=>n.slotMarket.rights.player['HAN:6'].unlockDay++,n=>n.slotMarket.rights.player['HAN:6'].startedDay=20,n=>n.slotMarket.rights.swift['HAN:6']={quantity:4,startedDay:1,unlockDay:8},n=>n.slotMarket.airports[1]='HAN',n=>n.slotMarket.rights.third={},n=>delete n.strategy,n=>delete n.legEconomy,n=>n.slotMarket.spent.player.daily=-1,n=>delete n.slotMarket.rights.player['DAD:7']]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});
test('actual cancellation frees movements but leaves recurring rights, and malformed receipts fail restore',()=>{
 let s=slotFixture({active:true});s=act(s,{type:'recover-flight',slot:1,day:1,mode:'cancel'});
 const f=forecast(s);assert.equal(f.sharedSlots.movements.reduce((n,m)=>n+m.player,0),0);assert.equal(sharedSlotDaily(s),80);assert.equal(s.slotMarket.rights.player['DAD:7'].quantity,2);
 s=act(s,{type:'advance'});assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 for(const mutate of [r=>r.movements[0].player=5,r=>r.rivals[0].signing=-1,r=>r.rivals[1].id='third',r=>r.movements.push({...r.movements[0]}),r=>r.movements=null]){const bad=structuredClone(s);mutate(bad.tycoon.history[0].sharedSlots);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});
test('renewed weekly AI rights have no second signing charge and no free capacity from a template cancellation',()=>{
 let s=slotFixture({active:true});s=act(s,{type:'market-research',id:'event-0'});
 for(let i=0;i<7;i++)s=act(s,{type:'advance'});
 const f=forecast(s);assert(f.sharedSlots.rivals.every(r=>r.signing===0));assert(f.sharedSlots.rivals.every(r=>r.daily>0));
 for(const row of f.sharedSlots.movements)assert(row.player+row.swift+row.aurelia<=4);
});
test('migration backup stores exact bytes before payment; reload and rollback restore the whole career',()=>{
 const s=slotFixture(),raw=JSON.stringify(s,null,2),storage=memory(raw),n=enableSlots(s);let next=persistGame(storage,n,raw);
 assert.equal(storage.getItem(slotMarketBackupKey(n.slotMarket.migrationId)),raw);assert.equal(readSlotMarketBackup(storage,n).raw,raw);
 const closed=act(n,{type:'advance'});next=persistGame(storage,closed,next);assert.equal(storage.getItem(slotMarketBackupKey(n.slotMarket.migrationId)),raw);assert.equal(storage.getItem(BACKUP_KEY),JSON.stringify(n));
 const rolled=rollbackSlotMarket(storage,next);assert.equal(rolled.raw,raw);assert.deepEqual(rolled.game,s);assert.equal(storage.getItem(slotMarketBackupKey(n.slotMarket.migrationId)+':rollback'),next);
});
test('quota, readback, stale and tampered activation failures leave old main bytes intact',()=>{
 const s=slotFixture(),raw=JSON.stringify(s),n=enableSlots(s),key=slotMarketBackupKey(n.slotMarket.migrationId);
 for(const target of [key,SAVE_KEY]){const storage=memory(raw),write=storage.setItem;storage.setItem=(k,v)=>{if(k===target)throw Error('quota');write(k,v);};assert.throws(()=>persistGame(storage,n,raw));assert.equal(storage.getItem(SAVE_KEY),raw);}
 const storage=memory(raw);storage.setItem=(k,v)=>{if(k!==key)storage.data.set(k,v);};assert.throws(()=>persistGame(storage,n,raw),/xác minh/);assert.equal(storage.getItem(SAVE_KEY),raw);
 const stale=memory(raw+' ');assert.throws(()=>persistGame(stale,n,raw),/tab khác/);assert.equal(stale.getItem(key),null);
 const corrupt=structuredClone(n);corrupt.cash++;const clean=memory(raw);assert.throws(()=>persistGame(clean,corrupt,raw),/JET-204/);assert.equal(clean.getItem(SAVE_KEY),raw);assert.equal(clean.getItem(key),null);
});
test('rollback archive failure preserves live branch and missing/corrupt snapshots never reset a career',()=>{
 const s=slotFixture(),raw=JSON.stringify(s),storage=memory(raw),n=enableSlots(s),key=slotMarketBackupKey(n.slotMarket.migrationId),live=persistGame(storage,n,raw),write=storage.setItem;
 storage.setItem=(k,v)=>{if(k===key+':rollback')throw Error('quota');write(k,v);};assert.throws(()=>rollbackSlotMarket(storage,live));assert.equal(storage.getItem(SAVE_KEY),live);
 for(const value of [null,'bad',live]){if(value===null)storage.data.delete(key);else storage.data.set(key,value);assert.throws(()=>rollbackSlotMarket(storage,live));assert.equal(storage.getItem(SAVE_KEY),live);}
 const removed=structuredClone(n);delete removed.slotMarket;assert.throws(()=>persistGame(storage,removed,live),/Không được xóa/);
});
