import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,context} from '../src/game.js';
import {weeklyAircraftEconomics} from '../src/aircraft-economics.js';
import {projectedWeekProfit} from '../src/planner.js';
const fixture=()=>{const s=createGame();s.tycoon.schedules=[];for(const p of s.fleet){p.wear=0;p.serviceDueAt=300;p.fault=null;}return s;};
const slot=(s,plane,start)=>s.tycoon.schedules.push({id:s.tycoon.schedules.length+1,plane,route:0,start});

test('forecast aircraft totals reconcile to shared planner profit without mutating progress',()=>{
 const s=fixture();for(const p of s.fleet.slice(0,2))for(const start of [0,6,12,18])slot(s,p.id,start);
 const before=structuredClone(s),ctx=context(s),result=weeklyAircraftEconomics(ctx,s.tycoon);
 assert.equal(Object.values(result).reduce((n,p)=>n+p.profit,0),projectedWeekProfit(ctx,s.tycoon));
 for(const p of Object.values(result)){assert(Math.abs(p.revenue-p.cost-p.profit)<1e-7);if(p.revenue)assert.equal(p.margin,p.profit/p.revenue*100);}
 const isolated=weeklyAircraftEconomics(ctx,{...s.tycoon,schedules:s.tycoon.schedules.filter(x=>x.plane===s.fleet[1].id)});
 assert(result[s.fleet[1].id].revenue<isolated[s.fleet[1].id].revenue,'must account for demand consumed by the other aircraft');
 assert.deepEqual(s,before);
});
test('idle and grounded aircraft have no defined margin; cross-week departure is counted once',()=>{
 const s=fixture(),id=s.fleet[0].id;slot(s,id,167);
 const report=weeklyAircraftEconomics(context(s),s.tycoon);assert.equal(report[id].flights,2);assert.equal(report[s.fleet[1].id].margin,null);
 s.fleet[0].fault='Hydraulic fault';const grounded=weeklyAircraftEconomics(context(s),s.tycoon)[id];assert.equal(grounded.revenue,0);assert.equal(grounded.margin,null);assert.equal(grounded.cancelled,2);
});
test('loss-making aircraft retain negative margin without clamping and zero-revenue losses remain visible',()=>{
 const s=fixture(),id=s.fleet[0].id;slot(s,id,0);
 const ctx=context(s);ctx.types={...ctx.types,A320:{...ctx.types.A320,nonfuel:1e7}};
 const loss=weeklyAircraftEconomics(ctx,s.tycoon)[id];assert(loss.profit<0);assert(loss.margin<0);
 s.tycoon.cabins[id]=[0,0,0];const empty=weeklyAircraftEconomics(ctx,s.tycoon)[id];assert.equal(empty.revenue,0);assert(empty.profit<0);assert.equal(empty.margin,null);
});
