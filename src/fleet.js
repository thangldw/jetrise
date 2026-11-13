import {atDay,oneOff,flightServiceError,maintenanceWindows,hangarConflict} from './maintenance.js';
import {aircraftNumber} from './registration.js';
import {repairCost} from './hq.js';
import {LIVERIES} from './liveries.js';
export {LIVERIES} from './liveries.js';
export const TECHNICAL_FAULTS=Object.freeze([
 'Rò rỉ hệ thống thủy lực',
 'Lỗi cảm biến nhiệt độ động cơ',
 'Lỗi máy phát điện',
 'Hỏng hệ thống điều áp cabin',
 'Lỗi cảm biến càng đáp',
 'Hao mòn phanh vượt giới hạn'
]);
export const describeFault=reason=>reason==='Sự cố kỹ thuật · cần kiểm tra đột xuất'?'Sự cố chưa xác định · cần chẩn đoán đột xuất':reason;
import {OPTIONS} from './amenities.js';
export {OPTIONS,optionEffects,cabinQuality} from './amenities.js';
export const PROFILES={
 A320:'Thân hẹp đa dụng cho mạng nội địa và khu vực. Quy mô trung bình giúp cân bằng ghế bán và chi phí trên các tuyến HAN hiện có.',
 E190:'Máy bay khu vực nhỏ, phù hợp tuyến nhu cầu thấp và nhiều chuyến mỗi ngày. Chi phí mỗi vòng thấp nhưng ít ghế để khai thác cao điểm.',
 B788:'Thân rộng đường dài. Có thể gom khách thay cho nhiều chuyến nhỏ; trên tuyến ngắn, chi phí cố định cao đòi hỏi hệ số lấp đầy tốt.',
 A223:'Quy mô nhỏ giữa máy bay khu vực và A320. Hợp mở tuyến mới có nhu cầu vừa, với nhiên liệu mô phỏng thấp hơn A320.',
 A321:'Nhiều ghế hơn A320, phù hợp trục đông khách. Cần kiểm tra nhu cầu còn lại để tránh dư ghế khi tăng tần suất.',
 A339:'Thân rộng cỡ trung cho tuyến khu vực đông khách hoặc chặng xa. Đổi lại quy mô cabin lớn là vốn và chi phí mỗi vòng cao.',
 A359:'Thân rộng đường dài, ưu tiên hiệu suất trên lượng khách lớn. Tầm bay dài không tạo thêm doanh thu nếu mạng hiện tại chỉ có tuyến ngắn.',
 A351:'Phiên bản cabin lớn cho thị trường mật độ cao. Phù hợp chiến lược gom khách, cần vốn và nhân sự nhiều hơn A350-900.',
 A388:'Máy bay sức chứa rất lớn. Trong PoC, nhu cầu chia sẻ hữu hạn khiến dư ghế là rủi ro chính; phù hợp ít chuyến trên trục cực đông khách.',
 B738:'Thân hẹp phổ biến cho nội địa và khu vực. Giá mua mô phỏng thấp, đổi lại mức tiêu thụ nhiên liệu cao hơn 737 MAX 8.',
 B38M:'Thân hẹp có sức chứa nhỉnh hơn 737-800 và nhiên liệu mô phỏng thấp hơn. Phù hợp khai thác tần suất cao trên tuyến đông khách.',
 B789:'Thân rộng lớn hơn 787-8, phục vụ chiến lược gom khách đường dài. Cân nhắc nhu cầu Y/J/F và chi phí trước khi thay máy bay nhỏ.',
 B77W:'Thân rộng sức chứa lớn, phù hợp tuyến trục mật độ cao. Nhiên liệu và chi phí mỗi vòng lớn khiến chuyến ít khách dễ thua lỗ.'
};
export function normalizePlane(p,day){
 p.airborneUntilAt??=null;if(p.airborneUntilAt!==null&&(!Number.isFinite(p.airborneUntilAt)||p.airborneUntilAt<0||p.airborneUntilAt%.25||p.airborneUntilAt>atDay(day)+168))throw Error('Invalid airborne reservation');
 p.servicePlan??=null;if(p.serviceDueAt===undefined)p.serviceDueAt=atDay(day)+168;
 if(!Number.isFinite(p.serviceDueAt)||p.serviceDueAt<0||p.serviceDueAt%.25||p.serviceDueAt>atDay(day)+336)throw Error('Invalid service due time');
 const plan=p.servicePlan;if(plan!==null&&(!plan||typeof plan!=='object'||!Number.isFinite(plan.start)||plan.start<0||plan.start>=168||plan.start%.25||!Number.isFinite(plan.activeFrom)||plan.activeFrom<0||plan.activeFrom%168!==plan.start||plan.activeFrom>atDay(day)+168))throw Error('Invalid recurring maintenance');
 p.hub??='HAN';p.livery??=0;p.options??=[];p.hoursSinceService??=0;p.fault??=null;p.maintenance??=null;p.ageDays??=0;p.lease??=null;
 if(!Number.isInteger(p.livery)||!LIVERIES[p.livery]||!Array.isArray(p.options)||new Set(p.options).size!==p.options.length||p.options.some(k=>!Object.hasOwn(OPTIONS,k))||!Number.isFinite(p.hoursSinceService)||p.hoursSinceService<0||p.hoursSinceService>1e7||(p.fault!==null&&(typeof p.fault!=='string'||p.fault.length>100)))throw Error('Invalid aircraft configuration');
 p.fault=describeFault(p.fault);
 if(!Number.isInteger(p.ageDays)||p.ageDays<0||p.ageDays>1e7||(p.lease!==null&&(!p.lease||!Number.isInteger(p.lease.remaining)||p.lease.remaining<1||p.lease.remaining>14||!Number.isInteger(p.lease.paidDay)||p.lease.paidDay<1||p.lease.paidDay>day||!Number.isInteger(p.lease.rate)||p.lease.rate<1||!Number.isInteger(p.lease.deposit)||p.lease.deposit<1)))throw Error('Invalid aircraft age/lease');
 if(p.lease&&p.lease.term!==undefined&&(![3,14].includes(p.lease.term)||p.lease.remaining>p.lease.term))throw Error('Invalid lease term');
 const m=p.maintenance;if(m!==null&&(!m||!['scheduled','emergency'].includes(m.kind)||!Number.isInteger(m.startDay)||!Number.isInteger(m.untilDay)||m.startDay<1||m.startDay>day+7||(m.startAt===undefined?m.untilDay!==m.startDay+(m.kind==='emergency'?2:1):(!Number.isFinite(m.startAt)||m.startAt%.25||!Number.isFinite(m.endAt)||m.endAt-m.startAt!==(m.kind==='emergency'?48:24)||m.startDay!==Math.floor(m.startAt/24)+1||m.untilDay!==Math.ceil(m.endAt/24)+1))||m.untilDay<=day))throw Error('Invalid maintenance');
 return p;
}
export const LIFE_DAYS=25*365;
export const usedPrice=(t,age,wear)=>Math.round(t.price*Math.max(.2,1-age/30)*(1-wear*.003));
export const deliveryDays=t=>t.seats>=250?4:2;
export function aircraftUnavailable(p,day){if(p.lease&&day>=p.lease.paidDay+(p.lease.term||14))return 'Đã hết hạn lease';if(p.ageDays>=LIFE_DAYS)return 'Hết niên hạn khai thác 25 năm';const now=atDay(day);if(maintenanceWindows(p,now,now+.001).length)return 'Đang trong ca bảo dưỡng';if(p.fault)return p.fault;if(now>=(p.serviceDueAt??now+168))return 'Đến hạn bảo dưỡng định kỳ theo tuần';return '';}
export function flightUnavailable(p,day,startHour,hours,baseDay=day){if(atDay(day)+startHour<(p.airborneUntilAt||0))return 'Máy bay còn đang bay từ ngày trước; chờ về hub.';const end=atDay(day)+startHour+hours;if(p.lease&&end>atDay(p.lease.paidDay+(p.lease.term||14)))return 'Vòng bay vượt thời hạn lease';if(p.ageDays>=LIFE_DAYS)return 'Hết niên hạn khai thác 25 năm';return flightServiceError(p,day,startHour,hours,baseDay);}

