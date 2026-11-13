import {legacySlotRights} from './legacy-slot-rights.mjs';
import {createGame,restoreGame,transition,SAVE_KEY,context,Engine} from '../../src/game.js';
import {persistGame} from '../../src/save-store.js';
import {quoteSlotActivation} from '../../src/slot-market.js';
import {memoryStorage} from './save-manager.mjs';
import {suggestMaintenance} from '../../src/maintenance.js';

// Synthetic, reproducible operating policy. No grants, clock edits or fault
// clearing after construction; every subsequent mutation uses the real transition.
export function longRunFixture({economy=1,stage=206,connections=true,fare=1,historicalRaw,scarcity=false,advance=false}={}){
 let storage=memoryStorage(),game;
 const apply=action=>{const raw=storage.getItem(SAVE_KEY),before=restoreGame(raw),r=transition(before,action);if(r.error)throw Error(`${action.type}, day ${before.day}: ${r.error}`);persistGame(storage,r.game,raw);game=restoreGame(storage.getItem(SAVE_KEY));return r;};
 const handle=()=>({get storage(){return storage;},useStorage(next){storage=next;game=restoreGame(storage.getItem(SAVE_KEY));},apply,get game(){return restoreGame(storage.getItem(SAVE_KEY));}});
 if(historicalRaw){storage.setItem(SAVE_KEY,historicalRaw);game=restoreGame(historicalRaw);return handle();}
 if(economy===2){storage.setItem(SAVE_KEY,JSON.stringify(createGame()));apply({type:'setup',name:'Long Run Air',origin:'HAN',logo:'wing',color:'#123abc',models:['A320','B738']});apply({type:'buy-used',model:'A223',tier:0});apply({type:'founding-next'});apply({type:'unlock',route:3});apply({type:'unlock',route:2});apply({type:'founding-finish'});}
 else {game=createGame();game.setupComplete=true;game.tycoon.schedules=[];game.tycoon.nextId=1;game.openedRoutes=[3,2];for(const p of game.fleet){p.wear=0;p.fault=null;p.serviceDueAt=168;}storage.setItem(SAVE_KEY,JSON.stringify(game));}
 const routes=context(game).routes,feeder=game.openedRoutes.find(i=>routes[i].to==='DAD'),onward=game.openedRoutes.find(i=>routes[i].to==='NRT');
 const [main,alternate,inbound]=game.fleet;
 // Non-overlapping checks at a single-capacity hangar; Sunday returns land first.
 for(const [p,start] of [[alternate,4],[inbound,9],[main,14]])apply({type:'service-plan',plane:p.id,start});
 for(let day=0;day<7;day++)for(const [p,route,hour] of [[main,onward,2],[alternate,onward,16],[inbound,feeder,22]])apply({type:'add',plane:p.id,route,start:day*24+hour});
 for(const [route,y] of [[feeder,200],[onward,360]])apply({type:'prices',route,values:[Math.round(y*fare),Math.round(y*2.5*fare),Math.round(y*5*fare)]});
 if(stage>=201)apply({type:'leg-economy-enable',migrationId:'longrun208ledger012345678'});
 if(stage>=202){apply({type:'overnight-enable',migrationId:'longrun208overnight012345'});if(!connections)apply({type:'connection-program',enabled:false,minimum:60,maximum:1440});}
 if(stage>=204){apply({type:'strategy-enable'});const airports=['HAN','DAD','NRT'];apply({type:'slot-market-enable',airports,migrationId:'longrun208slots0123456789',quotedFee:quoteSlotActivation(context(game),airports).fee});}
 if(stage>=205)apply({type:'customer-enable',objective:'hub',migrationId:'longrun208customers012345'});
 if(stage>=206)apply({type:'rival-network-enable',migrationId:'longrun208rivals012345678'});
 if(advance)apply({type:'advance-sales-enable',migrationId:'longrun209advance01234567'});
 if(scarcity){game=legacySlotRights(game,Array.from({length:168},(_,hour)=>['HAN',hour,4]));storage.setItem(SAVE_KEY,JSON.stringify(game));}
 return Object.assign(handle(),{feeder,onward});
}

export function maintainFleet(run){
 const actions=[];
 for(const plane of run.game.fleet){
  if(!(plane.fault||plane.wear>=90)||plane.maintenance)continue;
  const g=run.game;if((plane.airborneUntilAt||0)>(g.day-1)*24)continue;
  const action={type:'repair',plane:plane.id},r=transition(g,action);
  // A held onward ticket may legitimately prevent repair. Refund only tickets
  // on this aircraft with unstarted legs, then retry the same explicit action.
  if(r.error?.includes('giữ ghế'))for(const j of [...(g.legEconomy?.overnight?.journeys||[])]){
   if(j.legs.some(l=>l.plane===plane.id&&l.status==='reserved'&&l.departure>=(g.day-1)*24)){
    const refund={type:'journey-refund',id:j.id};if(!transition(run.game,refund).error){const before=run.game.cash;run.apply(refund);actions.push({type:'journey-refund',cash:run.game.cash-before});}
   }
  }
  if(!transition(run.game,action).error){const before=run.game.cash;run.apply(action);actions.push({type:'repair',plane:plane.id,cash:run.game.cash-before});}
 }
 for(const plane of run.game.fleet){
  if(plane.servicePlan||plane.fault||plane.wear>=90||plane.maintenance)continue;
  const g=run.game,c=context(g),suggestion=suggestMaintenance(g,plane,x=>Engine.duration(c,plane.id,x.route));
  if(suggestion){const action={type:'service-plan',plane:plane.id,start:suggestion.start};if(!transition(g,action).error){run.apply(action);actions.push(action);}}
 }
 return actions;
}
