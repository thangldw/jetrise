import {useI18n,LocalizedText} from './i18n.jsx';
import React from 'react';
import {context,money} from './game.js';
import {weeklyAircraftEconomics} from './aircraft-economics.js';
const cache=new WeakMap();
export function AircraftProfitability({game,plane,compact=false}){
 const {t:tx,locale}=useI18n();
 const percent=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
 let forecast=cache.get(game);if(!forecast){forecast=weeklyAircraftEconomics(context(game),game.tycoon);cache.set(game,forecast);}
 const p=forecast[plane];if(!p)return null;
 return <section className={'aircraft-utilization aircraft-profitability '+(compact?'compact':'')} aria-label={tx("Lợi nhuận khai thác dự kiến · {0}",{0:plane})}>
  <div className="utilization-heading"><span>{tx("Biên lợi nhuận · 7 ngày tới")}</span><strong className={p.profit<0?'negative':''}>{p.margin===null?'—':tx(percent.format(p.margin)+'%')}</strong></div>
  <p className="aircraft-profit-value"><LocalizedText source={"{0} khai thác {1}"} values={{0:p.profit<0?tx("Lỗ"):tx("Lãi"),1:<b>{tx(money(Math.abs(p.profit)))}</b>}}/></p>
  <p>{tx("Doanh thu {0} · chi phí bay {1}",{0:tx(money(p.revenue)),1:tx(money(p.cost))})}</p>
  {p.margin===null&&<p>{tx("Chưa có doanh thu để tính tỷ suất.")}</p>}
  {!!p.cancelled&&<p className="negative">{tx("{0} chặng dự kiến huỷ đã loại khỏi doanh thu.",{0:tx(p.cancelled)})}</p>}
  <small>{!compact&&(tx("Lợi nhuận khai thác ÷ doanh thu. Chi phí bay gồm nhiên liệu, CO₂ và dịch vụ trên chuyến. "))}{tx("Chưa trừ lease, bảo dưỡng, thưởng/phạt hợp đồng và chi phí chung. Theo lịch và mô hình dự báo hiện tại.")}</small>
 </section>;
}
