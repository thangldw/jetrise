import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition} from '../src/game.js';
import {longRunFixture,maintainFleet} from './fixtures/long-run.mjs';
import {profitReview,reportBridge} from '../src/profit-review.js';
const near=(a,b)=>assert(Math.abs(a-b)<.005,`${a} != ${b}`);

test('actual closes reconcile legacy and all-JET profit/cash without altering careers',()=>{
 for(const stage of [0,206]){
  const run=longRunFixture({stage});
  for(let i=0;i<14;i++){maintainFleet(run);run.apply({type:'advance'});}
  const game=run.game,raw=JSON.stringify(game),review=profitReview(game.tycoon.history,7);
  assert(review.ready&&review.before);
  near(review.total.profit-review.before.profit,review.changes.reduce((n,x)=>n+x.amount,0));
  for(const b of review.bridges){near(b.profitResidual,0);near(b.cashResidual,0);}
  assert(review.aircraft.length>0);
  assert.equal(review.routes===null,stage===0);
  assert.equal(JSON.stringify(game),raw);
 }
});

test('historical gaps, duplicate days and missing fields never become zero or a partial week',()=>{
 const r=transition(createGame(),{type:'advance'}).report;
 assert.equal(profitReview([]).ready,false);
 assert.equal(profitReview([r,r]).ready,false);
 assert.equal(profitReview([r],7).ready,false);
 const gap=profitReview([{...r,day:3},r]);assert.equal(gap.before,null);
 const missing={...r,day:2};delete missing.aircraft;delete missing.fuelCost;delete missing.maintenanceCost;delete missing.maintenancePrepaid;
 const review=profitReview([missing,r]);
 assert.equal(review.total.fuelCost,null);assert.equal(review.changes.find(x=>x.key==='fuelCost').amount,null);
 assert.equal(review.aircraft,null);assert.equal(review.bridges[0].cashResidual,null);
 const corrupt=reportBridge({...r,profit:r.profit+15});near(corrupt.profitResidual,15);
});

test('rankings include removed aircraft and routes using actual saved events only',()=>{
 const base={day:1,revenue:100,nonfuel:10,fuelCost:5,co2Cost:1,profit:84,cashDelta:84,pax:2,cancelled:0};
 const old={...base,aircraft:{OLD:{profit:80}},legEvents:[{route:3,revenue:100,cost:20}]};
 const now={...base,day:2,aircraft:{NEW:{profit:20}},legEvents:[{route:7,revenue:30,cost:10}]};
 const review=profitReview([now,old]);
 assert.deepEqual(review.aircraft.map(x=>[x.id,x.delta]),[['OLD',-80],['NEW',20]]);
 assert.deepEqual(review.routes.map(x=>[x.id,x.delta]),[[3,-80],[7,20]]);
});
