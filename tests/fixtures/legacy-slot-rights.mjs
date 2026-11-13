import {restoreGame} from '../../src/game.js';
// Historical pre-cap initial save data. Never use this to buy live rights.
export function legacySlotRights(game,entries){
 const s=structuredClone(game);
 for(const [airport,hour,quantity] of entries){
  const key=airport+':'+hour,old=s.slotMarket.rights.player[key]?.quantity||0,fee=Math.max(0,quantity-old)*500;
  s.cash-=fee;s.slotMarket.spent.player.signing+=fee;
  s.slotMarket.rights.player[key]={quantity,startedDay:s.day,unlockDay:s.day+7};
 }
 return restoreGame(JSON.stringify(s));
}
