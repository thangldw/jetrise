import {flightSegments} from './week-time.js';
import {weeklySegments} from './maintenance.js';
import Engine from './engine.js';
import {projectedWeekReports,projectedCohortProfit} from './planner.js';

export function scheduleGaps(ctx,state,pid,wrap=false){
 const p=ctx.fleet.find(p=>p.id===pid),slots=[...flightSegments(state.schedules.filter(s=>s.plane===pid),s=>Engine.duration(ctx,pid,s.route)).map(s=>({start:Math.max(0,s.start),end:Math.min(168,s.end)})),...(p?weeklySegments(p,ctx.day):[])].sort((a,b)=>a.start-b.start),gaps=[];
 let end=0;
 for(const s of slots){if(s.start>end)gaps.push({start:end,end:s.start});end=Math.max(end,s.end);}
 if(end<168)gaps.push({start:end,end:168});
 if(wrap&&gaps.length>1&&gaps[0].start===0&&gaps.at(-1).end===168)gaps.at(-1).end+=gaps[0].end;
 return gaps.filter(g=>g.end-g.start>=.25);
}
export function fareWeek(ctx,state,ri,values){
 const draft=structuredClone(state);draft.prices[ri]=[...values];
 const baseline=projectedWeekReports(ctx,state),proposed=projectedWeekReports(ctx,draft);
 const routeTotals=report=>report.rows.filter(r=>Engine.marketKey(ctx.routes[r.route])===Engine.marketKey(ctx.routes[ri])).reduce((v,r)=>({pax:v.pax+r.pax,profit:v.profit+r.profit,revenue:v.revenue+r.revenue}),{pax:0,profit:0,revenue:0});
 return proposed.map((d,i)=>({day:d.report.day,demand:d.demands[ri],capacity:d.capacities[ri],remaining:d.demands[ri].map((n,k)=>n-d.capacities[ri][k]),before:routeTotals(baseline[i].report),after:routeTotals(d.report)}));
}
export function findOpportunities(ctx,state,pid,gap,minHours=1,maxHours=36){
 const p=ctx.fleet.find(p=>p.id===pid);
 if(!p||!gap||!scheduleGaps(ctx,state,pid).concat(scheduleGaps(ctx,state,pid,true)).some(g=>g.start===gap.start&&g.end===gap.end))return [];
 const before=projectedCohortProfit(projectedWeekReports(ctx,state,false)),candidates=[];
 for(const [ri,r] of ctx.routes.entries()){
  if(ri<(ctx.legacyRouteCount??0)&&!ctx.openedRoutes.includes(ri))continue;
  const hours=Engine.duration(ctx,pid,ri);
  if(r.from!==(p.hub||'HAN')||r.km>ctx.types[p.type].range||hours<minHours||hours>maxHours||hours>gap.end-gap.start)continue;
  const opened=ctx.openedRoutes.includes(ri),trialCtx={...ctx,openedRoutes:opened?ctx.openedRoutes:[...ctx.openedRoutes,ri]};
  // A gap may begin during maintenance: search quarter-hour departures, including across midnight.
  let start=gap.start;
  while(start<168&&start+hours<=gap.end&&Engine.slotError(trialCtx,state,pid,ri,start))start+=.25;
  if(start>=168||start+hours>gap.end)continue;
  const trial=structuredClone(state);Engine.add(trialCtx,trial,pid,ri,start);
  const days=projectedWeekReports(trialCtx,trial),delta=projectedCohortProfit(days)-before;
  const index=days.findIndex(d=>(d.report.day-1)%7===Math.floor(start/24)),day=days[index];
  const cost=opened?0:r.price||180000;
  candidates.push({route:ri,start,hours,opened,cost,delta,netFirstWeek:delta-cost,remaining:day.demands[ri].map((n,k)=>n-day.capacities[ri][k])});
 }
 return candidates.sort((a,b)=>b.delta/b.hours-a.delta/a.hours||a.route-b.route);
}
