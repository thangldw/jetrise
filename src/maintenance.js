// All times are absolute hours from game day1, using the shared game clock.
export const WEEK=168, LIGHT_HOURS=5;
export const atDay=day=>(day-1)*24;
export const overlaps=(a,b)=>a.start<b.end&&a.end>b.start;
export function oneOff(p){const m=p.maintenance;return m?{start:m.startAt??atDay(m.startDay),end:m.endAt??atDay(m.untilDay),kind:m.kind}:null;}
export function maintenanceWindows(p,from,to){
 const out=[],heavy=oneOff(p),plan=p.servicePlan;
 if(heavy&&heavy.start<to&&heavy.end>from)out.push(heavy);
 if(plan){for(let k=Math.max(0,Math.floor((from-plan.activeFrom-LIGHT_HOURS)/WEEK));;k++){
  const start=plan.activeFrom+k*WEEK,end=start+LIGHT_HOURS;if(start>=to)break;
  if(end>from&&(!heavy||!overlaps({start,end},heavy)))out.push({start,end,kind:'light'});
 }}
 return out.sort((a,b)=>a.start-b.start);
}
export function serviceDue(p,from,at){let due=p.serviceDueAt??from+WEEK;for(const w of maintenanceWindows(p,from-48,at+1))if(w.end>=from&&w.end<=at&&(!p.fault||w.kind!=='light'||(oneOff(p)?.end??Infinity)<=w.end))due=w.end+WEEK;return due;}
export function flightServiceError(p,day,hour,hours,baseDay=day){
 const start=atDay(day)+hour,end=start+hours,heavy=oneOff(p);
 if(maintenanceWindows(p,start,end).length)return 'Trùng ca bảo dưỡng. Chọn giờ ngoài khối bảo dưỡng trên lịch.';
 if(p.fault&&(!heavy||heavy.end>start))return p.fault;
 if(end>serviceDue(p,atDay(baseDay),start)+1e-9)return 'Đến hạn bảo dưỡng định kỳ theo tuần. Đặt ca bảo dưỡng 5 giờ trước chuyến này.';
 return '';
}
export function applyCompletedService(p,from,to){
 for(const w of maintenanceWindows(p,from-48,to+1))if(w.end>from&&w.end<=to){
  if(w.kind==='light'&&p.fault)continue;
  p.wear=0;p.hoursSinceService=0;p.serviceDueAt=w.end+WEEK;
  if(w.kind!=='light')p.fault=null;
 }
}
export function displayAt(at){const days=['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'],d=Math.floor(at/24),h=at%24;return days[(d%7+7)%7]+' '+String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0')+' · ngày '+(d+1);}
export function nextPlanStart(day,start){const now=atDay(day);return now+((start-now%WEEK+WEEK)%WEEK);}
export function weeklySegments(p,day){const base=Math.floor(atDay(day)/WEEK)*WEEK;return maintenanceWindows(p,base,base+WEEK).map(w=>({...w,start:Math.max(0,w.start-base),end:Math.min(WEEK,w.end-base)}));}
export function planConflict(game,p,start,durationOf){
 if(!Number.isFinite(start)||start<0||start>=WEEK||start%.25)return 'Chọn thứ và giờ theo mốc 15 phút.';
 if(!game.hq.hubs[p.hub])return 'Cần hub có dịch vụ bảo dưỡng.';
 const first=nextPlanStart(game.day,start),trial={...p,servicePlan:{start,activeFrom:first}},heavy=oneOff(p);
 if(heavy&&maintenanceWindows(trial,first,first+WEEK).filter(w=>w.kind==='light').length===0)return 'Ca này trùng bảo dưỡng lớn đã đặt. Chọn giờ khác.';
 for(const w of maintenanceWindows(trial,first,first+WEEK*2)){
  if(w.kind!=='light')continue;
  if(w.start<(p.airborneUntilAt||0)&&w.end>atDay(game.day))return 'Máy bay còn đang bay từ ngày trước; đặt ca sau khi về hub.';
  for(const s of game.tycoon.schedules.filter(s=>s.plane===p.id))for(let week=Math.floor((w.start-WEEK)/WEEK);week<=Math.floor(w.end/WEEK);week++){
   const flight={start:s.start+week*WEEK,end:s.start+week*WEEK+durationOf(s)};
   if(overlaps(w,flight))return 'Ca bảo dưỡng trùng chuyến đã xếp '+displayAt(flight.start)+'. Chọn khoảng trống hoặc dời chuyến trước.';
  }
 }
 for(const w of maintenanceWindows(trial,first,first+WEEK*2).filter(w=>w.kind==='light')){const error=hangarConflict(game,p,w);if(error)return error;}
 return '';
}
export function suggestMaintenance(game,p,durationOf,preference='night'){
 const current=(atDay(game.day)%WEEK),candidates=[];
 for(let start=0;start<WEEK;start+=.25){
  const error=planConflict(game,p,start,durationOf);if(error)continue;
  const first=nextPlanStart(game.day,start),hour=start%24,day=Math.floor(start/24),night=hour<=1||hour>=22,weekend=day>=5;
  const ontime=first+LIGHT_HOURS<=(p.serviceDueAt??atDay(game.day)+WEEK);
  candidates.push({start,first,score:(ontime?0:10000)+(preference==='night'&&!night?1000:preference==='weekend'&&!weekend?1000:0)+((start-current+WEEK)%WEEK)});
 }
 candidates.sort((a,b)=>a.score-b.score);return candidates[0]??null;
}
export function hangarConflict(game,p,window){
 const capacity=1+(game.hq.hubs[p.hub]?.hangar||0),events=game.fleet.filter(x=>x.id!==p.id&&x.hub===p.hub).flatMap(x=>maintenanceWindows(x,window.start,window.end)).flatMap(w=>[{at:Math.max(w.start,window.start),n:1},{at:Math.min(w.end,window.end),n:-1}]).sort((a,b)=>a.at-b.at||a.n-b.n);let busy=1;
 for(const e of events){busy+=e.n;if(busy>capacity)return 'Hangar tại '+p.hub+' đã đủ ca bảo dưỡng trong giờ này. Chọn giờ khác.';}return '';
}
