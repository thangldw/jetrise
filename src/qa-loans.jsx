// Storage-free browser fixture, excluded from the production build.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Headquarters} from './Headquarters.jsx';
import {createGame, transition, restoreGame, forecast, context, TYPES, money} from './game.js';
import './styles.css';

function fixture(legacy = false) {
  const s = createGame(); s.cash = 2000000; s.tycoon.schedules = [];
  if (legacy) s.hq.loan = {balance: 678570, installment: 35715};
  return s;
}
function Button({primary, children, ...props}) { return <button className={`button${primary ? ' primary' : ''}`} {...props}>{children}</button>; }
function RangeControl({id, label, value, min, max, step = 1, onChange, unit}) {
  return <div className="range-control"><div className="range-heading"><label htmlFor={id}>{label}</label><output htmlFor={id}>{value.toLocaleString('vi-VN')}<small> {unit}</small></output></div><div className="range-row"><button type="button" className="range-step" aria-label={`Giảm ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>−</button><input id={id} type="range" value={value} min={min} max={max} step={step} style={{'--range-fill': `${(value - min) / (max - min) * 100}%`}} onChange={e => onChange(Number(e.target.value))}/><button type="button" className="range-step" aria-label={`Tăng ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>+</button></div><div className="range-scale"><span>{min.toLocaleString('vi-VN')}</span><span>Tối đa {max.toLocaleString('vi-VN')} {unit}</span></div></div>;
}
function QA() {
  const [game, setGame] = useState(fixture), [message, setMessage] = useState(''), [phone, setPhone] = useState(false);
  const ctx = context(game), submit = async action => { const r = transition(game, action); if (!r.error) setGame(r.game); setMessage(r.error || r.message); return r; };
  return <main className="workspace-page" style={{maxWidth: 1120, margin: 'auto', padding: 16, minWidth: 0, background: 'var(--paper)', minHeight: '100vh'}}>
    <h1>JETRISE · Phòng thử khoản vay</h1><p>QA trong bộ nhớ · không đọc hoặc ghi tiến độ trình duyệt.</p>
    <p>Ngày {game.day} · tiền {money(game.cash)} · dư nợ {money(game.hq.loan?.balance || 0)}</p>
    <div className="modal-actions"><Button onClick={() => submit({type: 'advance'})}>Chốt một ngày thử</Button><Button onClick={() => { setGame(restoreGame(JSON.stringify(game))); setMessage('Đã kiểm tra lưu/khôi phục JSON trong bộ nhớ.'); }}>Khôi phục bản sao JSON</Button><Button onClick={() => setGame(fixture(true))}>Nạp khoản vay cũ</Button><Button onClick={() => setGame(fixture())}>Đặt lại kịch bản thử</Button><Button onClick={() => setPhone(v => !v)}>Khung 380px</Button><Button onClick={() => setMessage(`Viewport ${document.documentElement.clientWidth}px / nội dung ${document.documentElement.scrollWidth}px; bảng ${[...document.querySelectorAll(".schedule-table-wrap")].map(e => `${e.clientWidth}/${e.scrollWidth}px`).join(", ")}`)}>Kiểm tra chiều rộng</Button></div>
    <p role="status">{message}</p>
    {phone && <iframe title="Financing 380px" src="/qa-loans.html" style={{display: 'block', width: 380, maxWidth: '100%', height: 820, border: '1px solid var(--line)'}}/>}
    <Headquarters game={game} types={TYPES} routes={ctx.routes} market={{...ctx, forecast, money}} section="finance" submit={submit} controls={{Button, RangeControl}}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<QA/>);
