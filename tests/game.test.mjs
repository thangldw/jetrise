import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,context,forecast,transition,routeInfo,Engine,TYPES} from '../src/game.js';

test('initial state, save round trip and corrupt cabin rejection',()=>{const s=createGame();assert.equal(s.cash,8600000);assert.equal(s.tycoon.schedules.length,13);assert.deepEqual(restoreGame(JSON.stringify(s)),s);const broken=structuredClone(s);broken.tycoon.cabins['VN-A101']=[999,9,9];assert.throws(()=>restoreGame(JSON.stringify(broken)));});
test('schedule collision, quarter-hour, week boundary and maintenance failures are atomic',()=>{const s=createGame();for(const a of [{plane:'VN-A101',route:2,start:6},{plane:'VN-A101',route:2,start:167},{plane:'VN-A101',route:2,start:50.1},{plane:'VN-A104',route:2,start:12}]){const r=transition(s,{type:'add',...a});assert(r.error);assert.strictEqual(r.game,s);}const add=transition(s,{type:'add',plane:'VN-A101',route:2,start:12});assert(!add.error);assert.equal(add.game.tycoon.schedules.length,14);assert.equal(s.tycoon.schedules.length,13);});
test('cabins and price changes update finite class demand without mutating a quote',()=>{const s=createGame(),before=JSON.stringify(s),info=routeInfo(s,2,'VN-A101');assert.equal(JSON.stringify(s),before);assert(info.estimate.profit>0);const bad=transition(s,{type:'cabin',plane:'VN-A101',values:[180,1,0]});assert(bad.error);const good=transition(s,{type:'cabin',plane:'VN-A101',values:[100,20,5]});assert(!good.error);const prices=transition(good.game,{type:'prices',route:2,values:[300,650,1400]});assert.equal(prices.game.cash,s.cash-5000);assert(transition(prices.game,{type:'prices',route:2,values:[220,550,1100]}).error);assert(routeInfo(prices.game,2,'VN-A101').demand[0]<info.demand[0]);});
test('day closes once with inventory/cash/profit reconciliation; week repeats',()=>{const s=createGame(),f=forecast(s),r=transition(s,{type:'advance'});assert(!r.error);assert.equal(r.game.day,2);assert.equal(r.game.tycoon.history.length,1);assert(Math.abs(r.game.cash-s.cash-f.cashDelta)<1e-7);assert(Math.abs(r.game.fuel-Math.max(0,s.fuel-f.burn))<1e-7);assert.equal(r.game.co2,Math.max(0,s.co2-f.co2));assert(Math.abs(f.profit-(f.revenue-f.nonfuel-f.fuelCost-f.co2Cost))<1e-7);const nextWeek=structuredClone(s);nextWeek.day=8;nextWeek.fleet.forEach(p=>p.serviceDueAt=336);assert.deepEqual(forecast(nextWeek).rows.map(x=>x.slot),f.rows.map(x=>x.slot));assert.deepEqual(restoreGame(JSON.stringify(r.game)),r.game);});
test('automatic resource top-ups and insufficient-cash guard',()=>{const s=createGame();s.fuel=0;s.co2=0;const f=forecast(s);assert(f.fuelPurchase>0&&f.co2Purchase>0);const r=transition(s,{type:'advance'});assert(Math.abs(r.game.cash-s.cash-f.profit)<1e-7);s.cash=0;const snapshot=JSON.stringify(s),bad=transition(s,{type:'advance'});assert(bad.error);assert.equal(JSON.stringify(s),snapshot);assert.strictEqual(bad.game,s);});
test('purchase, maintenance, route unlocking and shared class pools',()=>{let s=createGame();s=transition(s,{type:'repair',plane:'VN-A104'}).game;assert.equal(s.fleet[2].wear,96);assert(s.fleet[2].maintenance);assert.equal(s.cash,8540000);const buy=transition(s,{type:'buy-used',model:'E190',tier:0});assert(!buy.error);assert.equal(buy.game.fleet.length,4);assert(buy.game.tycoon.cabins[buy.game.fleet[3].id]);const unlocked=transition(s,{type:'unlock',route:3});assert(unlocked.game.openedRoutes.includes(3));assert(transition(unlocked.game,{type:'unlock',route:3}).error);s.tycoon.schedules=[];for(const p of s.fleet)for(const start of [0,6,12,18])Engine.add(context(s),s.tycoon,p.id,0,start);const r=forecast(s),pool=Engine.demand(context(s),s.tycoon,0,1);for(let c=0;c<3;c++)assert(r.rows.reduce((n,x)=>n+x.passengers[c],0)<=pool[c]);assert(r.rows.every(x=>x.passengers.every((n,i)=>n<=s.tycoon.cabins[x.plane][i]*2)));});

test('every catalog model can be bought, configured, scheduled, flown and restored',()=>{
 assert.equal(Object.keys(TYPES).length,13);
 for(const [model,type] of Object.entries(TYPES)){
  let s=createGame();s.cash=100000000;
  const purchase=transition(s,{type:'buy',model});assert(!purchase.error,model);
  s=purchase.game;assert.equal(s.cash,100000000-type.price);assert.equal(s.fleet.length,3);
  while(s.orders.length){const r=transition(s,{type:'advance'});assert(!r.error,model);s=r.game;}
  const plane=s.fleet.at(-1);
  assert.deepEqual(restoreGame(JSON.stringify(s)),s);
  s=transition(s,{type:'cabin',plane:plane.id,values:[type.seats,0,0]}).game;
  const scheduled=transition(s,{type:'add',plane:plane.id,route:2,start:(s.day-1)%7*24});assert(!scheduled.error,model);
  const report=forecast(scheduled.game);assert(report.rows.some(r=>r.plane===plane.id));
  assert(Number.isFinite(report.profit));
  const settled=transition(scheduled.game,{type:'advance'});assert(!settled.error,model);
  assert.deepEqual(restoreGame(JSON.stringify(settled.game)),settled.game);
  const poor=createGame();poor.cash=0;const bad=transition(poor,{type:'buy',model});assert(bad.error);assert.strictEqual(bad.game,poor);
 }
});
