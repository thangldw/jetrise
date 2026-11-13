import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame,transition,restoreGame,context,Engine} from '../src/game.js';
import {proposeSchedule,projectedWeekReports} from '../src/planner.js';
import {maintenanceWindows,planConflict} from '../src/maintenance.js';
const act=(s,a)=>{const r=transition(s,a);assert(!r.error,r.error);return r.game;};
function founding(){let s=act(createGame(),{type:'setup',name:'Planner Air',logo:'wing',color:'#123abc',origin:'HAN',models:['B38M','B738']});s=act(s,{type:'founding-next'});for(const route of [3,0])s=act(s,{type:'unlock',route});return act(s,{type:'founding-finish'});}

// Regression owner: the public optimize transition, not a copied gap algorithm.
// Previously the first aircraft reached 168h and lost twelve day-8 legs.
test('fresh automatic plan previews and atomically installs sustainable weekly checks without changing existing flights',()=>{
 let s=founding();s=act(s,{type:'add',plane:s.fleet[1].id,route:3,start:12});const raw=JSON.stringify(s),oldSlots=structuredClone(s.tycoon.schedules),proposal=proposeSchedule(context(s),s.tycoon);
 assert.equal(JSON.stringify(s),raw);assert(proposal.added>0);assert(proposal.maintenance?.length>0,'missing weekly maintenance preview');
 const result=transition(s,{type:'optimize',proposal});assert(!result.error,result.error);s=restoreGame(JSON.stringify(result.game));assert.equal(s.cash,JSON.parse(raw).cash);for(const slot of oldSlots)assert.deepEqual(s.tycoon.schedules.find(x=>x.id===slot.id),slot);
 for(const p of s.fleet.filter(p=>s.tycoon.schedules.some(x=>x.plane===p.id))){assert(p.servicePlan,'scheduled aircraft needs a saved weekly check');assert.equal(planConflict(s,p,p.servicePlan.start,x=>Engine.duration(context(s),p.id,x.route)),'');assert(maintenanceWindows(p,0,168).some(w=>w.kind==='light'&&w.end<=168));}
 for(const {report} of projectedWeekReports(context(s),s.tycoon,false,14))assert.equal(report.cancelled,0,'projected cancellation on day '+report.day);
 const beforeCash=s.cash,r=transition(s,{type:'advance'});assert(!r.error,r.error);assert.equal(r.report.maintenanceCash,proposal.maintenanceCost);assert(Math.abs(r.game.cash-beforeCash-r.report.cashDelta)<.005);assert.equal(r.game.day,2);
});

test('saturated legacy template is retained and blocked while other aircraft can expand; old save bytes never migrate on preview',()=>{
 const raw=fs.readFileSync(new URL('./fixtures/saves/pre-jet-schema1.json',import.meta.url),'utf8'),legacy=restoreGame(raw),before=JSON.stringify(legacy),p=proposeSchedule(context(legacy),legacy.tycoon);
 assert.equal(JSON.stringify(legacy),before);assert.equal(legacy.legEconomy,undefined);assert(p.added>0);
 const restored=restoreGame(JSON.stringify(act(legacy,{type:'optimize',proposal:p})));assert.equal(restored.cash,legacy.cash);assert.equal(restored.economyVersion,1);assert.equal(restored.legEconomy,undefined);for(const old of legacy.tycoon.schedules)assert.deepEqual(restored.tycoon.schedules.find(s=>s.id===old.id),old);
 for(let i=0;i<legacy.fleet.length;i++){const {servicePlan:a,...old}=legacy.fleet[i],{servicePlan:b,...next}=restored.fleet[i];assert.deepEqual(next,old);if(a)assert.deepEqual(b,a);}
 let s=founding();const id=s.fleet[0].id;for(let start=0;start<168;start+=3.5)s=act(s,{type:'add',plane:id,route:3,start});
 s=act(s,{type:'service-plan',plane:s.fleet[1].id,start:0});const slots=structuredClone(s.tycoon.schedules),proposal=proposeSchedule(context(s),s.tycoon);assert(proposal.blocked.some(p=>p.plane===id));assert(!proposal.maintenance.some(p=>p.plane===id));assert(proposal.added>0);
 const applied=act(s,{type:'optimize',proposal});assert.equal(applied.fleet[0].servicePlan,null);assert.deepEqual(applied.tycoon.schedules.filter(x=>x.plane===id),slots);assert.deepEqual(applied.fleet[1].servicePlan,s.fleet[1].servicePlan);
});

