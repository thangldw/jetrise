import test from 'node:test';
import assert from 'node:assert/strict';
import {trendSeries} from '../src/performance-trend.js';

test('trend series reads history oldest first and keeps the last 28 days',()=>{
 const history=Array.from({length:40},(_,i)=>({day:40-i,profit:i,revenue:2*i,pax:i}));
 const s=trendSeries(history);assert.equal(s.length,28);assert.equal(s[0].day,13);assert.equal(s.at(-1).day,40);
 assert.equal(JSON.stringify(history.map(h=>h.day)),JSON.stringify(Array.from({length:40},(_,i)=>40-i)),'does not mutate history');
});
