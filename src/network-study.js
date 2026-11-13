import {expandRoundTrip,findConnections,slotPressure} from './connection-core.js';
import {fleetFamilies} from './fleet-policy.js';
export function studyNetwork(ctx,state,days,{hub=ctx.airline.origin,minMinutes=60,maxMinutes=240,capacityPerHour=4}={}){
 const start=(ctx.day-1)*24,end=start+168;
 const legs=days.flatMap(({report})=>report.departureManifests?report.departureManifests.flatMap(r=>r.legs.map(l=>({...l,roundTrip:r.id,plane:r.plane,route:r.route,capacity:r.capacity}))):(report.operatedRounds||report.rows).flatMap(row=>{const route=ctx.routes[row.route];return expandRoundTrip({id:report.day+':'+row.slot,plane:row.plane,route:row.route,from:route.from,to:route.to,start:(report.day-1)*24+row.start,hours:row.hours,capacity:state.cabins[row.plane]});}));
 for(const r of ctx.legEconomy?.rounds||[])for(const l of r.legs)if(l.arrival>=start)legs.push({...l,roundTrip:r.id,plane:r.plane,route:r.route,capacity:r.capacity});
 const selected=legs.filter(l=>l.from===hub||l.to===hub),links=findConnections(selected,{minMinutes,maxMinutes,start,end,limit:60}),slots=slotPressure(selected.filter(l=>l.departure<end),hub,capacityPerHour).filter(b=>b.hour>=start&&b.hour<end);
 const rows=days.flatMap(d=>d.report.operatedRounds||d.report.rows),hours=rows.reduce((n,r)=>n+r.hours,0),seats=rows.reduce((n,r)=>n+state.cabins[r.plane].reduce((a,b)=>a+b,0)*2,0),directPax=rows.reduce((n,r)=>n+r.pax,0);
 const cohorts=new Map((ctx.legEconomy?.overnight?.journeys||[]).map(j=>[j.id,{pax:j.pax,legs:j.legs}]));
 for(const {report} of days)if(report.connections?.mode==='overnight')for(const j of report.connections.bookings)cohorts.set(j.legs[0].id+'>'+j.legs[1].id,j);
 const roundIds=new Set(days.flatMap(({report})=>(report.operatedRounds||report.rows).map(r=>`${report.day}:${r.slot}`)));
 const connectingPax=[...cohorts.values()].reduce((n,j)=>n+j.legs.filter(l=>l.status!=='refunded'&&roundIds.has(`${l.day}:${l.slot}`)).length*j.pax,0),pax=directPax+connectingPax;
 const families=fleetFamilies(ctx.fleet),largest=family=>family.planes.length;
 return {legs,links,slots,overloadedHours:slots.filter(s=>s.excess>0).length,metrics:{hours,pax,load:seats?pax/seats:null,utilization:ctx.fleet.length?hours/(ctx.fleet.length*168):0,familyShare:ctx.fleet.length?Math.max(0,...families.map(largest))/ctx.fleet.length:0,premiumSeats:ctx.fleet.reduce((n,p)=>n+state.cabins[p.id][1]+state.cabins[p.id][2],0)}};
}