test('shared hangar checks and cross-week continuations are reserved before adding flights',()=>{
 let s=act(founding(),{type:'buy-used',model:'A223',tier:0});const proposal=proposeSchedule(context(s),s.tycoon);s=act(s,{type:'optimize',proposal});assert.equal(s.fleet.length,3);
 for(const p of s.fleet)if(p.servicePlan)assert.equal(planConflict(s,p,p.servicePlan.start,x=>Engine.duration(context(s),p.id,x.route)),'');
 assert(proposal.maintenance.some(p=>p.start>=5),'third aircraft must wait for hangar capacity');
 let wrapped=founding();wrapped.fleet=wrapped.fleet.slice(0,1);wrapped.day=7;wrapped.fleet[0].serviceDueAt=200;for(let start=144;start<165;start+=3.5)wrapped=act(wrapped,{type:'add',plane:wrapped.fleet[0].id,route:3,start});
 const q=proposeSchedule(context(wrapped),wrapped.tycoon);assert(q.added>0);assert.equal(q.maintenance[0].activeFrom,165);assert.equal(q.checks[0].end,170);const next=act(wrapped,{type:'optimize',proposal:q});
 for(const {report} of projectedWeekReports(context(next),next.tycoon,false,14))assert.equal(report.cancelled,0);
});

test('missing, conflicting, duplicate or stale maintenance proposals fail the whole optimize transition',()=>{
 const s=founding(),p=proposeSchedule(context(s),s.tycoon),before=JSON.stringify(s);
 const missing=structuredClone(p);delete missing.maintenance;
 const duplicate=structuredClone(p);duplicate.maintenance.push(duplicate.maintenance[0]);
 const conflict=structuredClone(p),slot=conflict.state.schedules.find(x=>x.plane===conflict.maintenance[0].plane);conflict.maintenance[0].start=slot.start;conflict.maintenance[0].activeFrom=slot.start;
 for(const proposal of [missing,duplicate,conflict]){const r=transition(s,{type:'optimize',proposal});assert(r.error);assert.strictEqual(r.game,s);assert.equal(JSON.stringify(s),before);}
 const current=act(s,{type:'service-plan',plane:s.fleet[0].id,start:12}),stale=transition(current,{type:'optimize',proposal:p});assert(stale.error.includes('cũ'));assert.strictEqual(stale.game,current);
});

test('integrated JET-201–206 planning retains held tickets, disruption decisions and purchased shared slots',async()=>{
 const {saveManagerFixture}=await import('./fixtures/save-manager.mjs'),{auditDay,createAudit}=await import('../scripts/long-run-audit.mjs'),{forecast}=await import('../src/game.js');
 const {game:s}=saveManagerFixture({disrupted:true}),before=JSON.stringify(s),p=proposeSchedule(context(s),s.tycoon);assert(p.added>0);assert(p.maintenance.length>0);assert.equal(JSON.stringify(s),before);
 const next=restoreGame(JSON.stringify(act(s,{type:'optimize',proposal:p})));assert.equal(next.cash,s.cash);assert.deepEqual(next.legEconomy,s.legEconomy);assert.deepEqual(next.slotMarket,s.slotMarket);assert.deepEqual(next.tycoon.exceptions,s.tycoon.exceptions);assert.deepEqual(next.customerStrategy,s.customerStrategy);assert.deepEqual(next.strategy,s.strategy);
 const preview=forecast(next),closed=transition(next,{type:'advance'});assert(!closed.error,closed.error);auditDay(createAudit(),next,closed.game,closed.report,preview);
});
