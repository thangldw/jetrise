import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,context,transition,restoreGame,forecast,dayCashRequired,Engine,SAVE_KEY} from '../src/game.js';
import {persistGame,readLegBackup,rollbackLegEconomy,legBackupKey,BACKUP_KEY,readSession} from '../src/save-store.js';
import {projectedWeekReports,projectedWeekProfit,plannerBasis} from '../src/planner.js';
import {weeklyAircraftEconomics} from '../src/aircraft-economics.js';
import {operationsOutlook} from '../src/operations.js';
import {studyNetwork} from '../src/network-study.js';
import {marketEvents} from '../src/gameplay.js';
const ID='01234567-0123-4567-8901-012345678901';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const equalMoney=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function fixture(start=22){let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[0,1,2,3];for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}if(start!==null)s=act(s,{type:'add',plane:s.fleet[0].id,route:0,start});return s;}
const enable=s=>act(s,{type:'leg-economy-enable',migrationId:ID});
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
function migrate(s=fixture()){const store=storage(),before=persistGame(store,s,null),game=enable(s),raw=persistGame(store,game,before);return {store,before,game,raw};}
const advance=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);return {...r,game:restoreGame(JSON.stringify(r.game))};};

test('legacy careers remain opt-out; activation preserves all assets, schedules and history',()=>{
 const s=fixture(),before=JSON.stringify(s);assert.equal(restoreGame(before).legEconomy,undefined);const next=enable(s),without=structuredClone(next);delete without.legEconomy;assert.deepEqual(without,s);assert.equal(JSON.stringify(s),before);assert(transition(next,{type:'leg-economy-enable',migrationId:ID}).error);assert(transition(createGame(),{type:'leg-economy-enable',migrationId:ID}).error);
 const legacy=advance(s).game;assert(transition(legacy,{type:'leg-economy-enable',migrationId:ID}).error.includes('về hub'));
});

test('migration preserves exact prior bytes in a separate immutable backup across ordinary saves',()=>{
 const {store,before,game,raw}=migrate();assert.equal(store.getItem(legBackupKey(ID)),before);let next=advance(game).game;const saved=persistGame(store,next,raw);assert.equal(store.getItem(BACKUP_KEY),raw);assert.equal(readLegBackup(store,next).raw,before);assert.equal(readSession(store).raw,saved);assert.deepEqual(readSession(store).game,next);
});

test('backup quota failure, readback failure and stale revisions cannot activate a career',()=>{
 for(const failure of ['quota','silent']){const store=storage(),s=fixture(),before=persistGame(store,s,null),next=enable(s),wrapped={...store,setItem:(k,v)=>{if(k===legBackupKey(ID)){if(failure==='quota')throw Error('quota');return;}store.setItem(k,v);}};assert.throws(()=>persistGame(wrapped,next,before));assert.equal(store.getItem(SAVE_KEY),before);}
 const {store,before,game,raw}=migrate();assert.throws(()=>persistGame(store,game,before),/tab khác/);assert.equal(store.getItem(SAVE_KEY),raw);
});

test('failed final migration write leaves legacy main plus a valid retryable backup',()=>{
 const store=storage(),s=fixture(),before=persistGame(store,s,null),game=enable(s),broken={...store,setItem:(k,v)=>{if(k===SAVE_KEY)throw Error('quota');store.setItem(k,v);}};
 assert.throws(()=>persistGame(broken,game,before));assert.equal(store.getItem(SAVE_KEY),before);assert.equal(store.getItem(legBackupKey(ID)),before);assert.equal(persistGame(store,game,before),JSON.stringify(game));
});

test('rollback archives the live branch and restores exact pre-migration bytes; missing or corrupt backups fail closed',()=>{
 const {store,before,game,raw}=migrate(),advanced=advance(game).game,saved=persistGame(store,advanced,raw),result=rollbackLegEconomy(store,saved);
 assert.equal(result.raw,before);assert.equal(store.getItem(SAVE_KEY),before);assert.equal(store.getItem(legBackupKey(ID)+':rollback'),saved);assert.equal(result.game.legEconomy,undefined);
 for(const value of [null,'bad',JSON.stringify(game)]){store.setItem(SAVE_KEY,saved);if(value===null)store.data.delete(legBackupKey(ID));else store.setItem(legBackupKey(ID),value);assert.throws(()=>rollbackLegEconomy(store,saved));assert.equal(store.getItem(SAVE_KEY),saved);}
});

