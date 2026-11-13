import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SAVE_KEY,restoreGame,transition,forecast} from '../src/game.js';
import {exportSaveFile,importSaveFile,restartCareer,readSaveEntry,restoreSaveEntry,rollbackLegEconomy,rollbackOvernight,rollbackSlotMarket,rollbackCustomers,rollbackRivalNetwork,readSession,recoverBackup,BACKUP_KEY,DAMAGED_KEY,listSaveEntries} from '../src/save-store.js';
import {weeklyReview,goalProgress,gameWeekStart} from '../src/weekly-review.js';
import {longRunFixture,maintainFleet} from '../tests/fixtures/long-run.mjs';
import {memoryStorage} from '../tests/fixtures/save-manager.mjs';
import {createAudit,auditDay,auditSummary} from './long-run-audit.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const withoutGoal=g=>{const c=structuredClone(g);delete c.gameplay.weeklyGoal;return c;};
const accepted=(g,action)=>{const r=transition(g,action);assert(!r.error,r.error);return r;};
const config=[{id:'legacy-frozen',historical:true},{id:'all-jet-v1-hold',economy:1,mode:'hold'},{id:'all-jet-v2-rotate',economy:2,mode:'rotate'},{id:'slot-optins-v1-switch-clear',economy:1,optins:true,mode:'switch-clear'}];

