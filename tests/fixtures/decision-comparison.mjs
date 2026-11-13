import {createGame,restoreGame} from '../../src/game.js';
export function decisionFixture(){
 const game=createGame();game.setupComplete=true;game.tycoon.schedules=[];game.tycoon.nextId=1;game.openedRoutes=[3,2];game.fleet.forEach(p=>{p.wear=0;p.fault=null;p.serviceDueAt=168;p.airborneUntilAt=null;});
 return restoreGame(JSON.stringify(game));
}
export function decisionSpecs(game){return [
 {kind:'fares',route:3,percent:110},
 {kind:'frequency',plane:game.fleet[0].id,route:3,days:[0,2,4],at:8},
 {kind:'lease',model:'A320',route:3,days:[1,3,5],at:8,serviceStart:162},
 {kind:'route',plane:game.fleet[0].id,to:'SIN',days:[1,3,5],at:14}
 ];}
