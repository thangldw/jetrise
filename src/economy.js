// Synthetic progression prices, not aircraft quotations or real traffic forecasts.
export const capitalFactor=s=>s.economyVersion===2?12:1;
export const pricedTypes=(s,types)=>Object.fromEntries(Object.entries(types).map(([key,t])=>[key,{...t,price:Math.round(t.price*capitalFactor(s))}]));
export const leaseDailyRate=(s,price)=>Math.round(price*(s.economyVersion===2?.00025:.0015));
const business=new Set(['SIN','HKG','LHR','JFK','NRT','HND','FRA','DXB','SGN']);
const leisure=new Set(['DAD','DPS','HKT','CXR','PQC','MNL','BKK','SYD']);
export function marketProfile(a,b,km){
 const key=[a.iata,b.iata].sort().join('|'),hash=[...key].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0),domestic=a.country===b.country,biz=(business.has(a.iata)?1:0)+(business.has(b.iata)?1:0),tour=(leisure.has(a.iata)?1:0)+(leisure.has(b.iata)?1:0),size=(a.major?1:0)+(b.major?1:0);
 const y=Math.round((350+size*280+(domestic?220:0)+tour*100)*(.85+(hash%31)/100)*Math.max(.6,1-km/40000)),j=Math.round(y*(.055+biz*.055+(km>5000?.025:0))),f=Math.round(y*(.004+biz*.009+(km>7000?.009:0)));
 return {demand:y,classDemand:[y,j,f],segment:biz>tour?'business':tour>biz?'leisure':'mixed',weekPattern:biz>tour?[1.12,1.08,1.06,1.08,1.12,.82,.85]:tour>biz?[.88,.86,.9,.98,1.14,1.2,1.16]:[1,.98,1.02,1.01,1.08,1.1,1.04]};
}
