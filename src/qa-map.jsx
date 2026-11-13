// Browser-only visual fixture; no persistence and not a production build entry.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GeoNetwork} from './GeoNetwork.jsx';
import {createGame} from './game.js';
import {airportLabel,routeQuote} from './network.js';
import './styles.css';
const game=createGame();game.airline.name='JETRISE';
const routes=['BKK','DAD','SGN','SIN','PVG','NRT','HND'].map(to=>routeQuote(game,'HAN',to));
game.openedRoutes=[0,1,2,3,4,5,6];
function QA(){const [route,setRoute]=useState(0),[mobile,setMobile]=useState(false);return <div style={{padding:16,background:'#f5f7fb',minHeight:'100vh'}}><div style={{display:'flex',gap:20,marginBottom:20}}><a href="/">Game</a><button onClick={()=>setMobile(!mobile)}>Toggle 380px view</button></div>{mobile?<iframe title="Mobile map" src="/qa-map.html" style={{width:380,height:820,border:0}}/>:<div className="network-workspace"><GeoNetwork {...{game,routes,route,setRoute}}/><aside className="network-context" style={{padding:24}}><h1>Selected route</h1><p role="status">{airportLabel(game,routes[route].from)} → {airportLabel(game,routes[route].to)}</p><p>Read-only route selection fixture. No save storage.</p></aside></div>}</div>}
createRoot(document.getElementById('root')).render(<QA/>);
