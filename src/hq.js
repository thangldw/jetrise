import {RESEARCH,startResearch,researchEffects} from './research.js';
export {RESEARCH} from './research.js';
import {POSITIONINGS,positioningKey,positioningDaily,setPositioning} from './positioning.js';
import {slotDaily} from './airport-slots.js';
import {fleetSupportFee} from './fleet-policy.js';
import {capitalFactor} from './economy.js';
import {getAirport,AIRPORTS} from './network.js';
import {createLoan,validateLoan,loanPayment,repayLoan} from './loans.js';
export const HUBS={HAN:{name:'Hà Nội',price:0,daily:0,x:.34,y:.21},SGN:{name:'TP. Hồ Chí Minh',price:1200000,daily:6000,x:.35,y:.34},DAD:{name:'Đà Nẵng',price:850000,daily:4000,x:.37,y:.28}};
function baseHubInfo(s,key){const a=getAirport(s,key);return (key==='HAN'&&s.airline?.personalized&&s.airline.origin!=='HAN'?{...HUBS.HAN,price:1200000,daily:6000}:HUBS[key])||(a?{name:a.name,price:1200000,daily:6000,x:(a.lon+180)/360,y:(90-a.lat)/180}:null);}

export function hubInfo(s,key){const h=baseHubInfo(s,key);return h?{...h,price:h.price*(s.economyVersion===2?20:1)}:null;}
export const hubsFor=s=>Object.fromEntries([...new Set([...Object.keys(HUBS),...Object.keys(s.hq.hubs)])].map(k=>[k,hubInfo(s,k)]));
export const TEAMS={pilots:{name:'Phi công',salary:180},cabin:{name:'Tiếp viên',salary:80},tech:{name:'Kỹ thuật',salary:100},ground:{name:'Mặt đất',salary:60}};
export const SERVICES=[{name:'Cơ bản',demand:1,revenue:0,cost:0},{name:'Tiêu chuẩn',demand:1.03,revenue:3,cost:2},{name:'Cao cấp',demand:1.07,revenue:8,cost:5}];
export const createHQ=()=>({hubs:{HAN:{hangar:0}},staff:{pilots:12,cabin:10,tech:6,ground:6},training:{pilots:0,cabin:0,tech:0,ground:0},service:0,marketingUntil:0,loan:null,prepaidRent:0,maintenancePaid:0,targets:{},ledger:[]});
export function restoreHQ(value,day,game){
 if(value===undefined)return createHQ();
 const h=structuredClone(value),int=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
 if(!h||!h.hubs||Object.keys(h.hubs).length<1||Object.keys(h.hubs).length>30||Object.keys(h.hubs).some(k=>!(game?getAirport(game,k):AIRPORTS[k])||!int(h.hubs[k]?.hangar,0,2))||!int(h.service,0,2)||!int(h.marketingUntil,0,day+3)||!Array.isArray(h.ledger)||h.ledger.length>60)throw Error('Invalid headquarters');
 h.maintenancePaid??=0;if(!Number.isInteger(h.maintenancePaid)||h.maintenancePaid<0||h.maintenancePaid>1e10)throw Error('Invalid maintenance expense');
 h.prepaidRent??=0;if(!Number.isInteger(h.prepaidRent)||h.prepaidRent<0||h.prepaidRent>1e10)throw Error('Invalid prepaid rent');
 h.targets??={};if(!h.targets||Array.isArray(h.targets)||Object.entries(h.targets).some(([k,v])=>!/^\d+$/.test(k)||!Array.isArray(v)||v.length!==3||v.some((n,i)=>!int(n,0,[4000,1000,300][i]))))throw Error('Invalid capacity target');
 for(const k of Object.keys(TEAMS))if(!int(h.staff?.[k],0,200)||!int(h.training?.[k],0,3))throw Error('Invalid staff');
 validateLoan(h.loan);
 for(const row of h.ledger)if(!row||!int(row.day,1,day)||typeof row.label!=='string'||row.label.length>120||!Number.isFinite(row.amount)||Math.abs(row.amount)>1e10)throw Error('Invalid ledger');
 return h;
}
export function staffing(s,types){const required={pilots:s.fleet.length*4,cabin:s.fleet.reduce((n,p)=>n+Math.ceil(types[p.type].seats/50),0),tech:s.fleet.length*2,ground:Object.keys(s.hq.hubs).length*4+Math.ceil(s.fleet.length/2)};return Object.fromEntries(Object.entries(TEAMS).map(([k,t])=>[k,{...t,required:required[k],employed:s.hq.staff[k],shortage:Math.max(0,required[k]-s.hq.staff[k])}]));}
export function dailyHQ(s,types){const teams=staffing(s,types),salary=Object.entries(teams).reduce((n,[k,t])=>n+s.hq.staff[k]*t.salary,0),agency=Object.values(teams).reduce((n,t)=>n+t.shortage*t.salary*1.7,0),hubFees=Object.keys(s.hq.hubs).reduce((n,k)=>n+hubInfo(s,k).daily+s.hq.hubs[k].hangar*500,0),{interest,principal}=loanPayment(s.hq.loan),leaseCost=s.fleet.reduce((n,p)=>n+(p.lease&&p.lease.paidDay!==s.day?p.lease.rate:0),0);return {positioningFee:positioningDaily(s),slotFee:slotDaily(s),fleetSupportFee:fleetSupportFee(s),leaseCost,leaseExpense:leaseCost+(s.hq.prepaidRent??0),prepaidRent:(s.hq.prepaidRent??0),salary:Math.round(salary),agency:Math.round(agency),hubFees,interest,principal,overhead:positioningDaily(s)+slotDaily(s)+fleetSupportFee(s)+Math.round(salary+agency)+hubFees+interest+leaseCost+(s.hq.prepaidRent??0)};}
export function repairCost(s,plane){const p=s.fleet.find(p=>p.id===plane);return Math.round(60000*(1-.2*(s.hq.hubs[p?.hub||'HAN']?.hangar||0)));}
export function modifiers(s){const research=researchEffects(s),profile=POSITIONINGS[positioningKey(s)];return {demand:SERVICES[s.hq.service].demand*(1+s.hq.training.cabin*.01)*(s.day<=s.hq.marketingUntil?1.15:1),fuel:(1-s.hq.training.pilots*.01)*research.fuel,wear:(1-s.hq.training.tech*.03)*research.wear,serviceRevenue:SERVICES[s.hq.service].revenue+profile.revenue,serviceCost:SERVICES[s.hq.service].cost*(1-s.hq.training.ground*.02)+profile.cost*research.positioningCost};}
export function hqAction(s,a,types,routes,market){
 const spend=(cost)=>{if(s.cash<cost)throw Error('Ngân quỹ chưa đủ: cần $'+cost.toLocaleString('en-US')+'.');s.cash-=cost;};
 if(a.type==='hub-buy'){
  if(!hubInfo(s,a.hub)||s.hq.hubs[a.hub]||Object.keys(s.hq.hubs).length>=30)throw Error('Hub không hợp lệ hoặc đã sở hữu.');spend(hubInfo(s,a.hub).price);s.hq.hubs[a.hub]={hangar:0};return 'Đã mở hub '+a.hub+'. Chọn sân bay đến để mở đường bay mới.';
 }
 if(a.type==='hangar'){
  const h=s.hq.hubs[a.hub];if(!h||h.hangar>=2)throw Error('Hangar không thể nâng thêm.');spend(250000*capitalFactor(s)*(h.hangar+1));h.hangar++;return 'Đã nâng hangar '+a.hub+' lên cấp '+h.hangar+'.';
 }
 if(a.type==='transfer'){
  const p=s.fleet.find(p=>p.id===a.plane);if(!p||p.maintenance||p.fault||!s.hq.hubs[a.hub]||p.hub===a.hub)throw Error('Chọn hub khác đã sở hữu.');spend(25000);p.hub=a.hub;p.servicePlan=null;s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.plane!==p.id);return 'Đã điều chuyển '+p.id+' sang '+a.hub+' và gỡ lịch bay, ca bảo dưỡng lặp cũ.';
 }
 if(a.type==='staff'){
  if(!Object.hasOwn(TEAMS,a.team)||!Number.isInteger(a.count)||a.count<0||a.count>200)throw Error('Số nhân sự phải từ 0 đến 200.');const diff=a.count-s.hq.staff[a.team];if(!diff)throw Error('Số nhân sự chưa thay đổi.');spend(Math.abs(diff)*(diff>0?500:400));s.hq.staff[a.team]=a.count;return 'Đã cập nhật đội '+TEAMS[a.team].name+'.';
 }
 if(a.type==='training'){
  if(!Object.hasOwn(TEAMS,a.team)||s.hq.training[a.team]>=3)throw Error('Đội này đã đào tạo tối đa.');spend(30000*(s.hq.training[a.team]+1));s.hq.training[a.team]++;return 'Đã hoàn tất đào tạo '+TEAMS[a.team].name+'.';
 }
 if(a.type==='service'){
  if(!Number.isInteger(a.level)||!SERVICES[a.level]||s.hq.service===a.level)throw Error('Chọn gói dịch vụ khác.');s.hq.service=a.level;return 'Đã đổi gói dịch vụ mặt đất.';
 }
 if(a.type==='loan'){
  if(s.hq.loan)throw Error('Tất toán khoản vay hiện tại trước khi vay thêm.');s.hq.loan=createLoan(a.amount,a.termDays);s.cash+=a.amount;return 'Đã giải ngân. Gốc trả trong '+s.hq.loan.termDays+' ngày; lãi cố định '+(s.hq.loan.dailyRateBps/100).toLocaleString('vi-VN')+'% dư nợ mỗi ngày khai thác.';
 }
 if(a.type==='repay'){
  const amount=a.amount===undefined?s.hq.loan?.balance:a.amount,next=repayLoan(s.hq.loan,amount);spend(amount);s.hq.loan=next;return next?'Đã trả trước $'+amount.toLocaleString('en-US')+'. Giữ mức gốc mỗi ngày và rút ngắn thời gian vay.':'Đã tất toán khoản vay.';
 }
 if(a.type==='route-target'){if(!s.openedRoutes.includes(a.route)||!Array.isArray(a.values)||a.values.length!==3||a.values.some((n,i)=>!Number.isInteger(n)||n<0||n>[4000,1000,300][i]))throw Error('Mục tiêu công suất không hợp lệ.');s.hq.targets[a.route]=a.values;return 'Đã lưu mục tiêu công suất tuyến.';}
 if(a.type==='stock'){
  if(!['fuel','co2'].includes(a.resource)||!Number.isInteger(a.amount)||a.amount<=0||(a.resource==='fuel'&&(a.amount>1000||a.amount%10))||(a.resource==='co2'&&(a.amount>10000000||a.amount%100000)))throw Error('Lượng nhập kho không hợp lệ.');const fuel=a.resource==='fuel',old=fuel?s.fuel:s.co2,limit=fuel?10000:1e10;if(old+a.amount>limit)throw Error('Vượt sức chứa kho.');const price=fuel?market.fuelPrice:market.co2Price;spend(a.amount*price);if(fuel){s.average=(s.fuel*s.average+a.amount*price)/(s.fuel+a.amount);s.fuel+=a.amount;}else{s.co2Average=(s.co2*s.co2Average+a.amount*price)/(s.co2+a.amount);s.co2+=a.amount;}return 'Đã nhập kho theo giá hiện tại và cập nhật giá vốn bình quân.';
 }
 if(a.type==='marketing'){
  if(s.day<=s.hq.marketingUntil)throw Error('Chiến dịch hiện tại chưa kết thúc.');spend(50000);s.hq.marketingUntil=s.day+2;return 'Chiến dịch tăng 15% nhu cầu trong 3 ngày khai thác.';
 }
 if(a.type==='positioning')return setPositioning(s,a.key);
 if(a.type==='research')return startResearch(s,a.key);
 if(a.type==='research-cancel'){
  if(!s.hq.researchProject)throw Error('Không có dự án đang chạy.');
  const key=s.hq.researchProject.key;delete s.hq.researchProject;
  return 'Đã huỷ '+RESEARCH[key].name+'. Phí đã trả không được hoàn; nghiên cứu hoàn tất trước đó vẫn giữ nguyên.';
 }
 return null;
}
