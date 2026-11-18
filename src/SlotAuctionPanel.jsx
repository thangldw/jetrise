import {useI18n} from './i18n.jsx';
import React,{useState} from 'react';
import {money,SHORT_DAYS} from './game.js';
import {RIVAL_NAMES} from './strategy.js';
import {AUCTION_TERMS,nextCloseDay} from './slot-auction.js';

const clock=n=>String(n%24).padStart(2,'0')+':00';
const OUTCOME={won:'Thắng thầu',outbid:'Bị AI thầu cao hơn',full:'Hết chỗ khi chốt',blocked:'Đang chờ mua lại'};
// Opt-in sealed-bid auction for new slot rights on the shared market (rights already held are untouched).
export function SlotAuctionPanel({game,Button,act,busy,airport,hour,open}){
 const {t:tx,airportLabel}=useI18n();
 const market=game.slotMarket,auction=market.auction,[confirm,setConfirm]=useState(false),[price,setPrice]=useState(AUCTION_TERMS.reserve*2),[error,setError]=useState('');
 const place=async()=>{const r=await act({type:'slot-auction-bid',airport,hour,price});setError(r?.error||'');};
 return <section aria-label={tx("Đấu giá slot")}><h4>{tx("Đấu giá quyền slot mới · tùy chọn")}</h4>
 {!auction?<>
  <p>{tx("Thay giá cố định bằng đấu giá kín với SWIFT và AURELIA. Tiền thầu được ký quỹ ngay; mỗi {0} ngày, trước khi chạy ngày, các giá thầu được chốt. Thắng chỉ trả giá chốt (cao hơn giá sàn {1} và giá thầu cao nhất của AI), thua được hoàn đủ. Quyền đang sở hữu giữ nguyên.",{0:tx(AUCTION_TERMS.cadence),1:tx(money(AUCTION_TERMS.reserve))})}</p>
  <label className="field"><span><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>{tx(" Tôi chọn đấu giá slot và tạo backup trước khi bật.")}</span></label>
  <Button primary disabled={busy||!confirm} onClick={()=>act({type:'slot-auction-enable',acceptTerms:true,migrationId:crypto.randomUUID().replaceAll('-','')})}>{tx("Tạo backup & bật đấu giá slot")}</Button>
 </>:<>
  <p>{tx("Đã bật từ ngày {0}. Đang ký quỹ {1} cho {2} giá thầu. Mua quyền mới chỉ qua đấu giá; trả quyền vẫn trực tiếp.",{0:tx(auction.enabledDay),1:tx(money(auction.escrow)),2:tx(auction.bids.length)})}</p>
  <p>{tx("Giờ đang chọn: {0} {1}. Phiên chốt gần nhất: ngày {2}.",{0:airportLabel(game,airport),1:tx(SHORT_DAYS[Math.floor(hour/24)])+' '+clock(hour),2:tx(nextCloseDay(auction,game.day))})}</p>
  <label className="field"><span>{tx("Giá thầu mỗi quyền")}</span><input type="number" min={AUCTION_TERMS.reserve} max={AUCTION_TERMS.maxPrice} step={AUCTION_TERMS.step} value={price} onChange={e=>setPrice(Number(e.target.value))}/></label>
  <Button primary disabled={busy} onClick={place}>{tx("Đặt thầu · ký quỹ {0}",{0:money(price)})}</Button>
  {error&&<p className="form-error" role="alert">{tx(error)}</p>}
  {auction.bids.length>0&&<div className="schedule-table-wrap" role="region" tabIndex={0} aria-label={tx("Giá thầu đang chờ")}><table className="schedule-table"><thead><tr><th>{tx("Giờ")}</th><th>{tx("Giá thầu")}</th><th>{tx("Chốt ngày")}</th><th/></tr></thead><tbody>{auction.bids.map(b=><tr key={b.airport+b.hour}><td>{b.airport} {tx(SHORT_DAYS[Math.floor(b.hour/24)])} {clock(b.hour)}</td><td>{tx(money(b.price))}</td><td>{tx(b.closeDay)}</td><td><Button disabled={busy} onClick={()=>act({type:'slot-auction-cancel',airport:b.airport,hour:b.hour})}>{tx("Hủy · hoàn tiền")}</Button></td></tr>)}</tbody></table></div>}
  {auction.results.length>0&&<details><summary>{tx("Kết quả gần đây · {0}",{0:tx(auction.results.length)})}</summary>{auction.results.slice(0,8).map((r,i)=><p key={i}>{tx("Ngày {0} · {1} {2} {3} · thầu {4} · {5}{6}",{0:tx(r.day),1:r.airport,2:tx(SHORT_DAYS[Math.floor(r.hour/24)]),3:clock(r.hour),4:tx(money(r.bid)),5:tx(OUTCOME[r.outcome]),6:r.outcome==='won'?tx(" · trả {0}",{0:money(r.paid)}):' · '+r.rivals.filter(x=>x.bid).map(x=>tx(RIVAL_NAMES[x.id])+' '+money(x.bid)).join(', ')})}</p>)}</details>}
  <Button onClick={()=>open('saves')}>{tx("Mở Save Manager · backup trước đấu giá")}</Button>
 </>}
 </section>;
}
