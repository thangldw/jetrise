import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {studyBase,CELLS} from './slot-balance-matched.mjs';
import {enableConditional,enableUtilization,addStudyFlight,cancelStudyOccurrence} from './experiments/slot-utilization-actions.mjs';
import {maintainFleet} from '../tests/fixtures/long-run.mjs';
import {SAVE_KEY} from '../src/game.js';
const root='design/slot-utilization-optin-20261025',self=fileURLToPath(import.meta.url),mode=process.argv[2];
if(['off','on'].includes(mode)){
 const run=studyBase(CELLS.find(c=>c.id==='HAN-e2-f2-d1'));run.apply(enableConditional);if(mode==='on')run.apply(enableUtilization);const flight=addStudyFlight(run,{hub:'HAN',feeder:'DAD',onward:'NRT'}),rows=[];
 for(let i=0;i<180;i++){
  cancelStudyOccurrence(run,flight);maintainFleet(run);const day=run.game.day,r=run.apply({type:'advance'}).report;
  rows.push({day,returned:run.game.slotMarket.utilization?.returnedUnits||0,slots:r.sharedSlots.rivals.map(v=>({id:v.id,hour:v.hour,rotations:v.rotations,signing:v.signing,daily:v.daily})),rivals:r.competition.rivals.map(v=>({id:v.id,cashBefore:v.cashBefore,cash:v.cash,profit:v.profit,slotSigning:v.slotSigning,routeFee:v.routeFee,depositPaid:v.depositPaid,depositRefund:v.depositRefund,legs:v.legs.length,fleet:run.game.strategy.rivals.find(x=>x.id===v.id).network.fleet.map(p=>({id:p.id,route:p.route,lease:p.lease}))}))});
 }
 const expected=JSON.parse(fs.readFileSync(`${root}/cases/HAN-e2-f2-d1-cancel-${mode}.json`));const saveHash=createHash('sha256').update(run.storage.getItem(SAVE_KEY)).digest('hex');assert.equal(saveHash,expected.checkpoints[180].saveHash,'diagnostic replay drift');fs.writeFileSync(`${root}/HAN-f2-diagnostic-${mode}.json`,JSON.stringify({mode,flight,saveHash,days:180,rows},null,2)+'\n');console.log({mode,exactReplay:true});
}else{
 const codes=await Promise.all(['off','on'].map(mode=>new Promise(resolve=>{const p=spawn(process.execPath,[self,mode],{stdio:'inherit'});p.once('exit',resolve);})));assert(codes.every(c=>c===0));
 const off=JSON.parse(fs.readFileSync(root+'/HAN-f2-diagnostic-off.json')),on=JSON.parse(fs.readFileSync(root+'/HAN-f2-diagnostic-on.json'));
 const diffs=on.rows.flatMap((r,i)=>r.rivals.flatMap((v,j)=>{const old=off.rows[i].rivals[j];return old.legs!==v.legs||old.depositPaid!==v.depositPaid||old.depositRefund!==v.depositRefund?[{day:r.day,id:v.id,off:old,on:v,offSlots:off.rows[i].slots[j],onSlots:r.slots[j]}]:[];}));fs.writeFileSync(root+'/HAN-f2-diagnostic-diffs.json',JSON.stringify({exactReplayDays:180,firstCapacityDifference:diffs[0],differences:diffs},null,2)+'\n');console.log(JSON.stringify({first:diffs[0],differences:diffs.length},null,2));
}