test('rollback archive failure or stale raw never rewinds the main career',()=>{
 const {store,raw}=migrate(),blocked={...store,setItem:()=>{throw Error('quota');}};assert.throws(()=>rollbackLegEconomy(blocked,raw));assert.equal(store.getItem(SAVE_KEY),raw);assert.throws(()=>rollbackLegEconomy(store,'stale'));assert.equal(store.getItem(SAVE_KEY),raw);
});

test('cross-midnight tickets, expenses and stock reconcile without replay after reload',()=>{
 const old=fixture(),legacy=forecast(old).rows[0],s=enable(old),before=JSON.stringify(s),first=advance(s),a=first.report,second=advance(first.game),b=second.report;
 assert.equal(a.revenue,0);assert(a.deferredRevenue>0);assert.equal(a.flights,1);assert.equal(b.flights,1);assert.equal(b.fuelPurchase+b.co2Purchase,0);assert.equal(b.deferredRevenue,0);assert.equal(second.game.legEconomy.rounds.length,0);
 equalMoney(a.revenue+b.revenue,legacy.revenue);equalMoney(a.operatingNonfuel+b.operatingNonfuel,legacy.nonfuel);equalMoney(a.fuelCost+b.fuelCost,Math.round(legacy.fuelCost*100)/100);equalMoney(a.co2Cost+b.co2Cost,Math.round(legacy.co2Cost*100)/100);equalMoney(a.burn+b.burn,legacy.burn);assert.equal(a.co2+b.co2,legacy.co2);
 equalMoney(first.game.fuel,Math.max(0,s.fuel-legacy.burn));assert.equal(second.game.fuel,first.game.fuel);assert.equal(a.pax+b.pax,legacy.pax);assert.equal(JSON.stringify(s),before);
 const third=advance(second.game);assert.equal(third.report.revenue,0);assert.equal(third.report.flights,0);
 for(const r of [a,b])equalMoney(r.profit+r.fuelCost+r.co2Cost-r.fuelPurchase-r.co2Purchase+r.deferredRevenueDelta-r.prepaidNonfuelDelta+r.maintenancePrepaid+r.prepaidRent-r.principal+r.leaseRefunds,r.cashDelta);
});

test('all costs are funded before departure; following-day prepaid returns do not request cash again',()=>{
 let s=enable(fixture()),f=forecast(s),required=dayCashRequired(f);assert(required>f.nonfuel+f.fuelPurchase+f.co2Purchase);s.cash=required-.01;assert(transition(s,{type:'advance'}).error.includes('Cần'));s.cash=required;const next=advance(s).game,g=forecast(next);equalMoney(dayCashRequired(g),g.overhead+g.maintenanceCash-g.prepaidRent+g.principal);assert(g.prepaidNonfuelDelta<0);assert.equal(operationsOutlook(next).fuelCoverage,null);equalMoney(operationsOutlook(enable(fixture())).fuelCoverage,fixture().fuel/f.fuelAllocated);
});

test('headquarters distinguishes fixed overhead from arrivals and maintenance on a day without departures',()=>{
 const idle=fixture(null);
 assert.equal(operationsOutlook(idle).fixedCostsOnly,true);

 const scheduled=enable(fixture(19));
 assert.equal(operationsOutlook(scheduled).fixedCostsOnly,false);
 const arrival=operationsOutlook(advance(scheduled).game);
 assert.equal(arrival.report.flights,0);
 assert.ok(arrival.report.pax>0 && arrival.report.revenue>0);
 assert.equal(arrival.fixedCostsOnly,false);

 idle.hq.maintenancePaid=2000;
 assert.equal(operationsOutlook(idle).fixedCostsOnly,false);
});

test('a booked return survives deleting the weekly template and changing future prices/cabin',()=>{
 let s=advance(enable(fixture())).game;const manifest=JSON.stringify(s.legEconomy),expected=forecast(s).revenue;s=act(s,{type:'remove',id:s.tycoon.schedules[0].id});s.tycoon.prices[0]=[9999,9999,9999];s.tycoon.cabins[s.fleet[0].id]=[1,0,0];s=restoreGame(JSON.stringify(s));assert.equal(JSON.stringify(s.legEconomy),manifest);assert.equal(forecast(s).revenue,expected);assert(transition(s,{type:'sell',plane:s.fleet[0].id}).error);assert(transition(s,{type:'service-plan',plane:s.fleet[0].id,start:24}).error);assert.equal(advance(s).game.legEconomy.rounds.length,0);
});

