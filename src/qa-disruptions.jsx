// Disposable in-memory career. Never reads or writes player localStorage.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {GameplayOffice} from './GameplayOffice.jsx';
import {Report} from './Report.jsx';
import {transition,restoreGame,SAVE_KEY,money} from './game.js';
import {persistGame} from './save-store.js';
import {disruptionFixture} from '../tests/fixtures/disruption.mjs';
import './styles.css';
function Button({primary,children,...props}){return <button className={'button'+(primary?' primary':'')} {...props}>{children}</button>;}
function RangeControl({id,label,value,min,max,step,onChange,unit}){return <div className="field"><label htmlFor={id}>{label} · {value} {unit}</label><div className="modal-actions"><Button aria-label={'Giảm '+label} disabled={value<=min} onClick={()=>onChange(value-step)}>−</Button><input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/><Button aria-label={'Tăng '+label} disabled={value>=max} onClick={()=>onChange(value+step)}>+</Button></div></div>;}
function QA(){
 const [game,setGame]=useState(()=>disruptionFixture()),[section,setSection]=useState('recovery'),[message,setMessage]=useState(''),[report,setReport]=useState(null),[phone,setPhone]=useState(false),storage=useRef(null),raw=useRef(null);
 const reset=s=>{const data=new Map([[SAVE_KEY,JSON.stringify(s)]]);raw.current=data.get(SAVE_KEY);storage.current={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
 if(!storage.current)reset(game);
 const submit=a=>{try{const result=transition(game,a);if(result.error){setMessage(result.error);return result;}raw.current=persistGame(storage.current,result.game,raw.current);setGame(result.game);setMessage(result.message);if(result.report)setReport(result.report);return result;}catch(e){setMessage(e.message);return {game,error:e.message};}};
 return <main className="workspace-page" style={{maxWidth:1120,margin:'auto',padding:16,minWidth:0,background:'var(--paper)',minHeight:'100vh'}}><h1>JETRISE · Trễ chuyến & phục hồi</h1><p>QA trong bộ nhớ · không đọc hoặc ghi save người chơi</p><p>Ngày {game.day} · ví thử <b>{money(game.cash)}</b> · {game.legEconomy.overnight.journeys.length} nhóm vé đang thực hiện</p>
 <div className="modal-actions"><Button onClick={()=>submit({type:'advance'})}>Chốt một ngày thử</Button><Button onClick={()=>{setGame(restoreGame(raw.current));setMessage('Đã nạp lại từ save thử');}}>Nạp lại save thử</Button><Button onClick={()=>{const s=disruptionFixture();reset(s);setGame(s);setReport(null);setMessage('Đã tạo lại tình huống thử');}}>Tạo lại tình huống thử</Button><Button onClick={()=>{const frame=document.querySelector('iframe'),d=frame?.contentDocument;setMessage('Khung chính '+document.documentElement.clientWidth+'/'+document.documentElement.scrollWidth+' px'+(d?'; điện thoại '+d.documentElement.clientWidth+'/'+d.documentElement.scrollWidth+' px; bảng '+[...d.querySelectorAll('.schedule-table-wrap')].map(e=>e.clientWidth+'/'+e.scrollWidth).join(', '):''));}}>Kiểm tra chiều rộng</Button><Button onClick={()=>setPhone(v=>!v)}>Khung điện thoại 380px</Button></div><p role="status">{message}</p>
 {phone&&<iframe title="JETRISE disruptions 380px" src="/qa-disruptions.html" style={{display:'block',width:380,maxWidth:'100%',height:820,border:'1px solid var(--line)'}}/>}
 <GameplayOffice {...{game,Button,RangeControl,submit,section}} onSectionChange={setSection} open={(type,extra)=>{if(type==='gameplay')setSection(extra.section);else setMessage('Mở '+type+' trong game chính.');}}/>
 {report&&<details open><summary>Báo cáo ngày thử</summary><Report report={report}/></details>}
 </main>;
}
createRoot(document.getElementById('root')).render(<QA/>);
