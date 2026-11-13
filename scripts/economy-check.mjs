import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
import {createGame,transition,context,Engine,TYPES,forecast,routeInfo} from '../src/game.js';
import {STARTING_MODELS} from '../src/founding.js';
import {OPTIONS} from '../src/fleet.js';
import {dailyHQ,RESEARCH} from '../src/hq.js';
const results={rules:'operations-upgrade-v2',days:28,assumptions:'Synthetic game money. HAN hub; all 10 distinct starting-model pairs. Default cabins/fares; no external demand shocks. Managed policy schedules profitable same-day rounds and maintains at30h or fault. Not a globally optimal policy.',scenarios:[]};
function act(s,a){const r=transition(s,a);if(r.error)throw Error(JSON.stringify(a)+':'+r.error);return r.game;}
function setup(models){let s=act(createGame(),{type:'setup',name:'Audit Air',origin:'HAN',logo:'wing',color:'#1d77ca',models});s=act(s,{type:'founding-next'});for(const route of [0,1,3])s=act(s,{type:'unlock',route});return act(s,{type:'founding-finish'});}
function simulate(models,policy){let s=setup(models),initial=s.cash,maintenance=0,profit=0,pax=0,cancelled=0,flights=0,rows=[];if(policy==='unmaintained'){for(const p of s.fleet)s=act(s,{type:'auto',plane:p.id,route:1});}
 for(let n=0;n<28;n++){
  if(policy==='managed'){
   for(const p of [...s.fleet])if(!p.maintenance&&(p.hoursSinceService>=30||p.fault)){const before=s.cash;s=act(s,{type:'maintenance',plane:p.id,day:s.day});maintenance+=before-s.cash;}
   s.tycoon.schedules=[];
   const startDay=(s.day-1)%7*24;
   for(const p of s.fleet){for(let start=startDay;start<startDay+24;start+=.25){let best=null;const baseline=forecast(s).profit;for(const route of s.openedRoutes){if(start+Engine.duration(context(s),p.id,route)>startDay+24||Engine.slotError(context(s),s.tycoon,p.id,route,start))continue;const t=structuredClone(s);Engine.add(context(t),t.tycoon,p.id,route,start);const gain=forecast(t).profit-baseline,score=gain/Engine.duration(context(t),p.id,route);if(gain>0&&(!best||score>best.score))best={route,score};}if(best)s=act(s,{type:'add',plane:p.id,route:best.route,start});}}
  }
  const r=transition(s,{type:'advance'});if(r.error)throw Error(r.error);s=r.game;profit+=r.report.profit;pax+=r.report.pax;flights+=r.report.flights;cancelled+=r.report.cancelled;rows.push({day:n+1,cash:s.cash,profit:r.report.profit,cancelled:r.report.cancelled});
 }
 return {models,policy,initialCash:initial,finalCash:s.cash,cashChange:s.cash-initial,reportedProfit:profit,maintenanceSpend:maintenance,netAfterMaintenance:profit,pax,flights,cancelled,rows};}
for(let i=0;i<STARTING_MODELS.length;i++)for(let j=i+1;j<STARTING_MODELS.length;j++)for(const policy of ['idle','unmaintained','managed'])results.scenarios.push(simulate([STARTING_MODELS[i],STARTING_MODELS[j]],policy));
const base=setup(['A320','B738']);results.overhead=dailyHQ(base,TYPES);results.purchasing={sixA380:6*TYPES.A388.price,remainingAfterSixA380:base.cash-6*TYPES.A388.price,maxFleet:8,allOptionsPerAircraft:Object.values(OPTIONS).reduce((n,o)=>n+o.price,0),allResearch:Object.values(RESEARCH).reduce((n,o)=>n+o.price,0)};
results.routeQuotes=Object.entries(TYPES).map(([model,t])=>{const s=structuredClone(base);s.fleet[0].type=model;s.tycoon.cabins[s.fleet[0].id]=Engine.defaultCabin(t);const q=routeInfo(s,1,s.fleet[0].id).estimate;return {model,cabin:s.tycoon.cabins[s.fleet[0].id],pax:q.pax,profit:q.profit,burn:q.burn,co2:q.co2,price:t.price};});
let overshoot=structuredClone(base);overshoot.fleet[0].hoursSinceService=39;overshoot.tycoon.schedules=[];for(const start of [0,6,12,18])overshoot.tycoon.schedules.push({id:overshoot.tycoon.nextId++,plane:overshoot.fleet[0].id,route:1,start});const preClose=forecast(overshoot),close=transition(overshoot,{type:'advance'});results.maintenanceThreshold={before:39,flownHours:preClose.rows.reduce((n,r)=>n+r.hours,0),after:close.game.fleet[0].hoursSinceService,cancelled:close.report.cancelled};
// Demonstrate that training is allowed with zero staff and still grants the same modifier.
let empty=structuredClone(base);empty.hq.staff.pilots=0;const before=context(empty).modifiers.fuel;empty=act(empty,{type:'training',team:'pilots'});results.trainingWithoutStaff={before,after:context(empty).modifiers.fuel,staff:empty.hq.staff.pilots};
// Startup hangar prices differ for a non-HAN hub even though each is included.
results.startingHubs=['HAN','SGN','NRT'].map(origin=>{const s=act(createGame(),{type:'setup',name:'Audit Air',origin,logo:'wing',color:'#1d77ca',models:['A320','B738']});return {origin,dailyOverhead:dailyHQ(s,TYPES).overhead};});
// Extra action-level probes; no live or persisted game state is touched.
let orderProbe=act(createGame(),{type:'setup',name:'Audit Air',origin:'HAN',logo:'wing',color:'#1d77ca',models:['A320','B738']});
for(let i=0;i<6;i++)orderProbe=act(orderProbe,{type:'buy',model:'A388'});
let reverseProbe=setup(['A320','B738']);reverseProbe=act(reverseProbe,{type:'hub-buy',hub:'SGN'});reverseProbe=act(reverseProbe,{type:'route-create',from:'SGN',to:'HAN'});
results.actionProbes={sixA380:{orders:orderProbe.orders.length,fleet:orderProbe.fleet.length,cash:orderProbe.cash},reverseRoute:{accepted:true,custom:reverseProbe.network.routes}};
fs.writeFileSync(path.join(root,'design/economy-upgrade-results.json'),JSON.stringify(results,null,2));
for(const policy of ['idle','unmaintained','managed']){const all=results.scenarios.filter(s=>s.policy===policy),vals=all.map(s=>s.netAfterMaintenance);console.log(JSON.stringify({policy,n:all.length,minNet:Math.min(...vals),maxNet:Math.max(...vals),meanNet:vals.reduce((a,b)=>a+b)/vals.length,minCash:Math.min(...all.map(s=>s.finalCash)),maxCash:Math.max(...all.map(s=>s.finalCash)),meanCancelled:all.reduce((n,s)=>n+s.cancelled,0)/all.length,meanPax:all.reduce((n,s)=>n+s.pax,0)/all.length}));}
console.log(JSON.stringify({purchasing:results.purchasing,maintenanceThreshold:results.maintenanceThreshold,trainingWithoutStaff:results.trainingWithoutStaff,overhead:results.overhead,startingHubs:results.startingHubs}));