export function fleetAction(s,a,types){
 if(!['paint','option','repair','maintenance','return-lease','sell'].includes(a.type))return null;
 const p=s.fleet.find(p=>p.id===a.plane);if(!p)throw Error('Không tìm thấy máy bay.');
 const spend=cost=>{if(s.cash<cost)throw Error('Ngân quỹ chưa đủ để thực hiện.');s.cash-=cost;};
 if(a.type==='return-lease'){if(!p.lease)throw Error('Máy bay không phải lease.');s.cash+=p.lease.deposit;s.fleet=s.fleet.filter(x=>x.id!==p.id);s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.plane!==p.id);delete s.tycoon.cabins[p.id];return 'Đã trả máy bay lease, gỡ lịch và hoàn tiền cọc.';}
 if(a.type==='sell'){if(p.lease||s.fleet.filter(x=>!x.lease).length<=1)throw Error('Cần giữ ít nhất một máy bay sở hữu.');s.cash+=usedPrice(types[p.type],p.ageDays/365,p.wear);s.fleet=s.fleet.filter(x=>x.id!==p.id);s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.plane!==p.id);delete s.tycoon.cabins[p.id];return 'Đã bán máy bay và gỡ lịch liên quan.';}
 if(a.type==='paint'){if(!Number.isInteger(a.livery)||!LIVERIES[a.livery]||p.livery===a.livery)throw Error('Chọn phối màu khác.');spend(LIVERIES[a.livery].price);p.livery=a.livery;return 'Đã sơn '+p.id+' · '+LIVERIES[a.livery].name+'.';}
 if(a.type==='option'){if(!Object.hasOwn(OPTIONS,a.key)||p.options.includes(a.key))throw Error('Gói không hợp lệ hoặc đã lắp.');spend(OPTIONS[a.key].price);p.options.push(a.key);return 'Đã lắp '+OPTIONS[a.key].name+' cho '+p.id+'.';}
 if(p.ageDays>=LIFE_DAYS)throw Error('Máy bay đã hết niên hạn khai thác.');
 if(p.maintenance)throw Error('Máy bay đã có lịch bảo dưỡng.');
 if(a.type==='repair'&&p.wear===0&&!p.fault&&p.hoursSinceService===0)throw Error('Máy bay chưa cần bảo dưỡng.');
 const start=a.type==='repair'?s.day:a.day,hour=a.type==='repair'?0:(a.hour??0);
 if(!Number.isFinite(hour)||hour<0||hour>=24||hour%.25)throw Error('Chọn giờ theo mốc 15 phút.');
 if(!Number.isInteger(start)||start<s.day||start>s.day+7)throw Error('Chọn ngày bảo dưỡng trong 7 ngày tới.');
 if(p.fault&&(start!==s.day||hour!==0))throw Error('Sự cố cần xử lý ngay.');
 const kind=p.fault?'emergency':'scheduled',window={start:atDay(start)+hour,end:atDay(start)+hour+(p.fault?48:24)},blocked=hangarConflict(s,p,window);if(blocked)throw Error(blocked);
 const cost=Math.round(repairCost(s,p.id)*(kind==='emergency'?1.6:1));spend(cost);s.hq.maintenancePaid=(s.hq.maintenancePaid||0)+cost;p.maintenance={kind,startDay:start,untilDay:start+(kind==='emergency'?2:1)};if(hour){p.maintenance.startAt=atDay(start)+hour;p.maintenance.endAt=p.maintenance.startAt+(kind==='emergency'?48:24);p.maintenance.untilDay=Math.ceil(p.maintenance.endAt/24)+1;}
 return p.id+' ngừng bay từ ngày '+start+' đến trước ngày '+p.maintenance.untilDay+'. Đã trả '+cost.toLocaleString('en-US')+' USD.';
}
export function settleFleet(s,report){
 report.incidents=[];report.incidentDetails={};report.leaseReturns=[];
 for(const p of [...s.fleet]){
  const landing=Math.max(p.airborneUntilAt||0,...(report.operatedRounds||report.rows).filter(r=>r.plane===p.id).map(r=>atDay(s.day)+r.start+r.hours));p.airborneUntilAt=landing>atDay(s.day+1)?landing:null;
  p.ageDays++;
  if(p.lease){p.lease.remaining--;if(p.lease.remaining===0){report.leaseReturns.push(p.id);s.fleet=s.fleet.filter(x=>x.id!==p.id);s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.plane!==p.id);delete s.tycoon.cabins[p.id];continue;}}
  if(!report.serviceState?.[p.id])p.hoursSinceService+=(report.operatedRounds||report.rows).filter(r=>r.plane===p.id).reduce((n,r)=>n+r.hours,0);
  if(report.serviceState?.[p.id])Object.assign(p,report.serviceState[p.id]);
  if(oneOff(p)&&oneOff(p).end<=atDay(s.day+1)){p.maintenance=null;}
  // Reproducible PoC incidents; risk rises after 60% wear, no browser RNG or wall clock.
  const seed=s.day*31+aircraftNumber(p.id)*17,period=p.wear>=60?11:29;
  if(!p.maintenance&&!p.fault&&p.hoursSinceService>=20&&seed%period===0){p.fault=TECHNICAL_FAULTS[Math.floor(seed/period)%TECHNICAL_FAULTS.length]+' · cần sửa chữa đột xuất';report.incidents.push(p.id);report.incidentDetails[p.id]=p.fault;}
 }
}