// This is a disposable Storage replay, not a browser-quota or power-loss simulator.
export function lifecycleReplay({days=42,onProgress=()=>{}}={}){
 assert.equal(days,42,'This evidence matrix requires the complete six-week horizon');
 const results=[];
 for(const cfg of config){
  const run=longRunFixture(cfg.historical?{historicalRaw:fs.readFileSync(new URL('../tests/fixtures/saves/pre-jet-schema1.json',import.meta.url),'utf8')}:{economy:cfg.economy});
  if(cfg.optins){run.apply({type:'slot-reservation-enable',migrationId:'lifecycleterms202611010001',acceptTerms:true});run.apply({type:'slot-utilization-enable',migrationId:'lifecycleusage202611010001',acceptTerms:true});}
  const initial=run.game,initialRaw=run.storage.getItem(SAVE_KEY),snapshots=new Map([...run.storage.data].filter(([k])=>k!==SAVE_KEY&&k!==BACKUP_KEY));
  const audit=createAudit(),receipt={id:cfg.id,days:[],weeks:[],goals:[],imports:0,rollbacks:0,restartRestores:0,corruptionRecoveries:0,pairedNoGoalDays:0,immutableSnapshots:snapshots.size};
  const select=kind=>{const before=run.game;run.apply({type:'weekly-goal',kind,weekStart:gameWeekStart(before.day),basis:JSON.stringify(before)});assert.deepEqual(withoutGoal(run.game),withoutGoal(before));receipt.goals.push({day:before.day,kind});};
  if(!cfg.historical)select('margin');
  for(let i=0;i<days;i++){
   const day=run.game.day;
   if(!cfg.historical&&day>1){
    if(cfg.mode==='rotate'&&(day-1)%7===0)select(['margin','reliability','hub'][Math.floor((day-1)/7)%3]);
    if(cfg.mode==='switch-clear'&&[3,10,17,24,31,38].includes(day))select('reliability');
    if(cfg.mode==='switch-clear'&&[4,11,18,25,32,39].includes(day))select('none');
    if(cfg.mode==='switch-clear'&&[5,12,19,26,33,40].includes(day))select('hub');
   }
   maintainFleet(run);const before=run.game,preview=forecast(before),raw=run.storage.getItem(SAVE_KEY);
   const control=accepted(withoutGoal(before),{type:'advance'}),output=run.apply({type:'advance'}),after=run.game;
   assert.deepEqual(output.report,control.report);assert.deepEqual(withoutGoal(after),withoutGoal(control.game));receipt.pairedNoGoalDays++;
   auditDay(audit,before,after,output.report,preview);assert.equal(run.storage.getItem(BACKUP_KEY),raw);assert.deepEqual(restoreGame(run.storage.getItem(SAVE_KEY)),after);
   if(before.gameplay.weeklyGoal)assert.deepEqual(after.gameplay.weeklyGoal,before.gameplay.weeklyGoal,'no automatic rollover or reward snapshot');
   const goal=after.gameplay.weeklyGoal,progress=goal?goalProgress(after,goal):null;
   if(goal&&day<goal.weekStart+6)assert.equal(progress.status,'tracking');
   receipt.days.push({day,cash:after.cash,profit:output.report.profit,flights:output.report.flights,cancelled:output.report.cancelled,goalStatus:progress?.status??null,historyDays:after.tycoon.history.length});
   if(day%7===0){
    const week=weeklyReview(after,day-6),rows=after.tycoon.history.filter(r=>r.day>=day-6&&r.day<=day);assert.equal(rows.length,7);assert(week.complete);assert(Math.abs(week.totals.profit-rows.reduce((n,r)=>n+r.profit,0))<1e-6,'independent weekly sum, legacy fractional-cent noise only');
    if(goal?.weekStart===day-6){
     const profit=rows.reduce((n,r)=>n+r.profit,0),rev=rows.reduce((n,r)=>n+r.revenue,0),flights=rows.reduce((n,r)=>n+r.flights,0),cancelled=rows.reduce((n,r)=>n+r.cancelled,0),journeys=rows.reduce((n,r)=>n+(r.connections?.journeys??0),0);
     const met=goal.kind==='margin'?flights>0&&profit>0&&rev>0&&profit/rev>=.1:goal.kind==='reliability'?flights>=14&&flights/(flights+cancelled)>=.95:journeys>=20&&profit>0;
     assert.equal(progress.status,met?'achieved':'missed');
    }
    receipt.weeks.push({start:day-6,profit:week.totals.profit,flights:week.totals.flights,goal:goal?{...goal,status:progress.status}:null});
    const current=run.storage.getItem(SAVE_KEY),pack=exportSaveFile(run.storage,current),target=memoryStorage(),imported=importSaveFile(target,pack.text,null);
    assert.equal(imported.raw,current);assert.deepEqual(imported.game,after);assert.deepEqual(accepted(imported.game,{type:'advance'}),accepted(after,{type:'advance'}));receipt.imports++;
    const reset=restartCareer(target,current),entry=readSaveEntry(target,reset.archive);assert.equal(entry.raw,current);const back=restoreSaveEntry(target,entry.key,entry.stored,reset.raw);assert.equal(back.raw,current);receipt.restartRestores++;
    for(const [enabled,rollback] of [[after.legEconomy,rollbackLegEconomy],[after.legEconomy?.overnight,rollbackOvernight],[after.slotMarket,rollbackSlotMarket],[after.customerStrategy,rollbackCustomers],[after.strategy?.expansion,rollbackRivalNetwork]])if(enabled){
     const fork=memoryStorage([...target.data]),r=rollback(fork,current);assert.equal(fork.getItem(SAVE_KEY),r.raw);const archived=listSaveEntries(fork).entries.find(e=>e.reason==='rollback'&&e.raw===current);assert(archived);const recovered=restoreSaveEntry(fork,archived.key,archived.stored,r.raw);assert.equal(recovered.raw,current);assert.deepEqual(recovered.game,after);receipt.rollbacks++;
    }
    const damaged='synthetic damaged day '+day,fork=memoryStorage([...target.data]);fork.setItem(SAVE_KEY,damaged);fork.setItem(BACKUP_KEY,current);assert(readSession(fork).blocked);assert.equal(fork.getItem(SAVE_KEY),damaged);const recovered=recoverBackup(fork,damaged);assert.equal(recovered.raw,current);assert.equal(fork.getItem(DAMAGED_KEY),damaged);receipt.corruptionRecoveries++;
    // The following days run on the imported storage, with its real backups.
    run.useStorage(target);
   }
   for(const [key,value] of snapshots)assert.equal(run.storage.getItem(key),value,'immutable migration bytes');
   if(cfg.optins)assert.deepEqual(run.game.slotMarket.rights.player,initial.slotMarket.rights.player,'no retrospective seizure/repricing of paid player rights');
   onProgress({scenario:cfg.id,day});
  }
  if(cfg.mode==='hold'){assert.equal(run.game.gameplay.weeklyGoal.weekStart,1);assert.equal(goalProgress(run.game,run.game.gameplay.weeklyGoal).status,'unknown');assert.equal(weeklyReview(run.game,1).totals.profit,null);}
  if(cfg.historical){assert.equal(run.game.gameplay.weeklyGoal,undefined);assert.equal(run.game.legEconomy,undefined);assert.deepEqual(run.game.tycoon.schedules,initial.tycoon.schedules);}
  receipt.initialHash=hash(initialRaw);receipt.finalHash=hash(run.storage.getItem(SAVE_KEY));receipt.finalDay=run.game.day;receipt.audit=auditSummary(audit);receipt.status='passed';
  results.push({receipt,package:exportSaveFile(run.storage,run.storage.getItem(SAVE_KEY)).text});
 }
 return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=path.resolve(process.argv[2]||'design/save-lifecycle-20261101');fs.mkdirSync(out,{recursive:true});
 const sources=[...fs.readdirSync(new URL('../src/',import.meta.url),{recursive:true}).filter(f=>/\.jsx?$/.test(f)).map(f=>'src/'+f),'scripts/save-lifecycle-check.mjs','scripts/long-run-audit.mjs','tests/fixtures/long-run.mjs','tests/fixtures/legacy-slot-rights.mjs','tests/fixtures/save-manager.mjs','tests/fixtures/saves/pre-jet-schema1.json'].sort();
 const fingerprints=Object.fromEntries(sources.map(f=>[f,hash(fs.readFileSync(new URL('../'+f,import.meta.url)))]));
 const results=lifecycleReplay({onProgress:({scenario,day})=>{if(day%7===0)console.log(scenario,'closed day',day);}});
 for(const r of results)fs.writeFileSync(path.join(out,r.receipt.id+'-day43.json'),r.package);
 fs.writeFileSync(path.join(out,'career-results.json'),JSON.stringify({synthetic:true,daysPerScenario:42,totalDays:168,fingerprints,scenarios:results.map(r=>r.receipt)},null,2));console.log('PASS: 4 careers × 42 days; 168 actual/control day pairs');
}
