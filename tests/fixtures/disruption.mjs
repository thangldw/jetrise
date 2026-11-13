import {createGame,transition,restoreGame} from '../../src/game.js';
export function act(s,a){const r=transition(s,a);if(r.error)throw Error(r.error);return r.game;}
export function disruptionFixture({sunday=false,alternative=true,competing=false,onwardModel=null}={}){
 let s=createGame();s.setupComplete=true;s.tycoon.schedules=[];s.openedRoutes=[2,3];
 if(onwardModel)s.fleet[0].type=onwardModel;
 s.fleet.forEach(p=>{p.wear=0;p.fault=null;p.serviceDueAt=300;});
 s=act(s,{type:'add',plane:s.fleet[2].id,route:3,start:sunday?166:22});
 s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:sunday?2:26});
 if(alternative)s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:sunday?16:40});
 if(competing)s=act(s,{type:'add',plane:s.fleet[0].id,route:3,start:sunday?12:36});
 s=act(s,{type:'fleet-reserve',plane:s.fleet[1].id,enabled:true});
 s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=360;
 if(sunday)s.day=7;
 s=act(s,{type:'leg-economy-enable',migrationId:'0123456789abcdef0123456789abcdef'});
 s=act(s,{type:'overnight-enable',migrationId:'abcdef0123456789abcdef0123456789'});
 s=act(s,{type:'advance'});s=restoreGame(JSON.stringify(s));
 s=act(s,{type:'connection-program',enabled:false,minimum:60,maximum:1440});
 return s;
}
