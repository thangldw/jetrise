import test from 'node:test';
import assert from 'node:assert/strict';
import {compareDecisions} from '../src/decision-comparison.js';
import {transition,restoreGame,createGame} from '../src/game.js';
import {decisionFixture,decisionSpecs} from './fixtures/decision-comparison.mjs';
import {longRunFixture} from './fixtures/long-run.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<.005,`${a} != ${b}`);
const apply=(game,option,basis)=>transition(game,{type:'decision-apply',proposal:{basis,option}});

test('four independent snapshot options match canonical actions and full cash/P&L replay without advancing the applied career',()=>{
 const game=decisionFixture(),raw=JSON.stringify(game),comparison=compareDecisions(game,decisionSpecs(game));
 assert.equal(JSON.stringify(game),raw);assert.equal(comparison.options.length,4);
 for(const option of comparison.options){
  assert(!option.error,option.error);assert.equal(option.metrics.days,7);
  let expected=game;
  for(const action of option.actions){const r=transition(expected,action);assert(!r.error,r.error);expected=r.game;}
  const applied=apply(game,option,comparison.basis);assert(!applied.error,applied.error);assert.deepEqual(applied.game,expected);assert.equal(applied.game.day,game.day);
  near(game.cash-expected.cash,option.upfront);assert.deepEqual(restoreGame(JSON.stringify(expected)),expected);
  let profit=0;for(let i=0;i<7;i++){const r=transition(expected,{type:'advance'});assert(!r.error,r.error);profit+=r.report.profit;expected=r.game;}
  near(expected.cash,option.metrics.cashAfter);near(profit,option.metrics.profit);
  assert.equal(applied.game.fleet.length,game.fleet.length+(option.kind==='lease'?1:0));
  assert.equal(applied.game.openedRoutes.length,game.openedRoutes.length+(option.kind==='route'?1:0));
 }
 assert.deepEqual(compareDecisions(game,decisionSpecs(game)),comparison);
});

test('frequency changes preserve retained IDs and other clocks; a failed lease/check/flight batch spends nothing',()=>{
 let game=decisionFixture();
 for(const a of [{type:'add-weekly',plane:game.fleet[0].id,route:3,days:[0,2,4],at:8},{type:'add-weekly',plane:game.fleet[0].id,route:3,days:[1],at:15}]){const r=transition(game,a);assert(!r.error);game=r.game;}
 const keep=game.tycoon.schedules.filter(x=>x.start!==56),spec={kind:'frequency',plane:game.fleet[0].id,route:3,days:[0,4,6],at:8};
 const c=compareDecisions(game,[spec]),r=apply(game,c.options[0],c.basis);assert(!r.error,r.error);
 for(const slot of keep)assert.deepEqual(r.game.tycoon.schedules.find(x=>x.id===slot.id),slot);
 assert(!r.game.tycoon.schedules.some(x=>x.start===56));assert(r.game.tycoon.schedules.some(x=>x.start===152));
 const late={...decisionSpecs(game)[2],serviceStart:164};assert(compareDecisions(game,[late]).options[0].error,'late first check must be rejected');
 const raw=JSON.stringify(game),bad={...decisionSpecs(game)[2],days:[0],at:8,serviceStart:8};
 const invalid=compareDecisions(game,[bad,decisionSpecs(game)[0]]);assert(invalid.options[0].error);assert(!invalid.options[1].error);assert.equal(JSON.stringify(game),raw);
 assert(apply(game,invalid.options[0],invalid.basis).error);assert.equal(JSON.stringify(game),raw);
});

test('stale and altered proposal summaries, costs, actions or specs are rejected atomically',()=>{
 const game=decisionFixture(),c=compareDecisions(game,[decisionSpecs(game)[0]]),original=c.options[0];
 const next=transition(game,{type:'stock',resource:'fuel',amount:10}).game;
 assert.match(apply(next,original,c.basis).error,/Snapshot/);
 for(const tamper of [o=>o.metrics.profit++,o=>o.upfront=0,o=>o.actions=[],o=>o.spec.percent=120]){const option=structuredClone(original);tamper(option);const r=apply(game,option,c.basis);assert(r.error);assert.strictEqual(r.game,game);}
 const done=apply(game,original,c.basis);assert(!done.error);assert(apply(done.game,original,c.basis).error);
});

test('incomplete horizons have no misleading delta and cannot be applied from comparison',()=>{
 const game=decisionFixture();game.cash=6000;const c=compareDecisions(game,[decisionSpecs(game)[0]]),o=c.options[0];
 assert(c.baseline.days<7);assert(o.metrics.days<7);assert.equal(o.profitDelta,null);assert.equal(o.cashDelta,null);assert(apply(game,o,c.basis).error);
});

test('all-JET commitments, slot ownership and legacy schema remain intact during preview and canonical apply',()=>{
 const run=longRunFixture();run.apply({type:'advance'});
 for(const game of [createGame(),run.game]){
  const raw=JSON.stringify(game),route=game.openedRoutes[0],c=compareDecisions(game,[{kind:'fares',route,percent:110}]);assert.equal(JSON.stringify(game),raw);
  const o=c.options[0];assert(!o.error,o.error);const result=apply(game,o,c.basis);assert(!result.error,result.error);
  const direct=transition(game,{type:'prices',route,values:game.tycoon.prices[route].map(n=>Math.max(20,Math.min(10000,Math.round(n*1.1))))});
  assert.deepEqual(result.game,direct.game);assert.deepEqual(restoreGame(JSON.stringify(result.game)),result.game);
 }
});
