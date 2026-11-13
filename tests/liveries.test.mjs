import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,forecast} from '../src/game.js';
import {LIVERIES,liveryStyle,LIVERY_GROUPS,nameInk} from '../src/liveries.js';
test('extended paint catalog retains legacy IDs and every paint persists with cosmetic-only economics',()=>{
 assert.deepEqual(LIVERIES.slice(0,3).map(l=>l.name),['VANTIS Coral','Tết · Thịnh vượng','Kỷ niệm · Aurora']);assert.equal(LIVERIES.length,18);assert.equal(LIVERY_GROUPS.length,5);
 const base=createGame(),original=forecast(base);
 for(let i=1;i<LIVERIES.length;i++){
  const r=transition(base,{type:'paint',plane:base.fleet[0].id,livery:i});assert(!r.error,r.error);assert.equal(r.game.cash,base.cash-LIVERIES[i].price);assert.equal(r.game.fleet[0].livery,i);assert.equal(forecast(r.game).profit,original.profit);assert.equal(restoreGame(JSON.stringify(r.game)).fleet[0].livery,i);assert(transition(r.game,{type:'paint',plane:base.fleet[0].id,livery:i}).error);assert.match(liveryStyle(i).color,/^#[0-9a-f]{6}$/i);
 }
 assert.equal(liveryStyle(0,'#123456').color,'#123456');assert(transition(base,{type:'paint',plane:base.fleet[0].id,livery:99}).error);
});
test('nameInk keeps readable brand colors and swaps near-white ones for dark ink',()=>{
 assert.equal(nameInk('#c0392b'),'#c0392b');assert.equal(nameInk('#ffffff'),'#17314a');assert.equal(nameInk('#f5f5dc'),'#17314a');assert.equal(nameInk('bad'),'#17314a');
});
