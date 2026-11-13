import test from 'node:test';
import assert from 'node:assert/strict';
import {SAVE_KEY,createGame,restoreGame,forecast,transition,context} from '../src/game.js';
import {BACKUP_KEY,DAMAGED_KEY,ARCHIVE_PREFIX,SAVE_FILE_LIMIT,inspectSaveFile,exportSaveFile,importSaveFile,restartCareer,restoreSaveEntry,listSaveEntries,readSaveEntry,removeSaveArchive,manageSave,persistGame,readSession,readLegBackup,readOvernightBackup,readSlotMarketBackup,readCustomerBackup,readRivalNetworkBackup,rollbackLegEconomy,rollbackOvernight,rollbackSlotMarket,rollbackCustomers,rollbackRivalNetwork,recoverBackup,restartAfterDamage,withSaveLock} from '../src/save-store.js';
import {saveManagerFixture,memoryStorage,savedAction} from './fixtures/save-manager.mjs';
import {quoteSlotActivation} from '../src/slot-market.js';
const base=()=>JSON.stringify(createGame());
let complete;
const fixture=()=>complete??=saveManagerFixture({disrupted:true});
const fullFile=()=>exportSaveFile(fixture().storage,fixture().raw).text;
const activeStore=()=>{const s=memoryStorage();importSaveFile(s,fullFile(),null);return s;};
const featureRollbacks=[[readLegBackup,rollbackLegEconomy],[readOvernightBackup,rollbackOvernight],[readSlotMarketBackup,rollbackSlotMarket],[readCustomerBackup,rollbackCustomers],[readRivalNetworkBackup,rollbackRivalNetwork]];

test('legacy raw JSON imports exact bytes, preserves schedules and never opts into new economics',()=>{
 const old=createGame();delete old.economyVersion;delete old.setupComplete;const raw=JSON.stringify(old,null,2),parsed=inspectSaveFile(raw),storage=memoryStorage([[SAVE_KEY,base()]]),r=importSaveFile(storage,raw,base());
 assert.equal(r.raw,raw);assert.equal(storage.getItem(SAVE_KEY),raw);assert.equal(r.game.tycoon.schedules.length,13);assert.equal(r.game.legEconomy,undefined);assert.equal(r.game.economyVersion,1);assert.equal(parsed.package,false);assert.equal(parsed.snapshots.length,0);assert.deepEqual(forecast(r.game),forecast(restoreGame(raw)));
});

test('complete package exports all five immutable snapshots and imports JET-201–206 without reinterpretation',()=>{
 const {storage,raw,game}=fixture(),before=[...storage.data],pack=exportSaveFile(storage,raw),preview=inspectSaveFile(pack.text);assert.deepEqual([...storage.data],before);assert.equal(pack.snapshots,5);assert.deepEqual(pack.missing,[]);assert.deepEqual(preview.summary.features,['JET-201','JET-202','JET-203','JET-204','JET-205','JET-206']);
 const target=memoryStorage(),r=importSaveFile(target,pack.text,null);assert.equal(r.raw,raw);assert.deepEqual(r.game,game);assert.deepEqual(forecast(r.game),forecast(game));for(const row of preview.snapshots)assert.equal(target.getItem(row.key),row.raw);assert(listSaveEntries(target).entries.some(e=>e.reason==='package-backup'));
});

test('every intermediate migration stage can be exported, imported and advanced',()=>{
 const f=fixture();for(const raw of Object.values(f.states)){const target=memoryStorage(),pack=exportSaveFile(f.storage,raw,false),r=importSaveFile(target,pack.text,null),expected=transition(restoreGame(raw),{type:'advance'});assert(!expected.error,expected.error);assert.deepEqual(savedAction(target,{type:'advance'}),expected.game);assert.deepEqual(restoreGame(target.getItem(SAVE_KEY)),expected.game);assert.equal(r.raw,raw);}
});

