import {useI18n} from './i18n.jsx';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {airportList,getAirport} from './network.js';
import {AIRPORT_LIMIT as LIMIT,normalizeSearch,searchAirports} from './airport-search.js';
// One editable combobox (ARIA 1.2 list autocomplete): the input shows the chosen airport, typing filters the list.
export function AirportPicker({game,value,onChange,id,label='Sân bay',initialCountry='all',allowEmpty=false,exclude=[]}){
 const {t:tx,countryName,airportSearchText,airportLabel}=useI18n();
 const country=initialCountry,inputId=id+'-search',listId=id+'-list',input=useRef(null),list=useRef(null);
 // typed is null while the input simply shows the selection; a string means the player is editing a search.
 const[typed,setTyped]=useState(null),[open,setOpen]=useState(false),[active,setActive]=useState(-1),[place,setPlace]=useState({up:false,max:320});
 const airports=useMemo(()=>airportList(game),[game?.network?.airports]);
 const candidates=airports.filter(a=>!exclude.includes(a.iata));
 const selected=value&&!exclude.includes(value)?getAirport(game,value):null;
 const {q,matches,options}=searchAirports({candidates,query:typed||'',country,selected,searchText:a=>airportSearchText(game,a.iata)+' '+countryName(a.country)+' '+a.country,labelOf:a=>airportLabel(game,a.iata)});
 // Rows are {code,text}; the optional empty row lets callers clear the choice, as the old native select did.
 const showEmpty=allowEmpty&&!q,rows=[...(showEmpty?[{code:'',text:tx("Chọn {label}…",{label:tx(label)})}]:[]),...options.map(a=>({code:a.iata,text:airportLabel(game,a.iata)+' · '+tx(countryName(a.country))}))];
 const selectedText=selected?airportLabel(game,value):'';
 const optionId=i=>listId+'-'+i;
 useEffect(()=>{if(open&&active>=0)document.getElementById(optionId(active))?.scrollIntoView({block:'nearest'});},[active,open]);
 // Open downward unless the field is near the bottom of its dialog/viewport; then open upward and shrink to fit.
 const placeList=()=>{const el=input.current;if(!el)return;const box=el.closest('.modal-content'),r=el.getBoundingClientRect(),bottom=Math.min(box?box.getBoundingClientRect().bottom:Infinity,innerHeight),top=Math.max(box?box.getBoundingClientRect().top:0,0),below=bottom-r.bottom-12,above=r.top-top-12,up=below<240&&above>below;setPlace({up,max:Math.max(160,Math.min(320,up?above:below))});};
 const openList=()=>{if(open)return;placeList();const at=rows.findIndex(r=>r.code===(selected?value:''));setActive(at);setOpen(true);};
 const close=()=>{setOpen(false);setActive(-1);setTyped(null);};
 // Re-select the text after choosing so the next keystroke starts a new search instead of appending to the label.
 const choose=row=>{close();if(row.code!==(value||''))onChange(row.code);setTimeout(()=>{if(document.activeElement===input.current)input.current.select();},0);};
 const onKeyDown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){openList();return;}if(!rows.length)return;const step=e.key==='ArrowDown'?1:-1;setActive(a=>(a+step+rows.length)%rows.length);}
  else if(e.key==='Enter'&&open&&active>=0&&rows[active]){e.preventDefault();choose(rows[active]);}
  else if(e.key==='Escape'&&(open||typed!==null)){e.preventDefault();e.stopPropagation();close();}
 };
 return <div className="airport-picker"><label className="field" htmlFor={inputId}><span>{tx(label)}</span></label><div className="airport-search airport-combobox" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))close();}}><input ref={input} id={inputId} type="text" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open&&active>=0?optionId(active):undefined} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={typed===null?selectedText:typed} placeholder={tx("Thành phố, sân bay, quốc gia hoặc mã IATA")} onChange={e=>{setTyped(e.target.value);setActive(allowEmpty&&!normalizeSearch(e.target.value.trim())?1:0);if(!open)placeList();setOpen(true);}} onClick={e=>{if(typed===null)e.target.select();openList();}} onFocus={e=>e.target.select()} onKeyDown={onKeyDown}/>{typed!==null&&typed&&<button type="button" className="button" aria-label={tx("Xóa tìm {label}",{label:tx(label)})} onClick={()=>{setTyped('');setActive(allowEmpty?1:0);placeList();setOpen(true);input.current.focus();}}>{tx("Xóa")}</button>}<ul ref={list} id={listId} role="listbox" tabIndex={-1} aria-label={tx(label)} className={"airport-options"+(place.up?" up":"")} style={{maxHeight:place.max}} hidden={!open}>{rows.map((r,i)=><li key={r.code||'none'} id={optionId(i)} role="option" data-code={r.code} aria-selected={r.code===(selected?value:'')} className={(i===active?'active ':'')+(r.code===''?'empty':'')} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(r)} onMouseMove={()=>active!==i&&setActive(i)}>{r.text}</li>)}</ul></div><p className="micro" role="status">{matches.length?tx(matches.length>LIMIT?"{count} kết quả · đang hiện tối đa 60; gõ thêm để thu hẹp":"{count} kết quả",{count:matches.length}):tx("Không tìm thấy; thử tên thành phố, quốc gia hoặc mã IATA khác.")} · {selected?tx("Đang chọn: {0}",{0:airportLabel(game,value)}):tx("Chưa chọn sân bay")}</p></div>;
}
