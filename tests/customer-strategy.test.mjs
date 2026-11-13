import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,transition,forecast,context,SAVE_KEY} from '../src/game.js';
import {customerFixture,enableCustomers,act} from './fixtures/customer-strategy.mjs';
import {customerPreferences,customerOutcome,customerGoals,settleCustomers} from '../src/customer-strategy.js';
import {projectedWeekReports,plannerBasis} from '../src/planner.js';
import {previewDisruption} from '../src/disruption-recovery.js';
import {persistGame,readCustomerBackup,rollbackCustomers,customerBackupKey} from '../src/save-store.js';
import {compareCustomerStrategies} from '../src/customer-strategy-study.js';
const sum=xs=>xs.reduce((a,b)=>a+b,0),approx=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const close=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);r.game=restoreGame(JSON.stringify(r.game));return r;};
const memory=s=>{const data=new Map([[SAVE_KEY,JSON.stringify(s)]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const bridge=r=>approx(r.profit+r.fuelCost+r.co2Cost-r.fuelPurchase-r.co2Purchase+r.deferredRevenueDelta-r.prepaidNonfuelDelta+r.maintenancePrepaid+r.prepaidRent-r.principal+r.leaseRefunds+(r.disruptionPrepaid||0),r.cashDelta);
const stopSales=s=>act(s,{type:'connection-program',enabled:false,minimum:60,maximum:1440});
const disrupted=(s,mode)=>act(s,{type:'disruption-apply',preview:previewDisruption(s,context(s),{leg:s.legEconomy.overnight.journeys[0].legs[0].id,kind:'weather',delay:3,mode})});

test('legacy restore and old pending tickets stay untracked; activation is opt-in with neutral weights',()=>{
 const legacy=createGame(),bytes=JSON.stringify(legacy);assert.equal(restoreGame(bytes).customerStrategy,undefined);assert.equal(JSON.stringify(legacy),bytes);
 assert(transition(legacy,{type:'customer-enable',objective:'hub',migrationId:'customer-test-migration'}).error);
 const old=close(customerFixture({active:false,overnight:true})).game,active=enableCustomers(old);assert(active.legEconomy.overnight.journeys.length);assert(active.legEconomy.overnight.journeys.every(j=>!j.experience));assert.deepEqual(active.legEconomy,old.legEconomy);assert.equal(active.cash,old.cash-20000);assert.deepEqual(customerPreferences(active),[1,1,1]);
 assert.equal(close(stopSales(active)).report.customers.throughCompleted,0);
});

test('forecasts are pure, direct segment counts reconcile with arrivals and fee/cash bridge once',()=>{
 const s=customerFixture(),raw=JSON.stringify(s),r=forecast(s);assert.deepEqual(forecast(s),r);assert.equal(JSON.stringify(s),raw);
 assert.equal(sum(r.customers.segments),r.customers.count);assert.equal(r.customers.count,r.pax-r.contractPax);assert.equal(r.customers.fee,500);bridge(r);
 const result=close(s);assert.deepEqual(result.game.customerStrategy,r.customerStrategyState);assert.equal(result.game.cash,s.cash+r.cashDelta);assert(!('customerStrategyState' in result.report));
 assert.throws(()=>settleCustomers(context(result.game),r),/cursor/);
});

test('through passengers count once at terminal arrival, including Sunday continuation',()=>{
 for(const sunday of [false,true]){let s=customerFixture({overnight:true,sunday});const day1=close(s);s=stopSales(day1.game);const j=s.legEconomy.overnight.journeys[0];assert.equal(day1.report.customers.throughCompleted,0);assert(j.experience);assert.equal(sum(j.experience.counts),j.pax);
 const r=close(s);assert.equal(r.report.customers.throughCompleted,j.pax);assert.equal(r.report.customers.count,r.report.pax-r.report.contractPax-j.pax);bridge(r.report);
 assert.equal(close(r.game).report.customers.throughCompleted,0);
 }
});

test('sold experience stays immutable under fares, cabin service changes and rebooking',()=>{
 let s=stopSales(close(customerFixture({overnight:true})).game),j=s.legEconomy.overnight.journeys[0],frozen=structuredClone(j.experience);
 s=act(s,{type:'prices',route:2,values:[300,600,1000]});s=act(s,{type:'service',level:1});assert.deepEqual(s.legEconomy.overnight.journeys[0].experience,frozen);
 const next=disrupted(s,'rebook'),ticket=next.legEconomy.overnight.journeys[0];assert(ticket.rebookedFrom);assert.deepEqual(ticket.experience,frozen);assert(ticket.legs[1].arrival>frozen.promisedArrival);
 const r=close(next);assert.equal(r.report.customers.throughCompleted,j.pax);assert(r.report.customers.onTime<r.report.customers.completed);bridge(r.report);
});

test('waiting keeps promised arrival and lowers satisfaction against an on-time replay',()=>{
 const s=stopSales(close(customerFixture({overnight:true})).game),j=s.legEconomy.overnight.journeys[0],next=disrupted(s,'wait');
 assert.equal(next.legEconomy.overnight.journeys[0].experience.promisedArrival,j.experience.promisedArrival);
 const good=close(s).report,bad=close(next).report;assert(bad.customers.onTime<good.customers.onTime);assert(sum(bad.customers.after)<sum(good.customers.after));assert.equal(bad.customers.failed,0);bridge(bad);
});

test('voluntary refund and missed connection settle failure exactly once, including pending first arrival',()=>{
 for(const mode of ['refund','operate']){
  let s=stopSales(close(customerFixture({overnight:true})).game);const j=s.legEconomy.overnight.journeys[0];s=mode==='refund'?act(s,{type:'journey-refund',id:j.id}):disrupted(s,mode);
  assert.equal(s.customerStrategy.pending.length,0); // Feeder is still airborne.
  const r=close(s);assert.equal(r.report.customers.failed,j.pax);assert.equal(r.report.customers.throughCompleted,0);assert.equal(close(r.game).report.customers.failed,0);bridge(r.report);
 }
});

test('terminal pre-close refund queues once and survives reload without losing a customer',()=>{
 let s=customerFixture({overnight:true});s.tycoon.schedules.find(x=>x.route===2&&x.start===26).start=50;s.tycoon.schedules.find(x=>x.route===2&&x.start===40).start=64;
 // First arrival on day 2, onward departure on day 3; refund is terminal before day close.
 s.tycoon.schedules.find(x=>x.route===3).start=44;s=close(s).game;s=close(s).game;s=stopSales(s);
 const j=s.legEconomy.overnight.journeys[0];assert(j);assert.equal(j.legs[0].status,'arrived');
 s=act(s,{type:'journey-refund',id:j.id});assert.equal(s.customerStrategy.pending.length,1);s=restoreGame(JSON.stringify(s));const r=close(s);assert.equal(r.report.customers.failed,j.pax);assert.equal(close(r.game).report.customers.failed,0);
});

test('loyalty changes competitive allocation without changing demand or capacity; goals add no bonus',()=>{
 const s=customerFixture(),low=structuredClone(s),high=structuredClone(s);low.customerStrategy.scores=[-1,-1,-1];high.customerStrategy.scores=[1,1,1];
 const a=forecast(low),b=forecast(high);assert.deepEqual(a.competition.markets.map(m=>m.potential),b.competition.markets.map(m=>m.potential));assert(b.pax>a.pax);
 for(const r of [a,b])for(const m of r.competition.markets){assert.equal(m.player+m.swift+m.aurelia+m.outside,m.potential);for(const seg of m.segments)assert.equal(seg.player+seg.swift+seg.aurelia+seg.outside,seg.total);}
 const alt=structuredClone(s);alt.customerStrategy.objective='budget';const x=forecast(s),y=forecast(alt);assert.equal(x.revenue,y.revenue);assert.equal(x.cashDelta,y.cashDelta);assert.deepEqual(x.customers.after,y.customers.after);
 assert.deepEqual(customerPreferences(high),[1.15,1.15,1.15]);assert.deepEqual(customerPreferences(low),[.85,.85,.85]);
});

test('commitment, switching, pause and restart preserve points and cannot reset history',()=>{
 let s=customerFixture();for(const type of ['customer-change','customer-pause'])assert.match(transition(s,{type,objective:'budget'}).error,/Cam kết/);
 for(let i=0;i<7;i++)s=close(s).game;const old=structuredClone(s.customerStrategy),changed=act(s,{type:'customer-change',objective:'budget'});assert.equal(changed.cash,s.cash-10000);assert.deepEqual(changed.customerStrategy.scores,old.scores);assert.deepEqual(changed.customerStrategy.history,old.history);
 let paused=act(s,{type:'customer-pause'});assert.deepEqual(customerPreferences(paused),[1,1,1]);assert.equal(forecast(paused).customers.fee,0);assert.match(transition(paused,{type:'customer-resume'}).error,/Cam kết/);
 for(let i=0;i<7;i++)paused=close(paused).game;const resumed=act(paused,{type:'customer-resume'});assert.equal(resumed.cash,paused.cash-20000);assert.deepEqual(resumed.customerStrategy.scores,paused.customerStrategy.scores);assert.equal(resumed.customerStrategy.migrationId,old.migrationId);
});

test('seven-day projection propagates loyalty and matches actual known-market settlement',()=>{
 let s=customerFixture({overnight:true});
 // The existing market research transition makes the current week's event known to projections.
 const researched=transition(s,{type:'market-research',id:'event-0'});if(!researched.error)s=researched.game;
 const raw=JSON.stringify(s),projected=projectedWeekReports(context(s),s.tycoon,false);assert.equal(JSON.stringify(s),raw);
 for(const {report} of projected){const r=close(s);assert.deepEqual(report.customers,r.report.customers);s=r.game;}
 const altered=structuredClone(s);altered.customerStrategy.scores[0]+=.001;assert.notEqual(plannerBasis(context(s),s.tycoon),plannerBasis(context(altered),altered.tycoon));
});

test('bounded history, empty-day decay and objective samples are based on completed operations',()=>{
 let s=customerFixture();for(let i=0;i<29;i++)s=close(s).game;assert.equal(s.customerStrategy.history.length,28);const g=customerGoals(s);assert.equal(g.days,7);assert.equal(g.count,sum(s.customerStrategy.history.slice(0,7).map(r=>r.count)));
 assert(s.customerStrategy.scores.every(n=>n>=-1&&n<=1));const r=forecast(s);if(!r.customers.count)r.customers.after.forEach((v,i)=>approx(v,s.customerStrategy.scores[i]*.99));
});

test('same-capital deterministic strategy replays are pure and respect existing lock/cash rules',()=>{
 const s=customerFixture({overnight:true}),raw=JSON.stringify(s),r=compareCustomerStrategies(s);assert.equal(JSON.stringify(s),raw);assert.deepEqual(compareCustomerStrategies(s),r);assert(r.every(x=>x.days===7&&!x.error));assert(r.every(x=>x.setupCost>=0));
 const locked=act(s,{type:'positioning',key:'business'}),results=compareCustomerStrategies(locked);assert(results.find(r=>r.id==='budget').error);assert.equal(results.find(r=>r.id==='business').days,7);
 const poor=structuredClone(s);poor.cash=0;assert(compareCustomerStrategies(poor).every(r=>r.error));
});

test('strict restore rejects corrupted cursors, counters, identity and sold experience',()=>{
 const s=close(customerFixture({overnight:true})).game;
 for(const mutate of [x=>x.customerStrategy.through--,x=>x.customerStrategy.samples[0]=-1,x=>x.customerStrategy.scores[0]=1.1,x=>x.customerStrategy.history[0].completed++,x=>x.customerStrategy.history.push(x.customerStrategy.history[0]),x=>x.customerStrategy.migrationId='bad',x=>x.legEconomy.overnight.journeys[0].experience.counts[0]++,x=>x.legEconomy.rounds[0].legs[1].experience.quality[0]=NaN,x=>delete x.customerStrategy]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)),/customer/i);}
});

