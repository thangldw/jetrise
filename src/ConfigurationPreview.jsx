import {useI18n} from './i18n.jsx';
import React from 'react';
import {AirlineMark} from './AirlineMark.jsx';
import {AircraftPaintPreview} from './AircraftPaintPreview.jsx';
import {liveryStyle} from './liveries.js';
import {OPTIONS} from './fleet.js';
import {WifiHigh,Monitor,Usb,Armchair,Headphones,Lightbulb,SpeakerSlash,Wind,Suitcase,Coffee,ForkKnife,Moon} from '@phosphor-icons/react';

export function BrandPreview({name,logo,color,registration,variant=0}){
 const {t:tx,locale}=useI18n();
 const theme=liveryStyle(variant,color);
 return <figure className={'brand-preview paint-pattern-'+variant} style={{'--preview-brand':theme.color}} aria-label={tx("Xem trước nhận diện và phối màu")}><figcaption>{tx("XEM TRƯỚC · {0}",{0:variant?tx("PHỐI MÀU ĐẶC BIỆT"):tx("NHẬN DIỆN HÃNG")})}</figcaption><div className="brand-preview-lockup"><AirlineMark logo={logo} size={46}/><strong>{name.trim()||(tx("HÃNG BAY CỦA BẠN"))}</strong></div><AircraftPaintPreview name={name} logo={logo} color={theme.color} registration={registration} variant={variant}/><div className="brand-preview-stripe"/><div className="brand-preview-bottom"><span>{registration}</span><span>{tx(theme.color.toUpperCase())}</span></div></figure>;
}
export const AMENITY_ICONS={wifi:WifiHigh,screen:Monitor,power:Usb,seat:Armchair,audio:Headphones,light:Lightbulb,quiet:SpeakerSlash,air:Wind,bag:Suitcase,coffee:Coffee,meal:ForkKnife,bed:Moon};
export function AmenityPreview({installed,selected,money}){
 const {t:tx,locale}=useI18n();
 const active=[...new Set([...installed,selected])],o=OPTIONS[selected],owned=installed.includes(selected),Icon=AMENITY_ICONS[o.icon];
 const amount=n=>new Intl.NumberFormat(locale,{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 return <section className="amenity-preview expanded-amenity-preview" aria-label={tx("Xem trước tiện nghi")}><div className={'amenity-scene amenity-interior '+(active.includes('lighting')?'mood-lit':'')} aria-label={tx("Minh họa {0}",{0:tx(o.name)})}><div className="amenity-windows"><i/><i/><i/></div><div className={'amenity-screen '+(active.includes('screen')||active.includes('streaming')?'equipped':'')}><Monitor size={44}/></div><Armchair className={'amenity-chair '+(active.includes('seats')?'equipped':'')} size={104} weight={active.includes('seats')?'fill':'regular'}/><div className="amenity-highlight"><Icon size={32}/><span>{tx(o.name)}</span></div></div><div className="amenity-summary"><small>{tx("XEM TRƯỚC · {0}",{0:owned?tx("ĐÃ TRANG BỊ"):tx("CHƯA LẮP")})}</small><h3>{tx(o.name)}</h3><p>{tx(o.detail)}</p><dl className="amenity-economics"><div><dt>{tx("Đầu tư một lần")}</dt><dd>{tx(money(o.price))}</dd></div><div><dt>{tx("Doanh thu / khách")}</dt><dd>+{tx(amount(o.revenue))}</dd></div><div><dt>{tx("Chi phí / khách")}</dt><dd>{tx(amount(o.cost))}</dd></div><div><dt>{tx("Chênh lệch / khách")}</dt><dd>+{tx(amount(o.revenue-o.cost))}</dd></div></dl><small>{tx("Minh họa tiện nghi. Mức thu/chi áp dụng cho hành khách thực bay của toàn cabin; giữ nguyên số ghế.")}</small></div></section>;
}
