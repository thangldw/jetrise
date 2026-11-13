import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,context,Engine,TYPES,ROUTES,restoreGame,transition} from '../src/game.js';
import {scheduleGaps,findOpportunities,fareWeek} from '../src/opportunities.js';
import {projectedWeekProfit} from '../src/planner.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};

test('model speeds change duration while every legacy adjacent schedule stays valid',()=>{
 assert(Engine.modelDuration(ROUTES[2],TYPES.B788)<Engine.modelDuration(ROUTES[2],TYPES.E190));
 for(const model of Object.keys(TYPES)){
  const s=createGame(),p=s.fleet[0];p.type=model;p.wear=0;s.tycoon.cabins[p.id]=Engine.defaultCabin(TYPES[model]);s.tycoon.schedules=[];
  for(const [ri,r] of ROUTES.entries())if(r.from==='HAN'&&r.km<=TYPES[model].range){
   s.openedRoutes=[...new Set([...s.openedRoutes,ri])];const old=Math.ceil(r.cycle*4)/4;
   assert(Engine.duration(context(s),p.id,ri)<=old);
   s.tycoon.schedules=[{id:1,plane:p.id,route:ri,start:0},{id:2,plane:p.id,route:ri,start:old}];s.tycoon.nextId=3;
   assert.deepEqual(restoreGame(JSON.stringify(s)).tycoon.schedules,s.tycoon.schedules);
  }
 }
});
test('gaps exactly complement aircraft blocks, including overnight flights and full weeks',()=>{
 const s=createGame();s.cash=100000000;let n=act(s,{type:'buy-used',model:'B789'});n=act(n,{type:'unlock',route:10});const p=n.fleet.at(-1);n=act(n,{type:'add',plane:p.id,route:10,start:18});
 assert.deepEqual(scheduleGaps(context(n),n.tycoon,p.id),[{start:0,end:18},{start:45,end:168}]);
 const filled={...n.tycoon,schedules:[{id:1,plane:p.id,route:10,start:0}]};const ctx=context(n);ctx.routes=ctx.routes.map((r,i)=>i===10?{...r,cycle:188.875}:r);
 assert.deepEqual(scheduleGaps(ctx,filled,p.id),[]);
});
test('finder is read-only and every proposed flight passes domain validation with exact marginal profit',()=>{
 const s=createGame(),ctx=context(s),before=JSON.stringify(s),gap=scheduleGaps(ctx,s.tycoon,'VN-A101')[1],options=findOpportunities(ctx,s.tycoon,'VN-A101',gap,1,12);
 assert(options.length>0);assert.equal(JSON.stringify(s),before);
 for(const o of options){
  const c={...ctx,openedRoutes:[...new Set([...ctx.openedRoutes,o.route])]};assert.equal(Engine.slotError(c,s.tycoon,'VN-A101',o.route,o.start),'');
  assert(o.start+o.hours<=gap.end);assert(o.hours<=12);assert.equal(ROUTES[o.route].from,'HAN');
  const copy=structuredClone(s.tycoon);Engine.add(c,copy,'VN-A101',o.route,o.start);
  assert.equal(o.delta,projectedWeekProfit(c,copy)-projectedWeekProfit(ctx,s.tycoon));
  assert.equal(o.netFirstWeek,o.delta-o.cost);
 }
 assert.deepEqual(findOpportunities(ctx,s.tycoon,'VN-A101',{start:0,end:168}),[]);
 assert.deepEqual(findOpportunities(ctx,s.tycoon,'VN-A101',gap,35,36),[]);
});
test('finder defers departure past booked maintenance and respects range, hubs and lease expiry',()=>{
 let s=createGame();s=act(s,{type:'maintenance',plane:'VN-A101',day:1});s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.plane!=='VN-A101');const ctx=context(s),gap=scheduleGaps(ctx,s.tycoon,'VN-A101')[0];
 const options=findOpportunities(ctx,s.tycoon,'VN-A101',gap);assert(options.length>0);assert(options.every(o=>o.start>=24&&o.route!==10));
 s=createGame();s.cash=100000000;s=act(s,{type:'lease',model:'A320'});const p=s.fleet.at(-1);s.day=14;p.lease.remaining=1;
 const c=context(s),g=scheduleGaps(c,s.tycoon,p.id)[0],found=findOpportunities(c,s.tycoon,p.id,g);assert(found.every(o=>o.start>=144&&o.start+o.hours<=168));
 assert.deepEqual(findOpportunities(c,s.tycoon,'VN-A104',scheduleGaps(c,s.tycoon,'VN-A104')[0]),[]);
});
test('fare preview follows seven actual schedule days, finite shared demand and immutable prices',()=>{
 const s=createGame(),before=JSON.stringify(s),prices=s.tycoon.prices[0].map(n=>n+30),days=fareWeek(context(s),s.tycoon,0,prices);
 assert.equal(days.length,7);assert.equal(JSON.stringify(s),before);assert(days.some(d=>d.before.pax!==d.after.pax||d.before.profit!==d.after.profit));
 for(const d of days){assert(d.after.pax<=d.demand.reduce((a,b)=>a+b,0));assert(d.after.pax<=d.capacity.reduce((a,b)=>a+b,0));}
 const empty=fareWeek(context(s),s.tycoon,3,prices);assert(empty.every(d=>d.after.profit===0&&d.after.pax===0&&d.capacity.every(n=>n===0)));
 const same=fareWeek(context(s),s.tycoon,0,s.tycoon.prices[0]);assert(same.every(d=>d.after.profit===d.before.profit));
});
test('finder purchase, schedule, close day and reload use the existing atomic game loop',()=>{
 let s=createGame(),cash=s.cash;s=act(s,{type:'route-create',from:'HAN',to:'HKG'});assert(s.cash<cash);const c=context(s),gap=scheduleGaps(c,s.tycoon,'VN-A101')[1],candidate=findOpportunities(c,s.tycoon,'VN-A101',gap).find(o=>o.route===c.routes.length-1);assert(candidate);assert(candidate.opened);
 s=act(s,{type:'add',plane:'VN-A101',route:candidate.route,start:candidate.start});assert(transition(s,{type:'add',plane:'VN-A101',route:candidate.route,start:candidate.start}).error);
 s=act(s,{type:'advance'});assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});

test('finder cannot exceed the persisted schedule cap',()=>{
 const s=createGame();s.tycoon.schedules=Array.from({length:480},(_,i)=>({id:i+1,plane:'VN-A102',route:1,start:6}));s.tycoon.nextId=481;
 assert.deepEqual(findOpportunities(context(s),s.tycoon,'VN-A101',scheduleGaps(context(s),s.tycoon,'VN-A101')[0]),[]);
 const r=transition(s,{type:'add',plane:'VN-A101',route:0,start:0});assert(r.error);assert.strictEqual(r.game,s);
});