test('alternate valid activation order preserves all snapshot relationships',()=>{
 const f=saveManagerFixture({order:[201,204,206,202,205]}),target=memoryStorage(),pack=exportSaveFile(f.storage,f.raw),r=importSaveFile(target,pack.text,null);assert.equal(pack.snapshots,5);for(const [read] of featureRollbacks)assert.equal(read(target,r.game).raw,read(f.storage,f.game).raw);assert.deepEqual(savedAction(target,{type:'advance'}),transition(f.game,{type:'advance'}).game);
});

test('each whole-career rollback still works on a different storage after package import',()=>{
 for(const [read,rollback] of featureRollbacks){const target=activeStore(),raw=target.getItem(SAVE_KEY),g=restoreGame(raw),expected=read(target,g).raw,result=rollback(target,raw);assert.equal(result.raw,expected);assert.equal(target.getItem(SAVE_KEY),expected);assert(listSaveEntries(target).entries.some(e=>e.reason==='rollback'&&e.raw===raw));}
});

test('rollback to legacy can enable the complete stack again with fresh IDs and unchanged assets',()=>{
 const store=activeStore();let s=rollbackLegEconomy(store,store.getItem(SAVE_KEY)).game;const fleet=structuredClone(s.fleet),schedule=structuredClone(s.tycoon.schedules);
 const actions=[{type:'leg-economy-enable',migrationId:'reenableledger207012345'},{type:'strategy-enable'},{type:'overnight-enable',migrationId:'reenabletickets20701234'},{type:'customer-enable',objective:'business',migrationId:'reenablecustomers207012'}];for(const a of actions)s=savedAction(store,a);
 const airports=['HAN','DAD','NRT'];s=savedAction(store,{type:'slot-market-enable',airports,migrationId:'reenableslots2070123456',quotedFee:quoteSlotActivation(context(s),airports).fee});s=savedAction(store,{type:'rival-network-enable',migrationId:'reenablerivals207012345'});
 assert.deepEqual(s.fleet,fleet);assert.deepEqual(s.tycoon.schedules,schedule);assert.equal(exportSaveFile(store,store.getItem(SAVE_KEY)).missing.length,0);assert.deepEqual(restoreGame(store.getItem(SAVE_KEY)),s);
});

test('cross-week pending tickets retain cents, experience and subsequent settlement after transfer',()=>{
 const f=saveManagerFixture({sunday:true});for(let i=0;i<7;i++)f.run({type:'advance'});const raw=f.storage.getItem(SAVE_KEY),g=restoreGame(raw);assert(g.legEconomy.overnight.journeys.length);const target=memoryStorage();importSaveFile(target,exportSaveFile(f.storage,raw).text,null);
 for(let i=0;i<3;i++){const expected=f.run({type:'advance'}),actual=savedAction(target,{type:'advance'});assert.deepEqual(actual,expected);}
});

test('restart archives a fully migrated career and restoring it does not reset obligations or paid AI leases',()=>{
 const store=activeStore();let g;for(let i=0;i<8;i++)g=savedAction(store,{type:'advance'});assert(g.strategy.rivals.some(r=>r.network.fleet.length>1));const raw=store.getItem(SAVE_KEY),r=restartCareer(store,raw);assert.equal(r.game.setupComplete,false);assert.equal(r.game.legEconomy,undefined);const archive=readSaveEntry(store,r.archive);assert.equal(archive.raw,raw);assert.equal(archive.reason,'restart');
 const returned=restoreSaveEntry(store,archive.key,archive.stored,r.raw);assert.equal(returned.raw,raw);assert.deepEqual(returned.game,restoreGame(raw));assert.equal(readRivalNetworkBackup(store,returned.game).game.strategy.expansion,undefined);
});

test('ordinary persistence cannot remove the live ledger; explicit restart still preserves it',()=>{
 const f=saveManagerFixture({order:[201]}),s=structuredClone(f.game);delete s.legEconomy;assert.throws(()=>persistGame(f.storage,s,f.raw),/Không được xóa/);assert.equal(f.storage.getItem(SAVE_KEY),f.raw);assert.equal(readSaveEntry(f.storage,restartCareer(f.storage,f.raw).archive).raw,f.raw);
});

