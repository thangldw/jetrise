import {useI18n} from './i18n.jsx';
import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowUpRight,Check,MagnifyingGlass,X} from '@phosphor-icons/react';

import {normalizeMapSearch} from './map-markers.js';

export function MapRoutePicker({game,entries,route,initialIndices,origin,onSelect,onClose,returnTo,fallback}){
 const {t:tx,locale,airportSearchText,airportLabel}=useI18n();
 const dialog=useRef(null),search=useRef(null),title=useId(),[query,setQuery]=useState(''),[indices,setIndices]=useState(initialIndices);
 useEffect(()=>{
  const node=dialog.current;node.showModal();search.current.focus({preventScroll:true});
  return()=>{if(node.open)node.close();(returnTo?.isConnected?returnTo:fallback.current)?.focus({preventScroll:true});};
 },[]);
 const scoped=indices?entries.filter(({i})=>indices.includes(i)):entries;
 const results=scoped.filter(({r})=>normalizeMapSearch(airportSearchText(game,r.to)+' '+r.from+' '+r.to).includes(normalizeMapSearch(query)));
 return createPortal(<dialog ref={dialog} className="modal map-route-picker" aria-labelledby={title} onCancel={e=>{e.preventDefault();onClose();}}>
  <div className="modal-head"><h2 id={title}>{tx("Chọn tuyến bay")}</h2><button className="icon-button" aria-label={tx("Đóng danh sách tuyến")} onClick={onClose}><X size={23}/></button></div>
  <div className="map-picker-intro"><p>{tx("Từ {0}",{0:airportLabel(game,origin)})}</p><label className="map-route-search"><MagnifyingGlass size={20}/><span className="sr-only">{tx("Tìm thành phố, sân bay hoặc mã IATA")}</span><input ref={search} type="search" value={query} placeholder={tx("Thành phố, sân bay hoặc mã IATA")} onChange={e=>setQuery(e.target.value)}/></label>
   <div className="map-picker-scope"><span role="status">{tx("{0} tuyến{1}",{0:tx(results.length),1:indices?tx(" trong cụm"):tx(" trong mạng bay")})}</span>{indices&&<button onClick={()=>{setIndices(null);setQuery('');search.current.focus({preventScroll:true});}}>{tx("Xem tất cả {0} tuyến",{0:tx(entries.length)})}</button>}</div>
  </div>
  <div className="map-route-results">
   {results.length?<ul>{results.map(({r,i})=><li key={i}><button className="map-route-option" aria-pressed={i===route} onClick={()=>onSelect(i)}><span className="map-route-code">{tx(r.to)}</span><span className="map-route-description"><strong>{airportLabel(game,r.to)}</strong><small>{tx("{0} ↔ {1} · {2} km · {3}",{0:tx(r.from),1:tx(r.to),2:tx(r.km.toLocaleString(locale)),3:i===route?tx("Đang chọn"):game.openedRoutes.includes(i)?tx("Đã mở khai thác"):tx("Chưa mở tuyến")})}</small></span>{i===route?<Check size={19} weight="bold"/>:<ArrowUpRight size={19}/>}</button></li>)}</ul>:<div className="map-route-empty"><strong>{tx("Không tìm thấy tuyến phù hợp")}</strong><p>{tx("Thử tên thành phố hoặc mã sân bay khác.")}</p><button onClick={()=>{setQuery('');search.current.focus({preventScroll:true});}}>{tx("Xóa tìm kiếm")}</button></div>}
  </div>
  <p className="map-picker-note">{tx("Chọn tuyến để xem chi tiết và quản lý lịch bay.")}</p>
 </dialog>,document.body);
}
