import {useI18n,LocalizedText} from './i18n.jsx';
import React, {useMemo, useRef, useState} from 'react';
import {context} from './game.js';
import {SERVICES} from './hq.js';
import {POSITIONINGS, POSITIONING_DAYS, SEGMENT_NAMES, positioningKey, positioningBlock, positioningPreferences} from './positioning.js';
import {RESEARCH, RESEARCH_BRANCHES, researchBlock, researchEffects} from './research.js';
import {previewDevelopment} from './development-preview.js';

function useCommit(act) {
  const lock = useRef(false), [pending, setPending] = useState(false), [message, setMessage] = useState('');
  return {pending, message, commit: async action => {
    if (lock.current) return;
    lock.current = true; setPending(true); setMessage('');
    try { const r = await act(action); setMessage(r.error || r.message); }
    catch (error) { setMessage(error.message); }
    finally { lock.current = false; setPending(false); }
  }};
}
function Projection({game, action, money}) {
 const {t:tx,locale}=useI18n();
  const result = useMemo(() => {
    try { return {preview: previewDevelopment(context(game), game.tycoon, action)}; }
    catch (error) { return {error: error.message}; }
  }, [game, action.type, action.key]);
  if (result.error) return <p role="status">{tx("Chưa tính được dự báo: {0}. Các điều khoản và thao tác vẫn dùng được.",{0:tx(result.error)})}</p>;
  const p = result.preview;
  if (!p) return null;
  return <section className="decision-preview" aria-label={tx("So sánh vận hành bảy ngày")}>
    <small>{tx("DỰ BÁO NGÀY {0}–{1} · CHỈ XEM",{0:tx(game.day),1:tx(game.day + 6)})}</small>
    <div className="operation-metrics"><div><small>{tx("Đóng góp hiện tại")}</small><strong>{tx(money(p.before.profit))}</strong></div><div><small>{tx("Đóng góp theo bản nháp")}</small><strong>{tx(money(p.after.profit))}</strong></div></div>
    <p><LocalizedText source={"Thay đổi {0} · lượt khách {1} → {2} · fuel {3} → {4} t."} values={{0:<b className={p.delta < 0 ? 'negative' : ''}>{tx(money(p.delta))}</b>,1:tx(p.before.pax.toLocaleString(locale)),2:tx(p.after.pax.toLocaleString(locale)),3:tx(p.before.burn.toFixed(1)),4:tx(p.after.burn.toFixed(1))}}/></p>
    <p className="micro">{tx("Giữ lịch, vé, đội bay và đối thủ hiện tại; dự án chỉ có hiệu lực từ ngày hoàn tất. Đóng góp = doanh thu − chi phí chuyến bay − phí duy trì định vị. Chưa trừ phí triển khai/R&D, quản trị chung, lease và bảo dưỡng. {0} Sự cố tương lai chưa biết; đây không phải cam kết lợi nhuận.",{0:game.legEconomy?tx("Chặng/vé đã bán giữ nguyên giá trị; phần đến ngoài cửa sổ bảy ngày chưa ghi nhận ở đây."):tx("Vòng bay ghi nhận theo mô hình hiện tại.")})}</p>
  </section>;
}

