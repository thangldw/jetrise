// Disposable in-memory career; never reads or writes player localStorage.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {SlotMarketOffice} from './SlotMarketOffice.jsx';
import {Report} from './Report.jsx';
import {context,forecast,transition,restoreGame,SAVE_KEY,money} from './game.js';
import {persistGame,readSlotMarketBackup,rollbackSlotMarket} from './save-store.js';
import {slotFixture} from '../tests/fixtures/slot-market.mjs';
import './styles.css';
function Button({primary,children,...props}){return <button className={'button'+(primary?' primary':'')} {...props}>{children}</button>;}
function RangeControl({id,label,value,min,max,step,onChange,unit}){return <div className="field"><label htmlFor={id}>{label} · {value} {unit}</label><div className="modal-actions"><Button aria-label={'Giảm '+label} disabled={value<=min} onClick={()=>onChange(value-step)}>−</Button><input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/><Button aria-label={'Tăng '+label} disabled={value>=max} onClick={()=>onChange(value+step)}>+</Button></div></div>;}
function QA(){
 const [game,setGame]=useState(()=>slotFixture()),[message,setMessage]=useState(''),[report,setReport]=useState(null),[phone,setPhone]=useState(false),storage=useRef(null),raw=useRef(null);
 const reset=s=>{const data=new Map([[SAVE_KEY,JSON.stringify(s)]]);raw.current=data.get(SAVE_KEY);storage.current={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
 if(!storage.current)reset(game);
 const act=a=>{try{
  if(a.type==='slot-market-download'){const b=readSlotMarketBackup(storage.current,game);setMessage('Đã xác minh backup trước JET-204: ngày '+b.game.day+' · '+money(b.game.cash));return {game};}
  if(a.type==='slot-market-rollback'){const r=rollbackSlotMarket(storage.current,raw.current);raw.current=r.raw;setGame(r.game);setReport(null);setMessage(r.message);return r;}
  const r=transition(game,a);if(r.error){setMessage(r.error);return r;}raw.current=persistGame(storage.current,r.game,raw.current);setGame(r.game);setMessage(r.message);if(r.report)setReport(r.report);return r;
 }catch(e){setMessage(e.message);return {game,error:e.message};}};
 return <main className="workspace-page" style={{maxWidth:1120,margin:'auto',padding:16,minWidth:0,background:'var(--paper)',minHeight:'100vh'}}><h1>JETRISE · Slot sân bay dùng chung</h1><p>QA trong bộ nhớ · không đọc hoặc ghi save người chơi</p><p>Ngày {game.day} · ví thử <b>{money(game.cash)}</b> · {game.tycoon.schedules.length} vòng trong lịch</p>
 <div className="modal-actions"><Button onClick={()=>act({type:'advance'})}>Chốt một ngày thử</Button><Button onClick={()=>{setGame(restoreGame(raw.current));setMessage('Đã nạp lại từ save thử');}}>Nạp lại save thử</Button><Button onClick={()=>{const s=slotFixture();reset(s);setGame(s);setReport(null);setMessage('Đã tạo lại tình huống thử');}}>Tạo lại tình huống thử</Button><Button onClick={()=>{const frame=document.querySelector('iframe'),d=frame?.contentDocument;setMessage('Khung chính '+document.documentElement.clientWidth+'/'+document.documentElement.scrollWidth+' px'+(d?'; điện thoại '+d.documentElement.clientWidth+'/'+d.documentElement.scrollWidth+' px; bảng '+[...d.querySelectorAll('.schedule-table-wrap')].map(e=>e.clientWidth+'/'+e.scrollWidth).join(', '):''));}}>Kiểm tra chiều rộng</Button><Button onClick={()=>setPhone(v=>!v)}>Khung điện thoại 380px</Button></div><p role="status">{message}</p>
 {phone&&<iframe title="JETRISE slots 380px" src="/qa-slot-market.html" style={{display:'block',width:380,maxWidth:'100%',height:820,border:'1px solid var(--line)'}}/>}
 <SlotMarketOffice key={game.slotMarket?.migrationId||'disabled'} {...{game,Button,RangeControl,act}} ctx={context(game)} forecast={forecast(game)} open={(type,extra)=>setMessage('Mở '+extra.section+' trong game chính.')}/>
 {report&&<details open><summary>Báo cáo ngày thử</summary><Report report={report}/></details>}
 </main>;
}
const root=createRoot(document.getElementById('root'));root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
