import {SLOT_TERMS,SLOT_OWNERS,playerSlotPurchaseLimit,applyPlayerRights} from './slot-market.js';
import {validMigrationId} from './live-leg-economy.js';

// Optional layer on the shared slot market (JET-204). Instead of buying a new right at a fixed price, the player
// places a sealed bid that is escrowed. Bids close together every AUCTION_TERMS.cadence days, in a settlement step
// that runs before the day is simulated. Rights the player already holds are never touched.
//
// The two rivals bid with a deterministic model derived from (rival, weekday/hour key, closing day), scaled by the AI
// difficulty chosen when competition was enabled. Rival bids never change rival cash or rights, so the rival
// reconciliation is unaffected; a rival that outbids the player simply means the player does not get that right.
export const AUCTION_TERMS=Object.freeze({cadence:7,reserve:SLOT_TERMS.signing,step:50,maxPrice:5000,maxBids:12,history:24});
const LEVELS={easy:{interest:.3,spread:2},normal:{interest:.5,spread:3.5},hard:{interest:.75,spread:5}};
const OUTCOMES=['won','outbid','full','blocked'];
const int=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;};

// First closing day strictly after the placement day, so every bid has at least one day of lead time.
export const nextCloseDay=(auction,day)=>auction.enabledDay+AUCTION_TERMS.cadence*(Math.floor((day-auction.enabledDay)/AUCTION_TERMS.cadence)+1);
export const auctionDue=s=>{const a=s.slotMarket?.auction;return !!a&&a.bids.some(b=>b.closeDay<=s.day);};

export function rivalBids(ctx,key,closeDay){
 const [airport]=key.split(':'),level=LEVELS[ctx.strategy?.difficulty||'normal'];
 return (ctx.strategy?.rivals||[]).map(r=>{
  const ends=new Set([r.hub]),route=Number.isInteger(r.route)?ctx.routes[r.route]:null;
  if(route){ends.add(route.from);ends.add(route.to);}
  if(!ends.has(airport)||hash(`want:${r.id}:${key}:${closeDay}`)>=level.interest)return {id:r.id,bid:0};
  const raw=AUCTION_TERMS.reserve*(1+level.spread*hash(`bid:${r.id}:${key}:${closeDay}`));
  return {id:r.id,bid:Math.min(AUCTION_TERMS.maxPrice,Math.max(AUCTION_TERMS.reserve,Math.round(raw/AUCTION_TERMS.step)*AUCTION_TERMS.step))};
 });
}
const others=(market,key)=>SLOT_OWNERS.slice(1).reduce((n,o)=>n+(market.rights[o][key]?.quantity||0),0);
function blocked(market,key,day){const e=market.utilization?.expired[key];return !!e&&day<e.day+7;}

// Settlement step. Mutates s (rights, spend, refunds) and returns the closed results; callers that only preview run it on a clone.
export function closeAuctions(s,ctx){
 const market=s.slotMarket,a=market.auction,closed=[];
 const due=a.bids.filter(b=>b.closeDay<=s.day).sort((x,y)=>x.airport.localeCompare(y.airport)||x.hour-y.hour);
 a.bids=a.bids.filter(b=>b.closeDay>s.day);
 for(const b of due){
  const key=b.airport+':'+b.hour,rivals=rivalBids(ctx,key,b.closeDay),top=Math.max(0,...rivals.map(r=>r.bid));
  const old=market.rights.player[key],owned=old?.quantity||0,rival=others(market,key);
  let outcome='won',paid=0;
  if(b.price<top)outcome='outbid';
  else if(blocked(market,key,s.day))outcome='blocked';
  else if(owned+1+rival>SLOT_TERMS.capacity||owned+1>playerSlotPurchaseLimit(owned,rival))outcome='full';
  s.cash+=b.price;a.escrow-=b.price;
  if(outcome==='won'){paid=Math.max(AUCTION_TERMS.reserve,top);applyPlayerRights(s,key,owned+1,owned,old,paid);}
  const result={day:s.day,airport:b.airport,hour:b.hour,bid:b.price,paid,outcome,rivals};
  a.results.unshift(result);closed.push(result);
 }
 a.results=a.results.slice(0,AUCTION_TERMS.history);
 return closed;
}