export function ServiceOffice({game, act, Button, money}) {
 const {t:tx,locale}=useI18n();
  const current = positioningKey(game), [selected, setSelected] = useState(current), {pending, message, commit} = useCommit(act);
  const profile = POSITIONINGS[selected], block = positioningBlock(game, selected), effects = researchEffects(game);
  const draft = {...game, hq: {...game.hq, positioning: selected === 'none' ? undefined : {key: selected, startedDay: game.day}}};
  const preferences = positioningPreferences(draft), switchDay = game.hq.positioning ? game.hq.positioning.startedDay + POSITIONING_DAYS : game.day;
  return <>
    <article className="management-card" aria-busy={pending}>
      <small>{tx("DỊCH VỤ & KHÁCH MỤC TIÊU")}</small><h3>{tx("Định vị hãng")}</h3>
      <p><LocalizedText source={"{0} · {1}/ngày.{2}"} values={{0:<b>{tx("Đang áp dụng: {0}",{0:tx(POSITIONINGS[current].name)})}</b>,1:tx(money(POSITIONINGS[current].daily)),2:switchDay > game.day&&(tx(" Có thể đổi hoặc dừng từ ngày {0}.",{0:switchDay}))}}/></p>
      <p>{tx("Mỗi hướng ưu tiên một nhóm khách và giảm sức hút với nhóm khác. AI bật: thay đổi lựa chọn của khách trong cùng thị trường hữu hạn; AI tắt: thay đổi nhu cầu có thể tiếp cận theo cơ cấu tuyến. Giá vé, giờ bay và ghế trống vẫn quyết định kết quả.")}</p>
      <label className="field" htmlFor="airline-positioning"><span>{tx("Định vị muốn xem")}</span><select id="airline-positioning" value={selected} onChange={e => setSelected(e.target.value)}>{Object.entries(POSITIONINGS).map(([key, p]) => <option key={key} value={key}>{tx(p.name)}</option>)}</select></label>
      <h4>{tx(profile.name)} · {selected === current?tx("hiện tại"):tx("bản nháp")}</h4><p>{tx(profile.detail)}</p>
      <div className="operation-metrics">{SEGMENT_NAMES.map((name, i) => <div key={name}><small>{tx("Hệ số lựa chọn · {0}",{0:tx(name)})}</small><strong>{tx(preferences[i].toFixed(2))}×</strong></div>)}</div>
      <p>{tx("Phí triển khai {0} · duy trì {1}/ngày, kể cả ngày không bay. {2}",{0:tx(money(profile.fee)),1:tx(money(profile.daily)),2:selected !== 'none'?tx("Cam kết tối thiểu 7 ngày; tiếp tục thu phí đến khi chủ động đổi hoặc dừng. Đổi sang hướng khác trả phí triển khai mới."):tx("Dừng sau cam kết không mất phí, không hoàn phí cũ.")})}</p>
      <p>{tx("Mỗi lượt khách vé thẳng/hợp đồng: doanh thu phụ trợ +${0}; chi phục vụ +${1}",{0:tx(profile.revenue),1:tx((profile.cost * effects.positioningCost).toLocaleString(locale))})}{effects.positioningCost < 1&&(tx(" (đã giảm nhờ R&D)"))}{tx(". Vé nối chuyến giữ giá trọn gói, chịu chi phục vụ nhưng không cộng phụ trợ riêng.")}</p>
      <Projection game={game} action={{type: 'positioning', key: selected}} money={money}/>
      <p className="micro">{tx("Bản nháp giả định áp dụng từ hôm nay. Chọn mục chỉ đổi dự báo. Phí triển khai là dòng tiền đầu tư ngoài lợi nhuận khai thác; duy trì và phục vụ nằm trong vận hành. Tất cả là thông số cân bằng game.")}</p>
      {block && <p>{tx(block)}</p>}
      <Button primary disabled={pending || !!block} onClick={() => commit({type: 'positioning', key: selected})}>{pending?tx("Đang lưu…"):selected === current?tx("Đang áp dụng"):selected === 'none'?tx("Dừng định vị chuyên biệt"):tx("Áp dụng {0} · {1}",{0:tx(profile.name),1:money(profile.fee)})}</Button>
      <p role="status">{tx(message)}</p>
    </article>
    <h3>{tx("Gói dịch vụ mặt đất")}</h3><p>{tx("Gói hiện có được giữ nguyên và cộng với định vị hãng. Doanh thu, chi phí theo khách thực sự bay; tăng nhu cầu không bảo đảm bán hết ghế.")}</p>
    <div className="management-grid">{SERVICES.map((v, i) => <article className="management-card" key={i}><h3>{tx(v.name)}</h3><p>{tx("Nhu cầu +{0}%",{0:tx(Math.round((v.demand - 1) * 100))})}</p><p>{tx("Dịch vụ +${0}/khách · chi phí cơ sở +${1}/khách",{0:tx(v.revenue),1:tx(v.cost)})}</p><Button disabled={pending || game.hq.service === i} onClick={() => commit({type: 'service', level: i})}>{game.hq.service === i?tx("Đang áp dụng"):tx("Áp dụng gói {0}",{0:tx(v.name)})}</Button></article>)}</div>
  </>;
}

