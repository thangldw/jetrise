import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createGame,context,forecast,transition,restoreGame,SAVE_KEY,Engine} from '../src/game.js';
import {routeQuote} from '../src/network.js';
import {SLOT_TERMS} from '../src/slot-market.js';
import {exportSaveFile,importSaveFile,BACKUP_KEY} from '../src/save-store.js';
import {campaign,enableStudyFeatures,buyStudyRights} from './production-stability.mjs';
import {longRunFixture,maintainFleet} from '../tests/fixtures/long-run.mjs';
import {memoryStorage} from '../tests/fixtures/save-manager.mjs';
import {createAudit,auditDay,auditSummary} from './long-run-audit.mjs';
import {sourceFingerprint} from './long-run-208.mjs';

export const NETWORKS=[{hub:'HAN',feeder:'DAD',onward:'NRT'},{hub:'SGN',feeder:'DAD',onward:'SIN'},{hub:'LHR',feeder:'EDI',onward:'CDG'}];
const policies=['required','peak','monopoly'];
export const CELLS=[...NETWORKS.flatMap(network=>[1,2].flatMap(economy=>[1,2].map(fare=>({id:`${network.hub}-e${economy}-f${fare}-d1`,kind:'standard',network,economy,fare,interventionDay:1,policies})))),
 ...['original','medium'].map(fleet=>({id:'bridge-'+fleet,kind:'bridge',network:NETWORKS[0],economy:1,fare:'200/360',fleet,interventionDay:1,policies:['required','monopoly']})),
 ...[1,2].map(economy=>({id:`HAN-e${economy}-f1-d8`,kind:'standard',network:NETWORKS[0],economy,fare:1,interventionDay:8,policies}))];
