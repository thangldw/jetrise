import {useI18n,LocalizedText} from './i18n.jsx';
import {journeySeats} from './overnight-connections.js';
import React, {useEffect, useState} from 'react';
import {context, number} from './game.js';


const amount = cents => (cents / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'});

function ShadowLegLedgerOffice({game, Button, open}) {
 const {t:tx,displayAt,locale,number,airportLabel}=useI18n();
  const [result, setResult] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0), [selectedDay, setSelectedDay] = useState(game.day);
  useEffect(() => {
    let worker, active = true;
    setResult(null); setError('');
    try {
      worker = new Worker(new URL('./planner-worker.js', import.meta.url), {type: 'module'});
      worker.onmessage = ({data}) => {
        if (!active) return;
        if (data.error || !data.ledger) setError('Chưa đối chiếu được sổ chặng. Thử tính lại; bạn vẫn có thể quản lý lịch và chốt ngày như bình thường.');
        else setResult({source: game, value: data.ledger});
        worker.terminate();
      };
      worker.onerror = () => { if (active) setError('Bộ tính sổ chặng chưa chạy được. Thử lại hoặc trở về lịch bay.'); worker.terminate(); };
      worker.postMessage({kind: 'leg-ledger', ctx: context(game), state: game.tycoon});
    } catch { worker?.terminate(); setError('Trình duyệt chưa chạy được bộ đối chiếu. Lịch bay và tiến trình hiện tại vẫn dùng được.'); }
    return () => { active = false; worker?.terminate(); };
  }, [game, retry]);
  const study = result?.source === game ? result.value : null;
  const selected = study?.days.find(d => d.day === selectedDay) || study?.days[0];
  const legs = study && selected ? study.legs.filter(l => l.departure < selected.day * 24 && l.arrival >= (selected.day - 1) * 24) : [];
  return <section className="leg-ledger-office" aria-labelledby="leg-ledger-title">
    <article className="management-card">
      <small>{tx("ĐỐI CHIẾU THỬ NGHIỆM · CHỈ XEM")}</small>
      <h3 id="leg-ledger-title">{tx("Thu tiền vé và hoàn thành chuyến bay")}</h3>
      <p><LocalizedText source={"Lịch hiện tại ghi nhận cả vòng khứ hồi vào ngày khởi hành. Bảng này thử tách từng chiều: thu tiền vé khi vòng bắt đầu, ghi doanh thu vé khi từng chặng hạ cánh. Tiền vé đã thu cho chặng chưa hạ cánh là {0}."} values={{0:<b>{tx("doanh thu chưa thực hiện")}</b>}}/></p>
      <p>{tx("Dùng lượng khách của dự báo hiện tại, giữ ghế hợp đồng trước khách thường. Không đổi ví tiền, lịch, báo cáo đã chốt hoặc cách vận hành hãng. Đây là mẫu so sánh trước khi bật; không tạo giao dịch.")}</p>
      <Button onClick={() => open('planner')}>{tx("Xem lịch bay")}</Button>
    </article>
    {!study && !error && <p role="status">{tx("Đang đối chiếu 7 ngày và các chặng về sau kỳ dự báo…")}</p>}
    {error && <div className="management-card" role="status"><p>{tx(error)}</p><Button onClick={() => setRetry(n => n + 1)}>{tx("Tính lại sổ chặng")}</Button></div>}
    {study && <>
      <div className="operation-metrics">
        <div><small>{tx("Chặng của các vòng khởi hành ngày {0}–{1}",{0:tx(study.startDay),1:tx(study.endDay)})}</small><strong>{tx(number(study.legs.length))}</strong></div>
        <div><small>{tx("Khách bay thẳng & hợp đồng · lượt lên máy bay")}</small><strong>{tx(number(study.totals.boardings))}</strong></div>
        <div><small>{tx("Doanh thu sau khi mọi chặng hạ cánh")}</small><strong>{tx(amount(study.totals.revenueCents))}</strong></div>
      </div>
      <p><LocalizedText source={"Hai cách ghi nhận có cùng tổng doanh thu, chi phí và dòng tiền sau khi mọi chặng trong mẫu hoàn thành; số liệu từng ngày có thể khác nhau. Chỉ tính đóng góp chuyến bay thẳng và hợp đồng, {0}."} values={{0:<b>{tx("không phải lợi nhuận toàn hãng")}</b>}}/></p>
      <details className="management-card"><summary>{tx("Phạm vi và giả định của bản đối chiếu")}</summary>
        <p>{tx("Mỗi vòng gồm hai chặng bay bằng thời lượng và 30 phút mặt đất mỗi đầu. Khách mỗi hạng được chia đều hai chiều; khách lẻ đi chiều đầu. Đây là cách tách dữ liệu game, chưa phải mô hình nhu cầu từng chiều.")}</p>
        <p>{tx("Tiền dịch vụ thu khi hạ cánh. Chi phí cả vòng được thanh toán lúc vòng khởi hành, rồi chia đôi và ghi nhận lúc từng chặng cất cánh; tiền mua nhiên liệu/CO₂ được tách khỏi giá vốn kho. Tiền được làm tròn sang cent một lần cho từng khoản của vòng, nên có thể lệch dưới một cent/khoản so với tính toán cũ.")}</p>
        <p>{tx("Loại trừ vé nối chuyến đang hoạt động ({0} lượt lên máy bay, {1} tiền vé), phí điều phối, quản trị, lease, bảo dưỡng, thưởng/phạt hợp đồng và chiến dịch.",{0:tx(number(study.excluded.connectionBoardings)),1:tx(amount(study.excluded.connectionRevenueCents))})}</p>
        <p>{tx("Giờ game chung, không phải giờ địa phương sân bay. Sự cố tương lai và tác động thị trường chưa nghiên cứu có thể làm kết quả thực tế khác dự báo. Mẫu giữ nguyên snapshot hiện tại; đổi lịch sẽ tính lại một mẫu mới. Chưa tạo đặt chỗ tồn tại trong save.")}</p>
      </details>
      {study.excluded.airbornePlanes.length > 0 && <p className="inline-warning">{tx("Chưa có sổ đặt vé lịch sử cho máy bay đang bay từ trước ngày {0}: {1}. Mẫu này không dựng lại các vé đó.",{0:tx(study.startDay),1:tx(study.excluded.airbornePlanes.join(', '))})}</p>}
      {study.cancellations.length > 0 && <p className="inline-warning">{tx("Dự báo hiện tại loại {0} vòng bị hủy khỏi sổ chặng. ",{0:tx(study.cancellations.length)})}<Button onClick={() => open('gameplay', {section: 'recovery'})}>{tx("Xem cứu chuyến")}</Button></p>}
      {!study.legs.length ? <div className="management-card"><h3>{tx("Chưa có chuyến đủ điều kiện trong 7 ngày tới")}</h3><p>{tx("Thêm lịch bay hoặc xử lý máy bay không khai thác được để xem đối chiếu.")}</p></div> : <>
        <h3>{tx("Đối chiếu cuối mỗi ngày")}</h3>
        <p className="micro">{tx("Ngày sau {0} chỉ theo dõi chặng về của mẫu này, không dự báo vòng mới. Sự kiện đúng 00:00 thuộc ngày mới.",{0:tx(study.endDay)})}</p>
        <div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("Đối chiếu doanh thu theo ngày")}>
          <table className="schedule-table"><thead><tr><th>{tx("Ngày")}</th><th>{tx("Doanh thu hiện tại")}</th><th>{tx("Doanh thu theo chặng")}</th><th>{tx("Chưa thực hiện cuối ngày")}</th><th>{tx("Chi phí hiện tại / theo chặng")}</th><th>{tx("Dòng tiền hiện tại / theo chặng")}</th></tr></thead>
            <tbody>{study.days.map(d => <tr key={d.day}><td>{tx("Ngày {0}",{0:tx(d.day)})}{d.day > study.endDay && <small>{tx("Chặng về")}</small>}</td><td>{tx(amount(d.reference.revenueCents))}</td><td>{tx(amount(d.shadow.revenueCents))}</td><td>{tx(amount(d.deferredCents))}</td><td>{tx(amount(d.reference.expenseCents))}<br/>{tx(amount(d.shadow.expenseCents))}</td><td>{tx(amount(d.reference.cashCents))}<br/>{tx(amount(d.shadow.cashCents))}</td></tr>)}</tbody>
          </table>
        </div>
        <h3>{tx("Chặng bay và ghế đã giữ trong mẫu")}</h3>
        <label className="field" htmlFor="leg-ledger-day"><span>{tx("Ngày xem chặng")}</span><select id="leg-ledger-day" value={selected.day} onChange={e => setSelectedDay(Number(e.target.value))}>{study.days.map(d => <option key={d.day} value={d.day}>{tx("Ngày {0}{1}",{0:tx(d.day),1:d.day > study.endDay?tx(" · chặng về"):''})}</option>)}</select></label>
        {legs.length ? <div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("Sổ ghế từng chặng")}>
          <table className="schedule-table"><thead><tr><th>{tx("Máy bay / hành trình")}</th><th>{tx("Cất cánh → hạ cánh")}</th><th>{tx("Ghế Y / J / F")}</th><th>{tx("Tiền vé / trạng thái cuối ngày")}</th></tr></thead><tbody>{legs.map(l => <tr key={l.id}>
            <td>{tx(l.plane)}<br/>{airportLabel(game, l.from)}<br/>→ {airportLabel(game, l.to)}<small>{tx("Ngày khởi hành vòng {0} · lượt #{1}{2}",{0:tx(l.departureDay),1:tx(l.template),2:l.recovery?tx(" · cứu chuyến"):''})}</small></td>
            <td>{displayAt(l.departure)}<br/>→ {displayAt(l.arrival)}</td>
            <td>{l.reserved.map((n, k) => `${n}/${l.capacity[k]}`).join(' · ')}<small>{tx("Trong đó {0} ghế hợp đồng",{0:tx(l.contractSeats[0])})}</small></td>
            <td>{tx(amount(l.ticketCents))}<small>{l.arrival < selected.day * 24?tx("Đã ghi nhận trong mẫu"):tx("Chưa hạ cánh · vé còn treo")}</small></td>
          </tr>)}</tbody></table>
        </div> : <p>{tx("Không có chặng cất cánh hoặc tiếp tục bay trong ngày này.")}</p>}
      </>}
    </>}
  </section>;
}