test('raw saves without snapshots import with explicit missing-backup information',()=>{
 const raw=fixture().raw,preview=inspectSaveFile(raw),target=memoryStorage();assert.equal(preview.missing.length,5);const r=importSaveFile(target,raw,null);assert.equal(r.raw,raw);assert.throws(()=>readRivalNetworkBackup(target,r.game),/Không tìm/);assert.equal(exportSaveFile(target,r.raw).missing.length,5);assert.deepEqual(forecast(r.game),forecast(fixture().game));
});

test('invalid JSON, future formats, oversized input, forged keys and orphan snapshots reject without writes',()=>{
 const valid=JSON.parse(fullFile()),variants=['bad',JSON.stringify({...valid,version:2}),JSON.stringify({...valid,format:'other'}),' '.repeat(SAVE_FILE_LIMIT+1),JSON.stringify({...valid,current:'bad'}),JSON.stringify({...valid,previous:'bad'}),JSON.stringify({...valid,snapshots:[...valid.snapshots,valid.snapshots[0]]}),JSON.stringify({...valid,snapshots:[{key:SAVE_KEY,raw:base()}]}),JSON.stringify({...valid,snapshots:[{key:'__proto__',raw:base()}]}),JSON.stringify({...valid,snapshots:[...valid.snapshots,{key:SAVE_KEY+':leg-economy:unrelatedkey0123456',raw:base()}]})];
 for(const text of variants){const store=memoryStorage([[SAVE_KEY,base()]]),before=[...store.data];assert.throws(()=>importSaveFile(store,text,base()));assert.deepEqual([...store.data],before);}
});

test('malformed pending tickets, cursors and one-cent ledger changes are rejected before import',()=>{
 const f=fixture();for(const mutate of [s=>s.legEconomy.through--,s=>s.legEconomy.overnight.journeys[0].fareCents++,s=>s.customerStrategy.through--,s=>s.strategy.rivals[0].network.through--,s=>s.tycoon.history[0].competition.rivals[0].legs[0].costCents++]){const g=structuredClone(f.game);mutate(g);const store=memoryStorage([[SAVE_KEY,base()]]);assert.throws(()=>importSaveFile(store,JSON.stringify(g),base()));assert.equal(store.length,1);}
});

test('incompatible immutable backup links and local key collisions reject before any mutation',()=>{
 const pack=JSON.parse(fullFile()),row=pack.snapshots.find(x=>x.key.includes(':rival-network:'));row.raw=base();assert.throws(()=>inspectSaveFile(JSON.stringify(pack)));
 const good=JSON.parse(fullFile()),store=memoryStorage([[SAVE_KEY,base()],[good.snapshots[0].key,'different exact bytes']]),before=[...store.data];assert.throws(()=>importSaveFile(store,JSON.stringify(good),base()),/Trùng mã/);assert.deepEqual([...store.data],before);
});

test('quota and silent write failures at archive, snapshot, rolling and main stages preserve the original career',()=>{
 for(const stage of ['archive','snapshot','rolling','main'])for(const mode of ['throw','silent']){const store=memoryStorage([[SAVE_KEY,base()]]),original=base(),write=store.setItem;store.setItem=(key,value)=>{const hit=stage==='archive'?key.startsWith(ARCHIVE_PREFIX):stage==='snapshot'?key.includes(':leg-economy:'):stage==='rolling'?key===BACKUP_KEY:key===SAVE_KEY;if(hit){if(mode==='throw')throw Error('quota');return;}write(key,value);};
 assert.throws(()=>importSaveFile(store,fullFile(),original));assert.equal(store.getItem(SAVE_KEY),original);assert.deepEqual(readSession(store).game,createGame());if(stage!=='archive')assert(listSaveEntries(store).entries.some(e=>e.raw===original&&e.reason==='import'));
 }
});

