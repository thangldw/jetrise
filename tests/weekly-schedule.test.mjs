import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,Engine,context} from '../src/game.js';
function empty(){const s=createGame();s.tycoon.schedules=[];s.fleet[0].hoursSinceService=0;return s;}
test('weekly selection encodes weekdays and clock time, persists and repeats',()=>{
 const s=empty(),r=transition(s,{type:'add-weekly',plane:s.fleet[0].id,route:2,days:[4,0,2],at:8.25});
 assert(!r.error,r.error);assert.deepEqual(r.game.tycoon.schedules.map(x=>x.start),[8.25,56.25,104.25]);
 assert.equal(s.tycoon.schedules.length,0);assert.deepEqual(restoreGame(JSON.stringify(r.game)),r.game);
 const edit=transition(r.game,{type:'edit',id:r.game.tycoon.schedules[1].id,plane:s.fleet[0].id,route:2,start:81.5});assert(!edit.error,edit.error);assert.equal(edit.game.tycoon.schedules[1].start,81.5);
});
test('weekly batch rejects collisions without adding any other selected day',()=>{
 const s=empty();Engine.add(context(s),s.tycoon,s.fleet[0].id,2,24+8);
 const r=transition(s,{type:'add-weekly',plane:s.fleet[0].id,route:2,days:[0,1,2],at:8});
 assert(r.error.includes('Thứ Ba'));assert.strictEqual(r.game,s);assert.equal(s.tycoon.schedules.length,1);
});
test('invalid weekdays, duplicate days, clock and unopened routes fail atomically',()=>{
 const s=empty();for(const options of [{days:[]},{days:[7]},{days:[-1]},{days:[1,1]},{days:[1.5]},{at:24},{at:-1},{at:8.1},{at:NaN},{route:4}]){
 const r=transition(s,{type:'add-weekly',plane:s.fleet[0].id,route:2,days:[0],at:8,...options});assert(r.error,JSON.stringify(options));assert.strictEqual(r.game,s);
 }
});
test('weekly batch enforces maintenance deadline and end-of-week bounds',()=>{
 const s=empty();s.fleet[0].serviceDueAt=8;
 let r=transition(s,{type:'add-weekly',plane:s.fleet[0].id,route:2,days:[0,1],at:8});assert(r.error);assert.strictEqual(r.game,s);
 const clean=empty();r=transition(clean,{type:'add-weekly',plane:clean.fleet[0].id,route:2,days:[5,6],at:23.75});assert(r.error);assert.strictEqual(r.game,clean);
});
