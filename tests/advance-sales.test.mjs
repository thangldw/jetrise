import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,forecast,Engine} from '../src/game.js';
import {advanceLiability,ADVANCE_CURVE,invalidAdvanceBookings} from '../src/advance-sales.js';
import {projectedWeekReports} from '../src/planner.js';
import {context} from '../src/game.js';

const LEG='01234567-0123-4567-8901-012345678901', ADV='abcdef01-0123-4567-8901-012345678901';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const cents=n=>Math.round(n*100);
function fixture(hour=8,ledger=true){let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[0,1,2,3];for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}
 // One daily departure at 08:00 for the first aircraft on route 0.
 for(let d=0;d<7;d++)s=act(s,{type:'add',plane:s.fleet[0].id,route:0,start:d*24+hour});
 return ledger?act(s,{type:'leg-economy-enable',migrationId:LEG}):s;}
const enable=s=>act(s,{type:'advance-sales-enable',migrationId:ADV});
const day=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);return {...r,game:restoreGame(JSON.stringify(r.game))};};
const totalDeferred=s=>s.legEconomy.deferredCents+advanceLiability(s.legEconomy.advance);

test('opt-in only adds the advance ledger and requires JET-201',()=>{
 let s=createGame();assert(transition(s,{type:'advance-sales-enable',migrationId:ADV}).error.includes('JET-201'));
 s=fixture();const next=enable(s),without=structuredClone(next);delete without.legEconomy.advance;assert.deepEqual(without,s);
 assert.equal(next.legEconomy.advance.bookings.length,0);assert(transition(next,{type:'advance-sales-enable',migrationId:ADV}).error);
 assert.deepEqual(restoreGame(JSON.stringify(next)).legEconomy.advance,next.legEconomy.advance);
});

test('day close sells a bounded share of the next six days, collects cash once and books a liability',()=>{
 const s=enable(fixture()),f=forecast(s),{game,report}=day(s),a=game.legEconomy.advance;
 assert(report.advanceSalesCents>0);assert.equal(a.bookings.length,6);
 assert.deepEqual([...new Set(a.bookings.map(b=>b.day))],[2,3,4,5,6,7]);
 for(const b of a.bookings){assert.equal(b.lots.length,1);assert.deepEqual(b.lots[0].fares,s.tycoon.prices[0]);}
 // Cash difference against a career without advance sales is exactly the sold tickets.
 const plain=day(fixture()).game;assert.equal(cents(game.cash)-cents(plain.cash),report.advanceSalesCents);
 assert.equal(a.liabilityCents,report.advanceSalesCents);equalShare(a);
 assert.equal(cents(f.advanceSales),report.advanceSalesCents);
});
function equalShare(a){const far=a.bookings.find(b=>b.day===7),near=a.bookings.find(b=>b.day===2);assert(far.lots[0].passengers[0]<near.lots[0].passengers[0]);}

test('cumulative sales per round stay within 40% of bookable seats and follow the curve',()=>{
 let g=enable(fixture());const seats=g.tycoon.cabins[g.fleet[0].id];let last=null;
 for(let i=0;i<7;i++){g=day(g).game;last=g.legEconomy.advance.bookings.find(b=>b.day===g.day);}
 const total=[0,1,2].map(k=>last.lots.reduce((n,l)=>n+l.passengers[k],0));
 total.forEach((n,k)=>assert(n<=Math.floor(seats[k]*2*ADVANCE_CURVE[1])));assert.equal(last.lots.length,6);
 assert(last.lots[0].passengers[0]<last.lots[5].passengers[0]);
});

test('departure merges advance passengers at locked fares without charging them twice; deferred reconciles',()=>{
 // Late departures keep their return leg pending past midnight, so merged legs stay inspectable.
 let g=enable(fixture(20));g=day(g).game;const locked=g.tycoon.prices[0];
 const prices=locked.map(n=>Math.min(10000,Math.round(n*1.2)));g=act(g,{type:'prices',route:0,values:prices});
 for(let i=0;i<3;i++){const before=totalDeferred(g),cash=cents(g.cash),{game,report}=day(g);
  assert(report.advanceConsumedCents>0);
  const legs=game.legEconomy.rounds.flatMap(r=>r.legs).filter(l=>l.advance);assert(legs.length);
  // Today's round was sold entirely before the price change, so its advance seats keep the old fare exactly.
  if(i===0)for(const l of legs)assert.equal(l.advance.cents,l.advance.passengers.reduce((n,v,k)=>n+v*locked[k],0)*100);
  // Total ticket liability (per-leg deferred + advance book) changes exactly by the reported delta.
  assert.equal(totalDeferred(game)-before,cents(report.deferredRevenueDelta));
  assert.equal(cents(game.cash)-cash,cents(report.cashDelta));
  g=game;}
 assert.deepEqual(restoreGame(JSON.stringify(g)),g);
});

