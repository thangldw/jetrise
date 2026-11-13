import {advanceReservations} from './advance-sales.js';
import {RIVAL_LEASE,AI_LEVELS,aiLevel} from './rival-terms.js';
import {prepareRivalNetwork,rivalNetworkOffers,settleRivalNetwork,canonicalRivalRoute} from './rival-network.js';
import {customerPreferences} from './customer-strategy.js';
import {allocateRivalSlots,sharedSlotDaily} from './slot-market.js';
import {positioningPreferences,segmentMix} from './positioning.js';
import {operatingBase} from './fleet-policy.js';
// Optional local competition model. No external players or real-world traffic data.
import {demandEventFactor} from './gameplay.js';
import {optionEffects,cabinQuality} from './fleet.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const marketId=r=>[r.from,r.to].sort().join('|');
export const SEGMENTS=[
 {id:'budget',name:'Tiết kiệm',price:3.4,comfort:.25,time:.2,detail:'Nhạy với giá; chấp nhận tiện nghi cơ bản.'},
 {id:'business',name:'Công tác',price:1.7,comfort:.8,time:1.4,detail:'Ưu tiên khởi hành 07–10h hoặc 16–20h và độ tin cậy.'},
 {id:'leisure',name:'Nghỉ dưỡng',price:2.1,comfort:1.5,time:.5,detail:'Cân nhắc tiện nghi và giờ bay ban ngày.'}
];
export {RIVAL_LEASE,AI_LEVELS,aiLevel} from './rival-terms.js';
export const AI_LEVEL_NAMES={easy:'Dễ',normal:'Thường',hard:'Khó'};
export const RIVAL_NAMES={swift:'SWIFT AIR',aurelia:'AURELIA'};
const cycle=(r,t)=>Math.ceil((1+(r.cycle-1)*800/(t.speed||800))*4)/4;
const eligible=(ctx,r)=>ctx.openedRoutes.filter(i=>ctx.routes[i].from===r.hub&&ctx.routes[i].km<=ctx.types[r.model].range&&cycle(ctx.routes[i],ctx.types[r.model])<=18);

