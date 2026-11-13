import test from 'node:test';
import assert from 'node:assert/strict';
import {operationAlerts} from '../src/operation-alerts.js';
import {createGame,restoreGame,transition,context,SAVE_KEY} from '../src/game.js';
import {disruptionFixture,act} from './fixtures/disruption.mjs';
import {previewDisruption} from '../src/disruption-recovery.js';
import {studyBase,CELLS} from '../scripts/slot-balance-matched.mjs';
import {enableConditional,enableUtilization,addStudyFlight,cancelStudyOccurrence} from '../scripts/experiments/slot-utilization-actions.mjs';
import {longRunFixture,maintainFleet} from './fixtures/long-run.mjs';

test('legacy maintenance grace, timely checks and active repairs are read-only and use the selected aircraft',()=>{
 const legacy=restoreGame(JSON.stringify(createGame())),raw=JSON.stringify(legacy),result=operationAlerts(legacy);
 assert.equal(JSON.stringify(legacy),raw);assert(result.alerts.some(a=>a.id==='wear:VN-A104'&&a.extra.plane==='VN-A104'));
 assert(!result.alerts.some(a=>a.category==='slot'||a.category==='connection'||a.id.startsWith('due:')));
 const game=longRunFixture({stage:0}).game,p=game.fleet[0];
 p.serviceDueAt=72;p.servicePlan=null;
 assert(operationAlerts(game).alerts.some(a=>a.id==='due:'+p.id));
 p.servicePlan={start:14,activeFrom:14};
 assert(!operationAlerts(game).alerts.some(a=>a.id==='due:'+p.id));
 const repairing=transition(legacy,{type:'repair',plane:'VN-A104'});assert(!repairing.error);
 const alert=operationAlerts(repairing.game).alerts.find(a=>a.id==='service:VN-A104');assert.equal(alert.severity,'info');
});

test('sold pending connections warn from canonical refund forecasts; resolved missed connections are historical information',()=>{
 const game=disruptionFixture(),journey=game.legEconomy.overnight.journeys[0];assert(journey);
 assert(!operationAlerts(game).alerts.some(a=>a.id==='journey:'+journey.id));
 const blocked=structuredClone(game);blocked.fleet.find(p=>p.id===journey.legs[1].plane).fault='Synthetic preflight failure';
 const raw=JSON.stringify(blocked),alert=operationAlerts(blocked).alerts.find(a=>a.id==='journey:'+journey.id);
 assert(alert);assert.equal(alert.target,'gameplay');assert.equal(alert.extra.section,'recovery');assert.equal(JSON.stringify(blocked),raw);
 const preview=previewDisruption(game,context(game),{leg:journey.legs[0].id,kind:'weather',delay:3,mode:'wait',reservePlane:game.fleet[1].id});
 const resolved=act(act(game,{type:'disruption-apply',preview}),{type:'advance'});
 const history=operationAlerts(resolved).alerts.find(a=>a.id==='connection-history:'+(resolved.day-1));
 assert(history);assert.equal(history.severity,'info');assert.equal(history.target,'report');
});

test('lease warnings use the real expiry boundary and disappear after canonical return',()=>{
 const run=longRunFixture({stage:0});run.apply({type:'lease',model:'A320'});const id=run.game.fleet.at(-1).id;
 assert(!operationAlerts(run.game).alerts.some(a=>a.id==='lease:'+id));
 for(let i=0;i<13;i++){maintainFleet(run);run.apply({type:'advance'});}
 const warning=operationAlerts(run.game).alerts.find(a=>a.id==='lease:'+id);assert.equal(warning.severity,'urgent');assert.equal(warning.extra.plane,id);assert.match(warning.detail,/đầu ngày 15/);
 run.apply({type:'advance'});assert(!operationAlerts(run.game).alerts.some(a=>a.id==='lease:'+id));
});

test('real reclaimed new rights produce per-hour deficits while old rights and exact save bytes remain intact',()=>{
 const run=studyBase(CELLS.find(c=>c.id==='LHR-e2-f2-d1'));run.apply(enableConditional);run.apply(enableUtilization);
 const flight=addStudyFlight(run,{hub:'LHR',feeder:'EDI',onward:'CDG'});
 for(let i=0;i<15;i++){cancelStudyOccurrence(run,flight);maintainFleet(run);run.apply({type:'advance'});}
 assert(flight.keys.every(k=>!run.game.slotMarket.rights.player[k]));
 const raw=run.storage.getItem(SAVE_KEY),before=run.game,review=operationAlerts(before);
 for(const key of flight.keys){const a=review.alerts.find(a=>a.id==='slot:'+key);assert(a,key);assert.equal(a.extra.section,'network-study');}
 assert.equal(run.storage.getItem(SAVE_KEY),raw);assert.deepEqual(restoreGame(raw).slotMarket,before.slotMarket);assert.equal(review.forecastError,null);
});

test('forecast failure remains explicit while current-state warnings survive without mutation',()=>{
 const game=createGame();game.tycoon.prices=[]; // Disposable malformed-input fault injection, never persisted.
 const raw=JSON.stringify(game),result=operationAlerts(game);
 assert(result.forecastError);assert(result.alerts.some(a=>a.category==='maintenance'));
 assert.equal(JSON.stringify(game),raw);
});