export function LegLedgerOffice({game, Button, open, act, busy}) {
 const {t:tx,displayAt,locale,number}=useI18n();
  const [confirm, setConfirm] = useState(false), [rollback, setRollback] = useState(false);
  const active = game.legEconomy;
  useEffect(()=>{setConfirm(false);setRollback(false);},[active?.migrationId]);
  return <>
    <article className="management-card">
      <small>{active?tx("ĐANG ÁP DỤNG CHO CHỐT NGÀY"):tx("TÙY CHỌN CHUYỂN ĐỔI SAVE")}</small>
      <h3>{tx("Kinh tế theo chặng · JET-201")}</h3>
      <p>{tx("Thu tiền vé và trả chi phí cả vòng khi khởi hành. Doanh thu vé và dịch vụ ghi nhận lúc từng chặng hạ cánh; chi phí ghi nhận lúc từng chặng cất cánh. Nhiên liệu/CO₂ cấp cho cả vòng được lấy khỏi kho ngay để không dùng lại cho chuyến khác.")}</p>
      <p>{tx("Giữ nguyên tiền, tài sản, lịch tuần và báo cáo cũ. Vé của vòng đã khởi hành giữ giá và ghế riêng dù bạn sửa lịch, cabin hay giá sau đó. Vé nối chuyến qua đêm cần bật riêng JET-202 trong Chiến lược → Thiết kế mạng. Vé đó giữ chỗ trên hai chặng và cần hoàn phần chưa bay trước khi sửa lịch ảnh hưởng đến khách.")}</p>
      {!active ? <>
        <p>{tx("Khi bật, lưu riêng bản ngay trước chuyển đổi trên thiết bị. Nếu ghi backup thất bại, không chuyển chế độ. Máy bay đang bay theo luật cũ phải về hub trước. Chế độ này không tự bật cho save cũ hoặc hãng mới.")}</p>
        <label className="field"><span><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>{tx(" Tôi chọn bật kinh tế theo chặng và giữ bản trước chuyển đổi.")}</span></label>
        <Button primary disabled={!confirm||busy||!act} onClick={()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));act({type:'leg-economy-enable',migrationId:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')});}}>{tx("Tạo backup & bật kinh tế theo chặng")}</Button>
      </> : <>
        <p>{tx("Đã bật từ ngày {0}. Bản trước chuyển đổi được giữ riêng, không bị backup tự động ghi đè. Khôi phục sẽ trở lại toàn bộ tiến trình tại ngày đó, kể cả tiền và tài sản; các thay đổi từ sau khi bật không được giữ trong hãng đang chơi. Nhánh hiện tại sẽ được lưu riêng trước khi khôi phục.",{0:tx(active.enabledDay)})}</p>
        <Button disabled={busy||!act} onClick={()=>act({type:'leg-economy-download'})}>{tx("Tải bản trước chuyển đổi")}</Button>
        <label className="field"><span><input type="checkbox" checked={rollback} onChange={e=>setRollback(e.target.checked)}/>{tx(" Tôi muốn trở về toàn bộ bản trước chuyển đổi, ngày {0}.",{0:tx(active.enabledDay)})}</span></label>
        <Button disabled={!rollback||busy||!act} onClick={()=>act({type:'leg-economy-rollback'})}>{tx("Khôi phục bản trước chuyển đổi")}</Button>
      </>}
      <p className="micro">{tx("Backup cục bộ, không phải cloud save. Có thể tải bản trước chuyển đổi sau khi bật.")}</p>
    </article>
    {active&&<AdvanceSalesCard {...{game,Button,act,busy}}/>}
    {active?<LiveLegLedgerOffice {...{game,Button,open}}/>:<ShadowLegLedgerOffice {...{game,Button,open}}/>}
  </>;
}

// JET-209 opt-in: bounded advance direct sales on top of the live leg ledger.
function AdvanceSalesCard({game, Button, act, busy}) {
 const {t:tx,displayAt,locale,number}=useI18n();
  const a = game.legEconomy.advance, [confirm, setConfirm] = useState(false), [rollback, setRollback] = useState(false);
  useEffect(()=>{setConfirm(false);setRollback(false);},[a?.migrationId]);
  const byDay = a ? [...new Set(a.bookings.map(b=>b.day))].map(day=>{const list=a.bookings.filter(b=>b.day===day);return {day,flights:list.length,pax:list.reduce((n,b)=>n+b.lots.reduce((m,l)=>m+l.passengers.reduce((x,y)=>x+y,0),0),0),cents:list.reduce((n,b)=>n+b.cents,0)};}) : [];
  return <article className="management-card advance-sales-card">
    <small>{a?a.stopped?tx("ĐÃ DỪNG BÁN MỚI · VÉ ĐÃ BÁN VẪN BAY"):tx("ĐANG MỞ BÁN"):tx("TÙY CHỌN CHUYỂN ĐỔI SAVE")}</small>
    <h3>{tx("Bán vé trước · JET-209")}</h3>
    <p><LocalizedText source={"Mỗi lần chốt ngày, hãng bán trước một phần khách cho các chuyến trong 6 ngày tới: từ 4% (6 ngày trước) tăng dần đến tổng tối đa 40% vào hôm trước ngày bay. Mức khách dựa trên chuyến cùng tuyến, giờ khởi hành gần nhất đã bay gần đây; tuyến chưa bay chuyến nào sẽ chưa được bán trước. Tiền vé vào quỹ ngay lúc bán và là {0}; giá vé được chốt tại thời điểm bán. Doanh thu chỉ ghi nhận khi chặng hạ cánh."} values={{0:<b>{tx("doanh thu chưa thực hiện")}</b>}}/></p>
    <p>{tx("Không tạo thêm khách: vào ngày bay, vé bán trước thay một phần vé bán trong ngày. Nếu dự báo cao hơn thực tế, số vé đã bán vẫn bay. Sửa, xoá hoặc dời chuyến đã có vé, thu nhỏ cabin hay bán máy bay sẽ hiện số tiền phải hoàn trước khi xác nhận. Chuyến không khai thác được sẽ tự hoàn tiền một lần.")}</p>
    {!a ? <>
      <label className="field"><span><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>{tx(" Tôi chọn bật bán vé trước và giữ bản trước chuyển đổi.")}</span></label>
      <Button primary disabled={!confirm||busy||!act} onClick={()=>{const bytes=crypto.getRandomValues(new Uint8Array(16));act({type:'advance-sales-enable',migrationId:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')});}}>{tx("Tạo backup & bật bán vé trước")}</Button>
    </> : <>
      <dl className="advance-sales-summary"><div><dt>{tx("Vé đã bán chờ bay")}</dt><dd>{tx(amount(a.liabilityCents))}</dd></div><div><dt>{tx("Chuyến có vé bán trước")}</dt><dd>{tx(a.bookings.length)}</dd></div><div><dt>{tx("Bật từ ngày")}</dt><dd>{tx(a.enabledDay)}</dd></div></dl>
      {byDay.length>0&&<div className="table-scroll"><table><caption className="sr-only">{tx("Vé bán trước theo ngày bay")}</caption><thead><tr><th>{tx("Ngày bay")}</th><th>{tx("Chuyến")}</th><th>{tx("Khách")}</th><th>{tx("Tiền đã thu")}</th></tr></thead><tbody>{byDay.map(d=><tr key={d.day}><td>{tx("Ngày {0}",{0:tx(d.day)})}</td><td>{tx(d.flights)}</td><td>{tx(number(d.pax))}</td><td>{tx(amount(d.cents))}</td></tr>)}</tbody></table></div>}
      <Button disabled={busy||!act} onClick={()=>act({type:a.stopped?'advance-sales-resume':'advance-sales-stop'})}>{a.stopped?tx("Mở lại bán vé trước"):tx("Dừng bán vé mới")}</Button>
      <Button disabled={busy||!act} onClick={()=>act({type:'advance-download'})}>{tx("Tải bản trước chuyển đổi")}</Button>
      <label className="field"><span><input type="checkbox" checked={rollback} onChange={e=>setRollback(e.target.checked)}/>{tx(" Tôi muốn trở về toàn bộ bản trước JET-209, ngày {0}.",{0:tx(a.enabledDay)})}</span></label>
      <Button disabled={!rollback||busy||!act} onClick={()=>act({type:'advance-rollback'})}>{tx("Khôi phục bản trước chuyển đổi")}</Button>
    </>}
    <p className="micro">{tx("Backup cục bộ, không phải cloud save. Khôi phục trả lại toàn bộ tiến trình tại ngày bật, kể cả tiền; nhánh hiện tại được lưu riêng trước.")}</p>
  </article>;
}

function LiveLegLedgerOffice({game,Button,open}) {
 const {t:tx,displayAt,locale,number,airportLabel}=useI18n();
  const [result,setResult]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let worker,active=true;setResult(null);setError('');
    try{
      worker=new Worker(new URL('./planner-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{if(!active)return;if(data.error||!data.liveLedger)setError('Chưa tính được dự báo sổ chặng. Bản lưu hiện tại được giữ nguyên.');else setResult({source:game,value:data.liveLedger});worker.terminate();};
      worker.onerror=()=>{if(active)setError('Bộ dự báo chưa chạy được. Thử lại.');worker.terminate();};
      worker.postMessage({kind:'live-leg-ledger',ctx:context(game),state:game.tycoon});
    }catch{worker?.terminate();setError('Chưa khởi động được bộ dự báo.');}
    return()=>{active=false;worker?.terminate();};
  },[game,retry]);
  const study=result?.source===game?result.value:null,e=game.legEconomy;
  return <section className="leg-ledger-office" aria-label={tx("Sổ chặng đang áp dụng")}>
    <h3>{tx("Sổ đã lưu · đầu ngày {0}",{0:tx(game.day)})}</h3>
    <div className="operation-metrics"><div><small>{tx("Tiền vé chưa thực hiện")}</small><strong>{tx(amount(e.deferredCents))}</strong></div><div><small>{tx("Chi phí chuyến bay trả trước")}</small><strong>{tx(amount(e.prepaidCents))}</strong></div><div><small>{tx("Vòng còn chặng chưa hạ cánh")}</small><strong>{tx(e.rounds.length)}</strong></div></div>
    {e.rounds.length>0?<div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("Chặng đã đặt còn tiếp tục")}><table className="schedule-table"><thead><tr><th>{tx("Máy bay / chặng")}</th><th>{tx("Cất cánh → hạ cánh")}</th><th>{tx("Khách Y / J / F")}</th><th>{tx("Vé chưa thực hiện")}</th></tr></thead><tbody>{e.rounds.flatMap(r=>r.legs.filter(l=>l.arrival>=e.through).map(l=><tr key={l.id}><td>{tx(r.plane)}<br/>{airportLabel(game,l.from)} → {airportLabel(game,l.to)}</td><td>{displayAt(l.departure)} → {displayAt(l.arrival)}</td><td>{l.passengers.map((n,k)=>n+(k===0?journeySeats(game,l.id):0)).join(' / ')}</td><td>{amount(l.ticketCents+(e.overnight?.journeys||[]).flatMap(j=>j.legs.filter(a=>a.id===l.id&&a.status==='reserved')).reduce((n,l)=>n+l.fareCents,0))}</td></tr>))}</tbody></table></div>:<p>{tx("Không có vòng đã khởi hành còn chặng chưa hạ cánh.")}</p>}
    {e.overnight&&<p>{tx("Còn {0} khách nối chuyến chờ hoàn tất. Tổng tiền vé và chi phí trả trước phía trên đã gồm các vé này, kể cả chặng chưa bắt đầu vòng. ",{0:e.overnight.journeys.reduce((n,j)=>n+j.pax,0)})}<Button onClick={()=>open('gameplay',{section:'network-study'})}>{tx("Xem hai chặng & phần vé nối chuyến")}</Button></p>}
    <h3>{tx("Dự báo 7 ngày theo chế độ đang áp dụng")}</h3>
    <p>{tx("Dùng cùng bộ chốt chặng với Chạy ngày. Chỉ xem, không ghi save. Bao gồm chương trình nối chuyến đang bật và thưởng/phạt hợp đồng; chưa trừ chi phí quản trị, lease và bảo dưỡng toàn hãng. Tác động thị trường chưa nghiên cứu và sự cố tương lai có thể làm thực tế khác dự báo. Khách được tính khi hạ cánh, chặng khi cất cánh. Sự kiện đúng 00:00 thuộc ngày mới.")}</p>
    {!study&&!error&&<p role="status">{tx("Đang tính dự báo theo chặng…")}</p>}
    {error&&<p role="status">{tx(error)} <Button onClick={()=>setRetry(n=>n+1)}>{tx("Tính lại")}</Button></p>}
    {study&&<div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("Dự báo kinh tế theo chặng")}><table className="schedule-table"><thead><tr><th>{tx("Ngày")}</th><th>{tx("Doanh thu")}</th><th>{tx("Chi phí")}</th><th>{tx("Lợi nhuận")}</th><th>{tx("Dòng tiền khai thác")}</th><th>{tx("Vé chưa thực hiện cuối ngày")}</th></tr></thead><tbody>{study.map(r=><tr key={r.day}><td>{tx(r.day)}</td><td>{tx(amount(Math.round(r.revenue*100)))}</td><td>{tx(amount(Math.round((r.nonfuel+r.fuelCost+r.co2Cost)*100)))}</td><td>{tx(amount(Math.round(r.profit*100)))}</td><td>{tx(amount(Math.round(r.cashDelta*100)))}</td><td>{tx(amount(Math.round(r.deferredRevenue*100)))}</td></tr>)}</tbody></table></div>}
    <p className="micro">{tx("Mỗi vòng chia khách trực tiếp theo hai chiều, chừa ghế nối chuyến đã giữ; khách lẻ ưu tiên chiều đầu khi còn chỗ. Đây vẫn là nhu cầu khứ hồi của game, chưa phải thị trường theo từng chiều. Chi phí được chia cent giữa hai chặng. Bộ xếp lịch tính cả phần đóng góp còn lại của các vòng khởi hành trong kỳ để không ưu tiên giả các chuyến sát cuối tuần.")}</p>
    <Button onClick={()=>open('planner')}>{tx("Xem lịch bay")}</Button>
  </section>;
}
