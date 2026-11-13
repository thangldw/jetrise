import {scheduleGaps,findOpportunities} from '../src/opportunities.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,transition,context,Engine,typesFor,TYPES,routesFor,SAVE_KEY} from '../src/game.js';
import {readSession,persistGame,recoverBackup,BACKUP_KEY,DAMAGED_KEY,restartAfterDamage,withSaveLock} from '../src/save-store.js';
import {flightSegments} from '../src/week-time.js';
import {routeQuote} from '../src/network.js';
import {proposeSchedule,applyProposal} from '../src/planner.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
const empty=()=>{const s=createGame();s.tycoon.schedules=[];for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}return s;};
const startup=()=>act(createGame(),{type:'setup',name:'Review Air',logo:'wing',color:'#2563eb',origin:'HAN',models:['A320','B738']});

test('corrupt save is never overwritten; validated backup restores after archiving original bytes',()=>{
 const store=storage(),raw=JSON.stringify(createGame());store.setItem(SAVE_KEY,'broken bytes');store.setItem(BACKUP_KEY,raw);
 const session=readSession(store);assert(session.blocked);assert(session.backup);assert.equal(store.getItem(SAVE_KEY),'broken bytes');
 assert.throws(()=>persistGame(store,createGame(),'broken bytes'));assert.equal(store.getItem(SAVE_KEY),'broken bytes');
 const recovered=recoverBackup(store,'broken bytes');assert.deepEqual(recovered.game,createGame());assert.equal(store.getItem(DAMAGED_KEY),'broken bytes');assert.equal(store.getItem(SAVE_KEY),raw);
});
test('persistence checks stale revisions, retains prior valid save and fails without partial game commit',()=>{
 const store=storage(),s=createGame(),raw=persistGame(store,s,null),next=act(s,{type:'stock',resource:'fuel',amount:10});
 const saved=persistGame(store,next,raw);assert.equal(store.getItem(BACKUP_KEY),raw);assert.throws(()=>persistGame(store,s,raw),/tab khác/);assert.equal(store.getItem(SAVE_KEY),saved);
 const quota={...store,setItem:(k,v)=>{if(k===SAVE_KEY)throw Error('quota');store.setItem(k,v);}};assert.throws(()=>persistGame(quota,s,saved),/quota/);assert.equal(store.getItem(SAVE_KEY),saved);assert.equal(store.getItem(BACKUP_KEY),saved);
});
test('blocked storage and missing or damaged backups never create a replacement career',()=>{
 const broken={getItem:()=>{throw Error('denied');}};assert(readSession(broken).blocked);
 const store=storage();store.setItem(SAVE_KEY,'broken');store.setItem(BACKUP_KEY,'also broken');assert(!readSession(store).backup);assert.throws(()=>recoverBackup(store,'broken'));assert.equal(store.getItem(SAVE_KEY),'broken');assert.equal(store.getItem(DAMAGED_KEY),null);
});
test('Sunday rounds wrap, block next Monday, preserve edit identity and restore correctly',()=>{
 let s=empty(),pid=s.fleet[0].id;s=act(s,{type:'add',plane:pid,route:0,start:167});const slot=s.tycoon.schedules[0],hours=Engine.duration(context(s),pid,0);
 assert(Engine.slotError(context(s),s.tycoon,pid,0,0).includes('trùng'));
 assert.equal(Engine.airborneUntil(context(s),s.tycoon,pid,s.day),s.day);
 const pieces=flightSegments([slot],()=>hours);assert.equal(pieces.length,2);assert.equal(pieces[0].slot.id,slot.id);assert(pieces.some(p=>p.start<0&&p.end>0));
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const bad=structuredClone(s);bad.tycoon.schedules.push({id:bad.tycoon.nextId++,plane:pid,route:0,start:0});assert.throws(()=>restoreGame(JSON.stringify(bad)),/overlap/);
 const check=transition(s,{type:'service-plan',plane:pid,start:0});assert(check.error.includes('trùng'));
});
test('cross-week daily settlement books the Sunday round once and respects previous-flight transfer guard',()=>{
 let s=empty();s.day=7;s=act(s,{type:'add',plane:s.fleet[0].id,route:0,start:167});let r=transition(s,{type:'advance'});assert(!r.error);assert.equal(r.report.flights,2);s=r.game;
 assert(transition(s,{type:'maintenance',plane:s.fleet[0].id,day:8}).error.includes('đang thực hiện'));
 r=transition(s,{type:'advance'});assert(!r.error);assert.equal(r.report.flights,0);
});
test('economy v2 preserves founding grant but constrains capital expansion; legacy valuations and leases stay unchanged',()=>{
 let s=startup();assert.equal(s.cash,500000000);assert.equal(s.economyVersion,2);assert.equal(typesFor(s).A320.price,57600000);assert(typesFor(s).A388.price>s.cash);
 assert(transition(s,{type:'buy',model:'A388'}).error);s=act(s,{type:'lease',model:'A320'});const p=s.fleet.at(-1);assert.equal(p.lease.rate,14400);assert.equal(p.lease.deposit,2880000);assert.equal(restoreGame(JSON.stringify(s)).fleet.at(-1).lease.rate,14400);
 const legacy=createGame();delete legacy.economyVersion;const loaded=restoreGame(JSON.stringify(legacy));assert.equal(typesFor(loaded).A320.price,TYPES.A320.price);assert.equal(loaded.cash,legacy.cash);
});
test('market profiles are deterministic, symmetric, heterogeneous and applied consistently to preset/custom routes',()=>{
 const s=startup(),business=routeQuote(s,'HAN','SIN'),leisure=routeQuote(s,'HAN','DPS'),reverse=routeQuote(s,'SIN','HAN');assert.deepEqual(business.classDemand,reverse.classDemand);assert.deepEqual(business.weekPattern,reverse.weekPattern);assert.notDeepEqual(business.classDemand,leisure.classDemand);assert(business.classDemand[1]/business.classDemand[0]>leisure.classDemand[1]/leisure.classDemand[0]);
 assert.deepEqual(routesFor(s)[0].classDemand,routeQuote(s,'HAN','BKK').classDemand);assert.deepEqual(business,routeQuote(s,'HAN','SIN'));assert(business.price>1000000);
});
test('planner compares three strategies without mutating state, ignores roster order and rejects stale or forged apply',()=>{
 const s=empty(),ctx=context(s),before=JSON.stringify(s),p=proposeSchedule(ctx,s.tycoon);assert.equal(p.alternatives.length,3);assert.equal(p.after,Math.max(...p.alternatives.map(a=>a.profit)));assert.equal(JSON.stringify(s),before);assert(p.added>0);
 const reverse=proposeSchedule({...ctx,fleet:[...ctx.fleet].reverse()},s.tycoon);assert.equal(reverse.after,p.after);
 const {state,fleet}=applyProposal(ctx,s.tycoon,p);assert.equal(state.schedules.length,p.added);for(const slot of state.schedules)assert.equal(Engine.slotError({...ctx,fleet},state,slot.plane,slot.route,slot.start,slot.id),'');
 assert.throws(()=>applyProposal({...ctx,day:ctx.day+1},s.tycoon,p),/đã cũ/);
 const forged=structuredClone(p);forged.state.schedules[0].route=99;assert.throws(()=>applyProposal(ctx,s.tycoon,forged));
});


