import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createGame,context,forecast,SAVE_KEY,transition} from '../src/game.js';
import {quoteSlotActivation} from '../src/slot-market.js';
import {exportSaveFile,importSaveFile} from '../src/save-store.js';
import {longRunFixture,maintainFleet} from '../tests/fixtures/long-run.mjs';
import {memoryStorage} from '../tests/fixtures/save-manager.mjs';
import {createAudit,auditDay,auditSummary} from './long-run-audit.mjs';
import {sourceFingerprint} from './long-run-208.mjs';

// Paired synthetic campaigns: only purchased slot rights differ within a network.
// All setup and operating expenditure uses canonical transitions and persistence.
const networks=[{hub:'HAN',feeder:'DAD',onward:'NRT'},{hub:'SGN',feeder:'DAD',onward:'SIN'},{hub:'LHR',feeder:'EDI',onward:'CDG'}];
export function campaign(n,policy,{economy=2,fares}={}){
 let run=longRunFixture({historicalRaw:JSON.stringify(createGame())});const apply=a=>run.apply(a);
 apply({type:'setup',name:'Stability Air',origin:n.hub,logo:'wing',color:'#123abc',models:['A320','B738']});
 // Synthetic comparison seed only; never migrate or reprice a player career.
 if(economy===1){const seed=run.game;seed.economyVersion=1;run=longRunFixture({historicalRaw:JSON.stringify(seed)});}else assert.equal(economy,2);
 apply({type:'buy-used',model:'A223',tier:0});apply({type:'founding-next'});
 const open=to=>{let i=context(run.game).routes.findIndex(r=>r.from===n.hub&&r.to===to);if(i<0){apply({type:'route-create',from:n.hub,to});i=run.game.openedRoutes.at(-1);}else apply({type:'unlock',route:i});return i;};
 const feeder=open(n.feeder),onward=open(n.onward);apply({type:'founding-finish'});
 const [main,alternate,inbound]=run.game.fleet;
 for(const [p,start] of [[alternate,4],[inbound,9],[main,14]])apply({type:'service-plan',plane:p.id,start});
 for(let d=0;d<7;d++)for(const [p,route,hour] of [[main,onward,2],[alternate,onward,16],[inbound,feeder,22]])apply({type:'add',plane:p.id,route,start:d*24+hour});
 if(fares)for(const [route,y] of [[feeder,fares[0]],[onward,fares[1]]])apply({type:'prices',route,values:[Math.round(y),Math.round(y*2.5),Math.round(y*5)]});
 enableStudyFeatures(run,[n.hub,n.feeder,n.onward]);
 buyStudyRights(run,n.hub,policy);
 return run;
}
export function enableStudyFeatures(run,airports){
 const apply=a=>run.apply(a);
 apply({type:'leg-economy-enable',migrationId:'stability-ledger-0123456789'});apply({type:'overnight-enable',migrationId:'stability-overnight-0123456789'});apply({type:'strategy-enable'});
 apply({type:'slot-market-enable',airports,migrationId:'stability-slots-0123456789',quotedFee:quoteSlotActivation(context(run.game),airports).fee});
 apply({type:'customer-enable',objective:'hub',migrationId:'stability-customer-0123456789'});apply({type:'rival-network-enable',migrationId:'stability-rival-0123456789'});

}
export function buyStudyRights(run,hub,policy,{availableOnly=false}={}){
 assert(['required','peak','monopoly'].includes(policy));
 if(policy!=='required')for(let hour=0;hour<168;hour++)if(policy==='monopoly'||[7,8,9,16,17,18].includes(hour%24)){
  const market=run.game.slotMarket,key=hub+':'+hour,quantity=availableOnly?4-(market.rights.swift[key]?.quantity||0)-(market.rights.aurelia[key]?.quantity||0):4;
  if(quantity>(market.rights.player[key]?.quantity||0))run.apply({type:'slot-market-buy',airport:hub,hour,quantity});
 }
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
const out='design/production-stability';fs.mkdirSync(out,{recursive:true});
const result={generatedAt:new Date().toISOString(),sourceFingerprint:sourceFingerprint(),horizon:90,scope:'Synthetic new-economy matched networks; no production or player-save access',scenarios:[]};
for(const n of networks)for(const policy of ['required','peak','monopoly']){
 const id=n.hub+'-'+policy;let r={id,network:n,policy,status:'running',days:0,profit:0,slotFees:0,flights:0,pax:0,checkpoints:0};
 try{
  const run=campaign(n,policy),initial=run.game,audit=createAudit();r.initialCash=initial.cash;r.initialHash=createHash('sha256').update(run.storage.getItem(SAVE_KEY)).digest('hex');let actions=0,delta=0;
  for(let d=0;d<90;d++){
   const opening=run.game.cash;maintainFleet(run);actions+=run.game.cash-opening;const before=run.game,preview=forecast(before),closed=run.apply({type:'advance'}),after=run.game;
   auditDay(audit,before,after,closed.report,preview);delta+=closed.report.cashDelta;
   assert(Math.abs(after.cash-initial.cash-actions-delta)<.005,'cumulative cash bridge');
   r.days++;r.profit+=closed.report.profit;r.slotFees+=closed.report.slotFee||0;r.flights+=closed.report.flights;r.pax+=closed.report.pax;
   if([7,45,90].includes(d+1)){
    const raw=run.storage.getItem(SAVE_KEY),target=memoryStorage(),imported=importSaveFile(target,exportSaveFile(run.storage,raw).text,null);
    assert.equal(target.getItem(SAVE_KEY),raw);assert.deepEqual(transition(imported.game,{type:'advance'}),transition(run.game,{type:'advance'}));run.useStorage(target);r.checkpoints++;
   }
  }
  r.finalCash=run.game.cash;r.setupSpend=500000000-initial.cash;r.netCash=r.finalCash-500000000;r.audit=auditSummary(audit);r.status='passed';
 }catch(e){r.status='failed';r.error=e.stack;process.exitCode=1;}
 result.scenarios.push(r);fs.writeFileSync(out+'/slot-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(r));
}

}
