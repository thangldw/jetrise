import {useI18n} from './i18n.jsx';
import React,{useMemo,useState} from 'react';
import {operationAlerts} from './operation-alerts.js';
const groups={all:'Tất cả',maintenance:'Bảo dưỡng',slot:'Slot sân bay',connection:'Nối chuyến',lease:'Lease'};
const levels={urgent:'Cần xử lý',warning:'Sắp đến hạn',info:'Đã ghi nhận / đã lên kế hoạch'};
const actions={maintenance:'Mở bảo dưỡng',slot:'Quản lý slot',connection:'Mở cứu chuyến',lease:'Mở hồ sơ lease'};
export function OperationAlerts({game,Button,open}) {
 const {t:tx,locale,airportMessage}=useI18n();
 const result=useMemo(()=>operationAlerts(game),[game]),[category,setCategory]=useState('all');
 const selected=result.alerts.filter(a=>category==='all'||a.category===category),urgent=result.alerts.filter(a=>a.severity==='urgent').length;
 return <section className="operation-alerts" aria-label={tx("Trung tâm cảnh báo vận hành")}><h3>{tx("Ưu tiên vận hành · ngày {0}",{0:tx(result.from)})}</h3><p>{tx("{0} mục cần xử lý · {1} mục sắp đến hạn / thông tin. Dự báo từ ngày {2} đến {3}; bảo dưỡng nhắc hạn trong 72 giờ, lease nhắc trong 7 ngày.",{0:tx(urgent),1:tx(result.alerts.length-urgent),2:tx(result.from),3:tx(result.to)})}</p><p className="micro">{tx("Chỉ đọc trạng thái hiện tại và dự báo chuẩn. Không tự sửa lịch, mua slot, thuê/trả máy bay hoặc hoàn vé. Sự cố mới chưa biết không nằm trong dự báo.")}</p>
 {result.forecastError&&<p className="inline-warning" role="alert">{tx(result.forecastError)}</p>}
 <label className="field"><span>{tx("Nhóm cảnh báo")}</span><select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(groups).map(([key,label])=><option key={key} value={key}>{tx(label)} · {key==='all'?tx(result.alerts.length):result.alerts.filter(a=>a.category===key).length}</option>)}</select></label>
 <p role="status" className="micro">{tx("{0} mục trong nhóm đang xem.",{0:tx(selected.length)})}</p>
 {selected.length?<ul className="operation-alert-list">{selected.map(a=><li key={a.id}><article className="management-card"><p><span className={'status-tag '+(a.severity==='urgent'?'warning':'')}>{tx(levels[a.severity])}</span> · {tx(groups[a.category])}</p><h4>{airportMessage(game,a.title)}</h4><p>{airportMessage(game,a.detail)}</p><Button onClick={()=>open(a.target,a.extra)}>{a.target==='report'?tx("Xem báo cáo đã chốt"):tx(actions[a.category])}</Button></article></li>)}</ul>:<div className="management-card"><h4>{result.forecastError?tx("Chưa có cảnh báo từ dữ liệu đã kiểm tra"):result.alerts.length?tx("Không có cảnh báo trong nhóm này"):tx("Chưa phát hiện cảnh báo trong phạm vi kiểm tra")}</h4><p>{result.alerts.length?tx("Chọn Tất cả để xem các nhóm còn lại."):tx("Kiểm tra lại sau khi đổi lịch hoặc chạy ngày. Kết quả này không bảo đảm không có sự cố mới.")}</p></div>}
 </section>;
}
