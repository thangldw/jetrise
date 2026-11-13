import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {forecast,transition,restoreGame,SAVE_KEY,context,dayCashRequired} from '../src/game.js';
import {exportSaveFile,importSaveFile,restartCareer,restoreSaveEntry,readSaveEntry,persistGame,rollbackLegEconomy,rollbackOvernight,rollbackAdvance,rollbackSlotMarket,rollbackCustomers,rollbackRivalNetwork} from '../src/save-store.js';
import {previewDisruption} from '../src/disruption-recovery.js';
import {slotRequirements} from '../src/slot-market.js';
import {longRunFixture,maintainFleet} from '../tests/fixtures/long-run.mjs';
import {memoryStorage} from '../tests/fixtures/save-manager.mjs';
import {createAudit,auditDay,auditSummary} from './long-run-audit.mjs';

export const SCENARIOS=[
 {id:'frozen-legacy',economy:1,stage:0,days:180,historical:true},
 {id:'legacy-v1',economy:1,stage:0,days:90},
 {id:'ledger-v1',economy:1,stage:201,days:90},
 {id:'overnight-v1',economy:1,stage:202,days:90},
 {id:'slots-v1',economy:1,stage:204,days:90},
 {id:'customers-v1',economy:1,stage:205,days:90},
 {id:'full-v1',economy:1,stage:206,days:180,disruptions:true},
 {id:'full-v1-control',economy:1,stage:206,days:180},
 {id:'scarcity-v1',economy:1,stage:206,days:180,scarcity:true},
 {id:'advance-v1',economy:1,stage:206,days:90,advance:true},
 {id:'full-v2',economy:2,stage:206,days:180},
 {id:'full-v2-recovery',economy:2,stage:206,days:180,disruptions:true,programChanges:true},
 {id:'direct-v2',economy:2,stage:206,days:180,connections:false},
 {id:'value-v2',economy:2,stage:206,days:90,fare:.65},
 {id:'premium-v2',economy:2,stage:206,days:90,fare:1.3},
 {id:'high-fare-v2',economy:2,stage:206,days:90,fare:2},
 {id:'excessive-fare-v2',economy:2,stage:206,days:90,fare:4},
 {id:'unmaintained-v2',economy:2,stage:206,days:90,maintained:false},
];
const hash=s=>createHash('sha256').update(s).digest('hex');
export function sourceFingerprint(){const files=[...fs.readdirSync(new URL('../src/',import.meta.url),{recursive:true}).filter(f=>/\.jsx?$/.test(f)).map(f=>'src/'+f),'tests/fixtures/long-run.mjs','tests/fixtures/legacy-slot-rights.mjs','tests/fixtures/save-manager.mjs','tests/fixtures/saves/pre-jet-schema1.json','scripts/long-run-audit.mjs','scripts/long-run-208.mjs'].sort();return hash(files.map(f=>f+'\n'+fs.readFileSync(new URL('../'+f,import.meta.url),'utf8')).join('\n'));}
const closeEnough=(a,b,label)=>assert(Math.abs(a-b)<.005,label+`: ${a} != ${b}`);
function portableCheckpoint(run,counters){
 const source=run.storage,raw=source.getItem(SAVE_KEY),snapshot=run.game,file=exportSaveFile(source,raw),target=memoryStorage();
 const restored=importSaveFile(target,file.text,null);assert.equal(target.getItem(SAVE_KEY),raw);assert.deepEqual(restored.game,snapshot);
 assert.deepEqual(transition(restored.game,{type:'advance'}),transition(snapshot,{type:'advance'}),'next transition after transfer');
 counters.imports++;counters.maxPackageBytes=Math.max(counters.maxPackageBytes,file.bytes);
 const reset=restartCareer(target,raw),archived=readSaveEntry(target,reset.archive);assert.equal(archived.raw,raw);assert.equal(reset.game.setupComplete,false);const back=restoreSaveEntry(target,archived.key,archived.stored,reset.raw);assert.equal(back.raw,raw);counters.resets++;
 const rollbacks=[[snapshot.legEconomy,rollbackLegEconomy],[snapshot.legEconomy?.overnight,rollbackOvernight],[snapshot.legEconomy?.advance,rollbackAdvance],[snapshot.slotMarket,rollbackSlotMarket],[snapshot.customerStrategy,rollbackCustomers],[snapshot.strategy?.expansion,rollbackRivalNetwork]];
 for(const [enabled,rollback] of rollbacks)if(enabled){const copy=memoryStorage([...target.data]),r=rollback(copy,raw);assert.equal(copy.getItem(SAVE_KEY),r.raw);restoreGame(r.raw);assert.equal(target.getItem(SAVE_KEY),raw);counters.rollbacks++;}
 // Continue on the imported storage, not merely an isolated import assertion.
 run.useStorage(target);
}
function storageFailures(run,counters){
 const raw=run.storage.getItem(SAVE_KEY),s=run.game,r=transition(s,{type:'advance'});assert(!r.error,r.error);
 const target=memoryStorage([...run.storage.data]),write=target.setItem;target.setItem=(k,v)=>{if(k===SAVE_KEY)throw Error('Injected quota failure');write(k,v);};assert.throws(()=>persistGame(target,r.game,raw),/quota/);assert.equal(target.getItem(SAVE_KEY),raw);
 assert.throws(()=>importSaveFile(target,raw,raw+' '),/tab khác/);assert.equal(target.getItem(SAVE_KEY),raw);
 const poor=structuredClone(s),required=dayCashRequired(forecast(s));poor.cash=Math.max(0,required-.01);const denied=transition(poor,{type:'advance'});assert(denied.error,'unfunded close must reject');assert.deepEqual(denied.game,poor);assert.equal(run.storage.getItem(SAVE_KEY),raw);counters.failureChecks+=3;
}
function injectDisruption(run,index){
 const s=run.game,now=(s.day-1)*24,j=s.legEconomy.overnight.journeys.find(j=>j.legs[0].departure<now&&j.legs[0].arrival>=now&&j.legs[1].status==='reserved');if(!j)return {skipped:'no eligible pending feeder'};
 const leg=j.legs[0],hour=Math.floor(leg.arrival+3)%168,key=leg.to+':'+hour,owned=s.slotMarket.rights.player[key]?.quantity||0,needed=(slotRequirements(context(s)).get(key)||0)+1;
 const buy=owned<needed?{type:'slot-market-buy',airport:leg.to,hour,quantity:needed}:null;
 let trial=s;if(buy){const r=transition(s,buy);if(r.error)return {skipped:r.error};trial=r.game;}
 const request={leg:leg.id,kind:'weather',delay:3,mode:index%2?'operate':'rebook'};
 try{previewDisruption(trial,context(trial),request);}catch(e){return {skipped:e.message};}
 if(buy)run.apply(buy);
 const preview=previewDisruption(run.game,context(run.game),request),before=run.game.cash;
 run.apply({type:'disruption-apply',preview});closeEnough(before-run.game.cash,preview.summary.cashCostCents/100,'recovery payment');
 return {mode:request.mode,fee:preview.summary.feeCents/100,missed:preview.summary.missedPax,rebooked:preview.summary.rebookedPax,refunded:preview.summary.refundedPax};
}