test('Sunday carryovers are dated, settle once on Monday and do not duplicate templates',()=>{
 let s=fixture(166);s.day=7;s=enable(s);const a=advance(s),b=advance(a.game);assert(a.game.legEconomy.rounds[0].id.startsWith('7:'));assert.equal(b.report.flights,1);assert.equal(b.game.legEconomy.rounds.length,0);assert.equal(a.game.tycoon.schedules.length,1);assert.equal(b.game.tycoon.schedules.length,1);
});

test('pending contracts reserve actual Y seats and count delivery on arrival, deadline awards once',()=>{
 let s=fixture();s.gameplay.contracts=[{id:'contract-0-0',route:0,start:1,end:1,target:280,fare:149,penalty:1000,bonus:200,delivered:0,status:'active'}];s=enable(s);
 const a=advance(s);assert.equal(a.game.gameplay.contracts[0].delivered,0);assert.equal(a.report.contractPenalty,1000);assert.equal(a.report.contractPax,0);assert.equal(a.game.gameplay.contracts[0].status,'lost');
 const b=advance(a.game);assert.equal(b.game.gameplay.contracts[0].delivered,280);assert.equal(b.report.contractPenalty+b.report.contractBonus,0);assert.equal(b.report.contractPax,280);
});

test('held contract seats prevent a second round selling beyond the target',()=>{
 let s=fixture();s.gameplay.contracts=[{id:'contract-0-0',route:0,start:1,end:3,target:280,fare:149,penalty:1000,bonus:200,delivered:0,status:'active'}];s=act(s,{type:'add',plane:s.fleet[1].id,route:0,start:24});s=enable(s);const a=advance(s),b=advance(a.game),c=context(a.game),without=structuredClone(c);without.gameplay.contracts=[];assert.equal(Engine.demand(c,a.game.tycoon,0,2)[0],Engine.demand(without,a.game.tycoon,0,2)[0]);assert.equal(b.report.contractPax,280);assert.equal(b.report.contractRevenue,280*149);assert.equal(b.game.gameplay.contracts[0].delivered,280);assert(b.report.operatedRounds===undefined); // persisted report strips operational snapshots
});

test('same-day connections and AI keep exact ticket attribution without extra seats or revenue',()=>{
 let s=fixture(null);s.openedRoutes=[2,3];s=act(s,{type:'add',plane:s.fleet[2].id,route:3,start:0});s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:5});s=act(s,{type:'strategy-enable'});s=act(s,{type:'connection-program',enabled:true,minimum:60,maximum:240});s.tycoon.prices[3][0]*=2;
 const old=forecast(s),active=enable(s),next=forecast(active);assert(old.connections.boardings>0);equalMoney(next.revenue,old.revenue);equalMoney(next.nonfuel,old.nonfuel);assert.equal(next.pax,old.pax);assert.deepEqual(next.strategyState,old.strategyState);assert.equal(next.deferredRevenue,0);assert.equal(advance(active).game.legEconomy.rounds.length,0);
});

test('forecast and per-aircraft contributions use live settlement without changing the save',()=>{
 let s=enable(fixture(166));s.gameplay.research=marketEvents(context(s)).map(e=>e.id);const before=JSON.stringify(s),days=projectedWeekReports(context(s),s.tycoon,false),economics=weeklyAircraftEconomics(context(s),s.tycoon);assert.equal(JSON.stringify(s),before);
 equalMoney(Object.values(economics).reduce((n,r)=>n+r.profit,0),days.reduce((n,d)=>n+d.report.profit,0));
 assert(projectedWeekProfit(context(s),s.tycoon)>days.reduce((n,d)=>n+d.report.profit,0));const liveBasis=plannerBasis(context(s),s.tycoon);const old=structuredClone(s);delete old.legEconomy;assert.notEqual(liveBasis,plannerBasis(context(old),old.tycoon));
 for(const {report} of days){const r=advance(s);equalMoney(r.report.revenue,report.revenue);equalMoney(r.report.operatingNonfuel,report.nonfuel);assert.deepEqual(r.game.legEconomy,report.legEconomyState);s=r.game;}
});

test('network studies use physical round snapshots instead of treating financial events as flights',()=>{
 const s=enable(fixture()),days=projectedWeekReports(context(s),s.tycoon,false),study=studyNetwork(context(s),s.tycoon,days);assert.equal(study.legs.length,2);assert.equal(study.metrics.hours,Engine.duration(context(s),s.fleet[0].id,0));const next=advance(s).game;assert.doesNotThrow(()=>studyNetwork(context(next),next.tycoon,projectedWeekReports(context(next),next.tycoon,false)));
});