test('player changes that break sold flights require explicit refund confirmation',()=>{
 let g=day(enable(fixture())).game;const slot=g.legEconomy.advance.bookings[0].slot,owed=g.legEconomy.advance.bookings.find(b=>b.slot===slot).cents;
 const blocked=transition(g,{type:'remove',id:slot});assert(blocked.error);assert.equal(blocked.advanceRefund.cents,owed);assert.equal(blocked.game,g);
 const done=transition(g,{type:'remove',id:slot,refundAdvance:true});assert(!done.error,done.error);
 assert.equal(cents(g.cash)-cents(done.game.cash),owed);assert(!done.game.legEconomy.advance.bookings.some(b=>b.slot===slot));
 assert.equal(done.game.legEconomy.advance.liabilityCents,advanceLiability(done.game.legEconomy.advance));
 assert.deepEqual(invalidAdvanceBookings(done.game,Engine.dailySlots),[]);
});

test('stop keeps sold bookings and sells nothing new; corrupted ledgers are rejected',()=>{
 let g=day(enable(fixture())).game;g=act(g,{type:'advance-sales-stop'});const {report,game}=day(g);assert.equal(report.advanceSalesCents,0);assert(report.advanceConsumedCents>0);
 assert.equal(game.legEconomy.advance.bookings.length,g.legEconomy.advance.bookings.length-1);
 const bad=structuredClone(game);bad.legEconomy.advance.bookings[0].cents+=1;assert.throws(()=>restoreGame(JSON.stringify(bad)));
 const bad2=structuredClone(game);bad2.legEconomy.advance.liabilityCents+=1;assert.throws(()=>restoreGame(JSON.stringify(bad2)));
});

test('a round that does not operate refunds its advance tickets once at settlement',()=>{
 let g=day(enable(fixture())).game;const b=g.legEconomy.advance.bookings.find(b=>b.day===g.day);
 g=structuredClone(g);g.fleet[0].wear=95;const {report,game}=day(g);
 assert.equal(report.advanceRefundCents,b.cents);assert(!game.legEconomy.advance.bookings.some(x=>x.id===b.id));
});

import {persistGame,readAdvanceBackup,rollbackAdvance,advanceBackupKey,readSession,BACKUP_KEY} from '../src/save-store.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i],get length(){return data.size;},data};};

test('activation writes an immutable pre-JET-209 backup; rollback restores the whole earlier career',()=>{
 const store=storage(),base=fixture(8,false),first=persistGame(store,base,null),s=act(base,{type:'leg-economy-enable',migrationId:LEG}),before=persistGame(store,s,first),next=enable(s),raw=persistGame(store,next,before);
 assert.equal(store.getItem(advanceBackupKey(ADV)),before);assert.equal(readAdvanceBackup(store,next).raw,before);
 let g=day(next).game;const saved=persistGame(store,g,raw);assert.equal(store.getItem(advanceBackupKey(ADV)),before);
 const result=rollbackAdvance(store,saved);assert.equal(result.raw,before);assert.equal(readSession(store).raw,before);
 assert.equal(store.getItem(advanceBackupKey(ADV)+':rollback'),saved);assert.equal(store.getItem(BACKUP_KEY),saved);
});

test('activation cannot smuggle other changes or drop the ledger later',()=>{
 const store=storage(),base=fixture(8,false),first=persistGame(store,base,null),s=act(base,{type:'leg-economy-enable',migrationId:LEG}),before=persistGame(store,s,first),next=enable(s);next.cash+=1;
 assert.throws(()=>persistGame(store,next,before),/JET-209/);assert.equal(store.getItem(advanceBackupKey(ADV)),null);
 const ok=enable(s),raw=persistGame(store,ok,before),dropped=structuredClone(ok);delete dropped.legEconomy.advance;
 assert.throws(()=>persistGame(store,dropped,raw),/bán vé trước/);
});

// Review follow-ups (PR #7).
import {longRunFixture} from './fixtures/long-run.mjs';
import {ADVANCE_CAP} from '../src/advance-sales.js';