export function newStrategy(ctx,difficulty='normal'){
 if(!Object.hasOwn(AI_LEVELS,difficulty))throw Error('Chọn độ khó AI hợp lệ.');
 if(!ctx.setupComplete||ctx.founding&&ctx.founding.stage!=='done'||!ctx.openedRoutes.length)throw Error('Hoàn tất lập hãng và mở ít nhất một tuyến trước khi bật cạnh tranh.');
 const hub=ctx.airline.origin;
 const rivals=['swift','aurelia'].map((id,i)=>({id,hub,model:'A320',route:null,cash:AI_LEVELS[difficulty].cash,fare:i?1.15:.85,comfort:i?.85:.3,weekPax:0,weekSeats:0,weekProfit:0,profit:0,notice:'Gia nhập thị trường · 1 A320neo sở hữu sẵn.'}));
 for(const r of rivals)r.route=eligible(ctx,r)[0]??null;
 return {version:1,startDay:ctx.day,reliability:.9,days:0,profit:0,pax:0,profitableDays:0,rivals,result:null,...(difficulty!=='normal'?{difficulty}:{})};
}
export function validateStrategy(s,routes){
 const a=s.strategy;if(a===undefined)return;
 if(a.growth!==undefined&&typeof a.growth!=='boolean')throw Error('Invalid rival growth');
 if(a.difficulty!==undefined&&(a.difficulty==='normal'||!Object.hasOwn(AI_LEVELS,a.difficulty)))throw Error('Invalid AI difficulty');
 for(const r of a.rivals||[]){if(r.leases!==undefined&&(!a.growth||!Array.isArray(r.leases)||r.leases.length>2||r.leases.some(l=>!l||!Number.isInteger(l.remaining)||l.remaining<1||l.remaining>14||l.deposit!==RIVAL_LEASE.deposit)))throw Error('Invalid rival leases');}
 const num=(x,lo,hi)=>Number.isFinite(x)&&x>=lo&&x<=hi;
 const int=(x,lo,hi)=>Number.isInteger(x)&&num(x,lo,hi);
 if(!a||a.version!==1||!int(a.startDay,1,s.day)||!int(a.days,0,9999)||a.days!==s.day-a.startDay||!num(a.reliability,0,1)||!num(a.profit,-1e11,1e11)||!int(a.pax,0,1e9)||!int(a.profitableDays,0,a.days)||!Array.isArray(a.rivals)||a.rivals.length!==2)throw Error('Invalid strategy save');
 for(const [i,r] of a.rivals.entries())if(!r||r.id!==['swift','aurelia'][i]||r.model!=='A320'||r.hub!==s.airline.origin||(r.route!==null&&(!s.openedRoutes.includes(r.route)||routes[r.route]?.from!==r.hub))||!num(r.cash,0,1e10)||!num(r.fare,.65,1.5)||r.comfort!==(i?.85:.3)||!int(r.weekPax,0,1e8)||!int(r.weekSeats,0,1e8)||r.weekPax>r.weekSeats||!num(r.weekProfit,-1e10,1e10)||!num(r.profit,-1e11,1e11)||typeof r.notice!=='string'||r.notice.length>180)throw Error('Invalid rival save');
 if(a.result!==null&&(!a.result||a.days<42||typeof a.result.won!=='boolean'||!num(a.result.profit,-1e11,1e11)||!int(a.result.pax,0,1e9)||!int(a.result.profitableDays,0,42)))throw Error('Invalid strategy result');
 if(a.days>=42&&!a.result)throw Error('Missing strategy result');
 for(const h of s.tycoon?.history||[]){const c=h.competition;if(c===undefined)continue;
  if(!c||!num(c.reliabilityBefore,0,1)||!num(c.reliabilityAfter,0,1)||!Array.isArray(c.markets)||c.markets.length>200||!Array.isArray(c.rivals)||c.rivals.length!==2)throw Error('Invalid competition history');
  for(const m of c.markets)if(!m||!(int(m.route,0,routes.length-1)||a.expansion&&m.route===null&&typeof m.key==='string'&&m.key===[m.from,m.to].sort().join('|'))||!['potential','player','swift','aurelia','outside'].every(k=>int(m[k],0,1e9))||m.player+m.swift+m.aurelia+m.outside!==m.potential)throw Error('Invalid competition market');
 }
}
export function potentialDemand(ctx,ri,day){
 const r=typeof ri==='object'?canonicalRivalRoute(ctx,ri):ctx.routes.find(r=>marketId(r)===marketId(ctx.routes[ri])),base=r.classDemand||[r.demand,Math.floor(r.demand*.18),Math.floor(r.demand*.035)];
 const season=(r.weekPattern||[1,.95,1.08,1.02,1.12,1.15,.97])[(day-1)%7];
 return base.map(n=>Math.max(0,Math.floor(n*season*demandEventFactor(ctx,day)*(ctx.modifiers?.demand||1))));
}
function split(total,weights){const sum=weights.reduce((n,v)=>n+v,0),raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);let left=total-out.reduce((n,v)=>n+v,0);const order=raw.map((n,i)=>({i,r:n-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);for(let i=0;i<left;i++)out[order[i].i]++;return out;}
// Capped proportional choice, with an outside option. Overflow is redistributed once seats fill.
export function choosePassengers(total,offers,weights){
 const booked=offers.map(()=>0);let left=total,outside=0;
 while(left>0){const available=offers.map((o,i)=>o.capacity>booked[i]?weights[i]:0),shares=split(left,[...available,.55]);let used=shares.at(-1);outside+=used;
  for(let i=0;i<offers.length;i++){const n=Math.min(shares[i],offers[i].capacity-booked[i]);booked[i]+=n;used+=n;}
  if(!used){outside+=left;break;}left-=used;
 }
 return {booked,outside};
}
function utility(o,segment,k,ideal){
 const hour=o.hour,fit=segment.id==='business'?((hour>=7&&hour<=10)||(hour>=16&&hour<=20)?1:.15):(hour>=6&&hour<=21?1:.1);
 return Math.exp(clamp(2.8-segment.price*o.fares[k]/ideal+segment.comfort*(o.comfort+k*.12)+segment.time*fit+1.5*(o.reliability-.8)+Math.log(o.positioning?.[segment.id]||1),-12,8));
}
export function rivalOperation(ctx,r,day){
 const rest=(day-ctx.strategy.startDay)%7===6,route=r.route===null?null:ctx.routes[r.route],t=ctx.types[r.model],hours=route?cycle(route,t):0;
 const fleetSize=1+(r.leases?.length||0),overhead=2500*fleetSize+(r.leases?.length||0)*RIVAL_LEASE.rent,maintenance=rest?Math.round(t.nonfuel*.35)*fleetSize:0;
 const cost=route?(t.nonfuel+t.burn*hours/6*(ctx.fuelPrice+3160*ctx.co2Price))*fleetSize:0;
 const flies=!!route&&eligible(ctx,r).includes(r.route)&&!rest&&r.cash>=overhead+cost+360*4*fleetSize;
 const cabin=r.id==='swift'?[180,0,0]:[130,20,3];
 return {flies,cost:flies?cost:0,fixed:Math.min(r.cash,overhead+maintenance),seats:flies?cabin.map(n=>n*2*fleetSize):[0,0,0],hour:aiLevel(ctx.strategy).hour+hours<=24?aiLevel(ctx.strategy).hour:6,hours,status:rest?'Bảo dưỡng tuần':flies?'Đang khai thác':!route?'Chưa có tuyến phù hợp':'Tạm dừng · thiếu vốn hoặc tuyến không phù hợp'};
}
export function simulateCompetition(ctx,s,report,day){
 if(!ctx.strategy)return;
 const strategy=structuredClone(ctx.strategy),earlyRefund={};for(const r of strategy.rivals)if(!strategy.expansion&&strategy.growth&&r.leases?.length&&r.cash<2500*(1+r.leases.length)+RIVAL_LEASE.rent*r.leases.length){earlyRefund[r.id]=r.leases.reduce((n,l)=>n+l.deposit,0);r.cash+=earlyRefund[r.id];r.leases=[];r.notice='Trả máy bay thuê trước chuyến vì thiếu vốn duy trì; hoàn cọc.';}
 const network=strategy.expansion?prepareRivalNetwork(ctx,s,strategy,day):null,operations=network?[]:strategy.rivals.map(r=>rivalOperation(ctx,r,day)),playerPreferences=positioningPreferences({...ctx,tycoon:s},day).map((n,i)=>n*customerPreferences(ctx)[i]),offers=[];
 const slots=network?network.slots:allocateRivalSlots(ctx,strategy,operations,day);if(slots){report.slotMarketState=slots.state;report.sharedSlots={playerDaily:sharedSlotDaily(ctx),rivals:slots.receipts};}
 const advanceSeats=advanceReservations(ctx,day,ri=>marketId(ctx.routes[ri]));for(const row of report.rows){const p=ctx.fleet.find(p=>p.id===row.plane);offers.push({owner:'player',positioning:Object.fromEntries(SEGMENTS.map((segment,i)=>[segment.id,playerPreferences[i]])),route:row.route,row,capacity:s.cabins[row.plane].map((n,k)=>Math.max(0,n*2-(k===0?row.contractPax+(row.connectingReserved||[]).reduce((n,v)=>n+v,0):0)-advanceSeats.slot(row.slot,row.route)[k])),fares:s.prices[row.route],comfort:clamp(cabinQuality(p)+(s.service?.1:0)+(s.research.includes('comfort')?.1:0),0,1),hour:row.start,reliability:strategy.reliability,booked:[0,0,0],segmentBookings:[[0,0,0],[0,0,0],[0,0,0]]});}
 if(network)offers.push(...rivalNetworkOffers(ctx,strategy,network));else strategy.rivals.forEach((r,i)=>{if(operations[i].flies){const fare=ctx.routes[r.route].baseFare*r.fare;offers.push({owner:r.id,route:r.route,capacity:operations[i].seats,fares:[fare,fare*2.5,fare*5].map(Math.round),comfort:r.comfort,hour:operations[i].hour,reliability:aiLevel(strategy).reliability,booked:[0,0,0]});}});
 const routes=[...new Map([...ctx.openedRoutes.map(i=>[marketId(ctx.routes[i]),ctx.routes[i]]),...offers.filter(o=>o.routeData).map(o=>[marketId(o.routeData),o.routeData])]).values()],markets=[];
 for(const route of routes){const key=marketId(route),ri=ctx.openedRoutes.findLast(i=>marketId(ctx.routes[i])===key)??null,r=strategy.expansion?canonicalRivalRoute(ctx,route):route,local=offers.filter(o=>marketId(o.routeData||ctx.routes[o.route])===key),potential=potentialDemand(ctx,r,day).map((n,k)=>Math.max(0,n-advanceSeats.market(key)[k])),segments=SEGMENTS.map(x=>({id:x.id,name:x.name,total:0,player:0,swift:0,aurelia:0,outside:0,...((ctx.legEconomy?.overnight||strategy.expansion)?{outsideY:0}:{} )})),weights=segmentMix(r);
  for(let k=0;k<3;k++){const quantities=split(potential[k],weights);for(let step=0;step<3;step++){const j=(step+day)%3,segment=SEGMENTS[j],result=choosePassengers(quantities[j],local.map(o=>({capacity:o.capacity[k]-o.booked[k]})),local.map(o=>utility(o,segment,k,r.baseFare*[1,2.5,5][k])));segments[j].total+=quantities[j];segments[j].outside+=result.outside;if(k===0&&(ctx.legEconomy?.overnight||strategy.expansion))segments[j].outsideY+=result.outside;local.forEach((o,i)=>{o.booked[k]+=result.booked[i];if(o.segmentBookings)o.segmentBookings[j][k]+=result.booked[i];segments[j][o.owner]+=result.booked[i];});}}
  const count=id=>segments.reduce((n,x)=>n+x[id],0);markets.push({route:ri,...(strategy.expansion?{key,from:route.from,to:route.to}:{}),potential:potential.reduce((n,x)=>n+x,0),player:count('player'),swift:count('swift'),aurelia:count('aurelia'),outside:count('outside'),...((ctx.legEconomy?.overnight||strategy.expansion)?{outsideY:count('outsideY')}:{}),segments});
 }
 for(const o of offers.filter(x=>x.owner==='player')){const row=o.row,p=ctx.fleet.find(p=>p.id===row.plane),upgrades=optionEffects(p),passengers=o.booked.map((n,k)=>n+(k===0?row.contractPax:0)),pax=passengers.reduce((n,v)=>n+v,0),revenue=row.contractRevenue+o.booked.reduce((n,v,k)=>n+v*o.fares[k],0)+pax*((s.service?11:5)+(ctx.modifiers?.serviceRevenue||0)+upgrades.revenue),nonfuel=Math.round(operatingBase(ctx,p)+pax*((s.service?4:0)+(ctx.modifiers?.serviceCost||0)+upgrades.cost)),profit=revenue-nonfuel-row.fuelCost-row.co2Cost;
  for(const [k,v] of Object.entries({pax,revenue,nonfuel,profit})){report[k]+=v-row[k];row[k]=v;}row.passengers=passengers;if(ctx.customerStrategy?.active)row.segmentBookings=o.segmentBookings;
 }
 const rivals=network?settleRivalNetwork(ctx,strategy,network,offers,day):strategy.rivals.map((r,i)=>{const op=operations[i],o=offers.find(x=>x.owner===r.id),pax=o?.booked.reduce((n,v)=>n+v,0)||0,revenue=o?.booked.reduce((n,v,k)=>n+v*o.fares[k],0)||0,cost=op.fixed+op.cost+pax*(r.id==='aurelia'?4:1),profit=revenue-cost;r.cash=Math.max(0,r.cash+profit-(slots?slots.receipts[i].signing:0));r.profit+=profit;r.weekProfit+=profit;r.weekPax+=pax;r.weekSeats+=op.seats.reduce((n,v)=>n+v,0);
  let depositRefund=earlyRefund[r.id]||0;if(strategy.growth){r.leases??=[];for(const l of r.leases)l.remaining--;const expiredRefund=r.leases.filter(l=>!l.remaining).reduce((n,l)=>n+l.deposit,0);r.leases=r.leases.filter(l=>l.remaining>0);r.cash+=expiredRefund;depositRefund+=expiredRefund;}
  return {id:r.id,route:r.route,pax,revenue,cost,profit,cash:r.cash,depositRefund,depositPaid:0,seats:op.seats.reduce((n,v)=>n+v,0),...(slots?{slotSigning:slots.receipts[i].signing,slotDaily:slots.receipts[i].daily,hour:op.hour,rotations:slots.receipts[i].rotations}:{}),status:op.status};});
 // Easy/normal AI reprices once every seven days from its own completed load factor.
 // Hard AI reprices after every operated day and also prices against the player's published Y fare:
 // SWIFT undercuts it by 7%, AURELIA holds a 10% premium; each move goes halfway to that target.
 const level=aiLevel(strategy);
 if(!strategy.expansion&&level.review===1)for(const [i,r] of strategy.rivals.entries()){const result=rivals[i];if(r.route===null||!result.seats)continue;const fill=result.pax/result.seats,base=ctx.routes[r.route].baseFare,key=marketId(ctx.routes[r.route]),player=offers.filter(o=>o.owner==='player'&&o.capacity[0]>0&&marketId(ctx.routes[o.route])===key).map(o=>o.fares[0]);let fare=r.fare+(fill>.85?level.step[0]:fill<.55?level.step[1]:0);
  if(level.react&&player.length)fare=(fare+Math.min(...player)*(r.id==='swift'?.93:1.1)/base)/2;r.fare=Math.round(clamp(fare,.65,1.5)*100)/100;}
 if(!strategy.expansion&&(day-strategy.startDay+1)%7===0)for(const r of strategy.rivals){const fill=r.weekSeats?r.weekPax/r.weekSeats:0;if(level.review!==1)r.fare=Math.round(clamp(r.fare+(fill>.85?level.step[0]:fill<.55?level.step[1]:0),.65,1.5)*100)/100;const choices=eligible(ctx,r),old=r.route;
  if((r.weekProfit<0||r.route===null)&&choices.length)r.route=choices.sort((a,b)=>ctx.routes[b].demand*ctx.routes[b].baseFare/cycle(ctx.routes[b],ctx.types[r.model])-ctx.routes[a].demand*ctx.routes[a].baseFare/cycle(ctx.routes[a],ctx.types[r.model])||a-b)[0];
  let expansion='';if(strategy.growth&&r.route!==null&&(r.leases?.length||0)<2&&fill>.8&&r.weekProfit/7/(1+(r.leases?.length||0))>RIVAL_LEASE.rent&&r.cash>=RIVAL_LEASE.deposit+7*(RIVAL_LEASE.rent+2500)){r.cash-=RIVAL_LEASE.deposit;r.leases.push({remaining:RIVAL_LEASE.term,deposit:RIVAL_LEASE.deposit});const result=rivals.find(x=>x.id===r.id);result.depositPaid=RIVAL_LEASE.deposit;result.cash=r.cash;expansion=' Thuê +1 A320/14 ngày; cọc $500k, thuê $10k/ngày.';}
  r.notice=(r.route!==old?'Chuyển tuyến · ':'Giữ tuyến · ')+`giá Y bằng ${Math.round(r.fare*100)}% giá tham chiếu sau tuần lấp đầy ${Math.round(fill*100)}%.`+expansion;r.weekPax=0;r.weekSeats=0;r.weekProfit=0;}
 const total=report.flights+report.cancelled;if(total)strategy.reliability=clamp(strategy.reliability*.9+(report.flights/total)*.1,.25,1);
 report.competition={markets,rivals,reliabilityBefore:ctx.strategy.reliability,reliabilityAfter:strategy.reliability};report.strategyState=strategy;
}
export function settleStrategy(s,report){
 if(!report.strategyState)return;s.strategy=report.strategyState;s.strategy.days++;s.strategy.profit+=report.profit;s.strategy.pax+=report.pax;if(report.profit>0)s.strategy.profitableDays++;
 if(s.strategy.days===42)s.strategy.result={won:s.strategy.profit>0&&s.strategy.profitableDays>=21&&s.strategy.pax>=10000,profit:s.strategy.profit,pax:s.strategy.pax,profitableDays:s.strategy.profitableDays};
}
