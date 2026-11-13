import test from 'node:test';
import assert from 'node:assert/strict';
import {OPTIONS,optionEffects,cabinQuality} from '../src/amenities.js';
import {createGame,transition,restoreGame,forecast} from '../src/game.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const fixture=()=>{const s=createGame();s.setupComplete=true;s.cash=500000000;s.tycoon.schedules=[{id:1,plane:s.fleet[0].id,route:0,start:8}];s.tycoon.nextId=2;for(const p of s.fleet){p.wear=0;p.fault=null;p.options=[];p.serviceDueAt=300;}return s;};

test('legacy equipment economics and comfort remain unchanged',()=>{
 assert.deepEqual(optionEffects({options:['wifi','screen','seats','usb']}),{revenue:6.8,cost:2.15});
 near(cabinQuality({options:['wifi','screen','seats','usb']}),.9);
 assert.equal(OPTIONS.wifi.price,85000);assert.equal(OPTIONS.screen.price,120000);assert.equal(OPTIONS.seats.price,180000);assert.equal(OPTIONS.usb.price,40000);
});
test('all 16 equipment purchases charge once, affect only chosen aircraft and survive reload',()=>{
 assert.equal(Object.keys(OPTIONS).length,16);
 for(const [key,o] of Object.entries(OPTIONS)){
  const s=fixture(),saved=JSON.stringify(s),id=s.fleet[0].id,r=transition(s,{type:'option',plane:id,key});assert(!r.error,r.error);
  assert.equal(JSON.stringify(s),saved);assert.equal(r.game.cash,s.cash-o.price);
  assert.deepEqual(r.game.fleet[0].options,[key]);assert.deepEqual(r.game.fleet[1].options,[]);assert.deepEqual(r.game.tycoon.cabins,s.tycoon.cabins);
  assert.deepEqual(restoreGame(JSON.stringify(r.game)).fleet[0].options,[key]);
  const dup=transition(r.game,{type:'option',plane:id,key});assert(dup.error);assert.equal(dup.game,r.game);
  s.cash=o.price-1;const poor=transition(s,{type:'option',plane:id,key});assert(poor.error);assert.equal(poor.game,s);
 }
});
test('passenger-based benefits and costs reach forecasts and exact daily settlement',()=>{
 for(const key of Object.keys(OPTIONS)){
  const s=fixture(),base=forecast(s),o=OPTIONS[key],r=transition(s,{type:'option',plane:s.fleet[0].id,key}),n=r.game,after=forecast(n);
  near(after.revenue-base.revenue,after.pax*o.revenue);assert.equal(after.pax,base.pax);
  assert.equal(after.operatingNonfuel-base.operatingNonfuel,Math.round(base.rows[0].nonfuel+after.pax*o.cost)-base.rows[0].nonfuel);
  const closed=transition(n,{type:'advance'});assert(!closed.error,closed.error);near(closed.game.cash,n.cash+after.cashDelta);
  n.tycoon.schedules=[];assert.equal(forecast(n).revenue,0);assert.equal(forecast(n).operatingNonfuel,0);
 }
});
test('new amenities influence competition while comfort is bounded',()=>{
 const s=fixture(),enabled=transition(s,{type:'strategy-enable'}).game,base=forecast(enabled);enabled.fleet[0].options=['lighting','quiet','air','bedding'];
 assert(forecast(enabled).pax>base.pax);enabled.fleet[0].options=Object.keys(OPTIONS);assert.equal(cabinQuality(enabled.fleet[0]),1);
 const projected=forecast(enabled),before=JSON.stringify(enabled);const next=transition(enabled,{type:'advance'});assert(!next.error,next.error);near(next.game.cash,enabled.cash+projected.cashDelta);assert.equal(JSON.stringify(enabled),before);
});