export function ResearchOffice({game, act, Button, money}) {
 const {t:tx,locale}=useI18n();
  const [selected, setSelected] = useState(game.hq.researchProject?.key || 'fuel'), {pending, message, commit} = useCommit(act);
  const previewRef = useRef(null), choose = key => { setSelected(key); previewRef.current?.focus({preventScroll: true}); previewRef.current?.scrollIntoView({block: 'start'}); };
  const project = game.hq.researchProject, node = RESEARCH[selected], done = game.tycoon.research.includes(selected), block = researchBlock(game, selected);
  return <section aria-busy={pending}>
    <h3>{tx("Nghiên cứu & phát triển theo nhánh")}</h3>
    <p>{tx("Ba nghiên cứu nền tảng cũ giữ nguyên giá, hiệu lực tức thời và quyền sở hữu. Mỗi nhánh nâng cao cần nghiên cứu trước, trả phí một lần và chiếm một suất R&D toàn hãng. Thời gian chạy theo ngày game; xem dự báo hoặc tải lại không làm dự án tiến triển.")}</p>
    {project && <article className="management-card"><small>{tx("DỰ ÁN ĐANG CHẠY")}</small><h4>{tx(RESEARCH[project.key].name)}</h4><p>{tx("Ngày {0} → {1} · còn {2} lần chốt ngày. Hiệu lực từ đầu ngày {3}.",{0:tx(project.startedDay),1:tx(project.readyDay),2:tx(project.readyDay - game.day),3:tx(project.readyDay)})}</p><progress aria-label={tx("Tiến độ nghiên cứu")} value={game.day - project.startedDay} max={RESEARCH[project.key].days}/><p>{tx("Đã trả {0}. Huỷ mất toàn bộ phí và tiến độ dự án này; các nghiên cứu đã hoàn tất được giữ.",{0:tx(money(RESEARCH[project.key].price))})}</p><Button disabled={pending} onClick={() => commit({type: 'research-cancel'})}>{tx("Huỷ dự án · không hoàn tiền")}</Button></article>}
    <div className="management-grid">{RESEARCH_BRANCHES.map(branch => <article className="management-card" key={branch.id}><small>{tx("NHÁNH R&D")}</small><h4>{tx(branch.name)}</h4>{branch.keys.map((key, i) => {const r = RESEARCH[key], owned = game.tycoon.research.includes(key);return <section className="research-node" key={key}><h4>{tx(i + 1)}. {tx(r.name)}</h4><p>{tx(r.detail)}</p><p>{owned?tx("Đã hoàn tất · đang có hiệu lực"):project?.key === key?tx("Đang nghiên cứu"):tx("{0} · {1}",{0:money(r.price),1:r.days ? r.days + tx(' ngày') : tx('hiệu lực ngay')})}</p>{r.requires && <small>{tx("Cần: {0}",{0:tx(RESEARCH[r.requires].name)})}</small>}<Button aria-pressed={selected === key} onClick={() => choose(key)}>{selected === key?tx("Đang xem"):tx("Xem")} · {tx(r.name)}</Button></section>;})}</article>)}</div>
    <article ref={previewRef} tabIndex={-1} className="management-card" aria-label={tx("Chi tiết nghiên cứu")}><small>{done?tx("QUYỀN LỢI ĐÃ SỞ HỮU"):tx("BẢN NHÁP R&D")}</small><h4>{tx(node.name)}</h4><p>{tx(node.detail)}</p><p>{tx("{0} Phí R&D chỉ trừ tiền mặt khi bắt đầu, không trừ lại vào lợi nhuận khai thác.",{0:done?tx("Đã sở hữu; không phải mua lại."):project?.key === selected?tx("Đã trả {0} · có hiệu lực từ ngày {1}.",{0:money(node.price),1:project.readyDay}):tx("{0} trả một lần · {1}.",{0:money(node.price),1:node.days ? tx("hoàn tất từ ngày {0} nếu bắt đầu hôm nay",{0:game.day+node.days}) : tx('hiệu lực ngay khi mua')})})}</p>
      <Projection game={game} action={{type: 'research', key: selected}} money={money}/>
      <p className="micro">{tx("Không có hoàn tiền hoặc bán lại nghiên cứu. Các mức giảm nhiên liệu/hao mòn nhân nối tiếp trên phần còn lại. R&D độ bền giữ công thức sự cố hiện tại; hao mòn thấp hơn có thể tránh nhóm rủi ro từ 60%. Nghiên cứu không sửa lỗi và không thay thế lịch bảo dưỡng.")}</p>
      {block && <p>{tx(block)}</p>}
      <Button primary disabled={pending || !!block} onClick={() => commit({type: 'research', key: selected})}>{pending?tx("Đang lưu…"):done?tx("Đã hoàn tất"):tx("Nghiên cứu {0} · {1}",{0:tx(node.name),1:money(node.price)})}</Button>
      <p role="status">{tx(message)}</p>
    </article>
  </section>;
}
