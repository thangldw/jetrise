// Real browser storage under a QA-only prefix, never the player's SAVE_KEY.
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SaveManager} from './SaveManager.jsx';
import {SAVE_KEY,restoreGame,transition} from './game.js';
import {manageSave,withSaveLock,exportSaveFile,persistGame,BACKUP_KEY,archiveSave} from './save-store.js';
import {saveManagerFixture} from '../tests/fixtures/save-manager.mjs';
import './styles.css';
const PREFIX='jetrise-qa-save-manager-207:';
const keys=()=>Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k?.startsWith(PREFIX));
const storage={get length(){return keys().length;},key:i=>keys()[i]?.slice(PREFIX.length)??null,getItem:k=>localStorage.getItem(PREFIX+k),setItem:(k,v)=>localStorage.setItem(PREFIX+k,v),removeItem:k=>localStorage.removeItem(PREFIX+k)};
function Button({primary,children,...props}){return <button className={'button'+(primary?' primary':'')} {...props}>{children}</button>;}
function QA(){
 const [raw,setRaw]=useState(()=>storage.getItem(SAVE_KEY)),[message,setMessage]=useState(''),[phone,setPhone]=useState(false),[epoch,setEpoch]=useState(0);
 useEffect(()=>{const changed=e=>{if(e.key===PREFIX+SAVE_KEY&&e.newValue!==raw)setMessage('Tab QA khác vừa thay đổi save. Bản xem trước này đã cũ; chọn Nạp lại save QA.');};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[raw]);
 const action=async a=>{try{const r=await withSaveLock(()=>manageSave(storage,raw,a));if(typeof r.raw==='string')setRaw(r.raw);if(r.message)setMessage(r.message);return r;}catch(e){setMessage(e.message);return {error:e.message};}};
 let summary;try{const g=raw&&restoreGame(raw);summary=g?'Ngày '+g.day+' · '+g.airline.name+' · '+(g.setupComplete?'đã lập hãng':'màn lập hãng mới'):'Chưa có save QA';}catch{summary='Save QA đang hỏng · có thể nhập hoặc khôi phục';}
 return <main className="workspace-page" style={{maxWidth:1040,margin:'auto',padding:16,minWidth:0,background:'var(--paper)',minHeight:'100vh'}}><h1>JETRISE · Save Manager</h1><p>QA lưu thật trong vùng riêng của trình duyệt; không đọc hoặc thay save người chơi. Hai tab của trang này dùng chung dữ liệu QA.</p><p><b>{summary}</b></p><div className="modal-actions"><Button onClick={async()=>{const f=saveManagerFixture({disrupted:true}),bundle=exportSaveFile(f.storage,f.raw);await action({kind:'import',basis:raw,text:bundle.text});}}>Nạp bộ thử JET-201–206</Button><Button onClick={()=>{setRaw(storage.getItem(SAVE_KEY));setEpoch(n=>n+1);setMessage('Đã nạp lại save QA từ trình duyệt.');}}>Nạp lại save QA</Button><Button disabled={!raw} onClick={async()=>{try{const r=await withSaveLock(()=>{if(storage.getItem(SAVE_KEY)!==raw)throw Error('Tab khác đã đổi save QA.');const result=transition(restoreGame(raw),{type:'advance'});if(result.error)throw Error(result.error);return persistGame(storage,result.game,raw);});setRaw(r);setMessage('Đã chốt một ngày QA.');}catch(e){setMessage(e.message);}}}>Chốt một ngày QA</Button><Button disabled={!raw} onClick={async()=>{try{await withSaveLock(()=>{if(storage.getItem(SAVE_KEY)!==raw)throw Error('Tab khác đã đổi save QA.');restoreGame(raw);archiveSave(storage,raw,'restore');storage.setItem(BACKUP_KEY,raw);storage.setItem(SAVE_KEY,'damaged QA bytes');});setRaw('damaged QA bytes');setMessage('Đã làm hỏng riêng save QA; bản tốt được giữ.');}catch(e){setMessage(e.message);}}}>Giả lập save QA hỏng</Button><Button onClick={()=>setPhone(v=>!v)}>Khung điện thoại 380px</Button><Button onClick={()=>{const d=document.querySelector('iframe')?.contentDocument;setMessage('Chiều rộng '+document.documentElement.clientWidth+'/'+document.documentElement.scrollWidth+' px'+(d?'; điện thoại '+d.documentElement.clientWidth+'/'+d.documentElement.scrollWidth+' px':''));}}>Kiểm tra chiều rộng</Button></div><p role="status">{message}</p>
 {phone&&<iframe title="Save Manager 380px" src="/qa-save-manager.html" style={{display:'block',width:380,maxWidth:'100%',height:820,border:'1px solid var(--line)'}}/>}
 <SaveManager key={epoch} revision={raw} onAction={action} Button={Button}/></main>;
}
const root=createRoot(document.getElementById('root'));root.render(<QA/>);if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
