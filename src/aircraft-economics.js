import {projectedWeekReports} from './planner.js';

export function weeklyAircraftEconomics(ctx,state){
 const aircraft=Object.fromEntries(ctx.fleet.map(p=>[p.id,{revenue:0,cost:0,profit:0,flights:0,cancelled:0,margin:null}]));
 // Evaluate the complete fleet together so competing aircraft share route demand.
 for(const {report} of projectedWeekReports(ctx,state,false)){
  for(const row of report.rows){const p=aircraft[row.plane];if(!p)continue;p.revenue+=row.revenue;p.cost+=row.nonfuel+row.fuelCost+row.co2Cost;p.profit+=row.profit;p.flights+=row.flights??2;}
  for(const row of report.cancellations)aircraft[row.plane].cancelled+=2;
 }
 for(const p of Object.values(aircraft))p.margin=p.revenue>0?p.profit/p.revenue*100:null;
 return aircraft;
}
