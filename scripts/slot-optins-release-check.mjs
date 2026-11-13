import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SCENARIOS,replayScenario,sourceFingerprint} from './long-run-208.mjs';
import {studyFingerprint} from './slot-balance-matched.mjs';
const self=fileURLToPath(import.meta.url),args=process.argv.slice(2),value=(k,d)=>{const i=args.indexOf(k);return i<0?d:args[i+1];},out=path.resolve(value('--out','design/releases/2026-10-25-slot-optins/integrated'));
const usageIds=['HAN-e2-f1-d1-cancel-on','HAN-e2-f2-d1-cancel-on','SGN-e2-f1-d1-cancel-on','SGN-e2-f2-d1-cancel-on','LHR-e2-f1-d1-cancel-on','LHR-e2-f2-d1-cancel-on','HAN-e2-f2-d1-churn-on','LHR-e2-f2-d1-healthy-on','SGN-e2-f2-d1-cancel-protected','LHR-e2-f2-d1-required-off'];
const tasks=[...SCENARIOS.map(c=>({kind:'standard',id:c.id})),...usageIds.map(id=>({kind:'utilization',id})),{kind:'conditional',id:'LHR-e2-f2-d1-edit-revert-on'}];
fs.mkdirSync(out,{recursive:true});
if(args.includes('--standard')){
 const id=value('--standard'),c=SCENARIOS.find(c=>c.id===id);assert(c);const r=replayScenario(c,{onProgress:console.log});fs.mkdirSync(path.join(out,'standard'),{recursive:true});fs.writeFileSync(path.join(out,'standard',id+'.json'),JSON.stringify(r,null,2)+'\n');console.log({id,status:r.status,days:r.audit.days,failure:r.failure||r.blocked});if(r.status!=='passed')process.exitCode=1;
}else{
 assert(!fs.existsSync(path.join(out,'manifest.json')),'Use fresh evidence output');const fingerprint=sourceFingerprint(),runnerHash=createHash('sha256').update(fs.readFileSync(self)).digest('hex');fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({fingerprint,runnerHash,tasks,scope:'Fresh release-source replay of existing scenarios; old no-opt-in saves and accepted trial save hashes must remain exact; no player storage access.'},null,2)+'\n');let cursor=0,failed=false;
 async function worker(){while(cursor<tasks.length){const t=tasks[cursor++],cmd=t.kind==='standard'?[self,'--standard',t.id,'--out',out]:['scripts/slot-'+(t.kind==='utilization'?'utilization':'conditional')+'-study.mjs','--case',t.id,'--out',path.join(out,t.kind)],fd=fs.openSync(path.join(out,t.kind+'-'+t.id+'.log'),'w'),code=await new Promise(resolve=>{const p=spawn(process.execPath,cmd,{stdio:['ignore',fd,fd]});p.once('error',()=>resolve(1));p.once('exit',resolve);});fs.closeSync(fd);console.log({...t,code});if(code!==0)failed=true;}}
 await Promise.all(Array.from({length:6},()=>worker()));assert(!failed,'A release replay failed');assert.equal(sourceFingerprint(),fingerprint,'Runtime changed during replay');const prior=JSON.parse(fs.readFileSync('design/releases/2026-10-25-slot-access/integrated-results.json')),results=[];let exactLegacyFinalHashes=0,exactTrialCheckpoints=0;
 for(const t of tasks){const r=JSON.parse(fs.readFileSync(path.join(out,t.kind,t.kind==='standard'?'':'cases',t.id+'.json')));assert.equal(r.status,'passed',t.id);assert.equal(r.sourceFingerprint,t.kind==='standard'?fingerprint:studyFingerprint());
  if(t.kind==='standard'){const c=SCENARIOS.find(c=>c.id===t.id),old=prior.scenarios.find(x=>x.id===t.id);assert.equal(r.audit.days,c.days);assert.equal(r.finalHash,old.finalHash,'Old career drift '+t.id);exactLegacyFinalHashes++;results.push({kind:t.kind,id:t.id,days:r.audit.days,imports:r.checks.imports,resets:r.checks.resets,rollbacks:r.checks.rollbacks,failureChecks:r.checks.failureChecks,finalHash:r.finalHash});}
  else{assert.equal(r.days,180);assert.equal(r.portableChecks,4);const folder=t.kind==='utilization'?'slot-utilization-optin-20261025':'slot-conditional-optin-20261025',old=JSON.parse(fs.readFileSync(path.join('design',folder,'cases',t.id+'.json')));for(const h of[90,180]){assert.equal(r.checkpoints[h].saveHash,old.checkpoints[h].saveHash,'Accepted trial drift '+t.id);exactTrialCheckpoints++;}results.push({kind:t.kind,id:t.id,days:r.days,imports:r.portableChecks,checkpoints:{90:r.checkpoints[90].saveHash,180:r.checkpoints[180].saveHash}});}
 }
 const sum=k=>results.reduce((n,r)=>n+(r[k]||0),0),report={generatedAt:new Date().toISOString(),runtimeFingerprint:fingerprint,runnerHash,scenarios:results.length,days:sum('days'),imports:sum('imports'),resets:sum('resets'),rollbacks:sum('rollbacks'),failureChecks:sum('failureChecks'),exactLegacyFinalHashes,exactTrialCheckpoints,results};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log({...report,results:undefined});
}
