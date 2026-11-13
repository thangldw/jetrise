// Disposable in-memory career; never reads or writes player localStorage.
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {StrategyOffice} from './StrategyOffice.jsx';
import {Report} from './Report.jsx';
import {transition,restoreGame,SAVE_KEY,money} from './game.js';
import {persistGame,readRivalNetworkBackup,rollbackRivalNetwork} from './save-store.js';
import {rivalFixture} from '../tests/fixtures/rival-network.mjs';
import './styles.css';
function Button({primary,children,...props}){return <button className={'button'+(primary?' primary':'')} {...props}>{children}</button>;}
function RangeControl({id,label,value,min,max,step,onChange,unit}){return <div className="field"><label htmlFor={id}>{label} · {value} {unit}</label><input id={id} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))}/></div>;}
function QA(){
 const [game,setGame]=useState(()=>rivalFixture({active:false,customers:true})),[message,setMessage]=useState(''),[report,setReport]=useState(null),[phone,setPhone]=useState(false),storage=useRef(null),raw=useRef(null);
 const reset=s=>{const data=new Map([[SAVE_KEY,JSON.stringify(s)]]);raw.current=data.get(SAVE_KEY);storage.current={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
 if(!storage.current)reset(game);
 const act=a=>{try{
  if(a.type==='rival-network-download'){const b=readRivalNetworkBackup(storage.current,game);setMessage('Đã xác minh backup trước JET-206: ngày '+b.game.day+' · '+money(b.game.cash));return {game};}
  if(a.type==='rival-network-rollback'){const r=rollbackRivalNetwork(storage.current,raw.current);raw.current=r.raw;setGame(r.game);setReport(null);setMessage(r.message);return r;}
  const r=transition(game,a);if(r.error){setMessage(r.error);return r;}raw.current=persistGame(storage.current,r.game,raw.current);setGame(r.game);setMessage(r.message);if(r.report)setReport(r.report);return r;
 }catch(e){setMessage(e.message);return {game,error:e.message};}};
 const advanceWeek=()=>{try{let s=game,r;for(let i=0;i<7;i++){r=transition(s,{type:'advance'});if(r.error)throw Error(r.error);raw.current=persistGame(storage.current,r.game,raw.current);s=r.game;}setGame(s);setReport(r.report);setMessage('Đã chốt bảy ngày thử qua transition và save-store.');}catch(e){setGame(restoreGame(raw.current));setMessage(e.message);}};
 return <main className="workspace-page" style={{maxWidth:1120,margin:'auto',padding:16,minWidth:0,background:'var(--paper)',minHeight:'100vh'}}><h1>JETRISE · AI tự phát triển mạng bay</h1><p>QA trong bộ nhớ · không đọc hoặc ghi save người chơi</p><p>Ngày {game.day} · ví thử <b>{money(game.cash)}</b> · {game.tycoon.schedules.length} vòng trong lịch</p>
 <div className="modal-actions"><Button onClick={()=>act({type:'advance'})}>Chốt một ngày thử</Button><Button onClick={advanceWeek}>Chốt bảy ngày thử</Button><Button onClick={()=>{setGame(restoreGame(raw.current));setMessage('Đã nạp lại từ save thử');}}>Nạp lại save thử</Button><Button onClick={()=>{const s=rivalFixture({active:false,customers:true});reset(s);setGame(s);setReport(null);setMessage('Đã tạo lại tình huống thử');}}>Tạo lại tình huống thử</Button><Button onClick={()=>{const d=document.querySelector('iframe')?.contentDocument;setMessage('Khung chính '+document.documentElement.clientWidth+'/'+document.documentElement.scrollWidth+' px'+(d?'; điện thoại '+d.documentElement.clientWidth+'/'+d.documentElement.scrollWidth+' px':''));}}>Kiểm tra chiều rộng</Button><Button onClick={()=>setPhone(v=>!v)}>Khung điện thoại 380px</Button></div><p role="status">{message}</p>
 {phone&&<iframe title="JETRISE AI 380px" src="/qa-rival-network.html" style={{display:'block',width:380,maxWidth:'100%',height:820,border:'1px solid var(--line)'}}/>}
 <StrategyOffice key={game.strategy.expansion?.migrationId||'disabled'} {...{game,Button,RangeControl,act}} open={(type,extra)=>setMessage('Mở '+extra.section+' trong game chính.')}/>
 {report&&<details><summary>Báo cáo ngày thử</summary><Report report={report}/></details>}
 </main>;
}
const root=createRoot(document.getElementById('root'));root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
