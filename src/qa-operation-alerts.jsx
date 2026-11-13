import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OperationAlerts} from './OperationAlerts.jsx';
import cases from './qa-fixtures/operation-alerts-cases.json';
import './styles.css';
const Button=({children,onClick,...props})=><button className="button" {...props} onClick={onClick}>{children}</button>;
const forecastFailure={...cases.healthy,tycoon:{...cases.healthy.tycoon,prices:[]}};
const samples={...cases,forecastFailure};
function QA(){const [scenario,setScenario]=useState('connection'),[destination,setDestination]=useState('');return <main className="workspace-panel" style={{maxWidth:960,margin:'auto',padding:20}}><h1>Cảnh báo vận hành · QA</h1><p>Dữ liệu giả lập; không đọc hoặc ghi save trình duyệt.</p><label className="field"><span>Kịch bản</span><select value={scenario} onChange={e=>{setScenario(e.target.value);setDestination('');}}><option value="legacy">Save cũ · bảo dưỡng</option><option value="healthy">Không có cảnh báo</option><option value="connection">Vé đã bán · nguy cơ hoàn vé</option><option value="lease">Lease còn 1 ngày</option><option value="slots">Quyền slot mới đã bị thu hồi</option><option value="forecastFailure">Lỗi dự báo · dữ liệu giả lập hỏng</option></select></label>{destination&&<p role="status">Đích xử lý: {destination}</p>}<OperationAlerts key={scenario} game={samples[scenario]} Button={Button} open={(target,extra)=>setDestination(target+' '+JSON.stringify(extra))}/></main>;}
createRoot(document.getElementById('root')).render(<QA/>);
