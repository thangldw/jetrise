import {createGame,transition,context} from '../../src/game.js';
import {quoteSlotActivation} from '../../src/slot-market.js';
export const SLOT_AIRPORTS=['HAN','DAD','NRT'];
export function act(s,a){const r=transition(s,a);if(r.error)throw Error(r.error);return r.game;}
export function slotFixture({active=false,sunday=false}={}){
 let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.tycoon.nextId=1;s.openedRoutes=[3,2];
 for(const p of s.fleet){p.wear=0;p.fault=null;p.serviceDueAt=300;}
 s=act(s,{type:'add',plane:s.fleet[0].id,route:3,start:sunday?166:6});
 if(sunday)s.day=7;
 s=act(s,{type:'leg-economy-enable',migrationId:'slotfixtureledger0123456789'});
 s=act(s,{type:'strategy-enable'});
 return active?enableSlots(s):s;
}
export function enableSlots(s,airports=SLOT_AIRPORTS){return act(s,{type:'slot-market-enable',airports,migrationId:'slotfixturemarket0123456789',quotedFee:quoteSlotActivation(context(s),airports).fee});}
