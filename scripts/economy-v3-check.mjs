import fs from 'node:fs';
import {createGame,transition,context,Engine,typesFor,forecast} from '../src/game.js';
import {STARTING_MODELS} from '../src/founding.js';
const act=(s,a)=>{const r=transition(s,a);if(r.error)throw Error(JSON.stringify(a)+': '+r.error);return r.game;};
const result={rules:'economy-v3',days:28,assumptions:'Synthetic HAN careers, all10 starting pairs, same three owned routes, default cabins/fares. Managed policy repairs faults and adds positive-marginal same-day rounds hourly, retaining weekly checks. No purchases or demand shocks; this is a baseline policy, not global optimization.',scenarios:[]};
function run(models,policy){let s=act(createGame(),{type:'setup',name:'Balance QA',origin:'HAN',logo:'wing',color:'#2563eb',models});s=act(s,{type:'founding-next'});for(const route of [0,1,3])s=act(s,{type:'unlock',route});s=act(s,{type:'founding-finish'});const initial=s.cash;let profit=0,pax=0,cancelled=0,flights=0;
 if(policy==='managed')for(const p of s.fleet)s=act(s,{type:'service-plan',plane:p.id,start:0});
 for(let d=0;d<28;d++){
  if(policy==='managed')for(const p of [...s.fleet])if((p.fault||p.wear>=90)&&!p.maintenance)s=act(s,{type:'repair',plane:p.id});
  if(policy!=='idle'){s.tycoon.schedules=[];const first=(s.day-1)%7*24;for(let at=first;at<first+24;at++)for(const p of s.fleet){let best=null,baseline=forecast(s).profit;for(const route of s.openedRoutes){if(at+Engine.duration(context(s),p.id,route)>first+24||Engine.slotError(context(s),s.tycoon,p.id,route,at))continue;const t=structuredClone(s);Engine.add(context(t),t.tycoon,p.id,route,at);const gain=forecast(t).profit-baseline;if(gain>0&&(!best||gain>best.gain))best={route,gain};}if(best)s=act(s,{type:'add',plane:p.id,route:best.route,start:at});}}
  const r=transition(s,{type:'advance'});if(r.error)throw Error(r.error);s=r.game;profit+=r.report.profit;pax+=r.report.pax;flights+=r.report.flights;cancelled+=r.report.cancelled;
 }
 return {models,policy,initialCash:initial,finalCash:s.cash,cashChange:s.cash-initial,reportedProfit:profit,pax,flights,cancelled};
}
for(let i=0;i<STARTING_MODELS.length;i++)for(let j=i+1;j<STARTING_MODELS.length;j++)for(const policy of ['idle','unmaintained','managed'])result.scenarios.push(run([STARTING_MODELS[i],STARTING_MODELS[j]],policy));
const s=act(createGame(),{type:'setup',name:'Price QA',origin:'HAN',logo:'wing',color:'#2563eb',models:['A320','B738']}),types=typesFor(s);result.capital={startingCash:s.cash,a320:types.A320.price,a380:types.A388.price,sixA380:6*types.A388.price,canAffordA380:s.cash>=types.A388.price};
result.summary=['idle','unmaintained','managed'].map(policy=>{const rows=result.scenarios.filter(s=>s.policy===policy),values=rows.map(s=>s.cashChange);return {policy,minCashChange:Math.min(...values),maxCashChange:Math.max(...values),meanCashChange:values.reduce((n,x)=>n+x,0)/rows.length,meanPax:rows.reduce((n,x)=>n+x.pax,0)/rows.length};});
fs.writeFileSync(new URL('../design/economy-v3-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({summary:result.summary,capital:result.capital},null,2));
