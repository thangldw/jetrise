import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,context,Engine,restoreGame} from '../src/game.js';
import {recommendRoutes} from '../src/route-recommendations.js';
import {projectedWeekReports} from '../src/planner.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const fixture=()=>act(createGame(),{type:'setup',name:'Test Air',origin:'HAN',logo:'wing',color:'#d84440',models:['A320','B738']});
const profit=s=>projectedWeekReports(context(s),s.tycoon,false).reduce((n,d)=>n+d.report.profit,0);
test('recommendations are immutable, bounded, affordable and ordered by marginal profit per hour',()=>{
 const s=fixture(),before=JSON.stringify(s),r=recommendRoutes(context(s),s.tycoon,'HAN');
 assert.equal(JSON.stringify(s),before);assert.equal(r.items.length,3);assert(r.examined<=24);
 for(const [i,x] of r.items.entries()){
  assert(x.fee<=s.cash);assert(x.profit>0);assert.equal(x.netFirstWeek,x.profit-x.fee);
  const p=s.fleet.find(p=>p.id===x.plane);assert.equal(p.hub,'HAN');assert(x.route.km<=context(s).types[p.type].range);
  if(i)assert(r.items[i-1].profitPerHour>=x.profitPerHour);
 }
});
test('opening a recommended route spends only its fee, adds no flight, and its flight matches the canonical projection',()=>{
 const s=fixture(),before=profit(s);
 for(const x of recommendRoutes(context(s),s.tycoon,'HAN').items){
  let n=act(s,x.index===undefined?{type:'route-create',from:'HAN',to:x.route.to}:{type:'unlock',route:x.index});
  assert.equal(n.cash,s.cash-x.fee);assert.deepEqual(n.tycoon.schedules,s.tycoon.schedules);
  const ri=context(n).routes.findIndex(r=>r.from==='HAN'&&r.to===x.route.to);
  assert.equal(Engine.slotError(context(n),n.tycoon,x.plane,ri,x.start),'');
  n=act(n,{type:'add',plane:x.plane,route:ri,start:x.start});
  assert(Math.abs(profit(n)-before-x.profit)<.001);assert.deepEqual(restoreGame(JSON.stringify(n)),n);
 }
});
test('owned markets including reversed routes are excluded and budget is respected',()=>{
 let s=fixture(),x=recommendRoutes(context(s),s.tycoon,'HAN').items[0];
 s=act(s,{type:'route-create',from:'HAN',to:x.route.to});
 assert(!recommendRoutes(context(s),s.tycoon,'HAN').items.some(y=>y.route.to===x.route.to));
 const c=context(s),ri=c.routes.findIndex(r=>r.to===x.route.to&&r.from==='HAN');c.routes[ri]={...c.routes[ri],from:x.route.to,to:'HAN'};
 assert(!recommendRoutes(c,s.tycoon,'HAN').items.some(y=>y.route.to===x.route.to));
 s.cash=1;assert.equal(recommendRoutes(context(s),s.tycoon,'HAN').items.length,0);
});
test('no fleet, wrong hub, unavailable aircraft and schedule cap produce honest empty states',()=>{
 const s=fixture();assert.equal(recommendRoutes(context(s),s.tycoon,'SGN').items.length,0);
 const c=context(s);c.fleet=[];assert.match(recommendRoutes(c,s.tycoon,'HAN').reason,/Chưa có máy bay/);
 for(const p of s.fleet)p.wear=95;assert.equal(recommendRoutes(context(s),s.tycoon,'HAN').items.length,0);
 s.tycoon.schedules=Array.from({length:480},(_,i)=>({id:i+1,plane:s.fleet[0].id,route:0,start:8}));
 assert.match(recommendRoutes(context(s),s.tycoon,'HAN').reason,/480/);
});
test('active competition preserves all route indices and recommendations match committed forecasts',()=>{
 let s=act(fixture(),{type:'unlock',route:0});s=act(s,{type:'founding-next'});s=act(s,{type:'founding-finish'});s=act(s,{type:'strategy-enable'});
 const before=JSON.stringify(s),base=profit(s),r=recommendRoutes(context(s),s.tycoon,'HAN');
 assert(r.items.length);assert.equal(JSON.stringify(s),before);
 for(const x of r.items){
  let n=act(s,x.index===undefined?{type:'route-create',from:'HAN',to:x.route.to}:{type:'unlock',route:x.index});
  const ri=context(n).routes.findIndex(r=>r.from==='HAN'&&r.to===x.route.to);
  n=act(n,{type:'add',plane:x.plane,route:ri,start:x.start});
  assert(Math.abs(profit(n)-base-x.profit)<.001);
 }
});
