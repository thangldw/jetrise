import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,routesFor,context,forecast,Engine,TYPES,routeInfo} from '../src/game.js';
import {AIRPORTS,airportLabel,routeLabel,routeQuote,distance} from '../src/network.js';
import {dailyHQ} from '../src/hq.js';
import {scheduleGaps,findOpportunities,fareWeek} from '../src/opportunities.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const setup=origin=>act(createGame(),{type:'setup',name:'AURORA AIR',logo:'compass',color:'#2563eb',origin,models:['A320','B738']});

test('airport snapshot has unique IATA identities, valid coordinates and clear labels',()=>{
 assert.equal(Object.keys(AIRPORTS).length,4008);
 for(const a of Object.values(AIRPORTS)){assert(/^[A-Z]{3}$/.test(a.iata));assert(a.lat>=-90&&a.lat<=90);assert(a.lon>=-180&&a.lon<=180);}
 assert.equal(airportLabel(null,'HAN'),'Hà Nội · Nội Bài (HAN)');assert.equal(airportLabel(null,'NRT'),'Narita · Tokyo Narita (NRT)');
 assert.equal(distance(AIRPORTS.HAN,AIRPORTS.HND),distance(AIRPORTS.HND,AIRPORTS.HAN));assert.equal(distance(AIRPORTS.HAN,AIRPORTS.HAN),0);
 assert(distance(AIRPORTS.HAN,AIRPORTS.HND)>3500&&distance(AIRPORTS.HAN,AIRPORTS.HND)<4000);
 assert(distance({lat:0,lon:179},{lat:0,lon:-179})<230);
});
test('new route preview is immutable; creation appends without reindexing and ignores forged economics',()=>{
 let s=createGame();const original=structuredClone(s),q=routeQuote(s,'HAN','HND');assert.deepEqual(s,original);
 s=act(s,{type:'route-create',from:'HAN',to:'HND',price:0,km:1,demand:999999});assert.equal(s.cash,original.cash-q.price);assert.equal(routesFor(s).length,14);assert.deepEqual(routesFor(s).slice(0,13),routesFor(original));assert.equal(routesFor(s)[13].km,q.km);assert(s.openedRoutes.includes(13));assert.equal(s.tycoon.prices.length,14);
 assert.match(routeLabel(s,routesFor(s)[13]),/Nội Bài \(HAN\).*Tokyo Haneda \(HND\)/);
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 for(const a of [{from:'HAN',to:'HND'},{from:'HAN',to:'HAN'},{from:'LHR',to:'HND'},{from:'HAN',to:'ZZQ'},{from:'HAN',to:'EZE'}]){const r=transition(s,{type:'route-create',...a});assert(r.error,JSON.stringify(a));assert.strictEqual(r.game,s);}
 const poor=structuredClone(original);poor.cash=0;assert.strictEqual(transition(poor,{type:'route-create',from:'HAN',to:'HND'}).game,poor);
});
test('custom airport validates identity and coordinates, then works as a destination',()=>{
 let s=createGame();s=act(s,{type:'airport-add',iata:' zzq ',name:'Sân bay thử nghiệm',country:'VN',lat:15.25,lon:108.75});assert.equal(airportLabel(s,'ZZQ'),'Sân bay thử nghiệm (ZZQ)');
 s=act(s,{type:'route-create',from:'HAN',to:'ZZQ'});assert.equal(routesFor(s)[13].to,'ZZQ');assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 for(const a of [{iata:'HAN'},{iata:'ABC1'},{iata:'ZZQ'},{iata:'QQZ',lat:NaN},{iata:'QQZ',lon:181},{iata:'QQZ',country:'invalid'}]){const r=transition(s,{type:'airport-add',name:'Airport',country:'VN',lat:0,lon:0,...a});assert(r.error);assert.strictEqual(r.game,s);}
});
test('custom routes use shared capacity, quotes, Finder, scheduling, settlement and reload',()=>{
 let s=act(createGame(),{type:'route-create',from:'HAN',to:'HND'}),ri=13;
 s.tycoon.schedules=[];s=act(s,{type:'add',plane:'VN-A101',route:ri,start:0});s=act(s,{type:'add',plane:'VN-A102',route:ri,start:0});
 const f=forecast(s),pool=Engine.demand(context(s),s.tycoon,ri,s.day);for(let c=0;c<3;c++)assert(f.rows.filter(r=>r.route===ri).reduce((n,r)=>n+r.passengers[c],0)<=pool[c]);assert(routeInfo(s,ri,s.fleet[0].id).estimate.profit!==0);
 const days=fareWeek(context(s),s.tycoon,ri,s.tycoon.prices[ri]);assert.equal(days.length,7);assert(days.some(d=>d.after.pax>0));
 assert(findOpportunities(context(s),s.tycoon,'VN-A101',scheduleGaps(context(s),s.tycoon,'VN-A101')[0]).some(o=>o.route===ri));
 s=act(s,{type:'advance'});assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('custom long-haul flights cross midnight and reject aircraft outside range',()=>{
 let s=act(createGame(),{type:'route-create',from:'HAN',to:'JFK'});assert(transition(s,{type:'add',plane:'VN-A101',route:13,start:0}).error);assert.equal(routeInfo(s,13,'VN-A101').estimate.profit,0);
 s.cash=100000000;s=act(s,{type:'buy-used',model:'B789',tier:0});const p=s.fleet.at(-1);s=act(s,{type:'add',plane:p.id,route:13,start:18});assert(Engine.duration(context(s),p.id,13)>24);assert(transition(s,{type:'add',plane:p.id,route:0,start:30}).error);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('first-time setup supports international hubs and the funded aircraft-preparation stage',()=>{
 for(const origin of ['HAN','HND','LHR','JFK','SYD','PPT']){
  const s=setup(origin);assert.equal(s.airline.name,'AURORA AIR');assert.equal(s.airline.origin,origin);assert.equal(s.airline.color,'#2563eb');assert.equal(s.airline.logo,'compass');assert.equal(s.setupComplete,true);assert.equal(s.hq.hubs[origin].hangar,1);assert(s.fleet.every(p=>p.hub===origin));assert.equal(s.cash,500000000);assert.equal(s.fleet.length,2);assert.equal(s.openedRoutes.length,0);assert.equal(s.founding.stage,'fleet');assert.equal(s.tycoon.schedules.length,0);assert(Number.isFinite(forecast(s).profit));assert(dailyHQ(s,TYPES).hubFees>=500);assert.deepEqual(restoreGame(JSON.stringify(s)),s);assert(transition(s,{type:'setup',name:'Reset',origin:'HAN',logo:'wing',color:'#ff5955'}).error);
 }
});
test('aircraft purchase, lease, new delivery and relocation honor an international starting hub',()=>{
 let s=setup('HND');s=act(s,{type:'founding-next'});s=act(s,{type:'route-create',from:'HND',to:'HAN'});s=act(s,{type:'founding-finish'});s.cash=100000000;s=act(s,{type:'lease',model:'E190'});assert.equal(s.fleet.at(-1).hub,'HND');s=act(s,{type:'buy',model:'A320'});assert.equal(s.orders[0].hub,'HND');s=act(s,{type:'advance'});s=act(s,{type:'advance'});assert.equal(s.fleet.at(-1).hub,'HND');
 const cash=s.cash;s=act(s,{type:'hub-buy',hub:'HAN'});assert.equal(s.cash,cash-24000000);s=act(s,{type:'transfer',plane:s.fleet.at(-1).id,hub:'HAN'});assert.equal(s.fleet.at(-1).hub,'HAN');assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('legacy saves bypass onboarding without losing schedules, cash or purchases',()=>{
 const s=createGame(),old=structuredClone(s);delete old.network;delete old.airline;delete old.setupComplete;delete old.nextAircraftNumber;const migrated=restoreGame(JSON.stringify(old));assert.equal(migrated.setupComplete,true);assert.equal(migrated.cash,s.cash);assert.deepEqual(migrated.tycoon,s.tycoon);assert.equal(migrated.airline.name,'VANTIS AIR');assert.deepEqual(migrated.network,{airports:[],routes:[]});assert.deepEqual(restoreGame(JSON.stringify(migrated)),migrated);
});
test('invalid identities, custom route references and duplicate persisted airports are rejected',()=>{
 const s=createGame();for(const a of [{name:''},{logo:'unknown'},{origin:'ZZQ'},{color:'red'}]){const r=transition(s,{type:'setup',name:'AIR TEST',origin:'HAN',logo:'wing',color:'#ff5955',...a});assert(r.error);assert.strictEqual(r.game,s);}
 const q=act(s,{type:'route-create',from:'HAN',to:'HND'});
 for(const edit of [x=>x.network.routes.push({from:'HAN',to:'HND'}),x=>x.network.routes[0].to='ZZQ',x=>x.tycoon.prices.pop(),x=>x.airline.color='red',x=>x.airline.personalized='false']){const corrupt=structuredClone(q);edit(corrupt);assert.throws(()=>restoreGame(JSON.stringify(corrupt)));}
});

test('airport city labels support custom cities and legacy fallback without duplicate names',()=>{
 assert.equal(airportLabel(null,'SGN'),'TP. Hồ Chí Minh · Tân Sơn Nhất (SGN)');
 assert.equal(airportLabel(null,'BKK'),'Bangkok · Suvarnabhumi (BKK)');
 assert.equal(airportLabel(null,'DAD'),'Đà Nẵng (DAD)');
 assert.equal(airportLabel(null,'ZZZ'),'ZZZ');
 let s=act(createGame(),{type:'airport-add',iata:'ZZQ',name:'Sân bay thử nghiệm',city:'Thành phố thử nghiệm',country:'VN',lat:12,lon:108});
 assert.equal(airportLabel(s,'ZZQ'),'Thành phố thử nghiệm · Sân bay thử nghiệm (ZZQ)');
 assert.equal(airportLabel(restoreGame(JSON.stringify(s)),'ZZQ'),airportLabel(s,'ZZQ'));
 assert(transition(s,{type:'airport-add',iata:'ZZR',name:'Test',city:42,country:'VN',lat:12,lon:109}).error);
});
