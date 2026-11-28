import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,context} from '../src/game.js';
import {economyPhase,ECONOMY_PHASES,PHASE_DAYS,marketPrices,demandEventFactor} from '../src/gameplay.js';

const founded=()=>transition(createGame(),{type:'setup',name:'Cycle Air',logo:'wing',color:'#123abc',origin:'HAN',models:['A320','B738']}).game;
test('new careers get a deterministic four-week economic cycle; older careers stay flat',()=>{
 const s=founded();assert.equal(s.gameplay.cycle,true);const ctx=context(s);
 const phases=new Set();for(let d=s.day;d<s.day+PHASE_DAYS*6;d++){const p=economyPhase(ctx,d);phases.add(p.id);assert.ok(d>=p.start&&d<=p.end);assert.deepEqual(economyPhase(ctx,d),p);}
 assert.ok(phases.size>=3);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const old=structuredClone(s);delete old.gameplay.cycle;const octx=context(restoreGame(JSON.stringify(old)));
 for(let d=s.day;d<s.day+60;d++){assert.equal(economyPhase(octx,d).demand,1);}
 const bad=structuredClone(s);bad.gameplay.cycle='yes';assert.throws(()=>restoreGame(JSON.stringify(bad)));
});
test('phase scales demand and fuel price',()=>{
 const s=founded(),ctx=context(s),flat={...ctx,gameplay:{...ctx.gameplay,cycle:undefined}};
 for(let d=s.day;d<s.day+PHASE_DAYS*6;d+=PHASE_DAYS){const p=economyPhase(ctx,d);
  assert.ok(Math.abs(demandEventFactor(ctx,d)-demandEventFactor(flat,d)*p.demand)<1e-9);
  assert.ok(Math.abs(marketPrices(ctx,d).fuelPrice-marketPrices(flat,d).fuelPrice*p.fuel)<1e-9);}
 assert.ok(ECONOMY_PHASES.recession.demand<1&&ECONOMY_PHASES.boom.demand>1);
});
