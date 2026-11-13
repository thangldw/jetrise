import {useI18n} from './i18n.jsx';
import React,{useEffect,useState} from 'react';
import {context,DAYS,time,number} from './game.js';


export function RouteRecommendations({game,from,onSelect,Button,money}){
 const {t:tx,locale,number,airportLabel}=useI18n();
 const [result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let worker,active=true;setResult(null);setError('');try{
  worker=new Worker(new URL('./planner-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{if(!active)return;setResult(data.recommendations||null);setError(data.error?'Chưa tính được gợi ý. Thử lại hoặc chọn sân bay bên dưới.':'');worker.terminate();};
  worker.onerror=()=>{if(!active)return;setError('Chưa tính được gợi ý. Bạn vẫn có thể chọn sân bay bên dưới.');worker.terminate();};
  worker.postMessage({kind:'route-recommendations',ctx:context(game),state:game.tycoon,from});
 }catch{setError('Trình duyệt chưa chạy được bộ gợi ý. Chọn sân bay bên dưới để tiếp tục.');}
 return()=>{active=false;worker?.terminate();};},[game,from,retry]);
 return <section className="route-recommendations" aria-labelledby="route-recommendation-title"><div className="route-recommendation-heading"><div><small>{tx("CƠ HỘI MỞ RỘNG")}</small><h3 id="route-recommendation-title">{tx("Nên mở đường bay nào?")}</h3></div><span>{tx("Đội bay hiện tại · 7 ngày tới")}</span></div>
 {!result&&!error&&<p role="status">{tx("Đang đối chiếu tầm bay, lịch trống và lợi nhuận…")}</p>}
 {error&&<div role="status"><p>{tx(error)}</p><Button onClick={()=>setRetry(n=>n+1)}>{tx("Tính lại gợi ý")}</Button></div>}
 {result&&(!result.items.length?<p role="status">{tx(result.reason)}</p>:<><p className="micro">{tx("Ưu tiên lãi tăng thêm trên mỗi giờ máy bay, trong các tuyến đủ tiền mở. Mỗi phương án thêm 1 vòng khứ hồi vào lịch hiện tại; các gợi ý là lựa chọn thay thế nhau.")}</p><div className="route-recommendation-grid">{result.items.map((item,i)=><article className="management-card route-recommendation" key={item.route.to}><small>{tx("{0} · {1} km",{0:i===0?tx("ƯU TIÊN XEM TRƯỚC"):item.domestic?tx("NỘI ĐỊA"):tx("QUỐC TẾ"),1:tx(number(item.route.km))})}</small><h4>{airportLabel(game,item.route.to)}</h4><p>{tx("{0} · {1} · {2}h/vòng",{0:item.domestic?tx("Tuyến nội địa"):tx("Tuyến quốc tế"),1:tx(item.plane),2:tx(item.hours)})}</p><strong>{tx(money(item.profit))}<span>{tx(" lãi tăng thêm / 7 ngày")}</span></strong><p>{tx("Thêm 1 vòng · dự kiến {0} khách",{0:tx(number(item.pax))})}<br/>{tx("{0} {1} · ngày {2}",{0:tx(DAYS[(item.day-1)%7]),1:tx(time(item.start)),2:tx(item.day)})}</p><p>{tx("Phí mở tuyến ")}<b>{tx(money(item.fee))}</b><br/>{tx("Lãi tăng thêm trừ phí mở: {0}",{0:tx(money(item.netFirstWeek))})}</p><Button primary={i===0} onClick={()=>onSelect(item.route.to)}>{tx("Xem tuyến đến {0}",{0:tx(item.route.to)})}</Button></article>)}</div>{game.legEconomy&&<p className="micro">{tx("Lãi gợi ý gồm phần chặng về sau kỳ 7 ngày của vòng mới. Doanh thu thực tế vẫn ghi đúng ngày hạ cánh.")}</p>}<p className="micro">{tx("Đã so sánh {0} tuyến chọn lọc từ {1} tuyến đủ điều kiện; không phải tối ưu toàn bộ danh mục. Dự báo gồm nhiên liệu, CO₂, nhu cầu và cạnh tranh nếu đã bật; chưa phân bổ lease, bảo dưỡng và quản trị. Chọn gợi ý chỉ xem báo giá, chưa mua hoặc xếp lịch.",{0:tx(result.examined),1:tx(result.eligible)})}</p></>)}
 </section>;
}