export function auctionAction(s,a){
 if(a.type==='slot-auction-enable'){
  const m=s.slotMarket;
  if(!m||m.auction||!validMigrationId(a.migrationId)||a.acceptTerms!==true)throw Error('Bật thị trường slot chung và xác nhận điều khoản đấu giá trước.');
  m.auction={version:1,migrationId:a.migrationId,enabledDay:s.day,escrow:0,bids:[],results:[]};
  return 'Đã bật đấu giá slot; quyền đang sở hữu giữ nguyên, chưa thu phí. Mua quyền mới bằng giá thầu.';
 }
 if(a.type==='slot-auction-bid'){
  const m=s.slotMarket,auction=m?.auction;
  if(!auction)throw Error('Chưa bật đấu giá slot.');
  if(!m.airports.includes(a.airport)||!int(a.hour,0,167)||!int(a.price,AUCTION_TERMS.reserve,AUCTION_TERMS.maxPrice)||a.price%AUCTION_TERMS.step)throw Error(`Chọn sân bay, giờ và giá thầu từ $${AUCTION_TERMS.reserve} đến $${AUCTION_TERMS.maxPrice}, bước $${AUCTION_TERMS.step}.`);
  const key=a.airport+':'+a.hour,owned=m.rights.player[key]?.quantity||0,rival=others(m,key);
  if(auction.bids.some(b=>b.airport===a.airport&&b.hour===a.hour))throw Error('Đã có giá thầu cho giờ này. Hủy giá thầu cũ trước khi đặt lại.');
  if(auction.bids.length>=AUCTION_TERMS.maxBids)throw Error(`Tối đa ${AUCTION_TERMS.maxBids} giá thầu cùng lúc.`);
  if(blocked(m,key,s.day))throw Error('Quyền bị thu hồi vì không khai thác; chưa thể đấu lại giờ này.');
  if(owned+1+rival>SLOT_TERMS.capacity||owned+1>playerSlotPurchaseLimit(owned,rival))throw Error('Giờ này không còn chỗ hoặc đã đạt giới hạn mua mới 1 quyền mỗi thứ/giờ.');
  if(s.cash<a.price)throw Error('Không đủ tiền ký quỹ giá thầu.');
  s.cash-=a.price;auction.escrow+=a.price;
  const closeDay=nextCloseDay(auction,s.day);
  auction.bids.push({airport:a.airport,hour:a.hour,price:a.price,placedDay:s.day,closeDay});
  return `Đã đặt giá thầu $${a.price}; ký quỹ ngay, chốt ngày ${closeDay}. Thua thầu được hoàn đủ; thắng chỉ trả giá chốt.`;
 }
 if(a.type==='slot-auction-cancel'){
  const auction=s.slotMarket?.auction,i=auction?auction.bids.findIndex(b=>b.airport===a.airport&&b.hour===a.hour):-1;
  if(i<0)throw Error('Không có giá thầu này.');
  const [b]=auction.bids.splice(i,1);s.cash+=b.price;auction.escrow-=b.price;
  return `Đã hủy giá thầu; hoàn $${b.price}.`;
 }
 return null;
}

export function validateSlotAuction(s){
 const m=s.slotMarket,u=m?.auction;if(u===undefined)return;
 const fail=()=>{throw Error('Invalid slot auction');};
 if(!u||Object.keys(u).sort().join(',')!=='bids,enabledDay,escrow,migrationId,results,version'||u.version!==1||!validMigrationId(u.migrationId)||!int(u.enabledDay,m.enabledDay,s.day)||!Array.isArray(u.bids)||u.bids.length>AUCTION_TERMS.maxBids||!Array.isArray(u.results)||u.results.length>AUCTION_TERMS.history)fail();
 const seen=new Set();let escrow=0;
 for(const b of u.bids){
  if(!b||Object.keys(b).sort().join(',')!=='airport,closeDay,hour,placedDay,price'||!m.airports.includes(b.airport)||!int(b.hour,0,167)||!int(b.price,AUCTION_TERMS.reserve,AUCTION_TERMS.maxPrice)||b.price%AUCTION_TERMS.step||!int(b.placedDay,u.enabledDay,s.day)||b.closeDay!==nextCloseDay(u,b.placedDay)||seen.has(b.airport+':'+b.hour))fail();
  seen.add(b.airport+':'+b.hour);escrow+=b.price;
 }
 if(u.escrow!==escrow)fail();
 for(const r of u.results){
  if(!r||Object.keys(r).sort().join(',')!=='airport,bid,day,hour,outcome,paid,rivals'||!m.airports.includes(r.airport)||!int(r.hour,0,167)||!int(r.day,u.enabledDay,s.day)||!OUTCOMES.includes(r.outcome)||!int(r.bid,AUCTION_TERMS.reserve,AUCTION_TERMS.maxPrice)||(r.outcome==='won'?!int(r.paid,AUCTION_TERMS.reserve,r.bid):r.paid!==0)||!Array.isArray(r.rivals)||r.rivals.length!==2||r.rivals.some((x,i)=>!x||x.id!==SLOT_OWNERS[i+1]||!int(x.bid,0,AUCTION_TERMS.maxPrice)))fail();
 }
}
