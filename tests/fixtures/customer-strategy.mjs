import {slotFixture,act} from './slot-market.mjs';
export {act};
export function customerFixture({active=true,overnight=false,sunday=false}={}){
 let s=slotFixture({sunday});
 if(overnight){s.tycoon.schedules=[];s.tycoon.nextId=1;
  s=act(s,{type:'add',plane:s.fleet[2].id,route:3,start:sunday?166:22});
  s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:sunday?2:26});
  s=act(s,{type:'add',plane:s.fleet[0].id,route:2,start:sunday?16:40});
  s.tycoon.prices[3][0]=200;s.tycoon.prices[2][0]=360;
 }
 s=act(s,{type:'overnight-enable',migrationId:'customerfixtureovernight00'});
 return active?enableCustomers(s):s;
}
export const enableCustomers=s=>act(s,{type:'customer-enable',objective:'hub',migrationId:'customerfixtureprogram000'});
