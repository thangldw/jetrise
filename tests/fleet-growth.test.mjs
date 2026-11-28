import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,fleetCapacity} from '../src/game.js';

test('fleet ceiling grows with hubs and hangars, capped at 24, and survives save round-trip',()=>{
 let s=createGame();s.cash=1e10;
 assert.equal(fleetCapacity(s),8+2*Object.values(s.hq.hubs).reduce((n,h)=>n+h.hangar,0)+4*(Object.keys(s.hq.hubs).length-1));
 const base=fleetCapacity(s);
 const r=transition(s,{type:'hub-buy',hub:'SGN'});assert(!r.error,r.error);s=r.game;assert.equal(fleetCapacity(s),base+4);
 const h=transition(s,{type:'hangar',hub:'SGN'});assert(!h.error,h.error);s=h.game;assert.equal(fleetCapacity(s),base+6);
 for(const hub of ['DAD','BKK','SIN','HKG','ICN','NRT'])s=transition(s,{type:'hub-buy',hub}).game;assert.equal(fleetCapacity(s),24);
 let bought=0;while(s.fleet.length+s.orders.length<fleetCapacity(s)){const b=transition(s,{type:'buy',model:'A320'});if(b.error)break;s=b.game;bought++;}
 assert.equal(s.fleet.length+s.orders.length,24,'buys up to the ceiling');assert.match(transition(s,{type:'buy',model:'A320'}).error,/24/);
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
