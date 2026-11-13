import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,forecast,restoreGame,context,SAVE_KEY} from '../src/game.js';
import {slotFixture,act} from './fixtures/slot-market.mjs';
import {rivalFixture} from './fixtures/rival-network.mjs';
import {legacySlotRights} from './fixtures/legacy-slot-rights.mjs';
import {slotMarketRows,rivalSlotNeed,sharedSlotDaily} from '../src/slot-market.js';
import {longRunFixture} from './fixtures/long-run.mjs';

test('new acquisitions cap independently of schedules and grandfathered rights remain releasable',()=>{
 let s=slotFixture({active:true}),run=longRunFixture({historicalRaw:JSON.stringify(s)}),raw=run.storage.getItem(SAVE_KEY);
 assert.throws(()=>run.apply({type:'slot-market-buy',airport:'HAN',hour:130,quantity:2}),/tối đa 1 quyền/);assert.equal(run.storage.getItem(SAVE_KEY),raw);
 s=act(s,{type:'slot-market-buy',airport:'HAN',hour:130,quantity:1});assert.equal(s.cash,JSON.parse(raw).cash-500);
 const legacy=legacySlotRights(s,[['HAN',131,3]]),right=structuredClone(legacy.slotMarket.rights.player['HAN:131']);
 assert.deepEqual(restoreGame(JSON.stringify(legacy)),legacy);assert.equal(slotMarketRows(context(legacy),'HAN',5)[11].purchaseLimit,3);
 assert(transition(legacy,{type:'slot-market-buy',airport:'HAN',hour:131,quantity:4}).error);
 let next=legacy;for(let i=0;i<7;i++)next=act(next,{type:'advance'});
 assert.deepEqual(next.slotMarket.rights.player['HAN:131'],right);
 const fee=sharedSlotDaily(next),cash=next.cash;next=act(next,{type:'slot-market-buy',airport:'HAN',hour:131,quantity:1});assert.equal(next.cash,cash);assert.equal(sharedSlotDaily(next),fee-40);
 assert(transition(next,{type:'slot-market-buy',airport:'HAN',hour:131,quantity:2}).error);
});

test('AI reuses paid legal slots with zero signing and forecast equals actual settlement',()=>{
 const s=rivalFixture(),initial=forecast(s),expected=new Map();
 for(const row of initial.competition.rivals){
  const need=rivalSlotNeed(s.slotMarket,row.legs.map(l=>({...l,departure:l.departure+6,arrival:l.arrival+6}))),r=s.strategy.rivals.find(r=>r.id===row.id);let fee=0;
  for(const [key,quantity] of need){s.slotMarket.rights[r.id][key]={quantity,startedDay:1,unlockDay:8};fee+=quantity*500;}
  s.slotMarket.spent[r.id].signing+=fee;r.cash-=fee;expected.set(r.id,row.hour+6);
 }
 const valid=restoreGame(JSON.stringify(s)),f=forecast(valid),closed=act(valid,{type:'advance'});
 for(const r of f.competition.rivals){assert.equal(r.slotSigning,0);assert.equal(r.hour,expected.get(r.id));assert.equal(r.legs.length,2);}
 assert.deepEqual(closed.tycoon.history[0].competition,f.competition);assert.deepEqual(closed.slotMarket,f.slotMarketState);
});
