import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,context,Engine,routesFor} from '../src/game.js';
import {scheduledLegs,airborneAt,greatCircle,alongPath,subsolar,terminator} from '../src/live-map.js';

test('scheduled legs for today come from the weekly schedule, including ones carried over midnight',()=>{
 const s=createGame(),routes=routesFor(s),ctx=context(s);s.tycoon.schedules=[{id:1,plane:s.fleet[0].id,route:0,start:((s.day-1)%7)*24+22}];
 const legs=scheduledLegs(s,routes,(p,r)=>Engine.duration(ctx,p,r));
 assert.ok(legs.length>=1);assert.equal(legs[0].departure,22);assert.equal(legs[0].from,routes[0].from);
 assert.ok(airborneAt(legs,22.1).length===1);assert.equal(airborneAt(legs,21.9).length,0);
 const before=JSON.stringify(s);scheduledLegs(s,routes,(p,r)=>Engine.duration(ctx,p,r));assert.equal(JSON.stringify(s),before);
});
test('great circle endpoints, antimeridian continuity and path interpolation',()=>{
 const a={lat:35.55,lon:139.78},b={lat:33.94,lon:-118.41},pts=greatCircle(a,b,40);
 assert.ok(Math.abs(pts[0].lat-a.lat)<1e-9&&Math.abs(pts.at(-1).lat-b.lat)<1e-6);
 for(let i=1;i<pts.length;i++)assert.ok(Math.abs(pts[i].lon-pts[i-1].lon)<30);
 assert.ok(Math.max(...pts.map(p=>p.lat))>a.lat,'trans-Pacific great circle bows north');
 const mid=alongPath([{x:0,y:0},{x:10,y:0}],.5);assert.equal(mid.x,5);assert.equal(mid.angle,0);
});
test('sub-solar point and terminator follow the game clock and season',()=>{
 assert.ok(Math.abs(subsolar(1,12,0).lon)<1e-9);assert.ok(subsolar(1,12,0).lat<-20);assert.ok(subsolar(172,12,0).lat>20);
 const t=terminator(subsolar(172,12,0));assert.equal(t.darkPole,-90);assert.equal(t.line.length,73);
});
