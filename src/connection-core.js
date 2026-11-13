// Pure leg/itinerary kernel. Used by the same-day connection pilot and read-only studies.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function validateLegs(legs){
 if(!Array.isArray(legs)||legs.length>10000)throw Error('Invalid leg collection');
 const ids=new Set();for(const l of legs){if(!l||typeof l.id!=='string'||!l.id||ids.has(l.id)||typeof l.from!=='string'||typeof l.to!=='string'||!l.from||!l.to||l.from===l.to||!finite(l.departure)||!finite(l.arrival)||l.departure<0||l.arrival<=l.departure||!Array.isArray(l.capacity)||l.capacity.length!==3||!l.capacity.every(n=>int(n,0,1000)))throw Error('Invalid flight leg');ids.add(l.id);}
}
export function expandRoundTrip({id,plane,route,from,to,start,hours,capacity}){
 if(!finite(start)||start<0||!finite(hours)||hours<=1||hours>=168)throw Error('Invalid round-trip timing');
 // Existing blocks include 1h total ground time: 30min at each end, equal flight times.
 const air=(hours-1)/2;
 const legs=[{id:id+':out',roundTrip:id,plane,route,from,to,departure:start,arrival:start+air,capacity:[...capacity]},
 {id:id+':back',roundTrip:id,plane,route,from:to,to:from,departure:start+air+.5,arrival:start+2*air+.5,capacity:[...capacity]}];
 validateLegs(legs);return legs;
}
export function findConnections(legs,{minMinutes=60,maxMinutes=240,start=0,end=Infinity,limit=60}={}){
 validateLegs(legs);if(!finite(minMinutes)||!finite(maxMinutes)||minMinutes<0||maxMinutes<minMinutes||!finite(start)||start<0||!(end>start)||!int(limit,1,10000))throw Error('Invalid connection window');
 const departures=new Map();for(const l of legs){if(!departures.has(l.from))departures.set(l.from,[]);departures.get(l.from).push(l);}
 for(const list of departures.values())list.sort((a,b)=>a.departure-b.departure||a.id.localeCompare(b.id));
 const connections=[];let total=0;
 for(const a of [...legs].sort((a,b)=>a.arrival-b.arrival||a.id.localeCompare(b.id))){if(a.departure<start)continue;
  for(const b of departures.get(a.to)||[]){const wait=(b.departure-a.arrival)*60;if(wait<minMinutes-1e-7)continue;if(wait>maxMinutes+1e-7)break;if(b.departure>=end||a.from===b.to||a.roundTrip&&a.roundTrip===b.roundTrip)continue;
   total++;if(connections.length<limit)connections.push({id:a.id+'>'+b.id,from:a.from,via:a.to,to:b.to,first:a,second:b,waitMinutes:wait,totalHours:b.arrival-a.departure});
  }
 }
 return {total,connections};
}
export const journeyMarket=(legs,k)=>`${legs[0].from}|${legs.at(-1).to}|${Math.floor(legs[0].departure/24)}|${k}`;
// Requests arrive in caller-defined priority order. Each person consumes one seat on every leg.
// Revenue is recognized once per itinerary; integer-cent attribution must reconcile exactly.
export function allocateJourneys(legs,requests,markets,{minMinutes=60,maxMinutes=240}={}){
 validateLegs(legs);if(!Array.isArray(requests)||requests.length>10000||!markets||Object.values(markets).some(n=>!int(n,0,1e6))||!finite(minMinutes)||!finite(maxMinutes)||minMinutes<0||maxMinutes<minMinutes)throw Error('Invalid booking inputs');
 const byId=new Map(legs.map(l=>[l.id,l])),remaining=Object.fromEntries(legs.map(l=>[l.id,[...l.capacity]])),demand={...markets},seen=new Set(),bookings=[],legRevenue=Object.fromEntries(legs.map(l=>[l.id,0]));let passengers=0,revenueCents=0;
 for(const request of requests){
  if(!request||typeof request.id!=='string'||!request.id||seen.has(request.id)||!Array.isArray(request.legIds)||request.legIds.length<1||request.legIds.length>2||new Set(request.legIds).size!==request.legIds.length||!int(request.classIndex,0,2)||!int(request.requested,0,1e6)||!int(request.fareCents,0,1e8))throw Error('Invalid journey request');seen.add(request.id);
  const path=request.legIds.map(id=>byId.get(id));if(path.some(l=>!l)||path[0].from===path.at(-1).to)throw Error('Invalid itinerary');
  if(path.length===2){const [a,b]=path,wait=(b.departure-a.arrival)*60;if(a.to!==b.from||wait<minMinutes-1e-7||wait>maxMinutes+1e-7)throw Error('Invalid connection');}
  const k=request.classIndex,key=journeyMarket(path,k);if(!Object.hasOwn(demand,key))throw Error('Missing origin-destination demand');
  const count=Math.min(request.requested,demand[key],...path.map(l=>remaining[l.id][k]));demand[key]-=count;path.forEach(l=>remaining[l.id][k]-=count);
  const amount=count*request.fareCents,totalHours=path.reduce((n,l)=>n+l.arrival-l.departure,0),shares=path.map(l=>Math.floor(amount*(l.arrival-l.departure)/totalHours));
  shares[shares.length-1]+=amount-shares.reduce((n,x)=>n+x,0);path.forEach((l,i)=>legRevenue[l.id]+=shares[i]);
  passengers+=count;revenueCents+=amount;bookings.push({id:request.id,market:key,legIds:[...request.legIds],classIndex:k,passengers:count,revenueCents:amount});
 }
 return {bookings,remaining,demand,legRevenue,passengers,revenueCents};
}
export function slotPressure(legs,airport,capacityPerHour=4){
 validateLegs(legs);if(!int(capacityPerHour,1,100))throw Error('Invalid hourly slot capacity');
 const buckets=new Map();for(const leg of legs)for(const [key,time] of [['departure',leg.departure],['arrival',leg.arrival]])if(leg[key==='departure'?'from':'to']===airport){const hour=Math.floor(time),bucket=buckets.get(hour)||{hour,departures:0,arrivals:0};bucket[key==='departure'?'departures':'arrivals']++;buckets.set(hour,bucket);}
 return [...buckets.values()].sort((a,b)=>a.hour-b.hour).map(b=>({...b,total:b.departures+b.arrivals,capacity:capacityPerHour,excess:Math.max(0,b.departures+b.arrivals-capacityPerHour)}));
}
