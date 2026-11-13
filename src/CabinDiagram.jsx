import {useI18n} from './i18n.jsx';
import React,{useId,useRef,useState} from 'react';
import {MagnifyingGlassPlus,MagnifyingGlassMinus} from '@phosphor-icons/react';
import {cabinLayout} from './cabin-layout.js';
import {CLASSES,TYPES} from './game.js';

function SeatSprite({index,x=0,y=0,width=32,height=32}){
 const size=Math.min(width,height);
 return <g transform={`translate(${x+width/2} ${y+height/2}) rotate(-90)`}><svg x={-size/2} y={-size/2} width={size} height={size} viewBox={`${index*724} 0 724 724`} aria-hidden="true"><image href={import.meta.env.BASE_URL+'assets/cabin-seats-3d.png'} width="2172" height="724"/></svg></g>;
}
function ServiceArea({y,width=360}){
 const {t:tx,locale}=useI18n();
 return <g transform={`translate(0 ${y})`} aria-hidden="true"><rect x="55" width="48" height="38" rx="5" fill="#e0f2fc" stroke="#8cb6cb"/><text x="79" y="23" textAnchor="middle" fill="#286785" fontSize="10">{tx("WC")}</text><rect x={width-103} width="48" height="38" rx="5" fill="#e0f2fc" stroke="#8cb6cb"/><text x={width-79} y="23" textAnchor="middle" fill="#286785" fontSize="10">{tx("WC")}</text><rect x="132" width="96" height="38" rx="5" fill="#f9e8c6" stroke="#ccad72"/><text x="180" y="23" textAnchor="middle" fill="#765426" fontSize="10">{tx("GALLEY")}</text><path d={`M37 15h13m-13 0 5-5m-5 5 5 5M323 15h-13m13 0-5-5m5 5-5 5`} fill="none" stroke="#be605a" strokeWidth="2"/></g>;
}
export function CabinDiagram({counts,model='A320',compact=false}) {
 const {t:tx,locale}=useI18n();
 const plan=cabinLayout(counts,model),summary=counts.map((n,i)=>tx("{class}: {count} ghế",{class:tx(CLASSES[i]),count:n})).join(', '),uid=useId().replace(/:/g,''),viewport=useRef(null),[zoom,setZoom]=useState(false),[focus,setFocus]=useState(-1);
 const focusSection=index=>{setFocus(index);const section=plan.sections.find(s=>s.index===index),svg=viewport.current?.querySelector('.seatmap-render');if(svg&&section)viewport.current.scrollTo({top:Math.max(0,section.y-12)*svg.getBoundingClientRect().width/plan.width,behavior:'instant'});};
 return <figure className={'seatmap '+(compact?'seatmap-compact':'')} aria-label={tx("Sơ đồ cabin. {0}",{0:summary})}>
  <div className="seatmap-heading"><div><span>{tx("{0} · CABIN",{0:tx(TYPES[model]?.name||(tx(model)))})}</span><b>{tx("{0} cụm ghế · {1} lối đi",{0:tx(plan.blocks),1:tx(plan.aisles)})}</b></div>{!compact&&<button type="button" className="button" aria-pressed={zoom} onClick={()=>setZoom(!zoom)}>{zoom?<MagnifyingGlassMinus size={16}/>:<MagnifyingGlassPlus size={16}/>} {zoom?tx("Thu nhỏ"):tx("Phóng to")}</button>}</div>
  <div ref={viewport} className={'seatmap-viewport '+(zoom?'seatmap-zoom':'')} tabIndex={0} role="region" aria-label={tx("Sơ đồ ghế, cuộn xuống để xem từ đầu đến cuối cabin")}>
   <svg className="seatmap-render" viewBox={`0 0 ${plan.width} ${plan.height}`} role="img" aria-label={tx(summary)}>
    <defs><linearGradient id={uid+'hull'} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#cad2dc"/><stop offset=".08" stopColor="#fff"/><stop offset=".5" stopColor="#f8fafc"/><stop offset=".92" stopColor="#fff"/><stop offset="1" stopColor="#cad2dc"/></linearGradient></defs>
    <path d={`M180 13C100 13 40 65 40 138V${plan.height-100}Q40 ${plan.height-15} 180 ${plan.height-12}Q320 ${plan.height-15} 320 ${plan.height-100}V138C320 65 260 13 180 13Z`} fill={`url(#${uid}hull)`} stroke="#a8b5c5" strokeWidth="2"/>
    <path d="M137 50Q180 25 223 50L212 69Q180 55 148 69Z" fill="#18334e" stroke="#839aaf"/>
    <text x="180" y="91" textAnchor="middle" fontSize="9" fill="#65738b">{tx("ĐẦU MÁY BAY")}</text>
    <ServiceArea y={102}/>
    {plan.sections.filter(s=>s.count).map(s=><g key={s.index} data-cabin-class={s.index}>
     <rect x="51" y={s.y} width="258" height={s.height} rx="5" fill={['#eef3fc','#f5efe6','#f9ecea'][s.index]}/>
     <text x="60" y={s.y+18} fontSize="10" fontWeight="700" fill="#243b57">{tx(['PHỔ THÔNG','THƯƠNG GIA','HẠNG NHẤT'][s.index])}</text><text x="301" y={s.y+18} textAnchor="end" fontSize="9" fill="#65738b">{tx("{0} ghế · {1}",{0:tx(s.count),1:tx(s.blocks.join('–'))})}</text>
     {s.aisles.map((a,i)=><rect key={i} x={a.x} y={s.y+26} width={a.width} height={s.height-26} fill="#fff" opacity=".85"/>)}
     {s.columns.map(c=><text key={c.column} x={c.x+(s.seats[0]?.width||0)/2} y={s.y+37} fontSize="8" textAnchor="middle" fill="#65738b">{tx(c.letter)}</text>)}
     {Array.from({length:s.rows},(_,i)=><g key={i} fill="#65738b" fontSize="9" textAnchor="middle"><text x="28" y={s.y+61+i*s.pitch}>{tx(s.firstRow+i)}</text><rect x="44" y={s.y+48+i*s.pitch} width="3" height="12" rx="1.5" fill="#9dbad5"/><rect x="313" y={s.y+48+i*s.pitch} width="3" height="12" rx="1.5" fill="#9dbad5"/></g>)}
     {s.seats.map((seat,i)=><g key={i} data-seat={i} aria-hidden="true"><title>{String(seat.row)+seat.letter+' · '+tx(CLASSES[s.index])}</title><SeatSprite index={s.index} {...seat}/></g>)}
     <path d={`M55 ${s.y+s.height+10}H305`} stroke="#c6cfdb" strokeDasharray="3 3"/>
    </g>)}
    {!counts.some(Boolean)&&<text x="180" y="200" textAnchor="middle" fill="#65738b" fontSize="12">{tx("Thêm ghế bằng thanh gạt")}</text>}
    <ServiceArea y={plan.height-92}/><text x="180" y={plan.height-29} textAnchor="middle" fontSize="9" fill="#65738b">{tx("ĐUÔI MÁY BAY")}</text>
   </svg>
  </div>
  {!compact&&<><div className="seatmap-class-nav">{counts.map((n,i)=><button type="button" key={i} aria-pressed={focus===i} onClick={()=>focusSection(i)}><i className={'class-dot class-'+i}/><span>{tx(['Phổ thông','Thương gia','Hạng nhất'][i])}<b>{tx("{0} ghế",{0:tx(n)})}</b></span></button>)}</div>{focus>=0&&!counts[focus]&&<p role="status" className="micro">{tx("Khoang {0} chưa có ghế. Kéo thanh gạt để thêm ghế.",{0:tx(CLASSES[focus])})}</p>}<figcaption>{tx("Cuộn để xem toàn cabin · 1 ghế hiển thị = 1 ghế đã chọn.")}<span>{tx("{0}Bố trí minh họa trong game; không phải sơ đồ chứng nhận.",{0:model==='A388'?tx("A380 hiển thị gộp hai tầng. "):''})}</span></figcaption></>}
 </figure>;
}
