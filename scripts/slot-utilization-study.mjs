import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SAVE_KEY} from '../src/game.js';
import {slotUtilizationBackupKey} from '../src/save-store.js';
import {CELLS,runCase,compareCheckpoints,studyFingerprint} from './slot-balance-matched.mjs';
import {enableConditional,enableUtilization,addStudyFlight,cancelStudyOccurrence} from './experiments/slot-utilization-actions.mjs';
const self=fileURLToPath(import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const cells=CELLS.filter(c=>c.kind==='standard'&&c.economy===2&&c.interventionDay===1);
export const TASKS=cells.flatMap(cell=>[...['required','healthy','cancel','churn'].flatMap(intent=>['off','on'].map(mode=>({id:`${cell.id}-${intent}-${mode}`,cell,policy:'required',intent,mode}))),{id:`${cell.id}-cancel-protected`,cell,policy:'required',intent:'cancel',mode:'protected'}]);
export const utilizationFingerprint=()=>hash(studyFingerprint()+fs.readFileSync(self)+fs.readFileSync(new URL('./experiments/slot-utilization-actions.mjs',import.meta.url)));
function activate(run){const before=run.game,raw=run.storage.getItem(SAVE_KEY);run.apply(enableUtilization);assert.equal(run.game.cash,before.cash);assert.deepEqual(run.game.tycoon,before.tycoon);assert.deepEqual(run.game.slotMarket.rights,before.slotMarket.rights);assert.equal(run.storage.getItem(slotUtilizationBackupKey(enableUtilization.migrationId)),raw);}
function intervene(run,task){
 run.apply(enableConditional);if(task.mode==='on')activate(run);
 const flight=task.intent==='required'?null:addStudyFlight(run,task.cell.network);
 if(task.mode==='protected')activate(run);
 return {flight,mode:task.mode,intent:task.intent,signing:flight?.signing||0};
}
function beforeDay(run,task,result){
 if(!['cancel','churn'].includes(task.intent))return;
 let f=result.intervention.flight;
 if(task.intent==='churn'&&run.game.day===8){
  cancelStudyOccurrence(run,f);const old=run.game.tycoon.schedules.find(x=>x.id===f.slot);run.apply({type:'remove',id:f.slot});
  for(const key of f.keys){const [airport,hour]=key.split(':');run.apply({type:'slot-market-buy',airport,hour:Number(hour),quantity:1});}
  run.apply({type:'add',plane:old.plane,route:old.route,start:old.start});f=result.intervention.flight={...f,slot:run.game.tycoon.nextId-1};
 }
 if(cancelStudyOccurrence(run,f))result.cancelledOccurrences=(result.cancelledOccurrences||0)+1;
}
export function aggregateUsage(out){
 const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(m.fingerprint,utilizationFingerprint(),'stale usage trial');assert.deepEqual(m.tasks,TASKS);
 const cases=TASKS.map(t=>{const r=JSON.parse(fs.readFileSync(path.join(out,'cases',t.id+'.json')));assert.deepEqual(r.config,t);assert.equal(r.trialFingerprint,m.fingerprint);assert.equal(r.sourceFingerprint,studyFingerprint());assert.equal(r.status,'passed',r.error||r.blocked?.error);assert.equal(r.days,180);assert.equal(r.portableChecks,4);return r;});
 const rows=[];let legacyHashChecks=0;
 for(const task of TASKS){const r=cases.find(x=>x.id===task.id),mode=task.mode==='protected'?'off':task.mode,base=cases.find(x=>x.id===`${task.cell.id}-required-${mode}`),off=cases.find(x=>x.id===`${task.cell.id}-${task.intent}-off`);
  for(const h of[90,180]){
   const cp=r.checkpoints[h],ocp=off.checkpoints[h],effect=compareCheckpoints(base,r,task,h);
   if(task.intent==='required'||task.mode==='protected'){assert.equal(cp.cash,ocp.cash);assert.equal(cp.audit.rivalLegEvents,ocp.audit.rivalLegEvents);assert.equal(cp.utilizationReturns,0);}
   if(['cancel','churn'].includes(task.intent)&&task.mode==='on'){assert.equal(cp.utilizationReturns,4);assert.equal(cp.utilizationHeld,0);assert.equal(cp.conditionalHeld,0);assert.equal(cp.expiredKeys,4);}
   if(['cancel','churn'].includes(task.intent)&&task.mode!=='on')assert.equal(cp.conditionalHeld,4);
   if(task.intent==='required'&&task.mode==='off'){const old=JSON.parse(fs.readFileSync(path.resolve('design/slot-conditional-optin-20261025/cases',task.cell.id+'-required-on.json')));assert.equal(cp.saveHash,old.checkpoints[h].saveHash,'old schedule-only career drift');legacyHashChecks++;}
   rows.push({...effect,id:task.id,intent:task.intent,mode:task.mode,cashVsOff:cp.cash-ocp.cash,aiLegsVsOff:cp.audit.rivalLegEvents-ocp.audit.rivalLegEvents,utilizationReturns:cp.utilizationReturns,usageHeld:cp.utilizationHeld,conditionalHeld:cp.conditionalHeld,expiredKeys:cp.expiredKeys,controlCash:base.checkpoints[h].cash,treatmentCash:cp.cash});
  }
 }
 const report={generatedAt:new Date().toISOString(),fingerprint:m.fingerprint,sourceFingerprint:studyFingerprint(),cases:cases.length,days:cases.reduce((n,r)=>n+r.days,0),portableChecks:cases.reduce((n,r)=>n+r.portableChecks,0),legacyHashChecks,rows};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
 const fields=['id','network','fare','intent','mode','horizon','cashUplift','nonSlotProfit','extraUpkeep','extraSigning','otherCash','cashVsOff','aiLegsVsOff','utilizationReturns','usageHeld','conditionalHeld','expiredKeys'];fs.writeFileSync(path.join(out,'comparisons.csv'),fields.join(',')+'\n'+rows.map(r=>fields.map(k=>r[k]??'').join(',')).join('\n')+'\n');return report;
}
if(process.argv[1]===self){
 const args=process.argv.slice(2),value=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];},out=path.resolve(value('--out','design/slot-utilization-optin-20261025'));
 fs.mkdirSync(path.join(out,'cases'),{recursive:true});
 if(args.includes('--case')){const task=TASKS.find(t=>t.id===value('--case'));assert(task);const fingerprint=utilizationFingerprint(),r=runCase(task,{days:Number(value('--days',180)),intervene,beforeDay,onProgress:console.log});r.trialFingerprint=fingerprint;fs.writeFileSync(path.join(out,'cases',task.id+'.json'),JSON.stringify(r,null,2)+'\n');console.log({id:task.id,status:r.status,days:r.days,error:r.error,blocked:r.blocked});if(r.status!=='passed')process.exitCode=1;}
 else if(args.includes('--report')){const r=aggregateUsage(out);console.log({cases:r.cases,days:r.days,rows:r.rows.length,legacyHashChecks:r.legacyHashChecks});}
 else{
  assert(!fs.existsSync(path.join(out,'manifest.json')),'Fresh output required');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({fingerprint:utilizationFingerprint(),tasks:TASKS,scope:'Local synthetic new-acquisition utilization opt-in; no production or player save writes',terms:'14 closed idle days, physical per-hour receipts only; existing rights unchanged; pending legs and sold journeys protected; seven-day absence to reset an acquisition clock, seven-day reacquisition wait after expiry; templates retained and missing-right departures cancelled.',horizons:[90,180],pairs:'Exact same base, fleet, fares and real add/cancel/churn policy per off/on pair; protected activation after purchases; required opt-out hashes checked against prior version-2 policy study.'},null,2)+'\n');let cursor=0,failed=false;
  async function worker(){while(cursor<TASKS.length){const t=TASKS[cursor++],fd=fs.openSync(path.join(out,t.id+'.log'),'w'),code=await new Promise(resolve=>{const p=spawn(process.execPath,[self,'--case',t.id,'--out',out],{stdio:['ignore',fd,fd]});p.once('error',()=>resolve(1));p.once('exit',resolve);});fs.closeSync(fd);console.log({id:t.id,code});if(code!==0)failed=true;}}
  await Promise.all(Array.from({length:6},()=>worker()));if(failed)process.exitCode=1;else{const r=aggregateUsage(out);console.log({status:'passed',cases:r.cases,days:r.days,rows:r.rows.length,legacyHashChecks:r.legacyHashChecks});}
 }
}
