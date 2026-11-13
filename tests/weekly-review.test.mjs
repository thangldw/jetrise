import test from 'node:test';
import assert from 'node:assert/strict';
import {gameWeekStart,weeklyPeriods,weeklyReview,goalProgress} from '../src/weekly-review.js';
import {createGame,restoreGame,transition,forecast,SAVE_KEY} from '../src/game.js';
import {decisionFixture} from './fixtures/decision-comparison.mjs';
import {longRunFixture,maintainFleet} from './fixtures/long-run.mjs';
import {memoryStorage} from './fixtures/save-manager.mjs';
import {persistGame,exportSaveFile,importSaveFile} from '../src/save-store.js';
const row=(day,extra={})=>({day,revenue:100,profit:20,nonfuel:60,fuelCost:15,co2Cost:5,cashDelta:30,pax:10,flights:2,cancelled:0,maintenanceCost:0,slotFee:0,leaseExpense:0,connections:{journeys:3},...extra});
const sample=(day,rows)=>({day,tycoon:{history:rows}});
const goal=(kind='margin')=>({version:1,kind,weekStart:1,selectedDay:1});
const choose=(game,kind,extra={})=>transition(game,{type:'weekly-goal',kind,weekStart:gameWeekStart(game.day),basis:JSON.stringify(game),...extra});

test('calendar weeks are not rolling windows; margins and execution ratios use summed actual denominators',()=>{
 const rows=Array.from({length:9},(_,i)=>row(i+1)),game=sample(10,rows);
 rows[0]=row(1,{revenue:1000,profit:100,flights:100});for(let i=1;i<7;i++)rows[i]=row(i+1,{flights:0,cancelled:1});
 const full=weeklyReview(game,1),partial=weeklyReview(game,8);
 assert(full.complete);assert.equal(full.totals.revenue,1600);assert.equal(full.totals.profit,220);assert.equal(full.margin,220/1600);assert.equal(full.execution,100/106);
 assert.equal(partial.elapsed,2);assert.equal(partial.totals.revenue,200);assert.equal(partial.profitDelta,null);assert.equal(full.completedConnections,21);
 assert.deepEqual(weeklyPeriods(game),[8,1]);assert.equal(gameWeekStart(8),8);assert.equal(gameWeekStart(7),1);
});

test('missing/duplicate days, absent optional fields, future reports and recognition changes remain explicit',()=>{
 const rows=Array.from({length:7},(_,i)=>row(i+1)),game=sample(8,rows);
 const missing=weeklyReview(sample(8,rows.filter(r=>r.day!==3)),1);assert.deepEqual(missing.missing,[3]);assert.equal(missing.totals.profit,null);
 const duplicate=weeklyReview(sample(8,[...rows,row(3)]),1);assert.deepEqual(duplicate.duplicates,[3]);assert.equal(duplicate.complete,false);
 delete rows[1].cancelled;delete rows[2].connections;assert.equal(weeklyReview(game,1).execution,null);assert.equal(weeklyReview(game,1).completedConnections,null);
 const future=weeklyReview(sample(7,rows),1);assert.equal(future.observed,6);assert.equal(future.complete,false);
 rows[6].legAccounting=true;assert(weeklyReview(game,1).basisChanged);
 assert.equal(goalProgress(sample(50,[]),goal()).status,'unknown');
});

test('goals never certify partial weeks, idle flights or missing connection data',()=>{
 const rows=Array.from({length:7},(_,i)=>row(i+1));
 assert.equal(goalProgress(sample(7,rows),goal()).status,'tracking');assert.equal(goalProgress(sample(8,rows),goal()).status,'achieved');
 assert.equal(goalProgress(sample(8,rows),goal('reliability')).status,'achieved');assert.equal(goalProgress(sample(8,rows),goal('hub')).status,'achieved');
 rows[6].profit=-1000;assert.equal(goalProgress(sample(8,rows),goal()).status,'missed');assert.equal(goalProgress(sample(8,rows),goal('hub')).status,'missed');
 const idle=rows.map(r=>({...r,revenue:0,profit:0,flights:0,cancelled:0}));assert.equal(goalProgress(sample(8,idle),goal()).status,'missed');assert.equal(goalProgress(sample(8,idle),goal('reliability')).status,'missed');
 delete rows[0].connections;assert.equal(goalProgress(sample(8,rows),goal('hub')).status,'unknown');assert.equal(goalProgress(sample(1,[]),goal()).status,'tracking');
});

test('explicit goal selection/switch/clear survives portable saves with no financial or schedule changes',()=>{
 const game=decisionFixture(),before=JSON.stringify(game),r=choose(game,'margin');assert(!r.error,r.error);
 const stripped=structuredClone(r.game);delete stripped.gameplay.weeklyGoal;assert.deepEqual(stripped,game);assert.deepEqual(forecast(r.game),forecast(game));assert.equal(JSON.stringify(game),before);
 assert.deepEqual(transition(r.game,{type:'advance'}).report,transition(game,{type:'advance'}).report);
 const store=memoryStorage([[SAVE_KEY,before]]);persistGame(store,r.game,before);const pack=exportSaveFile(store,store.getItem(SAVE_KEY)),target=memoryStorage(),imported=importSaveFile(target,pack.text,null);assert.deepEqual(imported.game.gameplay.weeklyGoal,r.game.gameplay.weeklyGoal);
 const switched=choose(r.game,'reliability');assert(!switched.error);const cleared=choose(switched.game,'none');assert(!cleared.error);assert.deepEqual(cleared.game,game);
 assert(choose(r.game,'margin').error);assert(choose(game,'not-a-goal').error);assert.match(choose(game,'hub',{basis:'stale'}).error,/Snapshot/);assert(choose(game,'hub',{weekStart:8}).error);
});

test('legacy and all-JET day closes retain old data while only optional goal metadata is validated',()=>{
 const old=createGame();assert.equal(restoreGame(JSON.stringify(old)).gameplay.weeklyGoal,undefined);
 const run=longRunFixture();run.apply({type:'weekly-goal',kind:'hub',weekStart:1,basis:JSON.stringify(run.game)});
 for(let i=0;i<14;i++){maintainFleet(run);run.apply({type:'advance'});}
 assert(weeklyReview(run.game,8).complete);assert.deepEqual(restoreGame(JSON.stringify(run.game)),run.game);
 const selected=choose(decisionFixture(),'margin').game;
 for(const mutation of [g=>g.version=2,g=>g.kind='bad',g=>g.weekStart=2,g=>g.selectedDay=2,g=>g.extra=1]){const broken=structuredClone(selected);mutation(broken.gameplay.weeklyGoal);assert.throws(()=>restoreGame(JSON.stringify(broken)),/Mục tiêu tuần/);}
});