test('an underway reservation survives deleting the recurring slot and cannot be sold, transferred or serviced',()=>{
 let s=empty();s.day=7;const pid=s.fleet[0].id;s=act(s,{type:'add',plane:pid,route:0,start:167});s=act(s,{type:'advance'});assert(s.fleet[0].airborneUntilAt>168);s=act(s,{type:'remove',id:s.tycoon.schedules[0].id});
 assert(transition(s,{type:'add',plane:pid,route:0,start:0}).error.includes('đang bay'));
 assert(transition(s,{type:'sell',plane:pid}).error.includes('đang thực hiện'));
 assert(transition(s,{type:'service-plan',plane:pid,start:0}).error.includes('đang bay'));
 const restored=restoreGame(JSON.stringify(s));assert.equal(restored.fleet[0].airborneUntilAt,s.fleet[0].airborneUntilAt);
});
test('restarting without a valid backup retains the exact damaged save',()=>{
 const store=storage();store.setItem(SAVE_KEY,'original bytes');const fresh=restartAfterDamage(store,'original bytes');assert.equal(store.getItem(DAMAGED_KEY),'original bytes');assert.deepEqual(restoreGame(fresh.raw),createGame());
});
test('serialized concurrent saves accept one writer and reject the stale writer',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let queue=Promise.resolve();Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_name,work)=>{const next=queue.then(work);queue=next.catch(()=>{});return next;}}}});
 try{const store=storage(),base=JSON.stringify(createGame());store.setItem(SAVE_KEY,base);const a=act(createGame(),{type:'stock',resource:'fuel',amount:10}),b=act(createGame(),{type:'stock',resource:'fuel',amount:20});const outcomes=await Promise.allSettled([withSaveLock(()=>persistGame(store,a,base)),withSaveLock(()=>persistGame(store,b,base))]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(store.getItem(SAVE_KEY),JSON.stringify(a));}finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});

test('Finder can use a free interval joining Sunday tail and next Monday head',()=>{
 const s=empty(),pid=s.fleet[0].id,ctx=structuredClone(context(s));ctx.types[ctx.fleet[0].type].speed=800;ctx.routes[0].cycle=161;s.tycoon.schedules=[{id:1,plane:pid,route:0,start:6}];s.tycoon.nextId=2;
 const linear=scheduleGaps(ctx,s.tycoon,pid),cyclic=scheduleGaps(ctx,s.tycoon,pid,true);assert.deepEqual(linear,[{start:0,end:6},{start:167,end:168}]);assert.equal(cyclic.at(-1).end,174);
 const candidates=findOpportunities(ctx,s.tycoon,pid,cyclic.at(-1),1,36);assert(candidates.some(c=>c.start===167&&c.start+c.hours>168));for(const c of candidates)assert.equal(Engine.slotError(ctx,s.tycoon,pid,c.route,c.start),'');
});

test('a newly booked future Sunday does not create a phantom underway flight; old saves infer a legacy reservation once',()=>{
 let s=empty();s.day=8;for(const p of s.fleet)p.serviceDueAt=468;const pid=s.fleet[0].id;s=act(s,{type:'add',plane:pid,route:0,start:167});assert.equal(Engine.airborneUntil(context(s),s.tycoon,pid,s.day),8);assert(!transition(s,{type:'maintenance',plane:pid,day:8}).error);
 const old=structuredClone(s);delete old.fleet[0].airborneUntilAt;const loaded=restoreGame(JSON.stringify(old));assert(loaded.fleet[0].airborneUntilAt>168);assert.deepEqual(restoreGame(JSON.stringify(loaded)),loaded);
});
