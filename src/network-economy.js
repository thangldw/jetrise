// Opt-in, same-day connecting-ticket pilot. Legacy round-trip accounting is preserved.
import {expandRoundTrip,findConnections,allocateJourneys,journeyMarket} from './connection-core.js';
import {optionEffects} from './fleet.js';
import {distance,getAirport} from './network.js';
const pair=(a,b)=>[a,b].sort().join('|');
export const CONNECTION_FEE=3500;
export const connectionBoardingCost=(ctx,s,plane)=>12+(s.service?4:0)+(ctx.modifiers?.serviceCost||0)+optionEffects(plane).cost;
export function connectionAction(s,a){
 if(a.type!=='connection-program')return null;
 if(typeof a.enabled!=='boolean'||!Number.isInteger(a.minimum)||a.minimum<60||a.minimum>180||a.minimum%15||!Number.isInteger(a.maximum)||a.maximum<a.minimum||a.maximum>(s.legEconomy?.overnight?1440:360)||a.maximum%15)throw Error('Chọn cửa sổ nối chuyến hợp lệ.');
 if(!s.setupComplete||s.founding&&s.founding.stage!=='done')throw Error('Hoàn tất lập hãng trước.');
 s.connectionProgram={...(s.legEconomy?.overnight?{mode:'overnight'}:{}),enabled:a.enabled,minimum:a.minimum,maximum:a.maximum};
 return a.enabled?'Đã mở bán vé nối chuyến · phí điều phối $3.500/ngày.':'Đã dừng bán vé nối chuyến; không thu phí điều phối từ hôm nay.';
}
export function validateConnections(s){const p=s.connectionProgram;if(p===undefined)return;if(!p||p.mode!==undefined&&p.mode!=='overnight'||typeof p.enabled!=='boolean'||!Number.isInteger(p.minimum)||p.minimum<60||p.minimum>180||p.minimum%15||!Number.isInteger(p.maximum)||p.maximum<p.minimum||p.maximum>(s.legEconomy?.overnight?1440:360)||p.maximum%15)throw Error('Invalid connection program');}
export function settleConnections(ctx,s,report,day){
 if(!ctx.connectionProgram?.enabled)return;
 const start=(day-1)*24,end=start+24,p=ctx.connectionProgram;
 // Do not create a second pool for a direct OD already offered by this airline or its AI rivals.
 const direct=new Set(ctx.openedRoutes.map(i=>pair(ctx.routes[i].from,ctx.routes[i].to)));
 if(ctx.strategy?.expansion)for(const r of ctx.strategy.rivals)for(const route of r.network.routes)direct.add(pair(route.from,route.to));
 const rows=new Map(),legs=[];
 for(const row of report.rows){if(row.start+row.hours>24)continue;const r=ctx.routes[row.route],id=day+':'+row.slot;rows.set(id,row);
  const residual=s.cabins[row.plane].map((n,k)=>Math.max(0,n-Math.ceil(row.passengers[k]/2)));
  legs.push(...expandRoundTrip({id,plane:row.plane,route:row.route,from:r.from,to:r.to,start:start+row.start,hours:row.hours,capacity:residual}));
 }
 const links=findConnections(legs,{minMinutes:p.minimum,maxMinutes:p.maximum,start,end,limit:10000}).connections.filter(c=>ctx.hq.hubs[c.hub||c.first.to]&&!direct.has(pair(c.from,c.to))&&c.second.arrival<=end);
 const markets={},requests=[],paths=new Map();
 for(const c of links){const a=ctx.routes[c.first.route],b=ctx.routes[c.second.route],km=distance(getAirport(ctx,c.from),getAirport(ctx,c.to));if(km<50||a.km+b.km>km*1.8)continue;
  // One bounded, directed daily Y market, independent of the number of candidate connections.
  const path=[c.first,c.second],key=journeyMarket(path,0);
  const fare=Math.max(20,Math.round((s.prices[c.first.route][0]+s.prices[c.second.route][0])*.75));
  const demand=Math.min(40,Math.max(0,Math.floor(40*(2-fare/((a.baseFare+b.baseFare)*.75)))));markets[key]=Math.max(markets[key]||0,demand);
  const id=c.first.id+'>'+c.second.id;requests.push({id,legIds:path.map(l=>l.id),classIndex:0,requested:demand,fareCents:fare*100});paths.set(id,c);
 }
 const booking=allocateJourneys(legs,requests,markets,{minMinutes:p.minimum,maxMinutes:p.maximum});
 for(const l of legs){const row=rows.get(l.roundTrip),count=l.capacity[0]-booking.remaining[l.id][0],plane=ctx.fleet.find(p=>p.id===row.plane),revenue=booking.legRevenue[l.id]/100,nonfuel=count*connectionBoardingCost(ctx,s,plane);
  row.connectionLegs??=[{pax:0,revenueCents:0},{pax:0,revenueCents:0}];row.connectionLegs[l.id.endsWith(':out')?0:1]={pax:count,revenueCents:booking.legRevenue[l.id]};
  row.passengers[0]+=count;row.connectionBoardings=(row.connectionBoardings||0)+count;row.connectionRevenue=(row.connectionRevenue||0)+revenue;
  for(const [k,value] of Object.entries({pax:count,revenue,nonfuel,profit:revenue-nonfuel})){row[k]+=value;report[k]+=value;}
 }
 report.nonfuel+=CONNECTION_FEE;report.profit-=CONNECTION_FEE;
 report.connections={journeys:booking.passengers,boardings:booking.passengers*2,revenue:booking.revenueCents/100,coordination:CONNECTION_FEE,handling:booking.passengers*24,bookings:booking.bookings.filter(b=>b.passengers).slice(0,100).map(b=>{const c=paths.get(b.id);return {from:c.from,hub:c.first.to,to:c.to,first:c.first.plane,second:c.second.plane,departure:c.first.departure,arrival:c.second.arrival,wait:c.waitMinutes,pax:b.passengers,revenue:b.revenueCents/100};})};
 // Existing pax is passenger boardings, not unique journey customers. Fare is attributed only once.
}
