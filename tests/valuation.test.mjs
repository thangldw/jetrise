import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,typesFor} from '../src/game.js';
import {airlineValue,standing,TIERS,startingCapital} from '../src/valuation.js';

test('airline value counts cash and owned aircraft minus loans; tiers scale with starting capital',()=>{
 const s=transition(createGame(),{type:'setup',name:'Value Air',logo:'wing',color:'#123abc',origin:'HAN',models:['A320','B738']}).game,types=typesFor(s);
 const v=airlineValue(s,types);assert.equal(v.cash,s.cash);assert.ok(v.fleet>0);assert.equal(v.total,v.cash+v.fleet-v.debt);
 const st=standing(s,types);assert.ok(TIERS.includes(st.tier));assert.ok(st.progress>=0&&st.progress<=1);
 const rich={...s,cash:startingCapital(s)*30};assert.equal(standing(rich,types).tier.id,'global');assert.equal(standing(rich,types).next,null);
 const indebted={...s,hq:{...s.hq,loan:{balance:1000000}}};assert.equal(airlineValue(indebted,types).total,v.total-1000000);
 const legacy=createGame();assert.equal(startingCapital(legacy),legacy.cash);
});
test('every founding draw starts as a start-up',()=>{
 for(const models of [['A221','E295'],['A321','B38M'],['A320','B738']]){const s=transition(createGame(),{type:'setup',name:'Value Air',logo:'wing',color:'#123abc',origin:'HAN',models}).game;assert.equal(standing(s,typesFor(s)).tier.id,'startup');}
 const legacy=createGame();assert.equal(standing(legacy,typesFor(legacy)).tier.id,'startup');
});