export const CASES=CELLS.flatMap(cell=>cell.policies.map(policy=>({id:cell.id+'-'+policy,cell,policy})));
const hash=s=>createHash('sha256').update(s).digest('hex');
const close=(a,b,label)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<.005,`${label}: ${a} != ${b}`);
export function studyFingerprint(){return hash(sourceFingerprint()+['scripts/production-stability.mjs','scripts/slot-balance-matched.mjs'].map(p=>p+'\n'+fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')).join('\n'));}
function referenceFares(n){
 const result=transition(createGame(),{type:'setup',name:'Stability Air',origin:n.hub,logo:'wing',color:'#123abc',models:['A320','B738']});assert(!result.error,result.error);const ctx=context(result.game);
 return [n.feeder,n.onward].map(to=>(ctx.routes.find(r=>r.from===n.hub&&r.to===to)||routeQuote(result.game,n.hub,to)).baseFare);
}
export function studyBase(cell){
 if(cell.kind==='standard')return campaign(cell.network,'required',{economy:cell.economy,fares:referenceFares(cell.network).map(x=>x*cell.fare)});
 if(cell.fleet==='original')return longRunFixture({economy:1});
 // A synthetic initial fleet-package counterfactual, not a free in-game exchange.
 // Cash, crew, IDs, age, timetable, routes and 200/360 fares stay fixed.
 const seed=longRunFixture({economy:1,stage:0}).game;
 for(const [i,type] of ['A320','B738','A223'].entries()){seed.fleet[i].type=type;seed.tycoon.cabins[seed.fleet[i].id]=Engine.defaultCabin(context(seed).types[type]);}
 const run=longRunFixture({historicalRaw:JSON.stringify(seed)});enableStudyFeatures(run,['HAN','DAD','NRT']);return run;
}
function withoutTreatment(s){const copy=structuredClone(s);delete copy.cash;delete copy.hq.ledger;delete copy.slotMarket.rights.player;delete copy.slotMarket.spent.player;return copy;}
export function assertMatchedIntervention(before,after){
 assert.deepEqual(withoutTreatment(after),withoutTreatment(before),'slot treatment changed a non-treatment field');
 close(before.cash-after.cash,after.slotMarket.spent.player.signing-before.slotMarket.spent.player.signing,'paid policy signing');
 assert.equal(after.slotMarket.spent.player.daily,before.slotMarket.spent.player.daily);
 for(const [key,right] of Object.entries(before.slotMarket.rights.player))assert((after.slotMarket.rights.player[key]?.quantity||0)>=right.quantity,'treatment released required rights');
}
function portable(run){
 const raw=run.storage.getItem(SAVE_KEY),file=exportSaveFile(run.storage,raw),storage=memoryStorage(),restored=importSaveFile(storage,file.text,null);
 assert.equal(storage.getItem(SAVE_KEY),raw);assert.deepEqual(transition(restored.game,{type:'advance'}),transition(run.game,{type:'advance'}),'portable next transition');run.useStorage(storage);return file.bytes;
}
const totalRights=rights=>Object.values(rights).reduce((n,r)=>n+r.quantity,0);
export function runCase(config,{days=180,out,onProgress=()=>{},intervene,beforeDay}={}){
 const base=studyBase(config.cell),baseRaw=base.storage.getItem(SAVE_KEY),baseGame=base.game,run=longRunFixture({historicalRaw:baseRaw});run.useStorage(memoryStorage([...base.storage.data]));
 const backups=[...base.storage.data].filter(([key])=>key!==SAVE_KEY&&key!==BACKUP_KEY),audit=createAudit(),totals={revenue:0,profit:0,cashDelta:0,maintenanceActionCash:0,slotFees:0,signing:0,reportedFlights:0,cancelled:0,boardings:0,playerMovements:0,availablePlayerMovements:0},result={id:config.id,config,sourceFingerprint:studyFingerprint(),baseHash:hash(baseRaw),baseCash:baseGame.cash,baseEconomy:baseGame.economyVersion,baseFleet:baseGame.fleet.map(p=>({id:p.id,type:p.type,cabin:baseGame.tycoon.cabins[p.id]})),baseSchedules:baseGame.tycoon.schedules,baseFares:baseGame.openedRoutes.map(route=>({route,pair:context(baseGame).routes[route].code,fares:baseGame.tycoon.prices[route]})),status:'running',days:0,portableChecks:0,maxPackageBytes:0,checkpoints:{},rows:[]};
 let extraUnits=0,minCash=baseGame.cash;
 try{for(let i=0;i<days;i++){
  if(run.game.day===config.cell.interventionDay){
   const before=run.game;result.interventionHash=hash(run.storage.getItem(SAVE_KEY));
   if(intervene){result.intervention=intervene(run,config);const known=new Set(backups.map(([k])=>k));backups.push(...[...run.storage.data].filter(([k])=>k!==SAVE_KEY&&k!==BACKUP_KEY&&!known.has(k)));}else{buyStudyRights(run,config.cell.network.hub,config.policy,{availableOnly:true});assertMatchedIntervention(before,run.game);}totals.signing+=before.cash-run.game.cash;extraUnits=totalRights(run.game.slotMarket.rights.player)-totalRights(before.slotMarket.rights.player);result.extraRights=extraUnits;
  }
  const opening=run.game.cash,signingBefore=run.game.slotMarket.spent.player.signing;beforeDay?.(run,config,result);const policySigning=run.game.slotMarket.spent.player.signing-signingBefore;totals.signing+=policySigning;maintainFleet(run);totals.maintenanceActionCash+=run.game.cash-opening+policySigning;
  const before=run.game,raw=run.storage.getItem(SAVE_KEY),preview=forecast(before);assert.equal(run.storage.getItem(SAVE_KEY),raw,'forecast wrote storage');
  const trial=transition(before,{type:'advance'});if(trial.error){assert.deepEqual(trial.game,before);assert.equal(run.storage.getItem(SAVE_KEY),raw);result.status='unfunded-or-rejected';result.blocked={day:before.day,error:trial.error,cash:before.cash};break;}
  const actual=run.apply({type:'advance'}),after=run.game;assert.deepEqual(after,actual.game);auditDay(audit,before,after,actual.report,preview);
  for(const key of ['revenue','profit','cashDelta','slotFees','reportedFlights','cancelled','boardings'])totals[key]+=actual.report[({slotFees:'slotFee',reportedFlights:'flights',boardings:'pax'})[key]||key]||0;
  totals.playerMovements+=actual.report.sharedSlots.movements.reduce((n,m)=>n+m.player,0);
  const first=((before.day-1)%7)*24;totals.availablePlayerMovements+=Object.entries(after.slotMarket.rights.player).filter(([key])=>{const hour=Number(key.split(':')[1]);return hour>=first&&hour<first+24;}).reduce((n,[,right])=>n+right.quantity,0);
  close(after.cash,baseGame.cash-totals.signing+totals.maintenanceActionCash+totals.cashDelta,'cumulative wallet');
  assert(totals.playerMovements<=totals.availablePlayerMovements,'physical use exceeds recurring movement rights');
  result.days++;minCash=Math.min(minCash,after.cash);result.rows.push({day:before.day,cash:after.cash,profit:actual.report.profit,slotFees:actual.report.slotFee||0,rivalLegEvents:audit.rivalLegEvents});
  if([7,45,90,180].includes(result.days)){result.maxPackageBytes=Math.max(result.maxPackageBytes,portable(run));result.portableChecks++;for(const [key,bytes] of backups)assert.equal(run.storage.getItem(key),bytes,'pre-migration snapshot changed');}
  if([90,180].includes(result.days))result.checkpoints[result.days]={cash:after.cash,minCash,totals:structuredClone(totals),audit:auditSummary(audit),extraRights:extraUnits,utilizationReturns:after.slotMarket.utilization?.returnedUnits||0,utilizationHeld:Object.keys(after.slotMarket.utilization?.tracked||{}).filter(k=>after.slotMarket.rights.player[k]).length,expiredKeys:Object.keys(after.slotMarket.utilization?.expired||{}).length,conditionalReturns:after.slotMarket.conditional?.returnedUnits||0,conditionalHeld:Object.values(after.slotMarket.conditional?.newRights||{}).reduce((n,r)=>n+r.quantity,0),protectedHeld:Object.values(after.slotMarket.conditional?.protected||{}).reduce((n,r)=>n+r,0),slotUtilization:totals.availablePlayerMovements?totals.playerMovements/totals.availablePlayerMovements:null,terminal:{deferredCents:after.legEconomy.deferredCents,prepaidCents:after.legEconomy.prepaidCents,journeys:after.legEconomy.overnight.journeys.length,fuel:after.fuel,co2:after.co2},rivals:after.strategy.rivals.map(r=>({id:r.id,cash:r.cash,fleet:r.network.fleet.length,routes:r.network.routes.length})),saveHash:hash(run.storage.getItem(SAVE_KEY))};
  if(result.days%30===0)onProgress({id:config.id,days:result.days,cash:after.cash});
 }
 if(result.status==='running'){assert.equal(audit.days,days);result.status='passed';}
 }catch(error){result.status='failed';result.error=error.stack;}
 result.finalCash=run.game.cash;result.audit=auditSummary(audit);result.totals=totals;
 if(out){fs.mkdirSync(path.join(out,'cases'),{recursive:true});fs.writeFileSync(path.join(out,'cases',config.id+'.json'),JSON.stringify(result,null,2)+'\n');}
 return result;
}
export function compareCheckpoints(control,treatment,config,horizon){
 const c=control.checkpoints[horizon],t=treatment.checkpoints[horizon];assert(c&&t,'missing completed horizon');assert.equal(control.baseHash,treatment.baseHash,'unmatched construction');assert.equal(control.interventionHash,treatment.interventionHash,'unmatched pre-intervention trajectory');
 const nonSlotProfit=(t.totals.profit+t.totals.slotFees)-(c.totals.profit+c.totals.slotFees),extraUpkeep=t.totals.slotFees-c.totals.slotFees,extraSigning=t.totals.signing-c.totals.signing,otherCash=(t.totals.cashDelta-t.totals.profit+t.totals.maintenanceActionCash)-(c.totals.cashDelta-c.totals.profit+c.totals.maintenanceActionCash),cashUplift=t.cash-c.cash;
 close(cashUplift,nonSlotProfit-extraUpkeep-extraSigning+otherCash,'paired effect decomposition');
 return {cell:config.cell.id,kind:config.cell.kind,network:config.cell.network.hub,economy:config.cell.economy,fare:config.cell.fare,fleet:config.cell.fleet||'standard',interventionDay:config.cell.interventionDay,policy:config.policy,horizon,cashUplift,profitUplift:t.totals.profit-c.totals.profit,nonSlotProfit,extraUpkeep,extraSigning,otherCash,extraRights:t.extraRights,rivalLegDelta:t.audit.rivalLegEvents-c.audit.rivalLegEvents,controlRivalLegs:c.audit.rivalLegEvents,treatmentRivalLegs:t.audit.rivalLegEvents,controlUtilization:c.slotUtilization,treatmentUtilization:t.slotUtilization,controlTerminal:c.terminal,treatmentTerminal:t.terminal,accountingOnlyExtraDailyFeeToEraseUplift:cashUplift>0&&t.extraRights?cashUplift/(t.extraRights*(horizon-config.cell.interventionDay+1)):0};
}
export function assemble(out){
 const fingerprint=studyFingerprint(),cases=CASES.map(config=>{const r=JSON.parse(fs.readFileSync(path.join(out,'cases',config.id+'.json'),'utf8'));assert.equal(r.id,config.id);assert.deepEqual(r.config,config);assert.equal(r.sourceFingerprint,fingerprint,'stale case '+config.id);assert.equal(r.status,'passed','incomplete case '+config.id);assert.equal(r.days,180);return r;}),pairs=[];
 for(const config of CASES.filter(c=>c.policy!=='required'))for(const horizon of [90,180])pairs.push(compareCheckpoints(cases.find(r=>r.id===config.cell.id+'-required'),cases.find(r=>r.id===config.id),config,horizon));
 const report={generatedAt:new Date().toISOString(),sourceFingerprint:fingerprint,terms:SLOT_TERMS,caseCount:cases.length,totalDays:cases.reduce((n,r)=>n+r.days,0),portableChecks:cases.reduce((n,r)=>n+r.portableChecks,0),pairs};fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');
 const fields=['cell','kind','network','economy','fare','fleet','interventionDay','policy','horizon','cashUplift','profitUplift','nonSlotProfit','extraUpkeep','extraSigning','otherCash','extraRights','controlRivalLegs','treatmentRivalLegs','controlUtilization','treatmentUtilization','accountingOnlyExtraDailyFeeToEraseUplift'];fs.writeFileSync(path.join(out,'comparisons.csv'),fields.join(',')+'\n'+pairs.map(r=>fields.map(k=>r[k]??'').join(',')).join('\n')+'\n');return report;
}
const self=fileURLToPath(import.meta.url);
if(process.argv[1]===self){
 const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];},out=value('--out','design/slot-balance-matched-20261024');
 fs.mkdirSync(out,{recursive:true});
 if(args.includes('--case')){const config=CASES.find(c=>c.id===value('--case'));assert(config,'unknown case');const r=runCase(config,{out,days:Number(value('--days',180)),onProgress:console.log});console.log(JSON.stringify({id:r.id,status:r.status,days:r.days}));if(r.status!=='passed')process.exitCode=1;}
 else if(args.includes('--report')){const r=assemble(out);console.log(JSON.stringify({cases:r.caseCount,days:r.totalDays,pairs:r.pairs.length}));}
 else{
  assert(!args.includes('--days'),'partial runs require --case');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({scope:'Synthetic matched slot policies, not player behavior or a production repricing decision',sourceFingerprint:studyFingerprint(),cells:CELLS,cases:CASES,primaryMetric:'ending cash difference from exact matched control, including signing/upkeep and all paid maintenance',horizons:[90,180],timing:'calendar days from founding; day-8 intervention has 83/173 exposure days',latePolicy:'buy remaining available rights only; never seize AI ownership',economy1:'synthetic matched starting-career seed before purchases, not a migration of a player save',bridge:'model/default-cabin package counterfactual, fixed legacy cash/crew/IDs/timetable/fares, not a free in-game exchange',snapshot:'each policy independently reconstructs the same base; base and pre-intervention hashes must agree',seed:'deterministic registration/day incident rules; no empirical confidence intervals or real traffic claims'},null,2)+'\n');
  let cursor=0,failed=false;async function worker(){while(cursor<CASES.length){const config=CASES[cursor++],log=fs.openSync(path.join(out,config.id+'.log'),'w');const code=await new Promise(resolve=>{const child=spawn(process.execPath,[self,'--case',config.id,'--out',out],{stdio:['ignore',log,log]});child.once('error',()=>resolve(1));child.once('exit',resolve);});fs.closeSync(log);console.log(JSON.stringify({id:config.id,exitCode:code}));if(code!==0)failed=true;}}
  await Promise.all(Array.from({length:6},()=>worker()));if(failed)process.exitCode=1;else{const r=assemble(out);console.log(JSON.stringify({status:'passed',cases:r.caseCount,days:r.totalDays,pairs:r.pairs.length}));}
 }
}
