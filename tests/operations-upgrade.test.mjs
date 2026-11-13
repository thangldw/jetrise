import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,context,forecast,restoreGame,Engine} from '../src/game.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const career=()=>{let s=act(createGame(),{type:'setup',name:'Test Air',logo:'wing',color:'#1d77ca',origin:'HAN',models:['A320','B738']});s=act(s,{type:'founding-next'});s=act(s,{type:'unlock',route:1});return act(s,{type:'founding-finish'});};
test('legacy operational hours no longer cap departures at40h',()=>{
 const s=career(),p=s.fleet[0];p.hoursSinceService=39;
 assert.equal(Engine.slotError(context(s),s.tycoon,p.id,1,0),'');
 s.tycoon.schedules=[{id:1,plane:p.id,route:1,start:0},{id:2,plane:p.id,route:1,start:6}];s.tycoon.nextId=3;
 assert.deepEqual(restoreGame(JSON.stringify(s)).tycoon.schedules,s.tycoon.schedules);
 const f=forecast(s);assert.equal(f.rows.length,2);assert.equal(f.cancelled,0);assert.equal(act(s,{type:'advance'}).fleet[0].hoursSinceService,49.5);
});
test('weekly due time enforces exact return boundary and failed edits remain atomic',()=>{
 const s=career(),p=s.fleet[0];p.serviceDueAt=11.25;
 const a=act(s,{type:'add',plane:p.id,route:1,start:0}),b=act(a,{type:'add',plane:p.id,route:1,start:6});
 assert.equal(forecast(b).rows.length,2);
 const bad=transition(b,{type:'add',plane:p.id,route:1,start:12});assert(bad.error);assert.strictEqual(bad.game,b);
 b.tycoon.schedules.push({id:b.tycoon.nextId++,plane:p.id,route:1,start:12});assert.equal(forecast(b).cancelled,2);assert.equal(Engine.capacity(context(b),b.tycoon,1,1)[0],584);
});
test('booked heavy service moves weekly due time and clears accumulated hours',()=>{
 let s=career(),p=s.fleet[0];p.hoursSinceService=39;s=act(s,{type:'maintenance',plane:p.id,day:1});
 for(const start of [24,30,36,42,48,54,60])s=act(s,{type:'add',plane:p.id,route:1,start});
 assert.equal(Engine.slotError(context(s),s.tycoon,p.id,1,72),'');
 s=act(s,{type:'advance'});assert.equal(s.fleet[0].hoursSinceService,0);assert.equal(s.fleet[0].serviceDueAt,192);
});
test('opposite round-trip directions share one demand pool and offered capacity',()=>{
 let s=career();s=act(s,{type:'hub-buy',hub:'SGN'});s=act(s,{type:'route-create',from:'SGN',to:'HAN'});const reverse=context(s).routes.length-1;
 s=act(s,{type:'transfer',plane:s.fleet[1].id,hub:'SGN'});
 for(const [plane,route] of [[s.fleet[0].id,1],[s.fleet[1].id,reverse]])for(const start of [0,6,12])s=act(s,{type:'add',plane,route,start});
 const c=context(s),demand=Engine.demand(c,s.tycoon,1,1),f=forecast(s);assert.deepEqual(Engine.demand(c,s.tycoon,reverse,1),demand);assert.deepEqual(Engine.capacity(c,s.tycoon,reverse,1),Engine.capacity(c,s.tycoon,1,1));
 for(let i=0;i<3;i++)assert(f.rows.reduce((n,r)=>n+r.passengers[i],0)<=demand[i]);
 const before=JSON.stringify(s);forecast(s);assert.equal(JSON.stringify(s),before);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('CO2 uses fuel units and is positive with an empty cabin market',()=>{
 let s=career();s=act(s,{type:'add',plane:s.fleet[0].id,route:1,start:0});s.tycoon.prices[1]=[10000,10000,10000];
 const f=forecast(s);assert.equal(f.pax,0);assert(f.burn>0);assert.equal(f.co2,Math.ceil(f.burn*Engine.CO2_PER_FUEL_TONNE));
 const fuel=act(s,{type:'research',key:'fuel'});assert(forecast(fuel).co2<f.co2);
 const next=act(s,{type:'advance'});assert.equal(next.co2,s.co2-f.co2);
});
test('maintenance is expensed once and not charged again by the close-day reserve or cash bridge',()=>{
 let s=career();const initial=s.cash;s=act(s,{type:'maintenance',plane:s.fleet[0].id,day:1});const paid=initial-s.cash,f=forecast(s);
 assert.equal(f.maintenanceCost,paid);assert(Math.abs(f.profit-(f.revenue-f.nonfuel-f.fuelCost-f.co2Cost))<1e-7);
 const bridge=f.profit+f.fuelCost+f.co2Cost-f.fuelPurchase-f.co2Purchase+paid+f.prepaidRent-f.principal+f.leaseRefunds;assert(Math.abs(bridge-f.cashDelta)<1e-7);
 const before=s.cash;s=act(s,{type:'advance'});assert(Math.abs(s.cash-before-f.cashDelta)<1e-7);assert.equal(s.hq.maintenancePaid,0);assert.equal(forecast(s).maintenanceCost,0);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('a paid maintenance invoice does not increase cash required to close the day again',()=>{
 let s=career();s=act(s,{type:'maintenance',plane:s.fleet[0].id,day:1});s.cash=forecast(s).overhead;
 const r=transition(s,{type:'advance'});assert(!r.error,r.error);assert.equal(r.game.cash,0);
});
test('fare elasticity stays shared across opposite directions and quote reads remain immutable',()=>{
 let s=career();s=act(s,{type:'hub-buy',hub:'SGN'});s=act(s,{type:'route-create',from:'SGN',to:'HAN'});const reverse=context(s).routes.length-1;
 s=act(s,{type:'transfer',plane:s.fleet[1].id,hub:'SGN'});for(const [p,ri] of [[s.fleet[0].id,1],[s.fleet[1].id,reverse]])s=act(s,{type:'add',plane:p,route:ri,start:0});
 const c=context(s),before=JSON.stringify(s),old=Engine.demand(c,s.tycoon,1,1);s.tycoon.prices[reverse]=[10000,10000,10000];
 const after=Engine.demand(context(s),s.tycoon,1,1);assert(after.every((n,i)=>n<old[i]));assert.deepEqual(after,Engine.demand(context(s),s.tycoon,reverse,1));const repriced=JSON.stringify(s);forecast(s);assert.equal(JSON.stringify(s),repriced);assert.notEqual(JSON.stringify(s),before);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
