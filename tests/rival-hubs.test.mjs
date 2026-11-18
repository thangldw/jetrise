import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreGame,transition,SAVE_KEY,context} from '../src/game.js';
import {rivalFixture,act} from './fixtures/rival-network.mjs';
import {RIVAL_HUB_TERMS,hubShortlist,rivalPairs,rivalMarketKey} from '../src/rival-network.js';
import {persistGame,readRivalHubsBackup,rivalHubsBackupKey} from '../src/save-store.js';

const close=s=>{const r=transition(s,{type:'advance'});assert(!r.error,r.error);r.game=restoreGame(JSON.stringify(r.game));return r;};
const memory=raw=>{const data=new Map([[SAVE_KEY,raw]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const enable=s=>act(s,{type:'rival-hubs-enable',acceptTerms:true,migrationId:'rivalhubsmigration012345'});
// Runs days until both rivals have opened a hub (or the limit), returning every day's report.
function run(s,limit=70){const reports=[];for(let i=0;i<limit;i++){const r=close(s);s=r.game;reports.push(r.report);if(s.strategy.rivals.every(x=>x.network.hubs?.length))break;}return {s,reports};}
let cache;
const career=()=>cache??=run(enable(rivalFixture()));

test('second hubs are opt-in, need JET-206 and change nothing at activation',()=>{
 const base=rivalFixture(),on=enable(base);
 assert.equal(base.strategy.expansion.hubs,undefined);
 const strip=structuredClone(on);delete strip.strategy.expansion.hubs;assert.deepEqual(strip,base);
 assert.deepEqual(restoreGame(JSON.stringify(on)),on);
 assert(transition(on,{type:'rival-hubs-enable',acceptTerms:true,migrationId:'rivalhubsmigration999999'}).error);
 assert(transition(base,{type:'rival-hubs-enable',acceptTerms:false,migrationId:'rivalhubsmigration012345'}).error);
 const noNetwork=rivalFixture({active:false});assert(transition(noNetwork,{type:'rival-hubs-enable',acceptTerms:true,migrationId:'rivalhubsmigration012345'}).error);
 // Without the opt-in no rival ever opens a hub.
 let s=base;for(let i=0;i<24;i++)s=close(s).game;assert(s.strategy.rivals.every(r=>r.network.hubs===undefined));
});

test('hub shortlist is deterministic, excludes the hub itself and stays inside A320 range',()=>{
 const ctx=context(rivalFixture());
 const a=hubShortlist(ctx,'DAD');assert.deepEqual(a,hubShortlist(ctx,'DAD'));
 assert(a.length>=3&&a.length<=RIVAL_HUB_TERMS.shortlist);assert(a.every(p=>p.from==='DAD'&&p.to!=='DAD'));
});

test('rivals open different second hubs from their own cash, after the waiting period',()=>{
 const {s,reports}=career(),rivals=s.strategy.rivals,start=s.strategy.expansion.hubs.enabledDay;
 const hubs=rivals.map(r=>r.network.hubs?.[0]).filter(Boolean);
 assert(hubs.length>=1,'at least one rival opened a hub within the horizon');
 assert.equal(new Set(hubs.map(h=>h.code)).size,hubs.length,'rivals never share a hub');
 for(const h of hubs){assert(h.code!==s.airline.origin);assert(h.openedDay-start>=RIVAL_HUB_TERMS.minDays);assert.equal(h.fee,RIVAL_HUB_TERMS.fee);}
 // Each opening is one review decision whose fee is charged to that rival's cash bridge in the day report.
 for(const report of reports)for(const r of report.competition.rivals)if(r.hubFee){
  assert.equal(r.hubFee,RIVAL_HUB_TERMS.fee);assert(Math.abs(r.cashDelta-r.profit+r.slotSigning+r.depositPaid+r.routeFee+r.hubFee-r.depositRefund)<.01);
 }
 assert(reports.flatMap(r=>r.competition.rivals).filter(r=>r.hubFee).length===hubs.length);
});

test('a rival can open routes from its new hub and they are validated, demand-sharing markets',()=>{
 let {s}=career();
 const rival=s.strategy.rivals.find(r=>r.network.hubs?.length),hub=rival.network.hubs[0].code;
 assert(rivalPairs(s.strategy,rival).some(p=>p.from===hub));
 let opened=false;
 for(let i=0;i<42&&!opened;i++){const r=close(s);s=r.game;opened=s.strategy.rivals.find(x=>x.id===rival.id).network.routes.some(p=>p.from===hub);}
 if(opened){
  const later=s.strategy.rivals.find(x=>x.id===rival.id),route=later.network.routes.find(p=>p.from===hub);
  const day=close(s);const markets=day.report.competition.markets;
  assert(markets.some(m=>m.key===rivalMarketKey(route)),'the hub route is a market that shares finite demand');
  for(const m of markets)for(const seg of m.segments)assert.equal(seg.player+seg.swift+seg.aurelia+seg.outside,seg.total);
 }
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});

test('slots: hub routes need rights only at controlled airports, never beyond shared capacity',()=>{
 const {s}=career();
 for(const h of s.tycoon.history)if(h.sharedSlots)for(const m of h.sharedSlots.movements)assert(m.player+m.swift+m.aurelia<=4);
 const controlled=new Set(s.slotMarket.airports);
 for(const r of s.strategy.rivals)for(const x of r.network.hubs||[])assert.equal(typeof controlled.has(x.code),'boolean');
});

test('tampered hub state is rejected on load',()=>{
 const {s}=career(),raw=JSON.stringify(s),rival=s.strategy.rivals.findIndex(r=>r.network.hubs?.length);
 const mutate=fn=>{const bad=JSON.parse(raw);fn(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));};
 mutate(b=>{b.strategy.rivals[rival].network.hubs[0].fee++;});
 mutate(b=>{b.strategy.rivals[rival].network.hubs[0].code=b.airline.origin;});
 mutate(b=>{b.strategy.rivals[rival].network.hubs[0].shortlist.pop();});
 mutate(b=>{b.strategy.rivals[rival].network.hubs.push(structuredClone(b.strategy.rivals[rival].network.hubs[0]));});
 mutate(b=>{delete b.strategy.expansion.hubs;});
 mutate(b=>{b.strategy.rivals[1-rival>=0?1-rival:0].network.hubs=structuredClone(b.strategy.rivals[rival].network.hubs);});
 mutate(b=>{b.strategy.rivals[rival].network.reviews.find(d=>d.kind==='hub').hubFee=1;});
});

test('activation writes a rollback backup and cannot be removed or replaced silently',()=>{
 const base=rivalFixture(),raw=JSON.stringify(base),storage=memory(raw),on=enable(base);
 persistGame(storage,on,raw);
 const backup=readRivalHubsBackup(storage,on);assert.equal(backup.raw,raw);assert.equal(backup.game.strategy.expansion.hubs,undefined);
 assert(storage.data.has(rivalHubsBackupKey(on.strategy.expansion.hubs.migrationId)));
 const stored=JSON.stringify(on),removed=structuredClone(on);delete removed.strategy.expansion.hubs;
 assert.throws(()=>persistGame(memory(stored),removed,stored),/hub/);
 const cheat=structuredClone(base);cheat.strategy.rivals[0].cash+=1;cheat.strategy.expansion.hubs=structuredClone(on.strategy.expansion.hubs);
 assert.throws(()=>persistGame(memory(raw),cheat,raw));
});
