import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ProfitReview} from './ProfitReview.jsx';
import {Headquarters} from './Headquarters.jsx';
import {createGame,context,forecast,money,TYPES,routesFor,transition} from './game.js';
import {longRunFixture,maintainFleet} from '../tests/fixtures/long-run.mjs';
import './styles.css';
const run=longRunFixture();
for(let i=0;i<14;i++){maintainFleet(run);run.apply({type:'advance'});}
const full=run.game,legacy=transition(createGame(),{type:'advance'}).game;
const Button=({children,primary,icon,onClick, ...props})=><button className={'button '+(primary?'primary':'')} {...props} onClick={onClick}>{children}</button>;
function QA(){const [mode,setMode]=useState('full'),[destination,setDestination]=useState(''),game=mode==='empty'?createGame():mode==='legacy'?legacy:full;
 return <main className="workspace-panel" style={{maxWidth:1100,margin:'auto',padding:16}}><h1>Giải thích lãi/lỗ · dữ liệu giả lập</h1><p>Không đọc hoặc ghi localStorage.</p><label className="field"><span>Bộ dữ liệu</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="full">14 ngày · toàn bộ JET</option><option value="legacy">Save cũ · 1 ngày</option><option value="empty">Chưa khai thác</option></select></label><p role="status">{destination}</p><ProfitReview key={mode} game={game} Button={Button} open={(type,extra)=>setDestination(type+' '+JSON.stringify(extra||{}))}/><details><summary>Giao diện tài chính tích hợp</summary><Headquarters open={(type,extra)=>setDestination(type+' '+JSON.stringify(extra||{}))} game={game} types={TYPES} routes={routesFor(game)} market={{...context(game),money,forecast}} section="finance" submit={async()=>({error:'QA read-only'})} controls={{Button,RangeControl:()=>null}}/></details></main>;
}
createRoot(document.getElementById('root')).render(<QA/>);
