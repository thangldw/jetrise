import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,restoreGame,context,routesFor,Engine,TYPES} from '../src/game.js';
import {drawLogos,drawColors,drawStartingAircraft,whiteContrast,suggestedRoutes,STARTING_MODELS} from '../src/founding.js';
import {abbreviation} from '../src/registration.js';
import {getAirport} from '../src/network.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const setup=(origin='HAN',models=['A320','B738'])=>act(createGame(),{type:'setup',name:'Aurora Air',origin,logo:'planet',color:'#123abc',models});
const ready=()=>{let s=setup();s=act(s,{type:'founding-next'});s=act(s,{type:'unlock',route:1});return act(s,{type:'founding-finish'});};

test('logo and color rerolls return the requested distinct counts with no repeat lock',()=>{
 let prior=[];for(let n=0;n<50;n++){const next=drawLogos(()=>.25,prior);assert.equal(next.length,3);assert.equal(new Set(next.map(x=>x[0])).size,3);assert(next.every(x=>!prior.some(p=>p[0]===x[0])));prior=next;}
 for(let seed=0;seed<50;seed++){let n=seed;const random=()=>((n=(n*1664525+1013904223)>>>0)/2**32);const colors=drawColors(random);assert.equal(colors.length,6);assert.equal(new Set(colors).size,6);for(const hex of colors){assert(/^#[0-9a-f]{6}$/.test(hex));assert(whiteContrast(hex)>=4.5);}}
 assert.equal(new Set(drawColors(()=>0)).size,6);
});
test('starting aircraft draws stay inside the medium-haul pool and cannot contain a widebody or duplicate',()=>{
 const seen=new Set();for(let n=0;n<100;n++){const draw=drawStartingAircraft(()=>n/100);assert.equal(draw.length,2);assert.notEqual(draw[0],draw[1]);draw.forEach(k=>{assert(STARTING_MODELS.includes(k));seen.add(k);});}
 assert.equal(seen.size,STARTING_MODELS.length);for(const models of [['A320','B788'],['A320','A320'],['E190','B738'],[]]){const old=createGame(),r=transition(old,{type:'setup',name:'Aurora Air',origin:'HAN',logo:'wing',color:'#123abc',models});assert(r.error);assert.strictEqual(r.game,old);}
});
test('founding grants exactly $500m and two owned aircraft once, without an automatic route or schedule',()=>{
 const s=setup();assert.equal(s.cash,500000000);assert.equal(s.hq.ledger[0].amount,500000000);assert.deepEqual(s.fleet.map(p=>p.id),['AA-101','AA-102']);assert.deepEqual(s.fleet.map(p=>p.type),['A320','B738']);assert(s.fleet.every(p=>!p.lease&&p.wear===0&&p.hub==='HAN'));assert.equal(s.nextAircraftNumber,103);assert.equal(s.openedRoutes.length,0);assert.equal(s.tycoon.schedules.length,0);assert.deepEqual(restoreGame(JSON.stringify(s)),s);assert(transition(s,{type:'setup',name:'Other',origin:'HAN',logo:'wing',color:'#123abc',models:['A320','B738']}).error);assert.equal(s.cash,500000000);
 assert(transition(s,{type:'advance'}).error);assert(transition(s,{type:'founding-finish'}).error);
});
test('airline abbreviations support Vietnamese, single-word names and long multiword names',()=>{
 assert.equal(abbreviation('Aurora Air'),'AA');assert.equal(abbreviation('Hàng Không Đại Dương'),'HKDD');assert.equal(abbreviation('Vantis'),'VAN');assert.equal(abbreviation('A B C D E F'),'ABCDE');assert.equal(abbreviation('123'),'AIR');
});
test('cabin, options and decoration persist through the pre-flight preparation and route stages',()=>{
 let s=setup();s=act(s,{type:'cabin',plane:'AA-101',values:[100,20,5]});s=act(s,{type:'option',plane:'AA-101',key:'wifi'});s=act(s,{type:'paint',plane:'AA-102',livery:1});const cash=s.cash;
 s=restoreGame(JSON.stringify(s));assert.deepEqual(s.tycoon.cabins['AA-101'],[100,20,5]);assert(s.fleet[0].options.includes('wifi'));assert.equal(s.fleet[1].livery,1);s=act(s,{type:'founding-next'});assert.equal(s.founding.stage,'routes');assert(transition(s,{type:'founding-finish'}).error);s=act(s,{type:'founding-back'});assert.equal(s.cash,cash);assert.equal(s.founding.stage,'fleet');assert.equal(s.fleet.length,2);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('recommended routes are two domestic and one international, compatible with actual fleet range and cabin',()=>{
 for(const origin of ['HAN','HND','JFK','LHR','SYD']){let s=setup(origin),quote=suggestedRoutes(context(s));assert.equal(quote.domestic.length,2,origin);assert.equal(quote.international.length,1,origin);const country=getAirport(s,origin).country;for(const c of [...quote.domestic,...quote.international]){assert.equal(c.domestic,getAirport(s,c.route.to).country===country);assert(c.planes.length);for(const p of c.planes){assert(TYPES[p.model].range>=c.route.km);assert.equal(p.hours,Engine.modelDuration(c.route,TYPES[p.model]));assert(Number.isFinite(p.profit));}}const before=JSON.stringify(s);suggestedRoutes(context(s));assert.equal(JSON.stringify(s),before);}
 const singapore=suggestedRoutes(context(setup('SIN')));assert(singapore.domestic.length<2);assert.equal(singapore.international.length,1);
});
test('choosing a suggested or custom route finishes founding and the first flight settles normally',()=>{
 let s=setup();s=act(s,{type:'founding-next'});const c=suggestedRoutes(context(s)).domestic[0],ri=routesFor(s).findIndex(r=>r.from===c.route.from&&r.to===c.route.to);s=act(s,ri>=0?{type:'unlock',route:ri}:{type:'route-create',from:c.route.from,to:c.route.to});s=act(s,{type:'founding-finish'});assert.equal(s.founding.stage,'done');s=act(s,{type:'add',plane:s.fleet[0].id,route:s.openedRoutes[0],start:6});const result=transition(s,{type:'advance'});assert(!result.error);assert(result.report.flights>0);assert.deepEqual(restoreGame(JSON.stringify(result.game)),result.game);
 let custom=act(setup(),{type:'founding-next'});custom=act(custom,{type:'route-create',from:'HAN',to:'HND'});custom=act(custom,{type:'founding-finish'});assert.equal(routesFor(custom)[custom.openedRoutes[0]].to,'HND');
});
test('registrations reserve monotonically across immediate purchases, pending deliveries and removals',()=>{
 let s=ready();s=act(s,{type:'buy',model:'A320'});assert.equal(s.orders[0].id,'AA-103');s=act(s,{type:'lease',model:'A321'});assert.equal(s.fleet.at(-1).id,'AA-104');s=act(s,{type:'return-lease',plane:'AA-104'});s=act(s,{type:'buy-used',model:'B738',tier:0});assert.equal(s.fleet.at(-1).id,'AA-105');s=act(s,{type:'advance'});s=act(s,{type:'advance'});assert(s.fleet.some(p=>p.id==='AA-103'));s=act(s,{type:'sell',plane:'AA-105'});s=act(s,{type:'lease',model:'A320'});assert.equal(s.fleet.at(-1).id,'AA-106');assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('old personalized careers keep their wallet, fleet, routes and completed startup state',()=>{
 const s=createGame();s.setupComplete=true;s.airline={name:'Old Air',logo:'horizon',color:'#2563eb',origin:'HAN',personalized:true};delete s.nextAircraftNumber;const restored=restoreGame(JSON.stringify(s));assert.equal(restored.cash,8600000);assert.deepEqual(restored.fleet,s.fleet);assert.deepEqual(restored.tycoon,s.tycoon);assert.equal(restored.founding,undefined);assert.equal(restored.nextAircraftNumber,105);
});
test('corrupt founding progress, sequence and pending identities do not enter a playable save',()=>{
 const s=ready();for(const edit of [x=>x.founding.stage='unknown',x=>x.nextAircraftNumber=101,x=>x.airline.abbreviation='ZZ',x=>x.orders.push({id:'AA-101',model:'A320',deliverDay:3,hub:'HAN'}),x=>{x.founding.stage='fleet';x.day=2;}]){const bad=structuredClone(s);edit(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});
