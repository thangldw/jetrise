import {legacySlotRights} from './fixtures/legacy-slot-rights.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,transition,forecast,context,SAVE_KEY} from '../src/game.js';
import {rivalFixture,enableRivals,act} from './fixtures/rival-network.mjs';
import {customerFixture} from './fixtures/customer-strategy.mjs';
import {enableSlots} from './fixtures/slot-market.mjs';
import {previewDisruption} from '../src/disruption-recovery.js';
import {rivalMarketKey} from '../src/rival-network.js';
import {projectedWeekReports,plannerBasis} from '../src/planner.js';
import {persistGame,readRivalNetworkBackup,rollbackRivalNetwork,rivalNetworkBackupKey} from '../src/save-store.js';
const sum=xs=>xs.reduce((a,b)=>a+b,0),near=(a,b)=>assert(Math.abs(a-b)<.011,`${a} != ${b}`);
const close=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);r.game=restoreGame(JSON.stringify(r.game));return r;};
const memory=s=>{const data=new Map([[SAVE_KEY,JSON.stringify(s)]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const days=(s,n)=>{for(let i=0;i<n;i++)s=close(s).game;return s;};
let replay;
const career=()=>{if(!replay){let s=rivalFixture({customers:true});replay=[s];for(let i=0;i<30;i++){s=close(s).game;replay.push(s);}}return replay;};

test('legacy careers remain opt-out and activation requires ledger, AI and shared slots',()=>{
 const old=createGame(),raw=JSON.stringify(old);assert.deepEqual(restoreGame(raw),old);assert(transition(old,{type:'rival-network-enable',migrationId:'validmigration0123456789'}).error);
 const s=rivalFixture({active:false});assert.equal(restoreGame(JSON.stringify(s)).strategy.expansion,undefined);const f=forecast(s);assert(f.competition.rivals.every(r=>!r.network));
 for(const field of ['legEconomy','slotMarket','strategy']){const bad=structuredClone(s);delete bad[field];assert(transition(bad,{type:'rival-network-enable',migrationId:'validmigration0123456789'}).error);}
 assert(transition(s,{type:'rival-network-enable',migrationId:'bad'}).error);
});

test('activation preserves player progress and paid legacy leases without granting capital',()=>{
 const s=rivalFixture({active:false,legacyLease:true}),n=enableRivals(s);
 for(const key of ['cash','fleet','tycoon','network','openedRoutes','slotMarket','legEconomy'])assert.deepEqual(n[key],s[key]);
 for(const [i,r] of n.strategy.rivals.entries()){assert.equal(r.cash,s.strategy.rivals[i].cash);assert.equal(r.network.fleet.length,2);assert.deepEqual(r.network.fleet[1].lease,s.strategy.rivals[i].leases[0]);assert.equal(r.leases,undefined);}
 assert.deepEqual(restoreGame(JSON.stringify(n)),n);assert(transition(n,{type:'rival-network-enable',migrationId:'validmigration0123456789'}).error);assert(transition(n,{type:'rival-growth'}).error);
});

test('weekly reviews buy independent routes and actual leases within finite bounds',()=>{
 const states=career(),initial=states[0],first=states[8],second=states[15];
 assert(states.slice(0,8).every(s=>s.strategy.rivals.every(r=>r.network.fleet.length===1)));
 for(const s of [first,second]){assert.deepEqual(s.network,initial.network);assert.deepEqual(s.openedRoutes,initial.openedRoutes);assert.deepEqual(s.tycoon.schedules,initial.tycoon.schedules);for(const r of s.strategy.rivals){const review=r.network.reviews[0];assert.equal(review.kind,'lease');assert.equal(review.depositPaid,500000);assert(review.incrementalProfit>0);assert(review.considered<=12);assert(r.network.fleet.length<=3);assert(r.network.routes.length<=4);assert(r.network.routes.every(p=>s.strategy.expansion.shortlist.some(x=>rivalMarketKey(x)===rivalMarketKey(p))));}}
 assert(first.strategy.rivals.every(r=>r.network.routes.some(p=>!initial.openedRoutes.some(i=>rivalMarketKey(context(initial).routes[i])===rivalMarketKey(p)))));
 assert(second.strategy.rivals.every(r=>r.network.fleet.length===3));
});

test('30 daily settlements reconcile per-leg cents, rival cash and shared movement capacity',()=>{
 for(const s of career().slice(1)){const h=s.tycoon.history[0];for(const r of h.competition.rivals){near(r.cash,r.cashBefore+r.profit-r.slotSigning-r.routeFee-r.depositPaid+r.depositRefund);near(sum(r.legs.map(l=>l.revenueCents))/100,r.revenue);near(sum(r.aircraft.map(p=>p.cost)),r.cost);assert.equal(sum(r.legs.map(l=>l.pax)),r.pax);assert.equal(new Set(r.legs.map(l=>l.id)).size,r.legs.length);assert(r.cash>=0);assert(r.aircraft.every(p=>p.pax<=p.seats));assert(r.legs.every(l=>Number.isSafeInteger(l.revenueCents)&&Number.isSafeInteger(l.costCents)));}
 for(const m of h.sharedSlots.movements)assert(m.player+m.swift+m.aurelia<=4);for(const r of s.strategy.rivals)assert.equal(r.network.through,(s.day-1)*24);
 }
});

test('lease expiry refunds each paid deposit once and never reuses aircraft identifiers',()=>{
 const s=career();for(const id of ['swift','aurelia']){const reports=s.slice(1,29).map(x=>x.tycoon.history[0].competition.rivals.find(r=>r.id===id));assert.equal(reports[20].depositRefund,500000);assert.equal(reports[21].depositRefund,0);assert.equal(reports[27].depositRefund,500000);assert(!s[21].strategy.rivals.find(r=>r.id===id).network.fleet.some(p=>p.id===id+'-2'));assert(s[30].strategy.rivals.find(r=>r.id===id).network.nextId>4);}
});

test('maintenance grounds a whole day, charges once and cannot be bypassed without funds',()=>{
 const s=career()[6],r=forecast(s);for(const x of r.competition.rivals){assert.equal(x.legs.length,0);assert.equal(x.aircraft[0].maintenance,3675);assert.equal(x.aircraft[0].serviceDueDay,14);}const next=career()[7];assert(forecast(next).competition.rivals.every(r=>r.aircraft[0].maintenance===0));
 const poor=structuredClone(s);poor.strategy.rivals.forEach(r=>r.cash=0);const p=close(poor);assert(p.report.competition.rivals.every(r=>r.legs.length===0&&r.aircraft[0].maintenance===0&&r.cash===0));assert(p.game.strategy.rivals.every(r=>r.network.fleet[0].serviceDueDay===7));
});

test('an insolvent leased fleet returns deposits before operation, without taking player cash',()=>{
 const s=rivalFixture({legacyLease:true});s.strategy.rivals.forEach(r=>r.cash=0);const r=close(s);for(const x of r.report.competition.rivals){assert.equal(x.depositRefund,500000);assert.equal(x.aircraft.length,1);assert(x.cash>=0);}near(r.game.cash,s.cash+r.report.cashDelta);
});

test('weekly review returns a losing lease and does not reuse its registration',()=>{
 const s=structuredClone(career()[14]);for(const r of s.strategy.rivals){r.network.fleet[1].weekProfit=-1000;r.cash=100000;}
 const result=close(s);for(const r of result.game.strategy.rivals){assert(r.network.reviews[0].returned.includes(r.id+'-2'));assert.equal(r.network.reviews[0].depositRefund,500000);assert(!r.network.fleet.some(p=>p.id===r.id+'-2'));}
});

test('exhausted shared hub slots stop every AI flight and prevent expansion',()=>{
 let s=legacySlotRights(rivalFixture(),Array.from({length:168},(_,hour)=>['HAN',hour,4]));
 s=days(s,8);for(const r of s.strategy.rivals){assert.equal(r.network.fleet.length,1);assert.equal(r.network.reviews[0].kind,'hold');assert.equal(r.network.reviews[0].depositPaid,0);}assert(s.tycoon.history.every(h=>h.competition.rivals.every(r=>r.legs.length===0)));
});

test('AI shifts departure when the preferred hour is owned by the player',()=>{
 const s=legacySlotRights(rivalFixture(),[['HAN',6,4]]),r=close(s);assert(r.report.competition.rivals.every(r=>r.hour!==6&&r.legs.length===2));assert(r.report.sharedSlots.movements.every(m=>m.player+m.swift+m.aurelia<=4));
});

test('insufficient reserves and scaled route fees keep expansion affordable',()=>{
 let s=rivalFixture();s.economyVersion=2;s.strategy.rivals.forEach(r=>r.cash=300000);s=days(s,8);assert(s.strategy.rivals.every(r=>r.cash>=0&&r.network.fleet.length===1&&r.network.reviews[0].depositPaid===0));
});

test('AI-only and later player-owned routes use one canonical capacity-constrained market',()=>{
 let s=structuredClone(career()[8]);const before=context(s).routes,license=s.strategy.rivals[0].network.routes.find(p=>!p.inherited),key=rivalMarketKey(license),f=forecast(s);assert.equal(f.competition.markets.filter(m=>m.key===key).length,1);assert.equal(f.competition.markets.find(m=>m.key===key).route,null);
 s=act(s,{type:'route-create',from:license.from,to:license.to});assert.deepEqual(context(s).routes.slice(0,before.length),before);const after=forecast(s);assert.equal(after.competition.markets.filter(m=>m.key===key).length,1);assert.equal(after.competition.markets.find(m=>m.key===key).route,before.length);
 for(const m of after.competition.markets){assert.equal(m.player+m.swift+m.aurelia+m.outside,m.potential);for(const seg of m.segments)assert.equal(seg.player+seg.swift+seg.aurelia+seg.outside,seg.total);}close(s);
});

test('forecasts remain pure and eight-day projections include the same weekly decision',()=>{
 let s=act(rivalFixture(),{type:'market-research',id:'event-0'});const raw=JSON.stringify(s),projection=projectedWeekReports(context(s),s.tycoon,false,8);assert.equal(JSON.stringify(s),raw);
 for(const expected of projection){const r=close(s);assert.deepEqual(r.report.competition,expected.report.competition);assert.deepEqual(r.report.sharedSlots,expected.report.sharedSlots);s=r.game;}
 const altered=structuredClone(s);altered.strategy.rivals[0].network.fleet[0].weekProfit--;assert.notEqual(plannerBasis(context(s),s.tycoon),plannerBasis(context(altered),altered.tycoon));
});

test('overnight tickets and loyalty still settle once alongside autonomous AI markets',()=>{
 let s=enableRivals(enableSlots(customerFixture({overnight:true})));const a=close(s);assert(a.game.legEconomy.overnight.journeys.length);assert.equal(a.report.customers.throughCompleted,0);s=act(a.game,{type:'connection-program',enabled:false,minimum:60,maximum:1440});const pax=sum(s.legEconomy.overnight.journeys.map(j=>j.pax)),b=close(s);assert.equal(b.report.customers.throughCompleted,pax);assert.equal(close(b.game).report.customers.throughCompleted,0);for(const m of b.report.competition.markets)assert.equal(m.player+m.swift+m.aurelia+m.outside,m.potential);
});

test('strict restore rejects damaged fleet, money, market and ledger identities',()=>{
 const s=career()[8];for(const mutate of [x=>x.strategy.rivals[0].network.through--,x=>x.strategy.rivals[0].network.nextId=1,x=>x.strategy.rivals[0].network.fleet[1].id='swift-1',x=>x.strategy.rivals[0].network.fleet[1].lease.deposit++,x=>x.strategy.rivals[0].network.routes[1].fee++,x=>x.strategy.expansion.nextReviewDay++,x=>x.tycoon.history[0].competition.rivals[0].legs[0].revenueCents++,x=>x.tycoon.history[0].competition.rivals[0].legs[0].costCents++,x=>x.tycoon.history[0].sharedSlots.rivals[0].movements[0].at++,x=>x.tycoon.history[0].competition.rivals[0].cash++,x=>x.tycoon.history[0].competition.markets[0].key='HAN|XXX',x=>delete x.strategy.expansion]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});

test('activation backs up exact old bytes and rollback archives the current whole career',()=>{
 const old=rivalFixture({active:false,legacyLease:true}),storage=memory(old),raw=storage.getItem(SAVE_KEY),next=enableRivals(old);let saved=persistGame(storage,next,raw);assert.equal(readRivalNetworkBackup(storage,next).raw,raw);assert.equal(storage.getItem(rivalNetworkBackupKey(next.strategy.expansion.migrationId)),raw);saved=persistGame(storage,close(next).game,saved);const recovered=rollbackRivalNetwork(storage,saved);assert.equal(recovered.raw,raw);assert.deepEqual(recovered.game,old);assert.equal(storage.getItem(rivalNetworkBackupKey(next.strategy.expansion.migrationId)+':rollback'),saved);
});

test('failed backup, stale writes and tampered migration preserve the original save',()=>{
 const old=rivalFixture({active:false}),next=enableRivals(old);for(const kind of ['quota','readback','stale','tamper','collision']){const storage=memory(old),raw=storage.getItem(SAVE_KEY),write=storage.setItem,candidate=structuredClone(next);let expected=raw;
 if(kind==='quota')storage.setItem=(k,v)=>{if(k.includes(':rival-network:'))throw Error('quota');write(k,v);};if(kind==='readback')storage.setItem=(k,v)=>{if(!k.includes(':rival-network:'))write(k,v);};if(kind==='stale')expected+=' ';if(kind==='tamper')candidate.cash++;if(kind==='collision')storage.setItem(rivalNetworkBackupKey(next.strategy.expansion.migrationId),'wrong');assert.throws(()=>persistGame(storage,candidate,expected));assert.equal(storage.getItem(SAVE_KEY),raw);
 }
});

test('missing backup, rollback archive failure and an unfunded close cannot discard progress',()=>{
 const old=rivalFixture({active:false}),next=enableRivals(old),missing=memory(next);assert.throws(()=>rollbackRivalNetwork(missing,missing.getItem(SAVE_KEY)),/Không tìm/);
 const storage=memory(old),saved=persistGame(storage,next,storage.getItem(SAVE_KEY)),write=storage.setItem;storage.setItem=(k,v)=>{if(k.endsWith(':rollback'))throw Error('quota');write(k,v);};assert.throws(()=>rollbackRivalNetwork(storage,saved),/quota/);assert.equal(storage.getItem(SAVE_KEY),saved);
 const poor=structuredClone(career()[7]);poor.cash=0;const raw=JSON.stringify(poor),r=transition(poor,{type:'advance'});assert(r.error);assert.equal(r.game,poor);assert.equal(JSON.stringify(poor),raw);
});


test('rebooking with shared rights retains sold fares and customer promises under expanded AI',()=>{
 let s=close(enableRivals(enableSlots(customerFixture({overnight:true})))).game;s=act(s,{type:'connection-program',enabled:false,minimum:60,maximum:1440});
 const ticket=structuredClone(s.legEconomy.overnight.journeys[0]);
 s=legacySlotRights(s,s.slotMarket.airports.flatMap(airport=>Array.from({length:26},(_,i)=>[airport,24+i,4])));
 const preview=previewDisruption(s,context(s),{leg:ticket.legs[0].id,kind:'weather',delay:3,mode:'rebook'}),next=act(s,{type:'disruption-apply',preview}),j=next.legEconomy.overnight.journeys[0];
 assert(j.rebookedFrom);assert.equal(j.fareCents,ticket.fareCents);assert.deepEqual(j.experience,ticket.experience);const r=close(next);assert.equal(r.report.customers.throughCompleted,ticket.pax);assert(r.report.sharedSlots.movements.every(m=>m.player+m.swift+m.aurelia<=4));assert.equal(close(r.game).report.customers.throughCompleted,0);
});
