import {transition,context} from './game.js';
import {positioningKey} from './positioning.js';
import {CUSTOMER_OBJECTIVES} from './customer-strategy.js';

// Same saved market, fleet, schedule, cash and deterministic incident seed for each replay.
export function compareCustomerStrategies(game){
 const profiles={budget:{fare:.85,position:'value',connections:false},business:{fare:1.15,position:'business',connections:false},hub:{fare:1,position:'none',connections:true}};
 return Object.entries(profiles).map(([id,p])=>{
  let s=structuredClone(game),setupCost=0,profit=0,customers=0,through=0,days=0;
  const apply=a=>{const result=transition(s,a);if(result.error)throw Error(result.error);s=result.game;return result;};
  try{
   if(!s.customerStrategy)throw Error('Bật JET-205 trước khi so sánh.');
   if(positioningKey(s)!==p.position)apply({type:'positioning',key:p.position});
   for(const route of s.openedRoutes){const base=context(s).routes[route].baseFare,values=[1,2.5,5].map(k=>Math.max(20,Math.min(10000,Math.round(base*k*p.fare))));if(JSON.stringify(values)!==JSON.stringify(s.tycoon.prices[route]))apply({type:'prices',route,values});}
   apply({type:'connection-program',enabled:p.connections,minimum:60,maximum:1440});
   setupCost=game.cash-s.cash;
   for(let i=0;i<7;i++){const {report}=apply({type:'advance'});days++;profit+=report.profit;customers+=report.customers.count;through+=report.customers.throughCompleted;}
   return {id,name:CUSTOMER_OBJECTIVES[id],days,setupCost,profit,customers,through,cashDelta:s.cash-game.cash,scores:s.customerStrategy.scores};
  }catch(e){return {id,name:CUSTOMER_OBJECTIVES[id],days,error:e.message};}
 });
}
