import assert from 'node:assert/strict';
import {context,transition} from '../../src/game.js';
import {slotRequirements} from '../../src/slot-market.js';
export const enableConditional={type:'slot-reservation-enable',migrationId:'conditionalstudy0123456789',acceptTerms:true};
export const enableUtilization={type:'slot-utilization-enable',migrationId:'utilizationstudy0123456789',acceptTerms:true};
export function addStudyFlight(run,network){
 const before=run.game,ctx=context(before);let chosen;
 for(const plane of before.fleet.slice(1)){
  for(const route of before.openedRoutes.filter(i=>ctx.routes[i].to===network.feeder))for(let start=0;start<168;start+=.25){
   const action={type:'add',plane:plane.id,route,start},probe=structuredClone(before);
   for(const airport of probe.slotMarket.airports)for(let hour=0;hour<168;hour++){const key=airport+':'+hour;if(!probe.slotMarket.rights.player[key])probe.slotMarket.rights.player[key]={quantity:1,startedDay:before.day,unlockDay:before.day+7};}
   if(transition(probe,action).error)continue;
   const state=structuredClone(before.tycoon);state.schedules.push({id:state.nextId,plane:plane.id,route,start});
   const needed=slotRequirements(ctx,state),missing=[...needed].filter(([key,n])=>n>(before.slotMarket.rights.player[key]?.quantity||0));
   if(missing.length!==4||missing.some(([,n])=>n!==1))continue;
   chosen={action,missing};break;
  }
  if(chosen)break;
 }
 assert(chosen,'No legal four-new-right study flight');
 for(const [key]of chosen.missing){const [airport,hour]=key.split(':');run.apply({type:'slot-market-buy',airport,hour:Number(hour),quantity:1});}
 run.apply(chosen.action);return {slot:run.game.tycoon.nextId-1,plane:chosen.action.plane,start:chosen.action.start,keys:chosen.missing.map(([key])=>key),signing:before.cash-run.game.cash};
}
export function cancelStudyOccurrence(run,flight){
 const g=run.game;if((g.day-1)%7!==Math.floor(flight.start/24))return false;
 for(const j of [...(g.legEconomy?.overnight?.journeys||[])])if(j.legs.some(l=>l.slot===flight.slot&&l.status==='reserved'&&l.departure>=(g.day-1)*24))run.apply({type:'journey-refund',id:j.id});
 if(!run.game.tycoon.exceptions.some(e=>e.slot===flight.slot&&e.day===g.day))run.apply({type:'recover-flight',slot:flight.slot,day:g.day,mode:'cancel'});
 return true;
}
