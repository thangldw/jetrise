import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restoreGame,transition,forecast,context,ROUTES,TYPES,Engine} from '../src/game.js';
import {dailyHQ,repairCost,staffing} from '../src/hq.js';
import {usedPrice,TECHNICAL_FAULTS} from '../src/fleet.js';
import {proposeSchedule} from '../src/planner.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
const rich=()=>{const s=createGame();s.cash=100000000;return s;};

test('old saves migrate without loss; corrupt new management data is rejected',()=>{
 const s=createGame(),old=structuredClone(s);delete old.hq;delete old.orders;old.tycoon.prices=old.tycoon.prices.slice(0,5);old.fleet.forEach(p=>{for(const k of ['hub','livery','options','ageDays','lease','maintenance','fault','hoursSinceService'])delete p[k];});
 const migrated=restoreGame(JSON.stringify(old));assert.equal(migrated.cash,s.cash);assert.equal(migrated.tycoon.schedules.length,13);assert.equal(migrated.tycoon.prices.length,ROUTES.length);assert(migrated.hq.hubs.HAN);assert.deepEqual(restoreGame(JSON.stringify(migrated)),migrated);
 for(const edit of [x=>x.hq.staff.pilots=-1,x=>x.fleet[0].livery=99,x=>x.orders.push({model:'unknown',deliverDay:3}),x=>x.hq.loan={balance:0,installment:1}]){const bad=structuredClone(s);edit(bad);assert.throws(()=>restoreGame(JSON.stringify(bad)));}
});
test('hub purchase, relocation and hangar have real routing, fee and wear consequences',()=>{
 let s=act(rich(),{type:'hub-buy',hub:'SGN'});assert(!s.openedRoutes.includes(5));assert(!s.openedRoutes.includes(11));assert(dailyHQ(s,TYPES).hubFees===6000);
 const original=s.tycoon.schedules.length;s=act(s,{type:'transfer',plane:'VN-A101',hub:'SGN'});assert(s.tycoon.schedules.length<original);
 assert(transition(s,{type:'add',plane:'VN-A101',route:0,start:0}).error);
 s=act(s,{type:'unlock',route:5});s=act(s,{type:'add',plane:'VN-A101',route:5,start:0});s=act(s,{type:'hangar',hub:'SGN'});assert.equal(repairCost(s,'VN-A101'),48000);
 assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('payroll, agency, training, services, marketing and research affect actual forecasts',()=>{
 let s=rich();const base=forecast(s),fuel=base.burn;
 s=act(s,{type:'staff',team:'pilots',count:0});assert(staffing(s,TYPES).pilots.shortage>0);assert(dailyHQ(s,TYPES).agency>0);
 s=act(s,{type:'training',team:'pilots'});assert(forecast(s).burn<fuel);
 const demand=Engine.demand(context(s),s.tycoon,0,s.day)[0];s=act(s,{type:'service',level:2});s=act(s,{type:'marketing'});s=act(s,{type:'research',key:'comfort'});assert(Engine.demand(context(s),s.tycoon,0,s.day)[0]>demand);
 assert(transition(s,{type:'marketing'}).error);assert(transition(s,{type:'research',key:'comfort'}).error);
 while(s.day<=s.hq.marketingUntil)s=act(s,{type:'advance'});assert(s.day>s.hq.marketingUntil);
});
test('debt principal is cash-only, interest is expense, and daily settlement reconciles',()=>{
 let s=act(rich(),{type:'loan',amount:1000000});const f=forecast(s),before=s.cash,balance=s.hq.loan.balance;
 assert.equal(f.interest,500);assert.equal(f.principal,Math.ceil(1000000/28));assert(Math.abs(f.profit-(f.revenue-f.nonfuel-f.fuelCost-f.co2Cost))<1e-7);
 s=act(s,{type:'advance'});assert(Math.abs(s.cash-before-f.cashDelta)<1e-7);assert.equal(s.hq.loan.balance,balance-f.principal);
 const cash=s.cash;s=act(s,{type:'repay'});assert.equal(s.hq.loan,null);assert.equal(s.cash,cash-(balance-f.principal));
});
test('resource purchase uses domain prices and weighted cost, not action-supplied prices',()=>{
 let s=rich();const before=s.cash,oldFuel=s.fuel,oldAverage=s.average,price=context(s).fuelPrice;
 s=act(s,{type:'stock',resource:'fuel',amount:100,fuelPrice:0});assert.equal(s.cash,before-100*price);assert.equal(s.average,(oldFuel*oldAverage+100*price)/(oldFuel+100));
 const bad=structuredClone(s);bad.cash=0;assert.strictEqual(transition(bad,{type:'stock',resource:'co2',amount:100000}).game,bad);
});
test('maintenance cancels flights, holds aircraft and completes only after downtime',()=>{
 let s=rich();s=act(s,{type:'maintenance',plane:'VN-A101',day:1});assert(forecast(s).cancellations.some(x=>x.plane==='VN-A101'));
 assert(transition(s,{type:'add',plane:'VN-A101',route:0,start:1}).error);
 s=act(s,{type:'advance'});assert.equal(s.fleet[0].maintenance,null);assert.equal(s.fleet[0].wear,0);assert.equal(s.fleet[0].hoursSinceService,0);
 s.fleet[0].fault='Hydraulic fault';s=act(s,{type:'repair',plane:'VN-A101'});assert.equal(s.fleet[0].maintenance.untilDay,s.day+2);
 s=act(s,{type:'advance'});assert(s.fleet[0].maintenance);s=act(s,{type:'advance'});assert.equal(s.fleet[0].fault,null);assert.equal(s.fleet[0].maintenance,null);
});
test('long-haul shared routes cross days, respect range/overlap and maintenance windows',()=>{
 let s=rich();s=act(s,{type:'unlock',route:10});assert(transition(s,{type:'add',plane:'VN-A101',route:10,start:0}).error);
 s=act(s,{type:'buy-used',model:'B789',tier:0});const p=s.fleet.at(-1);s=act(s,{type:'add',plane:p.id,route:10,start:18});assert.equal(Engine.duration(context(s),p.id,10),27);
 assert(transition(s,{type:'add',plane:p.id,route:0,start:30}).error);s=act(s,{type:'add',plane:p.id,route:0,start:48});
 s=act(s,{type:'maintenance',plane:p.id,day:2});assert(forecast(s).cancellations.some(c=>c.plane===p.id));
 s=act(s,{type:'buy-used',model:'A359',tier:0});const other=s.fleet.at(-1);s=act(s,{type:'add',plane:other.id,route:10,start:0});
 const report=forecast(s),pool=Engine.demand(context(s),s.tycoon,10,s.day);for(let c=0;c<3;c++)assert(report.rows.filter(r=>r.route===10).reduce((n,r)=>n+r.passengers[c],0)<=pool[c]);
 s=act(s,{type:'route-target',route:10,values:[1200,200,50]});assert.deepEqual(s.hq.targets[10],[1200,200,50]);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('new orders wait for delivery; used values decrease with age and wear',()=>{
 let s=act(rich(),{type:'buy',model:'A320'});assert.equal(s.fleet.length,3);assert.equal(s.orders[0].deliverDay,3);
 s=act(s,{type:'advance'});assert.equal(s.fleet.length,3);s=act(s,{type:'advance'});assert.equal(s.fleet.length,4);assert.equal(s.fleet.at(-1).ageDays,0);assert.equal(s.orders.length,0);
 const t=TYPES.A320;assert(usedPrice(t,20,70)<usedPrice(t,12,45));assert(usedPrice(t,12,45)<usedPrice(t,5,20));
 s=act(s,{type:'buy-used',model:'E190',tier:2});assert.equal(s.fleet.at(-1).ageDays,20*365);assert.equal(s.fleet.at(-1).wear,70);
});
test('lease charges once per day and expiry returns deposit, aircraft and schedule',()=>{
 let s=act(rich(),{type:'lease',model:'E190'}),p=s.fleet.at(-1);assert.equal(forecast(s).leaseCost,0);assert.equal(forecast(s).leaseExpense,p.lease.rate);assert.equal(forecast(s).prepaidRent,p.lease.rate);
 s=act(s,{type:'add',plane:p.id,route:0,start:0});s=act(s,{type:'advance'});assert.equal(forecast(s).leaseCost,p.lease.rate);
 while(s.fleet.some(x=>x.id===p.id)&&s.fleet.find(x=>x.id===p.id).lease.remaining>1)s=act(s,{type:'advance'});
 const f=forecast(s);assert.equal(f.leaseRefunds,p.lease.deposit);const before=s.cash;s=act(s,{type:'advance'});assert(!s.fleet.some(x=>x.id===p.id));assert(!s.tycoon.schedules.some(x=>x.plane===p.id));assert(Math.abs(s.cash-before-f.cashDelta)<1e-6);assert.deepEqual(restoreGame(JSON.stringify(s)),s);
});
test('paint is cosmetic, upgrades affect flight revenue/cost, and sales ignore forged price',()=>{
 let s=rich();const f=forecast(s);s=act(s,{type:'paint',plane:'VN-A101',livery:2});assert.equal(forecast(s).revenue,f.revenue);
 s=act(s,{type:'option',plane:'VN-A101',key:'wifi'});assert(forecast(s).revenue>f.revenue);assert(forecast(s).operatingNonfuel>f.operatingNonfuel);assert(transition(s,{type:'option',plane:'VN-A101',key:'wifi'}).error);
 const p=s.fleet[0],price=usedPrice(TYPES[p.type],p.ageDays/365,p.wear),cash=s.cash;s=act(s,{type:'sell',plane:p.id,salePrice:1e9});assert.equal(s.cash,cash+price);assert(!s.tycoon.schedules.some(x=>x.plane===p.id));
});
test('automatic planner preserves manual slots and adds only valid positive marginal flights',()=>{
 const s=rich(),before=structuredClone(s.tycoon.schedules),p=proposeSchedule(context(s),s.tycoon);assert(p.added>0);assert(p.after>=p.before);assert.deepEqual(s.tycoon.schedules,before);
 const next=act(s,{type:'optimize'});assert.deepEqual(next.tycoon.schedules.slice(0,before.length),before);assert.deepEqual(restoreGame(JSON.stringify(next)),next);
 const slot=next.tycoon.schedules[0],bad=transition(next,{type:'edit',id:slot.id,plane:slot.plane,route:slot.route,start:25});assert(bad.error);assert.strictEqual(bad.game,next);
});

test('first lease fee is expensed once even if returned before the first day closes',()=>{
 let s=act(rich(),{type:'lease',model:'A320'}),p=s.fleet.at(-1),cash=s.cash;
 s=act(s,{type:'return-lease',plane:p.id});assert.equal(s.cash,cash+p.lease.deposit);
 const f=forecast(s);assert.equal(f.prepaidRent,p.lease.rate);const before=s.cash;
 s=act(s,{type:'advance'});assert(Math.abs(s.cash-before-f.cashDelta)<1e-7);assert.equal(s.hq.prepaidRent,0);
});

test('missing prepaid-rent field migrates on action, and nonfinite wallet never commits',()=>{
 const legacy=rich();delete legacy.hq.prepaidRent;const next=act(legacy,{type:'lease',model:'A320'});assert(Number.isFinite(forecast(next).profit));assert(Number.isFinite(forecast(next).cashDelta));
 const invalid=rich();invalid.cash=NaN;const bad=transition(invalid,{type:'advance'});assert(bad.error);assert.strictEqual(bad.game,invalid);
});

test('automatic allocation respects zero capacity targets without changing manual plans',()=>{
 const s=rich();s.hq.targets={0:[0,0,0],1:[0,0,0],2:[0,0,0]};const result=proposeSchedule(context(s),s.tycoon);assert.equal(result.added,0);assert.deepEqual(result.state.schedules,s.tycoon.schedules);
});

test('synthetic incidents persist and weekly deadlines ground overdue aircraft',()=>{
 let s=rich();s.day=26;s.fleet[0].hoursSinceService=20;
 const result=transition(s,{type:'advance'});assert(!result.error);assert(result.report.incidents.includes('VN-A101'));assert(TECHNICAL_FAULTS.some(name=>result.game.fleet[0].fault.startsWith(name)));assert.equal(result.report.incidentDetails['VN-A101'],result.game.fleet[0].fault);
 s=result.game;assert(forecast(s).cancellations.some(x=>x.plane==='VN-A101'&&x.reason===s.fleet[0].fault));assert.deepEqual(restoreGame(JSON.stringify(s)),s);
 const due=rich();due.fleet[0].serviceDueAt=0;assert(forecast(due).cancellations.some(x=>x.plane==='VN-A101'));assert(transition(due,{type:'add',plane:'VN-A101',route:0,start:0}).error);
});

test('aircraft still on a previous-day round trip cannot enter maintenance or transfer',()=>{
 let s=rich();s=act(s,{type:'unlock',route:10});s=act(s,{type:'buy-used',model:'B789',tier:0});const p=s.fleet.at(-1);s=act(s,{type:'add',plane:p.id,route:10,start:18});s=act(s,{type:'advance'});
 assert(transition(s,{type:'maintenance',plane:p.id,day:s.day}).error);assert(transition(s,{type:'transfer',plane:p.id,hub:'HAN'}).error);
 s=act(s,{type:'maintenance',plane:p.id,day:s.day+1});assert(s.fleet.find(x=>x.id===p.id).maintenance);
});

test('legacy unnamed faults remain explicitly undiagnosed and named faults survive restore',()=>{
 const s=rich();s.fleet[0].fault='Sự cố kỹ thuật · cần kiểm tra đột xuất';
 const restored=restoreGame(JSON.stringify(s));assert.equal(restored.fleet[0].fault,'Sự cố chưa xác định · cần chẩn đoán đột xuất');
 assert.deepEqual(restoreGame(JSON.stringify(restored)),restored);
 s.fleet[0].fault='Rò rỉ hệ thống thủy lực · cần sửa chữa đột xuất';
 assert.equal(restoreGame(JSON.stringify(s)).fleet[0].fault,s.fleet[0].fault);
});
