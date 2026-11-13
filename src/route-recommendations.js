import {airportList,getAirport,routeQuote} from './network.js';
import Engine from './engine.js';
import {projectedWeekReports,projectedCohortProfit} from './planner.js';
import {validateRecoveries} from './recovery.js';

// Read-only shortlist plus canonical seven-day simulation. Never buys a route or assigns a flight.
export function recommendRoutes(ctx,state,from){
 const planes=ctx.fleet.filter(p=>p.hub===from),origin=getAirport(ctx,from);
 if(!ctx.hq.hubs[from]||!origin)return {items:[],reason:'Chọn một hub đang sở hữu.',examined:0};
 if(!planes.length)return {items:[],reason:'Chưa có máy bay tại hub này. Điều chuyển hoặc mua/thuê máy bay để nhận gợi ý.',examined:0};
 if(state.schedules.length>=480)return {items:[],reason:'Lịch đã đủ 480 vòng. Gỡ bớt chuyến để có chỗ khai thác tuyến mới.',examined:0};
 const existing=new Map(ctx.routes.map((r,i)=>[r.from+'|'+r.to,i])),owned=new Set(ctx.openedRoutes.map(i=>Engine.marketKey(ctx.routes[i])));
 const candidates=[];
 for(const a of airportList(ctx)){
  if(a.iata===from||owned.has([from,a.iata].sort().join('|')))continue;
  const index=existing.get(from+'|'+a.iata);if(index===undefined&&ctx.network.routes.length>=100)continue;
  let route;try{route=index===undefined?routeQuote(ctx,from,a.iata):ctx.routes[index];}catch{continue;}
  const fee=route.price||180000;if(fee>ctx.cash||!planes.some(p=>ctx.types[p.type].range>=route.km))continue;
  // Cheap screening keeps full simulations bounded; it is not a global optimality claim.
  const score=(route.classDemand?.[0]||route.demand)*route.baseFare/Math.max(1,route.cycle)/fee;
  candidates.push({route,index,fee,domestic:a.country===origin.country,score});
 }
 if(!candidates.length)return {items:[],reason:'Chưa có tuyến mới vừa đủ ngân sách và tầm bay. Kiểm tra vốn, đội bay hoặc chọn hub khác.',examined:0};
 candidates.sort((a,b)=>b.score-a.score||a.route.to.localeCompare(b.route.to));
 const shortlist=[...candidates.filter(c=>c.domestic).slice(0,12),...candidates.filter(c=>!c.domestic).slice(0,12)];
 const before=projectedCohortProfit(projectedWeekReports(ctx,state,false)),items=[];
 for(const candidate of shortlist){
  const {route,index}=candidate,ri=index??ctx.routes.length,trialCtx={...ctx,routes:index===undefined?[...ctx.routes,route]:ctx.routes,openedRoutes:[...ctx.openedRoutes,ri]},base=structuredClone(state);
  if(index===undefined)base.prices.push([route.baseFare,Math.round(route.baseFare*2.5),route.baseFare*5]);
  let best=null;
  for(const p of planes){
   if(ctx.types[p.type].range<route.km)continue;
   let trial=null,slot=null;
   // Prefer the next legal daytime departure, then remaining hours; canonical guards own feasibility.
   for(let d=0;d<7&&!trial;d++)for(let h=0;h<96&&!trial;h++){
    const day=ctx.day+d,start=((day-1)%7)*24+((h+32)%96)/4;
    if(Engine.slotError(trialCtx,base,p.id,ri,start))continue;
    const next=structuredClone(base),id=next.nextId;Engine.add(trialCtx,next,p.id,ri,start);
    try{validateRecoveries(trialCtx,next,false);}catch{continue;}
    trial=next;slot={id,start,day,plane:p.id};
   }
   if(!trial)continue;
   const projection=projectedWeekReports(trialCtx,trial,false),row=projection.flatMap(d=>d.report.operatedRounds||d.report.rows).find(r=>r.slot===slot.id);
   if(!row||!row.pax)continue;
   const profit=projectedCohortProfit(projection)-before,hours=Engine.duration(trialCtx,p.id,ri);
   if(profit<=0)continue;
   const result={...candidate,plane:p.id,model:p.type,hours,start:slot.start,day:slot.day,pax:row.pax,profit,profitPerHour:profit/hours,netFirstWeek:profit-candidate.fee};
   if(!best||result.profitPerHour>best.profitPerHour)best=result;
  }
  if(best)items.push(best);
 }
 items.sort((a,b)=>b.profitPerHour-a.profitPerHour||a.fee-b.fee||a.route.to.localeCompare(b.route.to));
 return {items:items.slice(0,3),examined:shortlist.length,eligible:candidates.length,reason:items.length?'':'Chưa tìm thấy phương án có lãi trong khoảng trống 7 ngày tới. Kiểm tra lịch bảo dưỡng, lease và lịch bay; bạn vẫn có thể tự chọn sân bay.'};
}