test('an interrupted import can retry using partial verified snapshots without overwriting existing ones',()=>{
 const store=memoryStorage([[SAVE_KEY,base()]]),write=store.setItem;store.setItem=(key,value)=>{if(key.includes(':slot-market:'))throw Error('interrupted');write(key,value);};assert.throws(()=>importSaveFile(store,fullFile(),base()));assert.equal(store.getItem(SAVE_KEY),base());const existing=[...store.data].filter(([k])=>k.includes(':leg-economy:'));store.setItem=write;const result=importSaveFile(store,fullFile(),base());assert.equal(result.raw,fixture().raw);for(const [k,v] of existing)assert.equal(store.getItem(k),v);
});

test('failed reset archives and final writes never replace a career; stale confirmation never writes',()=>{
 for(const stage of ['archive','main']){const store=activeStore(),old=store.getItem(SAVE_KEY),write=store.setItem;store.setItem=(k,v)=>{if(stage==='archive'?k.startsWith(ARCHIVE_PREFIX):k===SAVE_KEY)throw Error('quota');write(k,v);};assert.throws(()=>restartCareer(store,old));assert.equal(store.getItem(SAVE_KEY),old);}
 const store=activeStore(),raw=store.getItem(SAVE_KEY),before=[...store.data];assert.throws(()=>manageSave(store,raw,{kind:'restart',basis:raw+' '}),/xác nhận/);assert.throws(()=>importSaveFile(store,fullFile(),raw+' '),/tab khác/);assert.deepEqual([...store.data],before);
});

test('corrupt main bytes survive import, recovery and fresh-start replacement',()=>{
 for(const mode of ['import','recover','restart']){const store=memoryStorage([[SAVE_KEY,'broken exact bytes'],[BACKUP_KEY,base()]]);let r;if(mode==='import')r=importSaveFile(store,fullFile(),'broken exact bytes');else if(mode==='recover')r=recoverBackup(store,'broken exact bytes');else r=restartAfterDamage(store,'broken exact bytes');assert.equal(store.getItem(DAMAGED_KEY),'broken exact bytes');assert(listSaveEntries(store).entries.some(e=>e.raw==='broken exact bytes'&&e.removable));assert.deepEqual(readSession(store).game,r.game);}
});

test('all archive versions remain discoverable and can be exported independently',()=>{
 const store=activeStore(),raw=store.getItem(SAVE_KEY),a=restartCareer(store,raw),entry=readSaveEntry(store,a.archive);restoreSaveEntry(store,entry.key,entry.stored,a.raw);restartCareer(store,raw);const listing=listSaveEntries(store);assert.equal(listing.entries.filter(e=>e.reason==='restart').length,2);assert(listing.totalBytes>raw.length);
 const result=manageSave(store,store.getItem(SAVE_KEY),{kind:'entry-export',key:entry.key,stored:entry.stored,basis:store.getItem(SAVE_KEY)});assert.equal(inspectSaveFile(result.download.text).current,raw);assert.equal(inspectSaveFile(result.download.text).missing.length,0);
});

test('deleting an explicitly selected archive cannot delete current or immutable backups',()=>{
 const store=activeStore(),r=restartCareer(store,store.getItem(SAVE_KEY)),entry=readSaveEntry(store,r.archive),before=store.getItem(SAVE_KEY);for(const key of [SAVE_KEY,BACKUP_KEY,JSON.parse(fullFile()).snapshots[0].key])assert.throws(()=>removeSaveArchive(store,key,store.getItem(key),before));assert.throws(()=>removeSaveArchive(store,entry.key,entry.stored+' ',before));removeSaveArchive(store,entry.key,entry.stored,before);assert.equal(store.getItem(entry.key),null);assert.equal(store.getItem(SAVE_KEY),before);
});

