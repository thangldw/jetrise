import {validateWeeklyGoal} from './weekly-review.js';
// Synthetic, deterministic gameplay. No wall-clock rewards or external economy.
export const RESEARCH_FEE = 5000;
export const CAMPAIGN = [
 {id:'takeoff',name:'Chuyến bay đầu tiên',detail:'Chở khách trên một vòng khứ hồi.',reward:25000,target:1,metric:'flights'},
 {id:'profitable',name:'Tìm công thức có lãi',detail:'Có ít nhất một tuyến tạo lợi nhuận khai thác dương.',reward:40000,target:1,metric:'profitableRoutes'},
 {id:'passengers',name:'1.000 hành khách tin tưởng',detail:'Vận chuyển 1.000 khách kể từ khi mở chiến dịch.',reward:60000,target:1000,metric:'pax'},
 {id:'contract',name:'Đối tác đáng tin cậy',detail:'Hoàn thành một hợp đồng đúng mức cam kết.',reward:75000,target:1,metric:'contracts'},
 {id:'resilience',name:'Vượt qua một tuần',detail:'Khai thác 7 ngày có chuyến bay và tổng lợi nhuận dương.',reward:100000,target:7,metric:'operatingDays'},
 {id:'network',name:'Hãng hàng không đa hub',detail:'Sở hữu hai hub và khai thác có khách từ cả hai.',reward:150000,target:2,metric:'hubs'},
];
export function newGameplay(day){return {version:1,startDay:day,contracts:[],dismissed:[],research:[],claimed:[],stats:{days:0,operatingDays:0,flights:0,pax:0,profit:0,profitableRoutes:[],hubs:[],contracts:0,recovered:0},decisions:[]};}
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function restoreGameplay(s,routes){
 if(s.gameplay===undefined)s.gameplay=newGameplay(s.day);
 const g=s.gameplay,fail=()=>{throw Error('Invalid gameplay progress');};
 if(!g||g.version!==1||!int(g.startDay,1,s.day))fail();
 for(const k of ['contracts','dismissed','research','claimed','decisions'])if(!Array.isArray(g[k])||g[k].length>(k==='contracts'?24:k==='decisions'?40:10000))fail();
 for(const k of ['dismissed','research','claimed'])if(g[k].some(x=>typeof x!=='string'||x.length>60)||new Set(g[k]).size!==g[k].length)fail();
 if(g.research.some(id=>!/^event-\d{1,4}$/.test(id))||g.dismissed.some(id=>!/^contract-\d{1,4}-\d{1,3}$/.test(id)))fail();
 if(g.claimed.some((id,i)=>CAMPAIGN[i]?.id!==id))fail();
 if(!g.stats||['days','operatingDays','flights','pax','contracts','recovered'].some(k=>!int(g.stats[k],0,1e9))||!Number.isFinite(g.stats.profit))fail();
 for(const k of ['profitableRoutes','hubs'])if(!Array.isArray(g.stats[k])||g.stats[k].length>200)fail();
 if(g.stats.profitableRoutes.some(i=>!int(i,0,routes.length-1))||g.stats.hubs.some(h=>typeof h!=='string'||h.length!==3))fail();
 const ids=new Set();for(const c of g.contracts){if(!c||typeof c.id!=='string'||c.id.length>60||ids.has(c.id)||!int(c.route,0,routes.length-1)||!s.openedRoutes.includes(c.route)||!int(c.start,1,10006)||!int(c.end,c.start,c.start+6)||!int(c.target,1,10000)||!int(c.fare,1,10000)||!int(c.penalty,0,1e8)||!int(c.bonus,0,1e8)||!int(c.delivered,0,c.target)||!['active','won','lost'].includes(c.status))fail();ids.add(c.id);}
 for(const d of g.decisions)if(!d||!int(d.day,1,s.day)||typeof d.text!=='string'||d.text.length>200)fail();
 validateWeeklyGoal(s);
 return g;
}
export function logDecision(s,text){s.gameplay.decisions.unshift({day:s.day,text});s.gameplay.decisions=s.gameplay.decisions.slice(0,40);}
export function contractOffers(ctx){
 const g=ctx.gameplay;if(!g)return [];
 const week=Math.floor((ctx.day-g.startDay)/7),anchor=g.startDay+week*7;
 return ctx.openedRoutes.slice(0,3).map((route,i)=>{const r=ctx.routes[route],id=`contract-${week}-${route}`;return {id,route,name:['Đoàn du lịch','Khách doanh nghiệp','Đoàn sự kiện'][i],start:anchor+2,end:anchor+8,target:280+i*70,fare:Math.round(r.baseFare*.9),penalty:Math.round(r.baseFare*(280+i*70)*.2),bonus:Math.round(r.baseFare*(280+i*70)*.05),delivered:0,status:'active'};}).filter(c=>c.end<9999&&ctx.day<c.start&&!g.contracts.some(x=>x.id===c.id)&&!g.dismissed.includes(c.id));
}
export function contractTerms(c,negotiate=false){return negotiate?{...c,target:Math.round(c.target*1.25),fare:Math.round(c.fare*1.12),penalty:Math.round(c.penalty*1.5)}:{...c};}
export function acceptContract(s,ctx,a){
 const offer=contractOffers(ctx).find(x=>x.id===a.id);if(!offer)throw Error('Đề nghị đã hết hạn hoặc đã xử lý.');
 if(a.type==='contract-decline'){s.gameplay.dismissed.push(a.id);return 'Đã từ chối đề nghị. Đợt mới xuất hiện mỗi 7 ngày.';}
 if(s.gameplay.contracts.filter(c=>c.status==='active').length>=3)throw Error('Tối đa 3 hợp đồng đang chạy.');
 const c=contractTerms(offer,a.negotiate===true);s.gameplay.contracts.push(c);const held=new Set(s.legEconomy?.rounds.flatMap(r=>r.legs.flatMap(l=>l.contracts.map(a=>a.id)))||[]),required=s.gameplay.contracts.filter(x=>x.status==='active'||held.has(x.id)),past=s.gameplay.contracts.filter(x=>x.status!=='active'&&!held.has(x.id));s.gameplay.contracts=required.concat(past.slice(-(24-required.length)));
 return 'Đã nhận hợp đồng '+c.target+' khách, ngày '+c.start+'–'+c.end+'. Cần chủ động xếp lịch.';
}
// Contract travellers are an extra group: take Y seats first and pay only the agreed fare.
export function allocateContracts(ctx,contracts,route,day,capacity){
 let remaining=capacity,revenue=0,pax=0;const allocations=[];
 const pair=r=>[r.from,r.to].sort().join('|');
 for(const c of contracts){if(c.status!=='active'||day<c.start||day>c.end||pair(ctx.routes[c.route])!==pair(ctx.routes[route]))continue;
  const n=Math.min(remaining,c.target-c.delivered);if(n<=0)continue;
  c.delivered+=n;remaining-=n;pax+=n;revenue+=n*c.fare;allocations.push({id:c.id,pax:n});
 }
 return {pax,revenue,remaining,allocations};
}
export function closeContracts(contracts,day){let bonus=0,penalty=0;const results=[];for(const c of contracts){if(c.status!=='active'||day<c.end)continue;const won=c.delivered>=Math.ceil(c.target*.9);c.status=won?'won':'lost';bonus+=won?c.bonus:0;penalty+=won?0:c.penalty;results.push({id:c.id,route:c.route,delivered:c.delivered,target:c.target,status:c.status,amount:won?c.bonus:-c.penalty});}return {bonus,penalty,results};}
export function marketEvents(ctx){
 if(!ctx.gameplay)return [];
 const start=ctx.gameplay.startDay,week=Math.max(0,Math.floor((ctx.day-start)/7)),events=[];
 for(let w=Math.max(0,week-1);w<=week+1;w++){
  const kind=w%3,anchor=start+w*7;events.push({id:`event-${w}`,kind:['tourism','fuel','low'][kind],title:['Tuần lễ du lịch','Biến động nhiên liệu','Mùa thấp điểm'][kind],start:anchor+3,end:anchor+6,low:[1.15,1.12,.65][kind],high:[1.45,1.32,.85][kind],factor:[1.2+(w%4)*.05,1.16+(w%4)*.04,.68+(w%4)*.04][kind]});
 }return events;
}
export function eventFactor(ctx,day,kind,{forecast=false}={}){
 return marketEvents({...ctx,day}).filter(e=>e.kind===kind&&day>=e.start&&day<=e.end).reduce((n,e)=>n*(forecast&&day>ctx.day&&!ctx.gameplay.research.includes(e.id)?(e.low+e.high)/2:e.factor),1);
}
export function marketPrices(ctx,day=ctx.day,forecast=false){return {fuelPrice:[740,790,860,725,700,815][(day-1)%6]*eventFactor(ctx,day,'fuel',{forecast}),co2Price:[.1,.12,.085,.11,.095,.13][(day-1)%6]};}
export function demandEventFactor(ctx,day){return eventFactor(ctx,day,'tourism',{forecast:!!ctx.projecting})*eventFactor(ctx,day,'low',{forecast:!!ctx.projecting});}
export function campaignStatus(s){const g=s.gameplay;if(!g)return [];return CAMPAIGN.map((c,i)=>{let value=c.metric==='flights'?(g.stats.pax>0?1:0):c.metric==='profitableRoutes'?g.stats.profitableRoutes.length:c.metric==='hubs'?g.stats.hubs.filter(h=>s.hq.hubs[h]).length:g.stats[c.metric];const eligible=value>=c.target&&(c.id!=='resilience'||g.stats.profit>0);return {...c,value,claimed:g.claimed.includes(c.id),locked:i>g.claimed.length,ready:i===g.claimed.length&&eligible};});}
export function settleGameplay(s,report,ctx){const g=s.gameplay;g.contracts=report.contractState;g.stats.days++;if(report.flights)g.stats.operatingDays++;g.stats.flights+=report.flights;g.stats.pax+=report.pax;g.stats.profit+=report.profit;g.stats.contracts+=report.contractResults.filter(c=>c.status==='won').length;const profits={};for(const r of report.rows){profits[r.route]=(profits[r.route]||0)+r.profit;if(r.pax&&!g.stats.hubs.includes(ctx.routes[r.route].from))g.stats.hubs.push(ctx.routes[r.route].from);if(r.recovery&&!report.legAccounting)g.stats.recovered++;}for(const [route,profit] of Object.entries(profits))if(profit>0&&!g.stats.profitableRoutes.includes(Number(route)))g.stats.profitableRoutes.push(Number(route));
 report.aircraft=Object.fromEntries(s.fleet.map(p=>{const rows=report.rows.filter(r=>r.plane===p.id);return [p.id,{revenue:rows.reduce((n,r)=>n+r.revenue,0),profit:rows.reduce((n,r)=>n+r.profit,0),pax:rows.reduce((n,r)=>n+r.pax,0)}];}));
 report.marketEvents=marketEvents(ctx).filter(e=>ctx.day>=e.start&&ctx.day<=e.end).map(e=>({title:e.title,factor:e.factor,kind:e.kind}));
 if(report.legAccounting)g.stats.recovered+=report.operatedRounds.filter(r=>r.recovery).length;
 report.recoveries=(report.operatedRounds||report.rows).filter(r=>r.recovery).map(r=>({plane:r.plane,slot:r.slot,pax:r.pax}));
}
