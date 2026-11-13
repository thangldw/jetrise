import {compareDecisions} from './decision-comparison.js';
import {compareCustomerStrategies} from './customer-strategy-study.js';
import {proposeSchedule,projectedWeekReports} from './planner.js';
import {recommendRoutes} from './route-recommendations.js';
import {studyLegLedger} from './leg-ledger.js';
self.onmessage=({data})=>{try{self.postMessage(data.kind==='decision-comparison'?{comparison:compareDecisions(data.game,data.specs)}:data.kind==='customer-strategy'?{comparison:compareCustomerStrategies(data.game)}:data.kind==='live-leg-ledger'?{liveLedger:projectedWeekReports(data.ctx,data.state,false).map(({report:{day,revenue,nonfuel,fuelCost,co2Cost,profit,cashDelta,deferredRevenue}})=>({day,revenue,nonfuel,fuelCost,co2Cost,profit,cashDelta,deferredRevenue}))}:data.kind==='leg-ledger'?{ledger:studyLegLedger(data.ctx,data.state)}:data.kind==='route-recommendations'?{recommendations:recommendRoutes(data.ctx,data.state,data.from)}:{proposal:proposeSchedule(data.ctx,data.state)});}catch(error){self.postMessage({error:error.message});}};
