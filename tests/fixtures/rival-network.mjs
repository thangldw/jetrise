import {slotFixture,enableSlots,act} from './slot-market.mjs';
export {act};
export const enableRivals=s=>act(s,{type:'rival-network-enable',migrationId:'rivalnetworkfixture012345'});
export function rivalFixture({active=true,overnight=false,customers=false,legacyLease=false}={}){
 let s=slotFixture();
 if(overnight||customers)s=act(s,{type:'overnight-enable',migrationId:'rivalnetworkovernight0123'});
 if(customers)s=act(s,{type:'customer-enable',objective:'hub',migrationId:'rivalnetworkcustomer01234'});
 if(legacyLease){s=act(s,{type:'rival-growth'});for(const r of s.strategy.rivals){r.cash-=500000;r.leases=[{remaining:9,deposit:500000}];}}
 s=enableSlots(s);return active?enableRivals(s):s;
}
