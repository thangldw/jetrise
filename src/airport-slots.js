import {sharedSlotConflict,sharedSlotDaily} from './slot-market.js';
import {datedRound} from './dated-legs.js';
// Synthetic recurring hub access rights. Both takeoffs and landings consume one movement.
export const slotDaily=s=>Object.values(s.slotRights||{}).reduce((n,r)=>n+r.capacity*300,0)+sharedSlotDaily(s);
const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
function movements(ctx,state,exceptions=false){
 const buckets=new Map(),now=(ctx.day-1)*24,week=Math.floor(now/168)*168;
 for(const x of state.schedules){const base=ctx.fleet.find(p=>p.id===x.plane);if(!base)continue;
  const offsets=exceptions?[-168,0,168]:[0];
  for(const offset of offsets){let start=(exceptions?week:0)+x.start+offset,plane=base;const day=Math.floor(start/24)+1,e=exceptions?state.exceptions?.find(e=>e.slot===x.id&&e.day===day):null;if(e?.cancel)continue;if(e?.plane)plane=ctx.fleet.find(p=>p.id===e.plane)||base;if(e?.start!==undefined)start=Math.floor(start/24)*24+e.start;
   if(exceptions&&ctx.legEconomy?.rounds.some(r=>r.day===day&&r.slot===x.id))continue;
   const route=ctx.routes[x.route],type=ctx.types[plane.type],hours=Math.ceil((1+(route.cycle-1)*800/(type.speed||800))*4)/4,air=(hours-1)/2;
   const actual=e?.timing?datedRound(ctx,state,day,x.id):null;for(const [airport,t] of (actual?actual.legs.flatMap(l=>[[l.from,l.departure],[l.to,l.arrival]]):[[route.from,start],[route.to,start+air],[route.to,start+air+.5],[route.from,start+2*air+.5]])){if(exceptions&&(t<now||t>=now+168))continue;const hour=exceptions?Math.floor(t):((Math.floor(t)%168)+168)%168,key=airport+':'+hour;buckets.set(key,{airport,hour,used:(buckets.get(key)?.used||0)+1});}
  }
 }
 if(exceptions)for(const r of ctx.legEconomy?.rounds||[])for(const l of r.legs)for(const [airport,t] of [[l.from,l.departure],[l.to,l.arrival]]){if(t<now||t>=now+168)continue;const hour=Math.floor(t),key=airport+':'+hour;buckets.set(key,{airport,hour,used:(buckets.get(key)?.used||0)+1});}
 return [...buckets.values()];
}
export function slotUsage(ctx,state,hub){return movements(ctx,state).filter(b=>b.airport===hub).sort((a,b)=>b.used-a.used||a.hour-b.hour);}
export function slotConflict(ctx,state){const shared=sharedSlotConflict(ctx,state);if(shared)return shared;if(!ctx.slotRights||!Object.keys(ctx.slotRights).length)return '';for(const b of [...movements(ctx,state),...movements(ctx,state,true)]){const right=ctx.slotRights[b.airport];if(right&&b.used>right.capacity)return `${b.airport}: ${b.used} lượt cất/hạ cánh tại giờ tuần ${b.hour%168}, vượt ${right.capacity} slot đã mua. Đổi giờ hoặc nâng gói slot trong Thiết kế mạng.`;}return '';}
export function validateSlots(s){if(s.slotRights===undefined)return;if(!s.slotRights||Array.isArray(s.slotRights)||Object.keys(s.slotRights).length>30)throw Error('Invalid slot rights');for(const [hub,r] of Object.entries(s.slotRights))if(!s.hq.hubs[hub]||!r||!int(r.capacity,1,12)||!int(r.startedDay,1,s.day)||r.unlockDay!==r.startedDay+7)throw Error('Invalid slot right');}
export function slotAction(s,a){if(a.type!=='slot-contract')return null;if(s.slotMarket?.airports.includes(a.hub))throw Error('Sân bay này dùng thị trường chung. Mua quyền theo thứ và giờ.');if(!s.hq.hubs[a.hub]||!int(a.capacity,0,12))throw Error('Chọn hub và số slot hợp lệ.');const old=s.slotRights?.[a.hub];if(old&&s.day<old.unlockDay&&a.capacity<=old.capacity)throw Error('Chỉ có thể giảm hoặc kết thúc gói sau ngày '+old.unlockDay+'.');if(!old&&!a.capacity)throw Error('Chưa có gói slot.');if(old?.capacity===a.capacity)throw Error('Gói slot chưa thay đổi.');
 const fee=Math.max(0,a.capacity-(old?.capacity||0))*10000;if(s.cash<fee)throw Error('Không đủ tiền mua quyền slot.');s.slotRights??={};if(!a.capacity){delete s.slotRights[a.hub];return 'Đã kết thúc thử thách slot tại '+a.hub+'. Không hoàn phí mua.';}s.cash-=fee;s.slotRights[a.hub]={capacity:a.capacity,startedDay:s.day,unlockDay:s.day+7};return `Đã mua ${a.capacity} lượt/giờ tại ${a.hub} · phí ${a.capacity*300}$/ngày · cam kết 7 ngày.`;}
