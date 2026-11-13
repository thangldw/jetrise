import {useI18n,LocalizedText} from './i18n.jsx';
import React from 'react';
import {context,Engine} from './game.js';

export function AircraftUtilization({game,plane,compact=false,inline=false}){
 const {t:tx,locale}=useI18n();
 const format=n=>new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(n),percent=n=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n);
 const ctx=context(game),fleet=plane?game.fleet.filter(p=>p.id===plane):game.fleet,hours=fleet.reduce((n,p)=>n+Engine.utilization(ctx,game.tycoon,p.id)*168/100,0),total=fleet.length*168,rate=total?hours/total*100:0,label=plane?'Sử dụng giờ bay · '+plane:'Sử dụng giờ bay toàn đội';
 return <section className={'aircraft-utilization '+(compact?'compact ':'')+(inline?'inline':'')} aria-label={tx(label)}>
  <div className="utilization-heading"><span>{inline?tx("Giờ bay"):plane?tx("Giờ bay / tuần"):tx("Toàn đội bay / tuần")}</span><strong>{tx(percent(rate))}<small>%</small></strong></div>
  <div className="utilization-meter" role="meter" aria-label={tx(label)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(rate.toFixed(2))} aria-valuetext={tx(`${percent(rate)}%, ${format(hours)} trên ${format(total)} giờ mỗi tuần`)}><span style={{width:Math.min(100,Math.max(0,rate))+'%'}}/></div>
  <p><LocalizedText source={"{0} / {1} giờ đã xếp"} values={{0:<b>{tx(format(hours))}</b>,1:tx(format(total))}}/></p>
  {!compact&&!inline&&<small>{tx("{0} Tính lịch khứ hồi, gồm quay đầu; không cộng giờ bảo dưỡng. Đây là lịch dự kiến.",{0:plane?tx("Chưa xếp chuyến: {0} giờ.",{0:format(Math.max(0,total-hours))}):tx("{0} máy bay × 168 giờ/tuần.",{0:fleet.length})})}</small>}
 </section>;
}
