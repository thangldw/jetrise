import {profitReview} from './profit-review.js';

// Coaching thresholds are synthetic gameplay guidance, never rewards or demand modifiers.
export const WEEKLY_GOALS=Object.freeze({
 margin:{name:'Hiệu quả tài chính',detail:'Có chuyến thực hiện, lợi nhuận tuần dương và biên lợi nhuận sau quản trị ít nhất 10%.'},
 reliability:{name:'Khai thác ổn định',detail:'Thực hiện ít nhất 14 chặng và tỷ lệ thực hiện từ 95% trên tổng chặng thực hiện + hủy trong báo cáo.'},
 hub:{name:'Phát triển trung chuyển',detail:'Ít nhất 20 khách nối chuyến hoàn tất hành trình và tổng lợi nhuận tuần dương.'}
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const gameWeekStart=day=>1+Math.floor((day-1)/7)*7;
export function weeklyPeriods(game){const current=gameWeekStart(game.day);return Array.from({length:5},(_,i)=>current-i*7).filter(d=>d>=1);}
function period(game,start){
 const end=start+6,elapsed=Math.max(0,Math.min(7,game.day-start)),rows=[],missing=[],duplicates=[];
 for(let day=start;day<start+elapsed;day++){
  const matches=game.tycoon.history.filter(r=>r.day===day&&r.day<game.day);
  if(matches.length===1)rows.push(matches[0]);else if(!matches.length)missing.push(day);else duplicates.push(day);
 }
 const covered=!missing.length&&!duplicates.length;
 const sum=get=>covered&&rows.every(r=>finite(get(r)))?rows.reduce((n,r)=>n+get(r),0):null;
 const totals=Object.fromEntries(['revenue','profit','cashDelta','pax','flights','cancelled','maintenanceCost','slotFee','leaseExpense'].map(key=>[key,sum(r=>r[key])]));
 const completedConnections=sum(r=>r.connections?.journeys),arrivals=sum(r=>r.punctuality?.arrivals),onTime=sum(r=>r.punctuality?.onTime);
 const execution=totals.flights!==null&&totals.cancelled!==null&&totals.flights+totals.cancelled>0?totals.flights/(totals.flights+totals.cancelled):null;
 return {start,end,elapsed,observed:rows.length,missing,duplicates,covered,complete:covered&&elapsed===7,totals,margin:totals.revenue>0&&totals.profit!==null?totals.profit/totals.revenue:null,execution,completedConnections,onTimeRate:arrivals>0&&onTime!==null?onTime/arrivals:null,bases:[...new Set(rows.map(r=>r.legAccounting===true?'leg':'round'))].sort()};
}
export function weeklyReview(game,start){
 if(!Number.isInteger(start)||start<1||(start-1)%7||start>gameWeekStart(game.day))throw Error('Tuần game không hợp lệ.');
 const current=period(game,start),previous=start>1?period(game,start-7):null;
 const profitDelta=current.complete&&previous?.complete&&current.totals.profit!==null&&previous.totals.profit!==null?current.totals.profit-previous.totals.profit:null;
 const review=current.complete?profitReview(game.tycoon.history.filter(r=>r.day<=current.end&&r.day<game.day),7):null;
 return {...current,previous,profitDelta,basisChanged:current.bases.length>1||!!(previous?.complete&&JSON.stringify(current.bases)!==JSON.stringify(previous.bases)),accountingChanges:review?.ready?review.changes:[],aircraft:review?.ready?review.aircraft:null};
}
export function goalProgress(game,goal){
 const review=weeklyReview(game,goal.weekStart),t=review.totals;let eligible=false,known=review.covered;
 if(goal.kind==='margin'){known&&=t.profit!==null&&t.flights!==null&&t.revenue!==null;eligible=t.flights>0&&t.profit>0&&review.margin!==null&&review.margin>=.1;}
 else if(goal.kind==='reliability'){known&&=t.flights!==null&&t.cancelled!==null;eligible=t.flights>=14&&review.execution!==null&&review.execution>=.95;}
 else if(goal.kind==='hub'){known&&=review.completedConnections!==null&&t.profit!==null;eligible=review.completedConnections>=20&&t.profit>0;}
 else throw Error('Mục tiêu không hợp lệ.');
 const ended=game.day>review.end;
 return {review,eligible:!!eligible,status:!known?'unknown':review.complete?(eligible?'achieved':'missed'):ended?'unknown':'tracking'};
}
export function validateWeeklyGoal(game){
 const goal=game.gameplay?.weeklyGoal;if(goal===undefined)return;
 if(!goal||goal.version!==1||!Object.hasOwn(WEEKLY_GOALS,goal.kind)||Object.keys(goal).some(k=>!['version','kind','weekStart','selectedDay'].includes(k))||!Number.isInteger(goal.weekStart)||goal.weekStart<1||(goal.weekStart-1)%7||goal.weekStart+6>9999||!Number.isInteger(goal.selectedDay)||goal.selectedDay<goal.weekStart||goal.selectedDay>goal.weekStart+6||goal.selectedDay>game.day)throw Error('Mục tiêu tuần trong save không hợp lệ.');
}
export function chooseWeeklyGoal(game,action){
 const start=gameWeekStart(game.day);
 if(action.weekStart!==start)throw Error('Tuần đã thay đổi. Mở lại mục tiêu tuần hiện tại.');
 if(action.kind==='none'){if(!game.gameplay.weeklyGoal)throw Error('Chưa theo dõi mục tiêu nào.');delete game.gameplay.weeklyGoal;return 'Đã dừng theo dõi mục tiêu; báo cáo thực tế được giữ nguyên.';}
 if(!game.setupComplete||game.founding&&game.founding.stage!=='done')throw Error('Hoàn tất thành lập hãng trước khi đặt mục tiêu.');
 if(start+6>9999)throw Error('Tuần cuối của PoC không còn đủ 7 ngày khai thác để đặt mục tiêu mới.');
 if(!Object.hasOwn(WEEKLY_GOALS,action.kind))throw Error('Chọn một mục tiêu hợp lệ.');
 const old=game.gameplay.weeklyGoal;
 if(old?.kind===action.kind&&old.weekStart===start)throw Error('Đang theo dõi mục tiêu này trong tuần hiện tại.');
 game.gameplay.weeklyGoal={version:1,kind:action.kind,weekStart:start,selectedDay:game.day};
 return `Đã lưu mục tiêu ${WEEKLY_GOALS[action.kind].name} · ngày ${start}–${start+6}. Không thu phí hoặc thưởng tiền.`;
}
