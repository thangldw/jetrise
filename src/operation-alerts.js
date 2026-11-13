import {context} from './game.js';
import {describeFault} from './fleet.js';
import {projectedWeekReports} from './planner.js';
import {atDay,maintenanceWindows,oneOff,displayAt} from './maintenance.js';
import {slotRequirements} from './slot-market.js';
import {slotUsage} from './airport-slots.js';
import {airportLabel} from './network.js';
import {datedRounds,roundEnd} from './dated-legs.js';

// An ephemeral view of current commitments. No forecast state is committed.
export function operationAlerts(game) {
 const ctx=context(game),now=atDay(game.day),end=now+168,alerts=[];
 const add=(id,category,severity,title,detail,target,extra={})=>alerts.push({id,category,severity,title,detail,target,extra});
 for(const p of game.fleet) {
  const due=p.serviceDueAt??now+168,heavy=oneOff(p);
  const repair=heavy&&heavy.end>now;
  const timely=maintenanceWindows(p,now,Math.max(now+.001,due+.001)).some(w=>w.end<=due&&(!p.fault||w.kind!=='light'));
  if(p.fault&&!repair)add('fault:'+p.id,'maintenance','urgent',p.id+' · cần sửa sự cố',describeFault(p.fault)+'. Ca kiểm tra tuần không sửa lỗi kỹ thuật.','fleet-studio',{plane:p.id,tab:'maintenance'});
  else if(p.wear>=90&&!repair)add('wear:'+p.id,'maintenance','urgent',p.id+' · hao mòn từ 90%',`Hao mòn ${p.wear.toFixed(1)}%. Kiểm tra ca bảo dưỡng và lịch khai thác trước khi chạy ngày.`,'fleet-studio',{plane:p.id,tab:'maintenance'});
  else if(due<=now+72&&!timely&&!(repair&&heavy.start<=now))add('due:'+p.id,'maintenance',due<=now?'urgent':'warning',p.id+(due<=now?' · đã đến hạn bảo dưỡng':' · hạn bảo dưỡng trong 72 giờ'),`Hạn ${displayAt(due)}. Chưa có ca hoàn tất đúng hạn trong kế hoạch hiện tại.`,'fleet-studio',{plane:p.id,tab:'maintenance'});
  if(repair)add('service:'+p.id,'maintenance','info',p.id+(heavy.start<=now?' · đang bảo dưỡng':' · đã đặt bảo dưỡng'),`Hoàn tất ${displayAt(heavy.end)}. Kiểm tra lịch bay trong thời gian ngừng khai thác.`,'fleet-studio',{plane:p.id,tab:'maintenance'});
  if(p.lease) {
   const expiry=p.lease.paidDay+(p.lease.term||14),expiryAt=atDay(expiry);
   if(expiryAt<=end) {
    const affected=datedRounds(ctx,game.tycoon,7).filter(r=>r.plane===p.id&&!r.cancelled&&roundEnd(r)>expiryAt);
    add('lease:'+p.id,'lease',expiryAt<=now+24?'urgent':'warning',p.id+' · lease sắp hết',`Tự trả máy bay từ đầu ngày ${expiry}; ${Math.max(0,expiry-game.day)} ngày game còn lại. ${affected.length} vòng trong 7 ngày tới kết thúc sau hạn; lịch của máy bay sẽ bị gỡ khi trả. Mở hồ sơ để xem điều khoản hoặc bố trí máy bay khác.`,'fleet-studio',{plane:p.id,tab:'details'});
   }
  }
 }
 if(game.slotMarket)for(const [key,required] of slotRequirements(ctx)) {
  const owned=game.slotMarket.rights.player[key]?.quantity||0;
  if(required>owned){const [airport,hour]=key.split(':'),at=now+((Number(hour)-now%168+168)%168);
   add('slot:'+key,'slot','urgent',airportLabel(game,airport)+' · thiếu quyền slot',`Lịch tuần / chặng đã cam kết cần ${required}, đang có ${owned}; thiếu ${required-owned} quyền tại ${displayAt(at)}. Chuyến thiếu quyền có thể bị hủy; mua lại còn phụ thuộc công suất và thời gian chờ.`,'gameplay',{section:'network-study'});
  }
 }
 for(const [airport,right] of Object.entries(game.slotRights||{}))for(const b of slotUsage(ctx,game.tycoon,airport))if(b.used>right.capacity)add('legacy-slot:'+airport+':'+b.hour,'slot','warning',airportLabel(game,airport)+' · vượt gói slot hiện tại',`Lịch tuần cần ${b.used} lượt, gói cho phép ${right.capacity} tại ${displayAt(now+((b.hour-now%168+168)%168))}. Kiểm tra gói hoặc đổi lịch.`,'gameplay',{section:'network-study'});
 let forecastError=null,reports=[];
 try {reports=projectedWeekReports(ctx,game.tycoon,false).map(x=>x.report);}catch {forecastError='Chưa hoàn tất dự báo 7 ngày; chưa thể kết luận an toàn nối chuyến. Cảnh báo từ trạng thái hiện tại vẫn được hiển thị.';}
 const journeys=game.legEconomy?.overnight?.journeys||[];
 for(const j of journeys) {
  const refunds=reports.flatMap(r=>(r.connections?.events||[]).filter(e=>e.id===j.id&&e.kind==='refund').map(e=>({...e,day:r.day})));
  if(refunds.length)add('journey:'+j.id,'connection','urgent',`${j.pax} khách · vé nối chuyến có nguy cơ không hoàn tất`,`Vé đã bán: ${airportLabel(game,j.legs[0].from)} → ${airportLabel(game,j.legs[1].to)}. Dự báo có hoàn phần chưa bay vào ngày ${Math.min(...refunds.map(e=>e.day))}. Kiểm tra chuyến bị hủy, máy bay và phương án cứu chuyến; đây chưa phải hoàn vé đã thực hiện.`,'gameplay',{section:'recovery'});
 }
 const recent=game.tycoon.history.find(h=>h.day===game.day-1),punctuality=recent?.punctuality;
 if(punctuality?.missedCustomers>0)add('connection-history:'+recent.day,'connection','info',`Ngày ${recent.day} · ${punctuality.missedCustomers} khách đã bị ảnh hưởng nối chuyến`,`Đã ghi nhận trong báo cáo: đổi chuyến ${punctuality.rebookedCustomers}, hoàn phần chưa bay ${punctuality.refundedCustomers}. Đây là kết quả đã chốt, không khẳng định còn hành trình chưa xử lý.`,'report',{report:recent});
 const order={urgent:0,warning:1,info:2};alerts.sort((a,b)=>order[a.severity]-order[b.severity]||a.id.localeCompare(b.id));
 return {alerts,forecastError,from:game.day,to:game.day+6};
}
