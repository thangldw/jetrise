import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {forecast,restoreGame,transition,SAVE_KEY} from '../src/game.js';
import {exportSaveFile,importSaveFile} from '../src/save-store.js';
import {longRunFixture} from './fixtures/long-run.mjs';
import {memoryStorage} from './fixtures/save-manager.mjs';
import {auditDay,createAudit} from '../scripts/long-run-audit.mjs';
import {replayScenario,SCENARIOS} from '../scripts/long-run-208.mjs';

test('frozen pre-JET schema1 bytes preserve legacy assets, thirteen schedules and opt-out after transfer',()=>{
 const raw=fs.readFileSync(new URL('./fixtures/saves/pre-jet-schema1.json',import.meta.url),'utf8');assert.equal(createHash('sha256').update(raw).digest('hex'),'02301213fe38fc8b2a69c70ceb71c81715b958fce4de0c9c0d987a49471528c5');
 const g=restoreGame(raw),source=memoryStorage([[SAVE_KEY,raw]]),target=memoryStorage(),r=importSaveFile(target,exportSaveFile(source,raw).text,null);
 assert.equal(r.raw,raw);assert.equal(r.game.economyVersion,1);assert.equal(r.game.cash,8600000);assert.equal(r.game.tycoon.schedules.length,13);assert.deepEqual(r.game.fleet.map(p=>p.id),['VN-A101','VN-A102','VN-A104']);assert.equal(r.game.legEconomy,undefined);assert.equal(r.game.strategy,undefined);assert.deepEqual(r.game,g);assert.deepEqual(transition(g,{type:'advance'}),transition(r.game,{type:'advance'}));assert.equal(source.getItem(SAVE_KEY),raw);
});

test('integrated replay operates through rebooking, daily reload and actual imported-storage continuation',()=>{
 const r=replayScenario(SCENARIOS.find(s=>s.id==='full-v1'),{days:10});assert.equal(r.status,'passed',r.failure?.stack);assert.equal(r.audit.days,10);assert(r.audit.connectionsSold>0);assert(r.audit.connectionsCompleted>0);assert(r.audit.leasesAcquired>0);assert(r.actions.some(a=>a.type==='disruption'&&a.rebooked>0));assert.equal(r.checks.imports,1);assert.equal(r.checks.resets,1);assert.equal(r.checks.rollbacks,5);assert.equal(r.checks.failureChecks,3);
});

test('auditor rejects one-cent changes, duplicated events, capacity breaches and changed terminal counts',()=>{
 const run=longRunFixture(),before=run.game,preview=forecast(before),actual=run.apply({type:'advance'}),after=run.game;
 auditDay(createAudit(),before,after,actual.report,preview);
 for(const mutate of [x=>x.after.cash+=.01,x=>x.after.legEconomy.deferredCents++,x=>x.report.revenue+=.01,x=>x.report.competition.rivals[0].legs[0].revenueCents++,x=>x.report.sharedSlots.movements[0].player=5,x=>x.report.customers.count++,x=>x.preview.rows[0].passengers[0]=10000]){const x=structuredClone({before,after,report:actual.report,preview});mutate(x);assert.throws(()=>auditDay(createAudit(),x.before,x.after,x.report,x.preview));}
 const journal=createAudit();auditDay(journal,before,after,actual.report,preview);assert.throws(()=>auditDay(journal,before,after,actual.report,preview),/duplicate/);
});

test('a constrained shared hub really prevents AI flights without changing the player save format',()=>{
 const run=longRunFixture({scarcity:true}),before=run.game,preview=forecast(before),r=run.apply({type:'advance'});auditDay(createAudit(),before,run.game,r.report,preview);assert(r.report.competition.rivals.every(r=>r.legs.length===0));assert.equal(run.game.schema,1);assert(run.game.legEconomy&&run.game.strategy.expansion);assert.equal(run.game.tycoon.schedules.length,21);
});

test('legacy fractional-cent P&L survives the day66 half-cent boundary without repricing the save',()=>{
 const r=replayScenario(SCENARIOS.find(s=>s.id==='legacy-v1'));assert.equal(r.status,'passed',r.failure?.stack);assert.equal(r.audit.days,90);assert.equal(r.days[65].profit,74704.52500000001);
});
