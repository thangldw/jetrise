import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,routesFor,typesFor,TYPES} from '../src/game.js';
import {staffing,busiestDayBlockHours,PILOT_DUTY_HOURS,dailyHQ} from '../src/hq.js';

const founded=()=>transition(createGame(),{type:'setup',name:'Crew Air',logo:'wing',color:'#123abc',origin:'HAN',models:['A320','B738']}).game;
test('new careers size pilot demand by the busiest weekday of the schedule',()=>{
 const s=founded();assert.equal(s.gameplay.crew,true);const routes=routesFor(s),types=typesFor(s);
 assert.equal(staffing(s,types,routes).pilots.required,0,'no schedule, no flying pilots');
 s.tycoon.schedules=[{id:1,plane:s.fleet[0].id,route:0,start:8},{id:2,plane:s.fleet[1].id,route:0,start:10},{id:3,plane:s.fleet[0].id,route:0,start:30}];
 const peak=busiestDayBlockHours(s,types,routes);assert.ok(peak>0);
 assert.equal(staffing(s,types,routes).pilots.required,Math.ceil(peak*2/PILOT_DUTY_HOURS*1.1));
 const fresh=founded();assert.deepEqual(restoreGame(JSON.stringify(fresh)),fresh);
 const bad=structuredClone(fresh);bad.gameplay.crew=1;assert.throws(()=>restoreGame(JSON.stringify(bad)));
});
test('older careers and callers without routes keep four pilots per aircraft',()=>{
 const legacy=createGame();assert.equal(staffing(legacy,TYPES,routesFor(legacy)).pilots.required,legacy.fleet.length*4);
 const s=founded();assert.equal(staffing(s,TYPES).pilots.required,s.fleet.length*4);
 assert.ok(Number.isFinite(dailyHQ(s,TYPES,routesFor(s)).salary??0));
});
