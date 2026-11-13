import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,routeEntries,ROUTES,restoreGame,context} from '../src/game.js';
import {findOpportunities,scheduleGaps} from '../src/opportunities.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
function weekly(){let s=createGame();s.tycoon.schedules=[];s=act(s,{type:'add-weekly',plane:s.fleet[0].id,route:1,days:[0,1,2,3,4,5,6],at:6});return s;}
test('retired demo routes disappear while owned routes/custom indices and saved schedule remain intact',()=>{
 let s=createGame(),before=JSON.stringify(s);assert.deepEqual(routeEntries(s).map(x=>x.i),s.openedRoutes);assert.equal(JSON.stringify(s),before);
 s=act(s,{type:'route-create',from:'HAN',to:'HKG'});assert(routeEntries(s).some(x=>x.i===ROUTES.length));assert.equal(routeEntries(s).find(x=>x.i===ROUTES.length).r.to,'HKG');assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const ctx=context(s),gap=scheduleGaps(ctx,s.tycoon,s.fleet[0].id)[1];assert(findOpportunities(ctx,s.tycoon,s.fleet[0].id,gap).every(x=>s.openedRoutes.includes(x.route)||x.route>=ROUTES.length));
});
test('buying a new hub does not reintroduce demo routes',()=>{const s=createGame(),r=act(s,{type:'hub-buy',hub:'SGN'});assert.deepEqual(r.openedRoutes,s.openedRoutes);assert.deepEqual(routeEntries(r),routeEntries(s));});
test('bulk edit changes all matching weekdays and keeps unrelated times/routes/planes and IDs',()=>{
 let s=weekly(),id=s.fleet[0].id;s=act(s,{type:'add',plane:id,route:1,start:18});s=act(s,{type:'add',plane:id,route:0,start:0});s=act(s,{type:'add',plane:s.fleet[1].id,route:1,start:6});
 const originals=structuredClone(s.tycoon.schedules),r=act(s,{type:'edit-weekly',id:originals[2].id,plane:id,route:1,at:7.75});
 assert.equal(r.tycoon.schedules.length,originals.length);for(const old of originals){const now=r.tycoon.schedules.find(x=>x.id===old.id);if(old.plane===id&&old.route===1&&old.start%24===6)assert.equal(now.start,Math.floor(old.start/24)*24+7.75);else assert.deepEqual(now,old);}
 assert.deepEqual(restoreGame(JSON.stringify(r)),r);assert.deepEqual(s.tycoon.schedules,originals);
});
test('one conflict on one weekday rejects the entire weekly edit',()=>{
 let s=weekly(),id=s.fleet[0].id;s=act(s,{type:'add',plane:id,route:1,start:18});const r=transition(s,{type:'edit-weekly',id:s.tycoon.schedules[0].id,plane:id,route:1,at:18});assert(r.error.includes('Thứ Hai'));assert.strictEqual(r.game,s);
});
test('bulk edits check maintenance, range and invalid clock before committing',()=>{
 let s=weekly(),id=s.fleet[0].id;s=act(s,{type:'service-plan',plane:id,start:5*24+12});
 for(const update of [{at:10},{at:24},{at:7.1},{at:NaN},{route:12},{plane:'missing'}]){const r=transition(s,{type:'edit-weekly',id:s.tycoon.schedules[0].id,plane:id,route:1,at:6,...update});assert(r.error,JSON.stringify(update));assert.strictEqual(r.game,s);}
});
test('single-flight edit remains limited to exactly one day',()=>{const s=weekly(),slot=s.tycoon.schedules[1],r=act(s,{type:'edit',id:slot.id,plane:slot.plane,route:slot.route,start:24+7.75});assert.equal(r.tycoon.schedules.filter((x,i)=>x.start!==s.tycoon.schedules[i].start).length,1);});
