import assert from 'node:assert/strict';
import {context,transition,SAVE_KEY} from '../../src/game.js';
import {slotRequirements} from '../../src/slot-market.js';

// All actual mutations use apply/persist. Fully provisioned copies below are
// read-only feasibility probes; they never grant a right to the operating save.
function feasible(game,action){
 const probe=structuredClone(game),m=probe.slotMarket;
 for(const airport of m.airports)for(let h=0;h<168;h++){
  const key=airport+':'+h,other=(m.rights.swift[key]?.quantity||0)+(m.rights.aurelia[key]?.quantity||0);
  m.rights.player[key]={quantity:4-other,startedDay:game.day,unlockDay:game.day+7};
 }
 return !transition(probe,action).error;
}
export function runSlotAttack(run,kind,network){
 const before=run.game,initialRaw=run.storage.getItem(SAVE_KEY),events=[];
 const act=a=>{const raw=run.storage.getItem(SAVE_KEY),g=run.game,r=transition(g,a);
  if(r.error){assert.match(r.error,/Experimental slot access|Mỗi thứ\/giờ chỉ mua mới tối đa 1 quyền/,'attack failed for an unrelated reason');assert.deepEqual(r.game,g);assert.equal(run.storage.getItem(SAVE_KEY),raw);events.push({action:a,accepted:false,error:r.error});return false;}
  run.apply(a);events.push({action:a,accepted:true});return true;
 };
 const requirements=action=>{
  const g=run.game,state=structuredClone(g.tycoon);
  if(action.type==='add')state.schedules.push({id:state.nextId,plane:action.plane,route:action.route,start:action.start});
  else{const x=state.schedules.find(x=>x.id===action.id);Object.assign(x,{plane:action.plane,route:action.route,start:action.start});}
  return slotRequirements(context(g),state);
 };
 const buyNeeded=action=>{
  const need=requirements(action),entries=[...need].sort(([a],[b])=>Number(b.startsWith(network.hub+':'))-Number(a.startsWith(network.hub+':'))||a.localeCompare(b));
  for(const [key,n] of entries)if(n>(run.game.slotMarket.rights.player[key]?.quantity||0)){const [airport,hour]=key.split(':');if(!act({type:'slot-market-buy',airport,hour:Number(hour),quantity:n}))return false;}
  return true;
 };
 let completed=0;
 if(kind==='stack-cancel'){
  const g=run.game,plane=g.fleet[1].id,route=g.openedRoutes.find(i=>context(g).routes[i].to===network.feeder);
  const candidates=g.tycoon.schedules.filter(s=>s.plane===g.fleet[0].id&&s.start>=24&&s.start<144).map(s=>({type:'add',plane,route,start:s.start}));
  const action=candidates.find(a=>feasible(g,a));assert(action,'no legal temporary flight for stack attack');
  if(buyNeeded(action)){
   assert(act(action));const id=run.game.tycoon.nextId-1,key=network.hub+':'+Math.floor(action.start),owned=run.game.slotMarket.rights.player[key].quantity;
   act({type:'slot-market-buy',airport:network.hub,hour:Math.floor(action.start),quantity:Math.min(4,owned+1)});
   assert(act({type:'remove',id}));completed++;
  }
 }else if(kind==='edit-revert'){
  const original=before.tycoon.schedules.find(s=>s.plane===before.fleet[1].id&&s.start>=24&&s.start<48);assert(original);
  for(const clock of [6,8,10,12,14,18,20,6.25,8.25,10.25,12.25,14.25,18.25,20.25]){
   if(completed===3)break;const action={type:'edit',id:original.id,plane:original.plane,route:original.route,start:24+clock};
   if(action.start===original.start||!feasible(run.game,action))continue;
   // Target empty/low-pressure hours in both policies, then retain paid rights
   // when reverting. This tests spreading idle rights rather than stacking.
   if([...requirements(action)].some(([key,n])=>n>Math.max(run.game.slotMarket.rights.player[key]?.quantity||0,1)))continue;
   assert(buyNeeded(action));assert(act(action));assert(act({type:'edit',id:original.id,plane:original.plane,route:original.route,start:original.start}));completed++;
  }
  assert.equal(completed,3,'insufficient legal edit/revert targets');
 }else throw Error('Unknown schedule attack '+kind);
 const after=run.game;
 assert.deepEqual(after.tycoon.schedules,before.tycoon.schedules,'attack did not restore the original timetable');
 assert.deepEqual(after.fleet,before.fleet);assert.deepEqual(after.tycoon.cabins,before.tycoon.cabins);assert.deepEqual(after.tycoon.prices,before.tycoon.prices);
 for(const [key,right] of Object.entries(before.slotMarket.rights.player))assert.deepEqual({...after.slotMarket.rights.player[key],quantity:right.quantity},right,'old right terms changed');
 assert.equal(before.cash-after.cash,after.slotMarket.spent.player.signing-before.slotMarket.spent.player.signing);
 return {kind,completed,events,signing:before.cash-after.cash,initialRawUnchanged:initialRaw===run.storage.getItem(SAVE_KEY)};
}