export function replayScenario(config,{onProgress=()=>{},days=config.days}={}){
 const run=longRunFixture({...config,...(config.historical?{historicalRaw:fs.readFileSync(new URL('../tests/fixtures/saves/pre-jet-schema1.json',import.meta.url),'utf8')}: {})}),initial=run.game,audit=createAudit(),started=performance.now();
 const initialRaw=run.storage.getItem(SAVE_KEY),backups=new Map([...run.storage.data].filter(([k])=>k!==SAVE_KEY&&!k.endsWith(':backup')));
 const result={id:config.id,config:{...config,days},sourceFingerprint:sourceFingerprint(),initialCash:initial.cash,setupCash:config.economy===2?500000000:8600000,finalCash:null,status:'running',initialHash:hash(initialRaw),days:[],actions:[],checks:{imports:0,resets:0,rollbacks:0,failureChecks:0,maxPackageBytes:0},totals:{revenue:0,profit:0,cashDelta:0,actionCash:0,flights:0,cancelled:0,pax:0,maintenance:0,connectionRevenue:0,connectionFees:0,customerFees:0,slotFees:0},maxSaveBytes:0,maxStorageBytes:0};
 let lastDisruptionWindow=-1,lastSkippedWindow=-1;
 if(config.maintained===false)for(const p of run.game.fleet){const r=transition(run.game,{type:'service-plan-remove',plane:p.id});if(!r.error)run.apply({type:'service-plan-remove',plane:p.id});}
 try{for(let i=0;i<days;i++){
  const opening=run.game;
  const actions=config.maintained===false?[]:maintainFleet(run);for(const action of actions)result.actions.push({day:opening.day,...action});
  const window=Math.floor((opening.day-2)/28);
  if(config.disruptions&&window>=0&&window!==lastDisruptionWindow){const disruption=injectDisruption(run,window);if(!disruption.skipped){lastDisruptionWindow=window;result.actions.push({day:opening.day,type:'disruption',...disruption});}else if(lastSkippedWindow!==window){lastSkippedWindow=window;result.actions.push({day:opening.day,type:'disruption',...disruption});}}
  if(config.programChanges){const action=opening.day===60?{type:'customer-change',objective:'business'}:opening.day===90?{type:'customer-pause'}:opening.day===97?{type:'customer-resume'}:null;if(action){run.apply(action);result.actions.push({day:opening.day,...action});}}
  const before=run.game;result.totals.actionCash+=before.cash-opening.cash;
  const raw=run.storage.getItem(SAVE_KEY),preview=forecast(before);assert.equal(run.storage.getItem(SAVE_KEY),raw,'forecast must not save');assert.deepEqual(run.game,before,'forecast must not mutate');
  const output=transition(before,{type:'advance'});
  if(output.error){assert.equal(run.storage.getItem(SAVE_KEY),raw);result.status='blocked';result.blocked={day:before.day,cash:before.cash,required:dayCashRequired(preview),error:output.error};break;}
  const actual=run.apply({type:'advance'}),after=run.game;assert.deepEqual(after,actual.game,'daily reload parity');
  auditDay(audit,before,after,actual.report,preview);
  const r=actual.report,t=result.totals;for(const key of ['revenue','profit','cashDelta','flights','cancelled','pax'])t[key]+=r[key];t.maintenance+=r.maintenanceCost;t.connectionRevenue+=r.connections?.revenue||0;t.connectionFees+=(r.connections?.coordination||0)+(r.connections?.handling||0);t.customerFees+=r.customers?.fee||0;t.slotFees+=r.slotFee||0;
  const row={day:before.day,cash:after.cash,profit:r.profit,pax:r.pax,flights:r.flights,cancelled:r.cancelled,required:dayCashRequired(preview),deferred:after.legEconomy?.deferredCents||0,prepaid:after.legEconomy?.prepaidCents||0,pendingTickets:after.legEconomy?.overnight?.journeys.length||0,rivals:after.strategy?.rivals.map(x=>({id:x.id,cash:x.cash,fleet:x.network?.fleet.length||1}))||[]};result.days.push(row);
  result.maxSaveBytes=Math.max(result.maxSaveBytes,Buffer.byteLength(run.storage.getItem(SAVE_KEY)));
  if([7,45,90,180].includes(i+1)){portableCheckpoint(run,result.checks);storageFailures(run,result.checks);}
  result.maxStorageBytes=Math.max(result.maxStorageBytes,[...run.storage.data].reduce((n,[k,v])=>n+Buffer.byteLength(k)+Buffer.byteLength(v),0));
  for(const [key,bytes] of backups)assert.equal(run.storage.getItem(key),bytes,'immutable pre-migration backup');
  closeEnough(run.game.cash,initial.cash+t.actionCash+t.cashDelta,'cumulative wallet');
  if((i+1)%30===0)onProgress({id:config.id,days:i+1,cash:after.cash});
 }
 if(result.status==='running'){
  assert.equal(audit.days,days,'full requested horizon');
  if(days>=45){assert(result.checks.imports>=2&&result.checks.resets>=2,'portable continuation coverage');if(config.disruptions)assert(result.actions.some(a=>a.type==='disruption'&&!a.skipped),'recovery scenario must actually execute');if(config.stage===206&&!config.scarcity){assert(audit.rivalLegEvents>0&&audit.leasesAcquired>0&&audit.leasesReturned>0,'AI lifecycle coverage');}if(config.scarcity)assert.equal(audit.rivalLegEvents,0,'scarcity must constrain actual flights');}
  result.status='passed';
 }
 }catch(error){result.status='failed';result.failure={day:run.game.day,error:error.message,stack:error.stack};}
 result.finalCash=run.game.cash;result.finalHash=hash(run.storage.getItem(SAVE_KEY));result.audit=auditSummary(audit);result.elapsedMs=Math.round(performance.now()-started);result.minCash=Math.min(result.initialCash,...result.days.map(d=>d.cash));result.balance={netCashChange:result.finalCash-result.initialCash,setupSpend:result.setupCash-result.initialCash,operatingMargin:result.totals.revenue?result.totals.profit/result.totals.revenue:null,completion:result.totals.flights+result.totals.cancelled?result.totals.flights/(result.totals.flights+result.totals.cancelled):null};
 return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const requested=process.argv.slice(2);for(const id of requested)assert(SCENARIOS.some(s=>s.id===id),'Unknown scenario: '+id);const selected=requested.length?SCENARIOS.filter(s=>requested.includes(s.id)):SCENARIOS;
 const report={version:1,scope:'JET-208 synthetic local 90–180-day canonical replays; no player storage access or commercial balance claim',generatedAt:new Date().toISOString(),scenarios:[]};
 fs.mkdirSync('design/long-run-208',{recursive:true});
 for(const config of selected){const r=replayScenario(config,{onProgress:v=>console.log(JSON.stringify(v))});report.scenarios.push(r);fs.writeFileSync(`design/long-run-208/${config.id}.json`,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({id:r.id,status:r.status,days:r.audit.days,finalCash:r.finalCash,failure:r.failure||r.blocked}));}
 fs.writeFileSync('design/long-run-208/results.json',JSON.stringify(report,null,2)+'\n');if(report.scenarios.some(r=>r.status!=='passed'))process.exitCode=1;
}
