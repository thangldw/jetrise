import {cabinQuality,optionEffects} from './fleet.js';
import {segmentMix} from './positioning.js';

// Synthetic customer experience, independent of the selected coaching objective.
export const CUSTOMER_TERMS={signing:20000,change:10000,daily:500,commitment:7};
export const CUSTOMER_OBJECTIVES={budget:'Giá trị tiết kiệm',business:'Khách công vụ',hub:'Mạng trung chuyển'};
export const CUSTOMER_SEGMENTS=['Tiết kiệm','Công vụ','Nghỉ dưỡng'];
const sum=xs=>xs.reduce((a,b)=>a+b,0),clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const int=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const migration=id=>typeof id==='string'&&/^[a-z0-9-]{16,64}$/.test(id);
const triple=(a,test)=>Array.isArray(a)&&a.length===3&&a.every(test);
const split=(total,weights)=>{const den=sum(weights);if(!den)return [0,0,0];const raw=weights.map(n=>n*total/den),out=raw.map(Math.floor),order=raw.map((n,i)=>({i,r:n-out[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);for(let i=0,left=total-sum(out);i<left;i++)out[order[i].i]++;return out;};
export function customerPreferences(ctx){return ctx.customerStrategy?.active?ctx.customerStrategy.scores.map(n=>1+.15*n):[1,1,1];}
export function customerAction(s,a){
 if(!['customer-enable','customer-change','customer-pause','customer-resume'].includes(a.type))return null;
 const p=s.customerStrategy;
 if(a.type==='customer-enable'){
  if(p)throw Error('JET-205 đã được bật.');
  if(!s.legEconomy?.overnight||!s.strategy)throw Error('Bật sổ chặng JET-201, vé qua đêm JET-202 và cạnh tranh AI trước.');
  if(!migration(a.migrationId)||!Object.hasOwn(CUSTOMER_OBJECTIVES,a.objective))throw Error('Mã chuyển đổi hoặc mục tiêu không hợp lệ.');
  if(s.cash<CUSTOMER_TERMS.signing)throw Error('Cần $20.000 để triển khai.');
  s.cash-=CUSTOMER_TERMS.signing;
  s.customerStrategy={version:1,migrationId:a.migrationId,enabledDay:s.day,changedDay:s.day,objective:a.objective,active:true,through:s.day-1,scores:[0,0,0],samples:[0,0,0],history:[],pending:[]};
  return 'Đã bật JET-205; chỉ theo dõi vé bán mới, cam kết 7 ngày.';
 }
 if(!p)throw Error('Bật JET-205 trước.');
 if(s.day<p.changedDay+7)throw Error('Cam kết hiện tại đến ngày '+(p.changedDay+7)+'.');
 if(a.type==='customer-pause'){
  if(!p.active)throw Error('Chương trình đã tạm dừng.');p.active=false;
 }else{
  if(a.type==='customer-resume'&&p.active)throw Error('Chương trình đang chạy.');
  if(a.type==='customer-change'&&(!p.active||!Object.hasOwn(CUSTOMER_OBJECTIVES,a.objective)||a.objective===p.objective))throw Error('Chọn mục tiêu khác khi chương trình đang chạy.');
  const fee=a.type==='customer-resume'?CUSTOMER_TERMS.signing:CUSTOMER_TERMS.change;
  if(s.cash<fee)throw Error('Ngân quỹ chưa đủ phí triển khai.');s.cash-=fee;p.active=true;
  if(a.type==='customer-change')p.objective=a.objective;
 }
 p.changedDay=s.day;
 return 'Đã cập nhật chương trình; giữ nguyên điểm và lịch sử khách, cam kết 7 ngày mới.';
}
function experience(ctx,state,plane,route,fares,counts,departure,arrival,from,to,through=false,carried=[1,0,0]){
 const p=ctx.fleet.find(p=>p.id===plane),cabins=state.cabins[plane],total=sum(cabins),premium=total?(cabins[1]+cabins[2])/total:0;
 const comfort=clamp(cabinQuality(p)+(state.service?.1:0)+(state.research.includes('comfort')?.1:0)),hour=departure%24;
 const fit=[hour>=6&&hour<=21?1:.1,(hour>=7&&hour<=10)||(hour>=16&&hour<=20)?1:.15,hour>=6&&hour<=21?1:.1];
 const fareRatio=sum(carried)?sum(fares.map((n,k)=>carried[k]*n/(ctx.routes[route].baseFare*[1,2.5,5][k])))/sum(carried):1;
 const value=clamp(1.5-fareRatio),quality=[.75*value+.15*comfort+.1*fit[0],.2*value+.35*clamp(comfort+premium)+.45*fit[1],.35*value+.5*comfort+.15*fit[2]].map(n=>2*n-1);
 return {counts,quality,fareRatio,comfort,premium,amenityCost:optionEffects(p).cost,fit,promisedArrival:arrival,from,to,through};
}
export function directExperiences(ctx,state,row,counts,allocations,pair,legFares=[]){
 if(!ctx.customerStrategy?.active)return [undefined,undefined];
 // Exact segment/class bookings from the capacity-constrained AI allocator. Contracts are excluded.
 if(!row.segmentBookings)throw Error('Missing customer segment bookings');
 const first=[0,0,0],second=[0,0,0];
 for(let k=0;k<3;k++){
  const weights=row.segmentBookings.map(a=>a[k]),n=counts[0][k]-(k===0?sum(allocations[0].map(a=>a.pax)):0),shares=split(n,weights);
  shares.forEach((v,j)=>{first[j]+=v;second[j]+=weights[j]-v;});
 }
 return pair.map((l,i)=>experience(ctx,state,row.plane,row.route,legFares[i]||state.prices[row.route],i?second:first,l.departure,l.arrival,l.from,l.to,false,counts[i].map((n,k)=>n-(k===0?sum(allocations[i].map(a=>a.pax)):0))));
}
export function journeyExperience(ctx,state,j,counts){
 if(!ctx.customerStrategy?.active)return;
 const [a,b]=j.legs,ea=experience(ctx,state,a.plane,a.route,state.prices[a.route],counts,a.departure,a.arrival,a.from,a.to),eb=experience(ctx,state,b.plane,b.route,state.prices[b.route],counts,b.departure,b.arrival,b.from,b.to);
 // A through fare is 75% of two Y fares; compare it with the same reference itinerary.
 const fareRatio=(j.fareCents/100/j.pax)/((ctx.routes[a.route].baseFare+ctx.routes[b.route].baseFare)*.75);
 const comfort=(ea.comfort+eb.comfort)/2,fit=ea.fit.map((v,i)=>(v+eb.fit[i])/2),value=clamp(1.5-fareRatio);
 return {...ea,counts,fareRatio,comfort,fit,premium:0,amenityCost:ea.amenityCost+eb.amenityCost,to:b.to,through:true,promisedArrival:b.arrival,quality:[.75*value+.15*comfort+.1*fit[0],.2*value+.35*comfort+.45*fit[1],.35*value+.5*comfort+.15*fit[2]].map(n=>2*n-1)};
}
export const syntheticJourneySegments=(ctx,j)=>split(j.pax,segmentMix(ctx.routes[j.legs[0].route]));
export function customerOutcome(experience,arrival,success){
 if(!experience)return null;
 const delay=Math.max(0,arrival-experience.promisedArrival);
 return {experience,success,onTime:success&&delay<.25-1e-7,ratings:experience.quality.map(n=>success?clamp(n-Math.min(1.5,delay/4),-1,1):-1)};
}
export function queueCustomerRefund(s,j){
 if(j.experience&&!j.legs.some(l=>l.status==='reserved'))s.customerStrategy.pending.push(customerOutcome(j.experience,j.legs[1].arrival,false));
 if(s.customerStrategy?.pending.length>960)throw Error('Chốt ngày trước khi xử lý thêm vé.');
}
export function settleCustomers(ctx,report){
 const old=ctx.customerStrategy;if(!old)return;
 if(old.through!==report.day-1)throw Error('Customer ledger cursor mismatch');
 const next=structuredClone(old),outcomes=[...next.pending,...(report.customerOutcomes||[])],start=(report.day-1)*24,end=start+24;
 for(const r of [...ctx.legEconomy.rounds,...report.departureManifests])for(const l of r.legs)if(l.arrival>=start&&l.arrival<end&&l.experience)outcomes.push(customerOutcome(l.experience,l.arrival,true));
 const n=[0,0,0],ratings=[0,0,0],daily={day:report.day,objective:old.objective,count:0,completed:0,failed:0,onTime:0,throughCompleted:0,fare:0,comfort:0,premium:0,amenityCost:0,businessFit:0,markets:[]};
 for(const o of outcomes){const x=o.experience,pax=sum(x.counts);daily.count+=pax;daily[o.success?'completed':'failed']+=pax;if(o.onTime)daily.onTime+=pax;if(o.success&&x.through)daily.throughCompleted+=pax;
  for(const [key,value] of Object.entries({fare:x.fareRatio,comfort:x.comfort,premium:x.premium,amenityCost:x.amenityCost,businessFit:x.fit[1]}))daily[key]+=pax*value;
  if(o.success&&pax)daily.markets.push(x.from+'>'+x.to);
  x.counts.forEach((v,i)=>{n[i]+=v;ratings[i]+=v*o.ratings[i];});
 }
 daily.markets=[...new Set(daily.markets)].sort();
 for(let i=0;i<3;i++){const rate=.08*Math.min(1,n[i]/100),decayed=old.scores[i]*.99;next.scores[i]=clamp(decayed*(1-rate)+(n[i]?ratings[i]/n[i]:0)*rate,-1,1);next.samples[i]+=n[i];}
 next.through=report.day;next.pending=[];next.history=[daily,...next.history].slice(0,28);
 const fee=old.active?CUSTOMER_TERMS.daily:0;report.nonfuel+=fee;report.profit-=fee;report.cashDelta-=fee;
 report.customerStrategyState=next;report.customers={...daily,segments:n,before:old.scores,after:next.scores,fee};delete report.customerOutcomes;
}
export function customerGoals(s){
 const rows=(s.customerStrategy?.history||[]).slice(0,7),total=key=>sum(rows.map(r=>r[key])),n=total('count'),profit=sum(rows.map(r=>s.tycoon.history.find(h=>h.day===r.day)?.profit||0)),avg=key=>n?total(key)/n:null;
 const onTime=n?total('onTime')/n:null,completion=n?total('completed')/n:null,markets=new Set(rows.flatMap(r=>r.markets)).size;
 return {days:rows.length,count:n,profit,fare:avg('fare'),comfort:avg('comfort'),premium:avg('premium'),amenityCost:avg('amenityCost'),businessFit:avg('businessFit'),onTime,completion,through:total('throughCompleted'),markets,met:{budget:rows.length===7&&n>0&&avg('fare')<=.9&&profit>0,business:rows.length===7&&n>0&&avg('businessFit')>=.75&&avg('comfort')>=.6&&onTime>=.95&&profit>0,hub:rows.length===7&&total('throughCompleted')>=20&&markets>=2&&completion>=.95&&profit>0}};
}
export function validateCustomers(s){
 const p=s.customerStrategy,fail=()=>{throw Error('Invalid customer strategy');};
 const finite=(n,a,b)=>Number.isFinite(n)&&n>=a&&n<=b;
 function validExperience(x,expected){
  if(!p||!x||!triple(x.counts,n=>int(n,0,3000))||sum(x.counts)!==expected||!triple(x.quality,n=>finite(n,-1,1))||!triple(x.fit,n=>finite(n,0,1))||!finite(x.fareRatio,0,1000)||!finite(x.comfort,0,1)||!finite(x.premium,0,1)||!finite(x.amenityCost,0,10000)||!finite(x.promisedArrival,(p.enabledDay-1)*24,(s.day+14)*24)||typeof x.through!=='boolean'||typeof x.from!=='string'||typeof x.to!=='string'||x.from===x.to||![x.from,x.to].every(a=>/^[A-Z0-9]{3,8}$/.test(a)))fail();
 }
 if(p!==undefined){
  if(!p||!s.legEconomy?.overnight||!s.strategy||p.version!==1||!migration(p.migrationId)||!int(p.enabledDay,1,s.day)||!int(p.changedDay,p.enabledDay,s.day)||!Object.hasOwn(CUSTOMER_OBJECTIVES,p.objective)||typeof p.active!=='boolean'||p.through!==s.day-1||!triple(p.scores,n=>finite(n,-1,1))||!triple(p.samples,n=>int(n,0,1e9))||!Array.isArray(p.history)||p.history.length!==Math.min(28,s.day-p.enabledDay)||!Array.isArray(p.pending)||p.pending.length>960)fail();
  for(const [i,r] of p.history.entries()){
   if(!r||r.day!==s.day-1-i||!Object.hasOwn(CUSTOMER_OBJECTIVES,r.objective)||!['count','completed','failed','onTime','throughCompleted'].every(k=>int(r[k],0,1e7))||r.completed+r.failed!==r.count||r.onTime>r.completed||r.throughCompleted>r.completed||!['fare','comfort','premium','amenityCost','businessFit'].every(k=>finite(r[k],0,1e11))||!Array.isArray(r.markets)||r.markets.length>960||new Set(r.markets).size!==r.markets.length||r.markets.some(k=>typeof k!=='string'||! /^[A-Z0-9]{3,8}>[A-Z0-9]{3,8}$/.test(k)))fail();
  }
  for(const o of p.pending){if(!o||o.success!==false||o.onTime!==false||!triple(o.ratings,n=>n===-1))fail();validExperience(o.experience,sum(o.experience?.counts||[]));}
 }
 for(const r of s.legEconomy?.rounds||[])for(const l of r.legs)if(l.experience!==undefined){validExperience(l.experience,sum(l.passengers)-sum(l.contracts.map(a=>a.pax))-l.connectionPax);if(l.experience.through||l.experience.from!==l.from||l.experience.to!==l.to)fail();}
 for(const j of s.legEconomy?.overnight?.journeys||[])if(j.experience!==undefined){validExperience(j.experience,j.pax);if(!j.experience.through||j.experience.from!==j.legs[0].from||j.experience.to!==j.legs[1].to)fail();}
}
