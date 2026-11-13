import {useI18n} from './i18n.jsx';
import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import {AirplaneTilt,GlobeHemisphereEast,ListBullets,MapPin} from '@phosphor-icons/react';
import {WORLD_LAND} from './data/world-land.js';
import {airportList,getAirport} from './network.js';
import {frameNetwork} from './map-framing.js';
import {clusterMapMarkers} from './map-markers.js';
import {MapRoutePicker} from './MapRoutePicker.jsx';

export function GeoNetwork({game,routes,route,setRoute}){
 const {t:tx,locale,airportLabel}=useI18n();
 const[global,setGlobal]=useState(false),uid=useId().replace(/:/g,''),r=routes[route],origin=getAirport(game,r.from),destination=getAirport(game,r.to),visible=routes.map((r,i)=>({r,i})).filter(({r,i})=>r.from===origin.iata&&(game.openedRoutes.includes(i)||i===route)),frame=frameNetwork([origin,...visible.map(({r})=>getAirport(game,r.to))],origin,global),{box}=frame,hub=frame.point(origin),rawHub=frame.raw(origin);
 const plane=useRef(null),pickerButton=useRef(null),[size,setSize]=useState({w:400,h:240}),[picker,setPicker]=useState(null);
 useLayoutEffect(()=>{const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height)setSize({w:width,h:height});});observer.observe(plane.current);return()=>observer.disconnect();},[]);
 const markers=clusterMapMarkers([{id:'hub-'+origin.iata,hub:true,...hub},...visible.map(({r,i})=>({id:'route-'+i,index:i,...frame.point(getAirport(game,r.to))}))],size.w,size.h);
 const openPicker=(event,indices=null)=>setPicker({indices,returnTo:event.currentTarget});
 const lights=airportList(game).filter(a=>a.major).map(a=>({...frame.raw(a),iata:a.iata})).filter(p=>p.x>box.x&&p.x<box.x+box.w&&p.y>box.y&&p.y<box.y+box.h).slice(0,320);
 const arc=to=>{const p=frame.raw(getAirport(game,to));return `M ${rawHub.x} ${rawHub.y} Q ${(rawHub.x+p.x)/2} ${Math.min(rawHub.y,p.y)-box.h*.14} ${p.x} ${p.y}`;};
 return <section className="world geo-network night-network" aria-label={tx("Sơ đồ mạng bay toàn cầu")}>
  <div className="network-atmosphere" aria-hidden="true"/>
  <div className="geo-title"><small><span className="network-status-dot"/>{game.airline.name} <span className="network-eyebrow-divider">/</span>{tx(" MẠNG BAY")}</small><p>{tx("{0} · {1} tuyến hiển thị",{0:airportLabel(game,origin.iata),1:tx(visible.length)})}</p><div className="map-view-controls" role="group" aria-label={tx("Phạm vi bản đồ")}><button aria-pressed={!global} onClick={()=>setGlobal(false)}><MapPin size={15}/>{tx(" Mạng hiện tại")}</button><button aria-pressed={global} onClick={()=>setGlobal(true)}><GlobeHemisphereEast size={15}/>{tx(" Toàn cầu")}</button></div></div>
  <div className="geo-plane" ref={plane}><svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} preserveAspectRatio="none" aria-hidden="true"><defs>
   <linearGradient id={uid+'land'} gradientUnits="userSpaceOnUse" x1={box.x} y1={box.y} x2={box.x+box.w} y2={box.y+box.h}><stop stopColor="#123450"/><stop offset=".5" stopColor="#16425a"/><stop offset="1" stopColor="#0b223b"/></linearGradient>
   <filter id={uid+'glow'} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation={box.w*.003}/></filter>
   <radialGradient id={uid+'light'}><stop stopColor="#f8d59e" stopOpacity=".85"/><stop offset="1" stopColor="#f8d59e" stopOpacity="0"/></radialGradient>
  </defs><g className="geo-land">{[-1000,0,1000].map(offset=><g key={offset} transform={`translate(${offset} 0)`}>{WORLD_LAND.map((d,i)=><path key={i} d={d} style={{fill:`url(#${uid}land)`}}/>)}</g>)}</g>
  <g className="geo-graticule">{Array.from({length:37},(_,i)=><line key={'lon'+i} x1={-1000+i*1000/12} y1="0" x2={-1000+i*1000/12} y2="500"/>)}{Array.from({length:7},(_,i)=><line key={'lat'+i} x1="-1000" y1={i*500/6} x2="2000" y2={i*500/6}/>)}</g>
  <g className="network-city-lights">{lights.map((p,i)=><g key={p.iata}><circle cx={p.x} cy={p.y} r={box.w*.005} fill={`url(#${uid}light)`} opacity=".2"/><circle cx={p.x} cy={p.y} r={box.w*(i%4===0?.00085:.00055)} fill={i%3?'#aacfe0':'#f8cf8f'} opacity={.45+i%4*.12}/></g>)}</g>
  {visible.map(({r,i})=><g key={r.code} className={i===route?'network-arc active':'network-arc'}><path className="arc-glow" filter={`url(#${uid}glow)`} d={arc(r.to)} vectorEffect="non-scaling-stroke"/><path className="arc-track" d={arc(r.to)} vectorEffect="non-scaling-stroke"/>{i===route&&<g className="map-motion"><animateMotion path={arc(r.to)} dur="12s" repeatCount="indefinite" rotate="auto"/><g transform={`rotate(45) translate(${-box.w*.011},${-box.w*.011})`}><AirplaneTilt size={box.w*.022} weight="fill" fill="#fff5d8" stroke="none"/></g></g>}</g>)}
  <g className="map-exact-endpoints">{[origin,...visible.map(({r})=>getAirport(game,r.to))].map(a=>{const p=frame.raw(a);return <circle key={a.iata} cx={p.x} cy={p.y} r={box.w*.003} fill={a.iata===origin.iata?'#ffdfa5':'#9ee8ef'}/>;})}</g>
  </svg>{markers.map(group=>{
   const targets=group.members.filter(m=>!m.hub),hasHub=group.members.some(m=>m.hub),selected=targets.some(m=>m.index===route),style={left:group.x+'%',top:group.y+'%'};
   if(!targets.length)return <div key={group.key} className="network-map-marker map-hub-marker" style={style} title={airportLabel(game,origin.iata)}><MapPin size={15} weight="fill"/><b>{tx(origin.iata)}</b><small>{tx("HUB")}</small></div>;
   const clustered=group.members.length>1,entry=routes[targets[0].index];
   return <button key={group.key} className={'network-map-marker '+(clustered?'map-cluster ':'')+(selected?'selected':'')} style={style} title={clustered?targets.map(m=>airportLabel(game,routes[m.index].to)).join(' · '):airportLabel(game,entry.to)} aria-label={clustered?tx("Chọn trong cụm {0} tuyến{1}",{0:targets.length,1:hasHub?tx(' gần hub ')+origin.iata:''}):tx("Chọn tuyến {0} đến {1}",{0:airportLabel(game,entry.from),1:airportLabel(game,entry.to)})} aria-pressed={selected} aria-haspopup={clustered?'dialog':undefined} onClick={e=>clustered?openPicker(e,targets.map(m=>m.index)):setRoute(targets[0].index)}>{clustered?<><span className="map-cluster-count">{tx(targets.length)}</span><span>{tx("tuyến")}{hasHub&&<small>{tx("Hub {0}",{0:tx(origin.iata)})}</small>}</span></>:<><span className="map-marker-dot"/><b>{tx(entry.to)}</b></>}</button>;
  })}</div>
  <div className="network-scene-footer"><div className="network-route-readout"><span className="network-route-icon"><AirplaneTilt size={22} weight="fill"/></span><div><small>{tx("TUYẾN ĐANG CHỌN")}</small><b>{tx(origin.iata)}<span>↔</span>{tx(destination.iata)}</b><p>{tx("{0} km · {1}",{0:tx(r.km.toLocaleString(locale)),1:game.openedRoutes.includes(route)?tx("Đã mở khai thác"):tx("Chưa mở tuyến")})}</p></div></div><button ref={pickerButton} className="map-pick-button" aria-haspopup="dialog" onClick={openPicker}><ListBullets size={19}/><span>{tx("Chọn tuyến")}</span><b>{tx(visible.length)}</b></button></div>
  <p className="geo-caption">{tx("Bản đồ đêm minh họa · {0} · Bấm cụm để chọn từng tuyến",{0:global?tx("Toàn cầu"):tx("Tự căn theo mạng bay")})}</p>
  {picker&&<MapRoutePicker game={game} entries={visible} route={route} origin={origin.iata} initialIndices={picker.indices} returnTo={picker.returnTo} fallback={pickerButton} onSelect={i=>{setRoute(i);setPicker(null);}} onClose={()=>setPicker(null)}/>}
 </section>;
}
