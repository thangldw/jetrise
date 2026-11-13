import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {context,SAVE_KEY} from '../src/game.js';
import {playerSlotPurchaseLimit} from '../src/slot-market.js';
import {slotReservationBackupKey} from '../src/save-store.js';
import {CELLS,runCase,compareCheckpoints,studyFingerprint} from './slot-balance-matched.mjs';
import {runSlotAttack} from './experiments/slot-schedule-attacks-quarter.mjs';
const self=fileURLToPath(import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
const cells=CELLS.filter(c=>c.kind==='standard'&&c.economy===2&&c.interventionDay===1),intents=['required','peak','all-hours','stack-cancel','edit-revert'];
export const TASKS=[...cells.flatMap(cell=>intents.flatMap(intent=>['off','on'].map(mode=>({id:`${cell.id}-${intent}-${mode}`,cell,policy:'required',intent,mode})))),...cells.map(cell=>({id:`${cell.id}-protected`,cell,policy:'required',intent:'edit-revert',mode:'protected'}))];
export const conditionalFingerprint=()=>hash(studyFingerprint()+fs.readFileSync(self)+fs.readFileSync(new URL('./experiments/slot-schedule-attacks-quarter.mjs',import.meta.url)));
function buyIntent(run,intent,hub){
 if(intent==='required')return;
 for(let hour=0;hour<168;hour++)if(intent==='all-hours'||[7,8,9,16,17,18].includes(hour%24)){
  const m=run.game.slotMarket,key=hub+':'+hour,owned=m.rights.player[key]?.quantity||0,ai=(m.rights.swift[key]?.quantity||0)+(m.rights.aurelia[key]?.quantity||0),quantity=playerSlotPurchaseLimit(owned,ai);
  if(quantity>owned)run.apply({type:'slot-market-buy',airport:hub,hour,quantity});
 }
}
export function conditionalIntervention(run,task){
 const start=run.game,raw=run.storage.getItem(SAVE_KEY);let activationRaw=null,attack;
 const activate=()=>{
  const before=run.game;activationRaw=run.storage.getItem(SAVE_KEY);run.apply({type:'slot-reservation-enable',migrationId:'conditionalstudy0123456789',acceptTerms:true});
  assert.deepEqual(run.game.slotMarket.rights,before.slotMarket.rights);assert.equal(run.game.cash,before.cash);assert.deepEqual(run.game.tycoon,before.tycoon);
  assert.equal(run.storage.getItem(slotReservationBackupKey('conditionalstudy0123456789')),activationRaw);
 };
 if(task.mode==='on')activate();
 if(['stack-cancel','edit-revert'].includes(task.intent))attack=runSlotAttack(run,task.intent,task.cell.network);else buyIntent(run,task.intent,task.cell.network.hub);
 if(task.mode==='protected')activate();
 const end=run.game;assert.deepEqual(end.tycoon.schedules,start.tycoon.schedules);assert.deepEqual(end.fleet,start.fleet);assert.deepEqual(end.tycoon.prices,start.tycoon.prices);
 for(const [key,right] of Object.entries(start.slotMarket.rights.player))assert.deepEqual(end.slotMarket.rights.player[key],right);
 assert.equal(start.cash-end.cash,end.slotMarket.spent.player.signing-start.slotMarket.spent.player.signing);
 return {mode:task.mode,intent:task.intent,startHash:hash(raw),activationHash:activationRaw?hash(activationRaw):null,attack,returnedImmediately:end.slotMarket.conditional?.returnedUnits||0,signing:start.cash-end.cash};
}
export function aggregateConditional(out){
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.fingerprint,conditionalFingerprint(),'stale terms experiment');assert.deepEqual(manifest.tasks,TASKS);const cases=TASKS.map(t=>{const r=JSON.parse(fs.readFileSync(path.join(out,'cases',t.id+'.json')));assert.equal(r.id,t.id);assert.deepEqual(r.config,t);assert.equal(r.sourceFingerprint,studyFingerprint());assert.equal(r.status,'passed',r.error||r.blocked?.error);assert.equal(r.days,180);assert.equal(r.portableChecks,4);return r;}),rows=[];
 for(const task of TASKS){const r=cases.find(r=>r.id===task.id),mode=task.mode==='protected'?'off':task.mode,control=cases.find(r=>r.id===`${task.cell.id}-required-${mode}`),offControl=cases.find(r=>r.id===`${task.cell.id}-required-off`);
  for(const horizon of [90,180]){
   const cp=r.checkpoints[horizon],c=control.checkpoints[horizon],off=offControl.checkpoints[horizon],effect=compareCheckpoints(control,r,task,horizon);
   if(task.intent==='required'&&task.mode==='on'){assert.equal(cp.cash,off.cash);assert.equal(cp.audit.rivalLegEvents,off.audit.rivalLegEvents);}
   const counterpart=cases.find(x=>x.id===`${task.cell.id}-${task.intent}-off`);let protectedMatches=null;
   if(task.mode==='protected'){const old=counterpart.checkpoints[horizon];assert.equal(cp.cash,old.cash);assert.equal(cp.audit.rivalLegEvents,old.audit.rivalLegEvents);assert.equal(cp.conditionalReturns,0);protectedMatches=true;}
   rows.push({...effect,id:task.id,mode:task.mode,intent:task.intent,controlCash:c.cash,treatmentCash:cp.cash,controlAiLegs:c.audit.rivalLegEvents,treatmentAiLegs:cp.audit.rivalLegEvents,conditionalReturned:cp.conditionalReturns,conditionalHeld:cp.conditionalHeld,protectedHeld:cp.protectedHeld,protectedMatches,offPolicyCashUplift:counterpart.checkpoints[horizon].cash-off.cash});
  }
 }
 let optOutExactChecks=0;
 const historicalRoot=path.resolve('design/slot-adaptive-experiment-20261024'),hm=JSON.parse(fs.readFileSync(path.join(historicalRoot,'manifest.json')));
 assert.equal(hm.fingerprint,'23bf2a62b59f5e40f9a527d7f01f3fa0f4e2119d6af8887f984cc1f962de1a82');
 for(const task of TASKS.filter(t=>t.mode==='off')){
  const suffix=task.intent==='all-hours'?'monopoly':task.intent,id='v2-'+task.cell.id+'-'+suffix;
  const repaired=task.cell.network.hub==='SGN'&&task.intent==='edit-revert';
  const old=JSON.parse(fs.readFileSync(path.join(historicalRoot,repaired?'repairs/cases':'cases',id+'.json'))),fresh=cases.find(r=>r.id===task.id);
  assert.equal(old.status,'passed');assert.equal(old.days,180);
  const expected=repaired?JSON.parse(fs.readFileSync(path.join(historicalRoot,'repairs/manifest.json'))).engineFingerprints.v2:hm.engineFingerprints.v2;assert.equal(old.sourceFingerprint,expected);
  for(const h of [90,180]){assert.equal(fresh.checkpoints[h].saveHash,old.checkpoints[h].saveHash,'opt-out career drift '+task.id);optOutExactChecks++;}
 }
 const report={generatedAt:new Date().toISOString(),scope:manifest.scope,fingerprint:conditionalFingerprint(),sourceFingerprint:studyFingerprint(),optOutExactChecks,cases:cases.length,days:cases.reduce((n,r)=>n+r.days,0),portableChecks:cases.reduce((n,r)=>n+r.portableChecks,0),rows};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');const fields=['id','network','economy','fare','mode','intent','horizon','cashUplift','nonSlotProfit','extraUpkeep','extraSigning','otherCash','controlCash','treatmentCash','controlAiLegs','treatmentAiLegs','conditionalReturned','conditionalHeld','protectedHeld','offPolicyCashUplift','protectedMatches'];fs.writeFileSync(path.join(out,'comparisons.csv'),fields.join(',')+'\n'+rows.map(r=>fields.map(k=>r[k]??'').join(',')).join('\n')+'\n');return report;
}
if(process.argv[1]===self){
 const args=process.argv.slice(2),value=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];},out=path.resolve(value('--out','design/slot-conditional-optin-20261025'));
 fs.mkdirSync(path.join(out,'cases'),{recursive:true});
 if(args.includes('--case')){const task=TASKS.find(t=>t.id===value('--case'));assert(task,'unknown case');const r=runCase(task,{days:Number(value('--days',180)),intervene:conditionalIntervention,onProgress:console.log});r.id=task.id;fs.writeFileSync(path.join(out,'cases',task.id+'.json'),JSON.stringify(r,null,2)+'\n');console.log({id:task.id,status:r.status,days:r.days,error:r.error,blocked:r.blocked});if(r.status!=='passed')process.exitCode=1;
 }else if(args.includes('--report')){const r=aggregateConditional(out);console.log({cases:r.cases,days:r.days,rows:r.rows.length});}
 else{
  assert(!fs.existsSync(path.join(out,'manifest.json')),'Use fresh output directory');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({fingerprint:conditionalFingerprint(),scope:'Local opt-in conditional new-right trial: no production deploy or player save access; all pre-opt-in rights protected',tasks:TASKS,horizons:[90,180],terms:'Only new rights: unused after timetable changes or before AI/day settlement are returned without signing refund. Recurring schedules and pending committed legs remain protected. No automatic opt-in.',controls:'Fresh off/on controls per network and fare; post-purchase activation controls preserve already paid rights.'},null,2)+'\n');
  let cursor=0,failed=false;async function worker(){while(cursor<TASKS.length){const task=TASKS[cursor++],log=fs.openSync(path.join(out,task.id+'.log'),'w'),code=await new Promise(resolve=>{const c=spawn(process.execPath,[self,'--case',task.id,'--out',out],{stdio:['ignore',log,log]});c.once('error',()=>resolve(1));c.once('exit',resolve);});fs.closeSync(log);console.log({id:task.id,exitCode:code});if(code!==0)failed=true;}}
  await Promise.all(Array.from({length:6},()=>worker()));if(failed)process.exitCode=1;else{const r=aggregateConditional(out);console.log({status:'passed',cases:r.cases,days:r.days,rows:r.rows.length});}
 }
}