test('corrupt live cursor, identities, money, manifests, capacity and duplicate rounds reject restore',()=>{
 const s=advance(enable(fixture())).game;for(const mutate of [x=>x.legEconomy.version=2,x=>x.legEconomy.through+=24,x=>x.legEconomy.deferredCents++,x=>x.legEconomy.prepaidCents++,x=>x.legEconomy.rounds.push(structuredClone(x.legEconomy.rounds[0])),x=>x.legEconomy.rounds[0].legs[0].ticketCents++,x=>x.legEconomy.rounds[0].legs[0].arrival++,x=>x.legEconomy.rounds[0].legs[1].passengers[0]=1001,x=>x.legEconomy.rounds[0].capacity=[1000,1000,1000],x=>x.legEconomy.rounds[0].plane='missing']){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});

test('exact-midnight arrival belongs to the next half-open settlement window',()=>{
 let s=fixture(null);s=act(s,{type:'add',plane:s.fleet[0].id,route:3,start:22.75});s=enable(s);const a=advance(s);assert.equal(a.game.legEconomy.rounds[0].legs[0].arrival,24);assert.equal(a.report.pax,0);const b=advance(a.game);assert(b.report.pax>0);assert.equal(b.game.legEconomy.rounds.length,0);
});

test('immutable return movements still occupy hub slots after removing the weekly template',()=>{
 let s=enable(fixture());s.slotRights={HAN:{capacity:1,startedDay:1,unlockDay:8}};s=advance(s).game;s=act(s,{type:'remove',id:s.tycoon.schedules[0].id});const before=JSON.stringify(s),result=transition(s,{type:'add',plane:s.fleet[1].id,route:0,start:27});assert(result.error.includes('slot'));assert.equal(JSON.stringify(result.game),before);assert.equal(JSON.stringify(s),before);
});

test('known cancellations create no bookings, while an underway return ignores a new technical fault',()=>{
 let s=enable(fixture());s.fleet[0].fault='Hydraulic pump fault';const f=forecast(s);assert.equal(f.cancelled,2);assert.equal(f.legEconomyState.rounds.length,0);assert.equal(f.deferredRevenue,0);
 s=advance(enable(fixture())).game;const expected=forecast(s).revenue;s.fleet[0].fault='Hydraulic pump fault';assert.equal(forecast(s).revenue,expected);assert.equal(advance(s).game.legEconomy.rounds.length,0);
});

test('empty flights retain per-leg operating expense and zero ticket liability',()=>{
 let s=fixture();s.tycoon.prices[0]=[10000,10000,10000];s=enable(s);const a=advance(s),b=advance(a.game);assert.equal(a.report.pax+b.report.pax,0);assert.equal(a.report.revenue+b.report.revenue,0);assert(a.report.fuelCost>0);assert(b.report.fuelCost>0);assert.equal(a.report.deferredRevenue,0);
});

test('older schema1 defaults migrate without changing original backup bytes',()=>{
 const old=fixture(null);delete old.economyVersion;delete old.nextAircraftNumber;for(const p of old.fleet)delete p.airborneUntilAt;const bytes=JSON.stringify(old,null,2),store=storage();store.setItem(SAVE_KEY,bytes);const loaded=readSession(store);assert(!loaded.blocked);const live=enable(loaded.game);persistGame(store,live,bytes);assert.equal(readLegBackup(store,live).raw,bytes);assert.deepEqual(rollbackLegEconomy(store,store.getItem(SAVE_KEY)).game,loaded.game);
});

test('live optimizer uses the cohort score and rejects a proposal after ledger progression',async()=>{
 const {proposeSchedule,applyProposal}=await import('../src/planner.js');let s=enable(fixture(null));s.fleet=s.fleet.slice(0,1);s.openedRoutes=[0];s=restoreGame(JSON.stringify(s));const before=JSON.stringify(s),ctx=context(s),p=proposeSchedule(ctx,s.tycoon);assert(p.added>0);equalMoney(p.after+p.maintenanceCost,projectedWeekProfit({...ctx,fleet:applyProposal(ctx,s.tycoon,p).fleet},p.state));assert.equal(JSON.stringify(s),before);assert.doesNotThrow(()=>applyProposal(ctx,s.tycoon,p));const next=advance(s).game;assert.throws(()=>applyProposal(context(next),next.tycoon,p),/cũ/);
});
