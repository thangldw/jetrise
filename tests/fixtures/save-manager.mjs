import {legacySlotRights} from './legacy-slot-rights.mjs';
import {createGame,transition,restoreGame,SAVE_KEY,context} from '../../src/game.js';
import {persistGame} from '../../src/save-store.js';
import {quoteSlotActivation} from '../../src/slot-market.js';
import {previewDisruption} from '../../src/disruption-recovery.js';
export function memoryStorage(initial=[]){const data=new Map(initial);return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
export function savedAction(storage,action){const raw=storage.getItem(SAVE_KEY),s=restoreGame(raw),r=transition(s,action);if(r.error)throw Error(r.error);persistGame(storage,r.game,raw);return r.game;}
export function saveManagerFixture({order=[201,202,204,205,206],disrupted=false,sunday=false}={}){
 const storage=memoryStorage(),states={};let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.tycoon.nextId=1;s.openedRoutes=[3,2];s.fleet.forEach(p=>{p.wear=0;p.fault=null;p.serviceDueAt=300;});
 for(const a of [{type:'add',plane:s.fleet[2].id,route:3,start:sunday?166:22},{type:'add',plane:s.fleet[0].id,route:2,start:sunday?2:26},{type:'add',plane:s.fleet[0].id,route:2,start:sunday?16:40}]){const r=transition(s,a);if(r.error)throw Error(r.error);s=r.game;}
 s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=360;storage.setItem(SAVE_KEY,JSON.stringify(s));states.legacy=storage.getItem(SAVE_KEY);
 const run=a=>{s=savedAction(storage,a);return s;};
 for(const stage of order){if(stage>=204&&!s.strategy)run({type:'strategy-enable'});
  if(stage===201)run({type:'leg-economy-enable',migrationId:'savemanagerledger0123456'});
  if(stage===202)run({type:'overnight-enable',migrationId:'savemanagertickets012345'});
  if(stage===204){const airports=['HAN','DAD','NRT'];run({type:'slot-market-enable',airports,migrationId:'savemanagerslots01234567',quotedFee:quoteSlotActivation(context(s),airports).fee});}
  if(stage===205)run({type:'customer-enable',objective:'hub',migrationId:'savemanagercustomers0123'});
  if(stage===206)run({type:'rival-network-enable',migrationId:'savemanagerrivals0123456'});
  states[stage]=storage.getItem(SAVE_KEY);
 }
 if(disrupted){run({type:'advance'});run({type:'connection-program',enabled:false,minimum:60,maximum:1440});
  // Historical fully funded rights preserve old recovery and portable-save coverage.
  const raw=storage.getItem(SAVE_KEY);s=legacySlotRights(s,s.slotMarket.airports.flatMap(airport=>Array.from({length:26},(_,i)=>[airport,24+i,4])));persistGame(storage,s,raw);
  run({type:'disruption-apply',preview:previewDisruption(s,context(s),{leg:s.legEconomy.overnight.journeys[0].legs[0].id,kind:'weather',delay:3,mode:'rebook'})});states[203]=storage.getItem(SAVE_KEY);
 }
 return {storage,game:s,raw:storage.getItem(SAVE_KEY),states,run};
}