test('migration saves exact old bytes before fee and rollback archives the entire current branch',()=>{
 const old=customerFixture({active:false}),storage=memory(old),raw=storage.getItem(SAVE_KEY),next=enableCustomers(old);let saved=persistGame(storage,next,raw);assert.equal(readCustomerBackup(storage,next).raw,raw);assert.equal(storage.getItem(customerBackupKey(next.customerStrategy.migrationId)),raw);
 const advanced=close(next).game;saved=persistGame(storage,advanced,saved);const recovered=rollbackCustomers(storage,saved);assert.equal(recovered.raw,raw);assert.deepEqual(recovered.game,old);assert.equal(storage.getItem(customerBackupKey(next.customerStrategy.migrationId)+':rollback'),saved);
});

test('quota, stale state, altered activation and missing backup leave original main save intact',()=>{
 const old=customerFixture({active:false}),next=enableCustomers(old);
 for(const kind of ['quota','readback','stale','tamper']){const storage=memory(old),raw=storage.getItem(SAVE_KEY),write=storage.setItem;let candidate=structuredClone(next),expected=raw;
  if(kind==='quota')storage.setItem=(key,v)=>{if(key.includes(':customer-strategy:'))throw Error('quota');write(key,v);};
  if(kind==='readback')storage.setItem=(key,v)=>{if(!key.includes(':customer-strategy:'))write(key,v);};
  if(kind==='stale')expected=raw+' ';if(kind==='tamper')candidate.cash++;
  assert.throws(()=>persistGame(storage,candidate,expected));assert.equal(storage.getItem(SAVE_KEY),raw);
 }
 const storage=memory(next),raw=storage.getItem(SAVE_KEY);assert.throws(()=>rollbackCustomers(storage,raw),/Không tìm/);assert.equal(storage.getItem(SAVE_KEY),raw);
});