test('selected backup revisions and corrupt archive records cannot be silently restored',()=>{
 const store=activeStore(),r=restartCareer(store,store.getItem(SAVE_KEY)),entry=readSaveEntry(store,r.archive);store.setItem(entry.key,JSON.stringify({...JSON.parse(entry.stored),raw:base()}));assert.throws(()=>restoreSaveEntry(store,entry.key,entry.stored,r.raw),/vừa thay đổi/);store.setItem(entry.key,'bad wrapper');assert(listSaveEntries(store).entries.find(e=>e.key===entry.key).error);assert.throws(()=>restoreSaveEntry(store,entry.key,'bad wrapper',r.raw));assert.equal(store.getItem(SAVE_KEY),r.raw);const downloaded=manageSave(store,r.raw,{kind:'entry-raw',key:entry.key,stored:'bad wrapper',basis:r.raw});assert.equal(downloaded.download.text,'bad wrapper');
});

test('serialized concurrent replacement accepts only the first matching revision',async()=>{
 let tail=Promise.resolve();const original=Object.getOwnPropertyDescriptor(globalThis.navigator,'locks');Object.defineProperty(globalThis.navigator,'locks',{configurable:true,value:{request:(_key,fn)=>{const job=tail.then(fn);tail=job.catch(()=>{});return job;}}});
 try{const store=activeStore(),raw=store.getItem(SAVE_KEY),results=await Promise.allSettled([withSaveLock(()=>restartCareer(store,raw)),withSaveLock(()=>importSaveFile(store,base(),raw))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);}finally{if(original)Object.defineProperty(globalThis.navigator,'locks',original);else delete globalThis.navigator.locks;}
});


test('new-career founding grant and identities occur once after reset and survive export/import',()=>{
 const store=activeStore(),old=store.getItem(SAVE_KEY);restartCareer(store,old);const setup={type:'setup',name:'Aurora Air',origin:'HAN',logo:'planet',color:'#123abc',models:['A320','B738']};const g=savedAction(store,setup);assert.equal(g.cash,500000000);assert.equal(g.economyVersion,2);assert.deepEqual(g.fleet.map(p=>p.id),['AA-101','AA-102']);assert.equal(g.legEconomy,undefined);const target=memoryStorage(),raw=store.getItem(SAVE_KEY);importSaveFile(target,exportSaveFile(store,raw).text,null);assert.deepEqual(restoreGame(target.getItem(SAVE_KEY)),g);assert.throws(()=>savedAction(target,setup));assert.equal(target.getItem(SAVE_KEY),raw);assert(listSaveEntries(store).entries.some(e=>e.reason==='restart'&&e.raw===old));
});

test('denied storage access rejects manager operations without changing memory',()=>{
 const store=activeStore(),raw=store.getItem(SAVE_KEY),before=[...store.data];store.getItem=()=>{throw Error('Storage denied');};for(const kind of ['list','export','import','restart','recover'])assert.throws(()=>manageSave(store,raw,{kind,basis:raw,text:base()}),/Storage denied/);assert.deepEqual([...store.data],before);
});

test('ordinary saves verify the rolling backup before committing the next career revision',()=>{
 const original=base(),next=transition(restoreGame(original),{type:'advance'});assert(!next.error,next.error);
 for(const stage of ['backup','main'])for(const mode of ['throw','silent',...(stage==='backup'?['truncated']:[])]){
  const store=memoryStorage([[SAVE_KEY,original]]),write=store.setItem;
  store.setItem=(key,value)=>{if(key===(stage==='backup'?BACKUP_KEY:SAVE_KEY)){
   if(mode==='throw')throw Error('Injected storage failure');
   if(mode==='truncated')write(key,'truncated backup');return;
  }write(key,value);};
  assert.throws(()=>persistGame(store,next.game,original),undefined,`${stage}/${mode} must reject`);
  assert.equal(store.getItem(SAVE_KEY),original,`${stage}/${mode} must preserve the active revision`);
  assert.deepEqual(readSession(store).game,restoreGame(original));
 }
});
