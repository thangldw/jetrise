// Storage-free fixture. This entry is excluded from the production Vite build.
import React, {useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {GameplayOffice} from './GameplayOffice.jsx';
import {createGame, transition, money} from './game.js';
import {persistGame,readSession,rollbackLegEconomy,readLegBackup,rollbackOvernight,readOvernightBackup} from './save-store.js';
import './styles.css';

function fixture(kind) {
  let s = createGame(); s.setupComplete = true; s.airline.name = 'JETRISE LEDGER LAB'; s.tycoon.schedules = []; s.openedRoutes = [0, 1, 2, 3];
  for (const p of s.fleet) { p.wear = 0; p.fault = null; p.serviceDueAt = 300; }
  const act = a => { const r = transition(s, a); if (r.error) throw Error(r.error); s = r.game; };
  if(kind==='overnight'){s.openedRoutes=[2,3];act({type:'add',plane:s.fleet[2].id,route:3,start:19.5});act({type:'add',plane:s.fleet[0].id,route:2,start:25});s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=360;} else if (kind === 'connections') {
    s.openedRoutes = [2, 3];
    act({type: 'add', plane: s.fleet[2].id, route: 3, start: 0}); act({type: 'add', plane: s.fleet[0].id, route: 2, start: 5});
    act({type: 'strategy-enable'}); act({type: 'connection-program', enabled: true, minimum: 60, maximum: 240}); s.tycoon.prices[3][0] *= 2;
  } else if (kind !== 'empty') {
    act({type: 'add', plane: s.fleet[0].id, route: 0, start: kind === 'same-day' ? 8 : 166});
  }
  if(kind==='cross-week')s.day=7;return s;
}
function Button({primary, children, ...props}) { return <button className={`button${primary ? ' primary' : ''}`} {...props}>{children}</button>; }
function RangeControl({id, label, value, min, max, step, onChange, unit}) { return <label className="field" htmlFor={id}>{label} · {value} {unit}<input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(Number(e.target.value))}/></label>; }
function QA() {
  const [kind, setKind] = useState('overnight'), [game, setGame] = useState(() => fixture('overnight')), [section, setSection] = useState('leg-ledger'), [message, setMessage] = useState(''), [phone, setPhone] = useState(false);
  const store=useRef(null),raw=useRef(null);
  const resetStore=s=>{const data=new Map();store.current={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};raw.current=persistGame(store.current,s,null);};
  if(!store.current)resetStore(game);
  const submit = a => {try{if(['leg-economy-download','overnight-download'].includes(a.type)){const b=(a.type==='overnight-download'?readOvernightBackup:readLegBackup)(store.current,game);setMessage('Đã xác minh backup thử '+b.raw.length+' bytes, ngày '+b.game.day);return {game};}const r=['leg-economy-rollback','overnight-rollback'].includes(a.type)?(a.type==='overnight-rollback'?rollbackOvernight:rollbackLegEconomy)(store.current,raw.current):transition(game,a);if(!r.error){raw.current=r.raw||persistGame(store.current,r.game,raw.current);setGame(r.game);}setMessage(r.error||r.message);return r;}catch(e){setMessage(e.message);return {game,error:e.message};}};
  return <main className="workspace-page" style={{maxWidth: 1120, margin: 'auto', padding: 16, minWidth: 0, background: 'var(--paper)', minHeight: '100vh'}}>
    <h1>JETRISE · Sổ theo chặng</h1><p>QA trong bộ nhớ · không đọc hoặc ghi save trên trình duyệt</p>
    <label className="field"><span>Tình huống kiểm tra</span><select value={kind} onChange={e => { setKind(e.target.value); const next=fixture(e.target.value);resetStore(next);setGame(next); setMessage(''); }}><option value="overnight">DAD → HAN → NRT qua đêm</option><option value="cross-week">Chủ nhật → thứ Hai</option><option value="same-day">Khứ hồi trong ngày</option><option value="connections">Chương trình nối chuyến đang bật</option><option value="empty">Chưa có lịch bay</option></select></label>
    <p>Ngày {game.day} · ví thử {money(game.cash)} · {game.tycoon.schedules.length} lịch tuần</p>
    <div className="modal-actions"><Button onClick={() => submit({type: 'advance'})}>Chốt một ngày thử</Button><Button onClick={()=>{const session=readSession(store.current);setGame(session.game);setMessage(session.blocked?'Bản thử bị lỗi':'Đã nạp lại từ save thử');}}>Nạp lại save thử</Button><Button onClick={()=>{const slot=game.tycoon.schedules.find(x=>x.route===2)||game.tycoon.schedules[0];if(slot)submit({type:'remove',id:slot.id});}}>Gỡ lịch tuần thử</Button><Button onClick={()=>{const next=structuredClone(game);next.fleet[0].fault='QA hydraulic fault';try{raw.current=persistGame(store.current,next,raw.current);setGame(next);setMessage('Đã tạo sự cố thử ở máy bay chặng tiếp');}catch(e){setMessage(e.message);}}}>Sự cố chặng tiếp thử</Button><Button onClick={() => setPhone(v => !v)}>Khung điện thoại 380px</Button><Button onClick={() => setMessage(`Viewport ${document.documentElement.clientWidth}px / nội dung ${document.documentElement.scrollWidth}px; bảng ${[...document.querySelectorAll('.schedule-table-wrap')].map(e => `${e.clientWidth}/${e.scrollWidth}px`).join(', ')}`)}>Kiểm tra chiều rộng</Button></div>
    <p role="status">{message}</p>
    {phone && <iframe title="JETRISE ledger 380px" src="/qa-leg-ledger.html" style={{display: 'block', width: 380, maxWidth: '100%', height: 820, border: '1px solid var(--line)'}}/>}
    <GameplayOffice {...{game, Button, RangeControl, submit, section}} onSectionChange={setSection} open={(type, extra) => { if (type === 'gameplay') setSection(extra.section); else setMessage('Liên kết tới ' + type + ' trong game chính.'); }}/>
  </main>;
}
createRoot(document.getElementById('root')).render(<QA/>);