test('completed refund queue remains pending when the day cannot be funded; rollback archive failure preserves the branch',()=>{
 let s=customerFixture({overnight:true});s.tycoon.schedules.find(x=>x.route===3).start=44;s.tycoon.schedules.find(x=>x.route===2&&x.start===26).start=50;s.tycoon.schedules.find(x=>x.route===2&&x.start===40).start=64;s=close(close(s).game).game;s=act(s,{type:'journey-refund',id:s.legEconomy.overnight.journeys[0].id});
 s.cash=0;const raw=JSON.stringify(s),r=transition(s,{type:'advance'});assert(r.error);assert.equal(r.game,s);assert.equal(JSON.stringify(s),raw);assert.equal(s.customerStrategy.pending.length,1);
 const old=customerFixture({active:false}),storage=memory(old),next=enableCustomers(old),saved=persistGame(storage,next,storage.getItem(SAVE_KEY)),write=storage.setItem;
 storage.setItem=(key,value)=>{if(key.endsWith(':rollback'))throw Error('quota');write(key,value);};assert.throws(()=>rollbackCustomers(storage,saved),/quota/);assert.equal(storage.getItem(SAVE_KEY),saved);
});

test('contract customers stay outside loyalty and existing research/positioning remain independent',()=>{
 let s=act(customerFixture(),{type:'contract-accept',id:'contract-0-3'});
 s=close(close(s).game).game;s=act(s,{type:'add',plane:s.fleet[0].id,route:3,start:54});
 const r=forecast(s);assert(r.contractPax>0);assert.equal(r.customers.count,r.pax-r.contractPax);assert(r.departureManifests.every(round=>round.legs.every(l=>sum(l.experience.counts)===sum(l.passengers)-sum(l.contracts.map(c=>c.pax))-l.connectionPax)));
 const inactive=structuredClone(s);inactive.customerStrategy.active=false;inactive.customerStrategy.scores=[0,0,0];s.customerStrategy.scores=[0,0,0];const neutral=forecast(s);assert.equal(forecast(inactive).revenue,neutral.revenue);assert.equal(forecast(inactive).profit-neutral.profit,500);
});