test('the 40% cap applies to the dated flight, not to a larger aircraft used as basis',()=>{
 let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[0,1,2,3];for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}
 const [big,small]=s.fleet;s=act(s,{type:'add',plane:big.id,route:0,start:8});
 for(let d=1;d<7;d++)s=act(s,{type:'add',plane:small.id,route:0,start:d*24+8});
 s=enable(act(s,{type:'leg-economy-enable',migrationId:LEG}));const g=day(s).game,seats=g.tycoon.cabins[small.id];
 for(const b of g.legEconomy.advance.bookings)soldTotals(b).forEach((n,k)=>assert(n<=Math.floor(seats[k]*2*ADVANCE_CAP),`class ${k}: ${n}`));
});
const soldTotals=b=>[0,1,2].map(k=>b.lots.reduce((n,l)=>n+l.passengers[k],0));

test('reported unearned balance includes the advance book',()=>{
 const {report,game}=day(enable(fixture()));
 assert(game.legEconomy.advance.liabilityCents>0);
 assert.equal(cents(report.deferredRevenue),game.legEconomy.deferredCents+game.legEconomy.advance.liabilityCents);
});

test('planned maintenance over a sold flight requires refund confirmation',()=>{
 const g=day(enable(fixture())).game,b=g.legEconomy.advance.bookings.find(b=>b.day===g.day);
 const blocked=transition(g,{type:'maintenance',plane:g.fleet[0].id,day:g.day,hour:6});
 assert(blocked.error);assert.equal(blocked.advanceRefund.cents,b.cents);
 const done=transition(g,{type:'maintenance',plane:g.fleet[0].id,day:g.day,hour:6,refundAdvance:true});assert(!done.error,done.error);
 assert(!done.game.legEconomy.advance.bookings.some(x=>x.id===b.id));
});

test('customer fare-value ratings use the locked advance fares',()=>{
 const run=longRunFixture({advance:true});run.apply({type:'advance'});
 for(const route of [run.feeder,run.onward])run.apply({type:'prices',route,values:[10000,10000,10000]});
 const f=forecast(run.game),legs=f.legEconomyState.rounds.flatMap(r=>r.legs).filter(l=>l.advance&&l.experience);
 assert(legs.length);
 for(const l of legs)assert(l.experience.fareRatio<5,`fare ratio ${l.experience.fareRatio}`);
});

test('no tickets are sold for a dated flight already blocked by planned maintenance',()=>{
 let s=enable(fixture());s=act(s,{type:'maintenance',plane:s.fleet[0].id,day:3,hour:6});
 const {game,report}=day(s),days=game.legEconomy.advance.bookings.map(b=>b.day);
 assert(!days.includes(3));assert(days.includes(4));assert.equal(report.advanceRefundCents,0);
});

test('the 7-day projection sells advance tickets like the real close',()=>{
 // Projection demand uses forecast mode, so amounts can differ from the real close; the cash effect must be there.
 const s=enable(fixture()),stopped=act(s,{type:'advance-sales-stop'});
 const [first]=projectedWeekReports(context(s),s.tycoon,false),[base]=projectedWeekReports(context(stopped),stopped.tycoon,false);
 assert(first.report.advanceSalesCents>0);assert.equal(base.report.advanceSalesCents,0);
 assert.equal(cents(first.report.cashDelta)-cents(base.report.cashDelta),first.report.advanceSalesCents);
});

test('advance seats are reserved before day-of allocation, so earlier flights cannot resell their demand',()=>{
 let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[0,1,2,3];for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}
 const [a320,e190,other]=s.fleet;for(let d=0;d<7;d++)s=act(s,{type:'add',plane:e190.id,route:0,start:d*24+20});
 let g=day(enable(act(s,{type:'leg-economy-enable',migrationId:LEG}))).game;
 for(const h of [0,6,12])g=act(g,{type:'add',plane:h===6?other.id:a320.id,route:0,start:24+h});
 const sold=g.legEconomy.advance.bookings.find(b=>b.day===g.day).lots.reduce((n,l)=>n.map((v,k)=>v+l.passengers[k]),[0,0,0]);
 const f=forecast(g),rounds=f.operatedRounds.filter(r=>r.route===0),demand=Engine.demand(context(g),g.tycoon,0,g.day);
 for(let k=0;k<3;k++)assert(rounds.reduce((n,r)=>n+r.passengers[k],0)<=Math.max(demand[k],sold[k]),`class ${k}`);
 assert.deepEqual(rounds.find(r=>r.advance).advance.passengers,sold);
});
