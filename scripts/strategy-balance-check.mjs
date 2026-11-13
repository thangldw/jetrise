import {writeFileSync} from 'node:fs';
import {createGame,transition,context,Engine} from '../src/game.js';
import {projectedWeekReports} from '../src/planner.js';
import {fleetSupportFee} from '../src/fleet-policy.js';
const rows=[];
for(const count of [1,2,4,8])for(const mixed of [false,true])for(const rounds of [1,2,3]){
 const s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.tycoon.cabins={};s.tycoon.nextId=1;s.openedRoutes=[0];const prototype=structuredClone(s.fleet[0]);
 s.fleet=Array.from({length:count},(_,i)=>({...structuredClone(prototype),id:'QA-'+(101+i),type:mixed&&i%2?'B738':'A320',wear:0,fault:null,serviceDueAt:300}));s.nextAircraftNumber=101+count;
 for(const p of s.fleet)s.tycoon.cabins[p.id]=Engine.defaultCabin(context(s).types[p.type]);
 for(let day=0;day<7;day++)for(const p of s.fleet)for(let k=0;k<rounds;k++){const result=Engine.add(context(s),s.tycoon,p.id,0,day*24+k*6);if(result.error)throw Error(result.error);}
 const trial=transition(s,{type:'fleet-program',family:'A320'});if(trial.error)throw Error(trial.error);
 const before=projectedWeekReports(context(s),s.tycoon,false),after=projectedWeekReports(context(trial.game),trial.game.tycoon,false),saved=after.reduce((n,d,i)=>n+d.report.profit-before[i].report.profit,0),fee=7*fleetSupportFee(trial.game),upfront=s.cash-trial.game.cash;
 rows.push({aircraft:count,composition:mixed?'alternating A320/B738':'all A320',roundsPerAircraftPerDay:rounds,operatedRounds:before.reduce((n,d)=>n+d.report.rows.length,0),sevenDayFlightSavings:Math.round(saved),sevenDaySupportFees:fee,setupFee:upfront,sevenDayNetDelta:Math.round(saved-fee-upfront)});
}
const output={scenarioCount:rows.length,positiveCases:rows.filter(r=>r.sevenDayNetDelta>0).length,negativeCases:rows.filter(r=>r.sevenDayNetDelta<0).length,scope:'Synthetic paired policy comparison; current seven-day schedule, no new incidents or deliveries; not retention or real airline economics.',rows};
writeFileSync('design/strategy-foundation-v7/support-balance.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({scenarios:output.scenarioCount,positive:output.positiveCases,negative:output.negativeCases,min:Math.min(...rows.map(r=>r.sevenDayNetDelta)),max:Math.max(...rows.map(r=>r.sevenDayNetDelta))}));
