import {validMigrationId} from './live-leg-economy.js';
import {SAVE_KEY,createGame,restoreGame,transition} from './game.js';
export const BACKUP_KEY=SAVE_KEY+':backup',DAMAGED_KEY=SAVE_KEY+':damaged',WRITER_LOCK=SAVE_KEY+':writer';
export function readSession(storage){
 try{const raw=storage.getItem(SAVE_KEY);if(raw===null)return {game:createGame(),raw,blocked:false};try{return {game:restoreGame(raw),raw,blocked:false};}catch{
  let backup=null;try{const value=storage.getItem(BACKUP_KEY);if(value)backup=restoreGame(value);}catch{}
  return {game:createGame(),raw,blocked:true,backup,warning:'Bản lưu chính không đọc được. Dữ liệu gốc được giữ nguyên; chọn khôi phục bản dự phòng hoặc tải bản lỗi về.'};
 }}catch{return {game:createGame(),raw:null,blocked:true,warning:'Không truy cập được bộ nhớ trình duyệt. Bật quyền lưu trữ rồi thử lại.'};}
}
export const legBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid migration backup ID');return SAVE_KEY+':leg-economy:'+id;};
function writeVerified(storage,key,raw){storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Không xác minh được bản lưu. Tiến trình chưa được chuyển đổi.');}
export function readLegBackup(storage,game){
 const e=game.legEconomy;if(!e)throw Error('Chưa bật kinh tế theo chặng.');const raw=storage.getItem(legBackupKey(e.migrationId));
 if(raw===null)throw Error('Không tìm thấy bản trước chuyển đổi trên thiết bị này. Giữ tiến trình hiện tại và dùng bản đã tải về.');
 const backup=restoreGame(raw);if(backup.legEconomy||backup.day!==e.enabledDay)throw Error('Bản trước chuyển đổi không hợp lệ.');return {raw,game:backup};
}
export function rollbackLegEconomy(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readLegBackup(storage,current);
 // Archive the entire live branch before restoring the immutable migration snapshot.
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,legBackupKey(current.legEconomy.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về bản trước chuyển đổi, ngày '+backup.game.day+'. Nhánh theo chặng đã được lưu riêng.'};
}
export const overnightBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid migration backup ID');return SAVE_KEY+':overnight:'+id;};
export function readOvernightBackup(storage,game){
 const e=game.legEconomy?.overnight;if(!e)throw Error('Chưa bật vé qua đêm.');const raw=storage.getItem(overnightBackupKey(e.migrationId));
 if(raw===null)throw Error('Không tìm thấy bản trước JET-202 trên thiết bị này. Giữ tiến trình hiện tại và dùng bản đã tải về.');
 const backup=restoreGame(raw);if(!backup.legEconomy||backup.legEconomy.overnight||backup.legEconomy.migrationId!==game.legEconomy.migrationId||backup.day!==e.enabledDay)throw Error('Bản trước JET-202 không hợp lệ.');return {raw,game:backup};
}
export function rollbackOvernight(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readOvernightBackup(storage,current);
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,overnightBackupKey(current.legEconomy.overnight.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về bản trước JET-202, ngày '+backup.game.day+'. Nhánh vé qua đêm đã được lưu riêng.'};
}
export const advanceBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid migration backup ID');return SAVE_KEY+':advance-sales:'+id;};
export function readAdvanceBackup(storage,game){
 const a=game.legEconomy?.advance;if(!a)throw Error('Chưa bật bán vé trước.');const raw=storage.getItem(advanceBackupKey(a.migrationId));
 if(raw===null)throw Error('Không tìm thấy bản trước JET-209 trên thiết bị này. Giữ tiến trình hiện tại và dùng bản đã tải về.');
 const backup=restoreGame(raw);if(!backup.legEconomy||backup.legEconomy.advance||backup.legEconomy.migrationId!==game.legEconomy.migrationId||backup.day!==a.enabledDay)throw Error('Bản trước JET-209 không hợp lệ.');return {raw,game:backup};
}
export function rollbackAdvance(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readAdvanceBackup(storage,current);
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,advanceBackupKey(current.legEconomy.advance.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về bản trước JET-209, ngày '+backup.game.day+'. Nhánh bán vé trước đã được lưu riêng.'};
}
export const slotMarketBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid slot migration backup ID');return SAVE_KEY+':slot-market:'+id;};
export function readSlotMarketBackup(storage,game){
 const market=game.slotMarket;if(!market)throw Error('Chưa bật thị trường slot chung.');
 const raw=storage.getItem(slotMarketBackupKey(market.migrationId));if(raw===null)throw Error('Không tìm thấy bản trước JET-204 trên thiết bị này.');
 const backup=restoreGame(raw);if(backup.slotMarket||backup.day!==market.enabledDay||backup.legEconomy?.migrationId!==game.legEconomy.migrationId||!backup.strategy)throw Error('Bản trước JET-204 không hợp lệ.');return {raw,game:backup};
}
export function rollbackSlotMarket(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readSlotMarketBackup(storage,current);
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,slotMarketBackupKey(current.slotMarket.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về toàn bộ bản trước JET-204, ngày '+backup.game.day+'. Nhánh slot chung đã được lưu riêng.'};
}
export const customerBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid customer migration backup ID');return SAVE_KEY+':customer-strategy:'+id;};
export function readCustomerBackup(storage,game){
 const p=game.customerStrategy;if(!p)throw Error('Chưa bật JET-205.');
 const raw=storage.getItem(customerBackupKey(p.migrationId));if(raw===null)throw Error('Không tìm thấy bản trước JET-205 trên thiết bị này.');
 const backup=restoreGame(raw);if(backup.customerStrategy||backup.day!==p.enabledDay||backup.legEconomy?.migrationId!==game.legEconomy.migrationId||!backup.strategy)throw Error('Bản trước JET-205 không hợp lệ.');return {raw,game:backup};
}
export function rollbackCustomers(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readCustomerBackup(storage,current);
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,customerBackupKey(current.customerStrategy.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về toàn bộ bản trước JET-205, ngày '+backup.game.day+'. Nhánh chiến lược khách đã được lưu riêng.'};
}
export const rivalNetworkBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid rival network migration ID');return SAVE_KEY+':rival-network:'+id;};
export function readRivalNetworkBackup(storage,game){
 const p=game.strategy?.expansion;if(!p)throw Error('Chưa bật JET-206.');
 const raw=storage.getItem(rivalNetworkBackupKey(p.migrationId));if(raw===null)throw Error('Không tìm thấy bản trước JET-206 trên thiết bị này.');
 const backup=restoreGame(raw);if(backup.strategy?.expansion||backup.day!==p.enabledDay||backup.legEconomy?.migrationId!==game.legEconomy.migrationId||backup.slotMarket?.migrationId!==game.slotMarket.migrationId)throw Error('Bản trước JET-206 không hợp lệ.');return {raw,game:backup};
}
export function rollbackRivalNetwork(storage,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi khôi phục.');
 const current=restoreGame(expected),backup=readRivalNetworkBackup(storage,current);
 archiveSave(storage,expected,'rollback');
 writeVerified(storage,rivalNetworkBackupKey(current.strategy.expansion.migrationId)+':rollback',expected);
 writeVerified(storage,BACKUP_KEY,expected);writeVerified(storage,SAVE_KEY,backup.raw);
 return {...backup,message:'Đã trở về toàn bộ bản trước JET-206, ngày '+backup.game.day+'. Nhánh AI mở rộng được lưu riêng.'};
}
export const slotReservationBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid slot reservation migration ID');return SAVE_KEY+':slot-reservation:'+id;};
export function readSlotReservationBackup(storage,game){
 const p=game.slotMarket?.conditional;if(!p)throw Error('Chưa bật điều khoản quyền mới.');
 const raw=storage.getItem(slotReservationBackupKey(p.migrationId));if(raw===null)throw Error('Không tìm thấy backup trước điều khoản quyền mới.');
 const g=restoreGame(raw);if(g.slotMarket?.version!==1||g.slotMarket.migrationId!==game.slotMarket.migrationId||g.day!==p.enabledDay||JSON.stringify(g.slotMarket.rights.player)!==JSON.stringify(p.grandfathered))throw Error('Backup điều khoản quyền mới không khớp.');
 return {raw,game:g};
}
export const slotUtilizationBackupKey=id=>{if(!validMigrationId(id))throw Error('Invalid slot utilization migration ID');return SAVE_KEY+':slot-utilization:'+id;};
export function readSlotUtilizationBackup(storage,game){
 const u=game.slotMarket?.utilization;if(!u)throw Error('Chưa bật điều kiện khai thác thực tế.');
 const raw=storage.getItem(slotUtilizationBackupKey(u.migrationId));if(raw===null)throw Error('Không tìm thấy backup trước điều kiện khai thác thực tế.');
 const g=restoreGame(raw);if(g.slotMarket?.version!==2||g.slotMarket.migrationId!==game.slotMarket.migrationId||g.day!==u.enabledDay||JSON.stringify(g.slotMarket.rights.player)!==JSON.stringify(u.grandfathered))throw Error('Backup điều kiện khai thác không khớp.');
 return {raw,game:g};
}
export function persistGame(storage,game,expected){
 if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi tiếp tục.');
 const raw=JSON.stringify(game),next=restoreGame(raw),previous=expected===null?null:restoreGame(expected);
 if(next.legEconomy&&!previous?.legEconomy){
  if(!previous)throw Error('Lưu hãng hiện tại trước khi bật kinh tế theo chặng.');
  const before=structuredClone(next);delete before.legEconomy;
  if(JSON.stringify(before)!==JSON.stringify(previous)||next.legEconomy.rounds.length||next.legEconomy.enabledDay!==previous.day)throw Error('Chuyển đổi phải giữ nguyên toàn bộ tiến trình hiện tại.');
  const key=legBackupKey(next.legEconomy.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(previous?.legEconomy&&(!next.legEconomy||next.legEconomy.migrationId!==previous.legEconomy.migrationId))throw Error('Không được xóa hoặc thay mã sổ chặng; dùng Save Manager hoặc khôi phục bản trước chuyển đổi.');
 const overnight=next.legEconomy?.overnight,old=previous?.legEconomy?.overnight;
 if(overnight&&!old){
  if(!previous?.legEconomy)throw Error('Lưu kinh tế theo chặng trước khi bật JET-202.');
  const before=structuredClone(next);delete before.legEconomy.overnight;
  if(previous.connectionProgram===undefined)delete before.connectionProgram;else before.connectionProgram=previous.connectionProgram;
  if(JSON.stringify(before)!==JSON.stringify(previous)||overnight.journeys.length||overnight.refundsPaidToday||overnight.enabledDay!==previous.day||!next.connectionProgram.enabled||next.connectionProgram.minimum!==60||next.connectionProgram.maximum!==1440)throw Error('JET-202 phải giữ nguyên tiến trình trước chuyển đổi.');
  const key=overnightBackupKey(overnight.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(old&&(!overnight||overnight.migrationId!==old.migrationId))throw Error('Không được xóa hoặc thay mã sổ vé qua đêm; dùng khôi phục bản trước chuyển đổi.');
 const advance=next.legEconomy?.advance,oldAdvance=previous?.legEconomy?.advance;
 if(advance&&!oldAdvance){
  if(!previous?.legEconomy)throw Error('Lưu kinh tế theo chặng trước khi bật JET-209.');
  const before=structuredClone(next);delete before.legEconomy.advance;
  if(JSON.stringify(before)!==JSON.stringify(previous)||advance.bookings.length||advance.liabilityCents||advance.enabledDay!==previous.day)throw Error('JET-209 phải giữ nguyên tiến trình trước chuyển đổi.');
  const key=advanceBackupKey(advance.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(oldAdvance&&(!advance||advance.migrationId!==oldAdvance.migrationId||advance.enabledDay!==oldAdvance.enabledDay))throw Error('Không được xóa hoặc thay mã sổ bán vé trước; dùng khôi phục bản trước chuyển đổi.');
 const market=next.slotMarket,oldMarket=previous?.slotMarket;
 if(market&&!oldMarket){
  if(!previous?.legEconomy||!previous.strategy)throw Error('Lưu JET-201 và AI trước khi bật thị trường slot.');
  const result=transition(previous,{type:'slot-market-enable',airports:market.airports,migrationId:market.migrationId,quotedFee:previous.cash-next.cash});
  if(result.error||JSON.stringify(result.game)!==JSON.stringify(next))throw Error('JET-204 chỉ được mua quyền bảo toàn lịch; giữ nguyên toàn bộ tiến trình khác.');
  const key=slotMarketBackupKey(market.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(oldMarket&&(!market||market.migrationId!==oldMarket.migrationId||market.enabledDay!==oldMarket.enabledDay||JSON.stringify(market.airports)!==JSON.stringify(oldMarket.airports)))throw Error('Không được xóa hoặc đổi thị trường slot đã bật; dùng khôi phục bản trước chuyển đổi.');
 const customers=next.customerStrategy,oldCustomers=previous?.customerStrategy;
 if(customers&&!oldCustomers){
  if(!previous?.legEconomy?.overnight||!previous.strategy)throw Error('Lưu JET-201, JET-202 và AI trước khi bật JET-205.');
  const result=transition(previous,{type:'customer-enable',objective:customers.objective,migrationId:customers.migrationId});
  if(result.error||JSON.stringify(result.game)!==JSON.stringify(next))throw Error('JET-205 phải giữ nguyên tiến trình ngoài phí kích hoạt đã công bố.');
  const key=customerBackupKey(customers.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(oldCustomers&&(!customers||customers.migrationId!==oldCustomers.migrationId||customers.enabledDay!==oldCustomers.enabledDay))throw Error('Không được xóa hoặc đổi lịch sử JET-205; dùng khôi phục bản trước chuyển đổi.');
 const expansion=next.strategy?.expansion,oldExpansion=previous?.strategy?.expansion;
 if(expansion&&!oldExpansion){
  if(!previous?.slotMarket||!previous.legEconomy||!previous.strategy)throw Error('Lưu sổ chặng, AI và thị trường slot trước khi bật JET-206.');
  const result=transition(previous,{type:'rival-network-enable',migrationId:expansion.migrationId});
  if(result.error||JSON.stringify(result.game)!==JSON.stringify(next))throw Error('JET-206 phải giữ nguyên tiền, lịch, đội bay và nghĩa vụ cũ.');
  const key=rivalNetworkBackupKey(expansion.migrationId),existing=storage.getItem(key);
  if(existing!==null&&existing!==expected)throw Error('Mã bản dự phòng đã được sử dụng. Thử bật lại.');
  writeVerified(storage,key,expected);
 }else if(oldExpansion&&(!expansion||expansion.migrationId!==oldExpansion.migrationId||expansion.enabledDay!==oldExpansion.enabledDay||JSON.stringify(expansion.shortlist)!==JSON.stringify(oldExpansion.shortlist)))throw Error('Không được xóa hoặc đổi mạng AI đã bật; dùng khôi phục bản trước chuyển đổi.');
 const reservation=next.slotMarket?.conditional,oldReservation=previous?.slotMarket?.conditional;
 if(reservation&&!oldReservation){
  if(!previous?.slotMarket||previous.slotMarket.version!==1)throw Error('Lưu thị trường slot cũ trước khi bật điều khoản quyền mới.');
  const r=transition(previous,{type:'slot-reservation-enable',migrationId:reservation.migrationId,acceptTerms:true});
  if(r.error||JSON.stringify(r.game)!==JSON.stringify(next))throw Error('Bật điều khoản phải giữ nguyên quyền, tiền và toàn bộ lịch cũ.');
  const key=slotReservationBackupKey(reservation.migrationId),existing=storage.getItem(key);if(existing!==null&&existing!==expected)throw Error('Mã backup điều khoản đã được sử dụng.');writeVerified(storage,key,expected);
 }else if(oldReservation&&(!reservation||reservation.version!==oldReservation.version||reservation.migrationId!==oldReservation.migrationId||reservation.enabledDay!==oldReservation.enabledDay||JSON.stringify(reservation.grandfathered)!==JSON.stringify(oldReservation.grandfathered)))throw Error('Không được xóa hoặc đổi điều khoản quyền mới; dùng Save Manager để khôi phục toàn bộ bản trước opt-in.');
 const usage=next.slotMarket?.utilization,oldUsage=previous?.slotMarket?.utilization;
 if(usage&&!oldUsage){
  const r=previous&&transition(previous,{type:'slot-utilization-enable',migrationId:usage.migrationId,acceptTerms:true});
  if(!r||r.error||JSON.stringify(r.game)!==JSON.stringify(next))throw Error('Bật điều kiện khai thác phải giữ nguyên quyền, tiền và lịch.');
  const key=slotUtilizationBackupKey(usage.migrationId),existing=storage.getItem(key);if(existing!==null&&existing!==expected)throw Error('Mã backup khai thác đã được sử dụng.');writeVerified(storage,key,expected);
 }else if(oldUsage&&(!usage||usage.version!==oldUsage.version||usage.migrationId!==oldUsage.migrationId||usage.enabledDay!==oldUsage.enabledDay||JSON.stringify(usage.grandfathered)!==JSON.stringify(oldUsage.grandfathered)))throw Error('Không được xóa hoặc đổi điều kiện khai thác; khôi phục toàn bộ backup bằng Save Manager.');
 if(expected!==null){restoreGame(expected);writeVerified(storage,BACKUP_KEY,expected);}
 writeVerified(storage,SAVE_KEY,raw);return raw;
}
export function recoverBackup(storage,expected){
 const raw=storage.getItem(BACKUP_KEY);if(!raw)throw Error('Chưa có bản dự phòng.');
 return replaceCareer(storage,raw,expected,'recovery');
}
export function restartAfterDamage(storage,expected){return restartCareer(storage,expected);}

let lockDatabase;
export async function withSaveLock(work){
 if(globalThis.navigator?.locks)return navigator.locks.request(WRITER_LOCK,work);
 // In insecure local previews Web Locks is absent; an IndexedDB read/write
 // transaction serializes the same synchronous compare-and-write section.
 if(!globalThis.indexedDB)throw Error('Trình duyệt không hỗ trợ lưu phiên an toàn.');
 lockDatabase??=new Promise((resolve,reject)=>{const request=indexedDB.open(SAVE_KEY+'-coordination',1);request.onblocked=()=>reject(Error('Bộ nhớ đang bận ở tab khác. Đóng tab cũ rồi thử lại.'));request.onupgradeneeded=()=>request.result.createObjectStore('mutex');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Không mở được bộ nhớ điều phối.'));}).catch(error=>{lockDatabase=null;throw error;});
 const db=await lockDatabase;
 return new Promise((resolve,reject)=>{const tx=db.transaction('mutex','readwrite'),request=tx.objectStore('mutex').get('writer');let result,done=false;
  request.onsuccess=()=>{try{result=work();done=true;}catch(error){tx.abort();reject(error);}};
  tx.oncomplete=()=>resolve(result);tx.onerror=()=>done?resolve(result):reject(Error('Chưa khóa được phiên lưu.'));tx.onabort=()=>{if(done)resolve(result);};
 });
}

// Save Manager uses the same synchronous critical section as ordinary saves.
// Immutable snapshots and archives are verified first; the main key commits last.
export const SAVE_FILE_LIMIT=16*1024*1024,ARCHIVE_PREFIX=SAVE_KEY+':archive:';
const SNAPSHOT_LIMIT=64,FORMAT='jetrise-save',REASONS=['import','restart','recovery','rollback','restore','package-backup'];
const bytes=s=>new TextEncoder().encode(s).length;
const revision=(storage,expected)=>{if(storage.getItem(SAVE_KEY)!==expected)throw Error('Tiến độ đã thay đổi ở tab khác. Tải bản mới nhất trước khi tiếp tục.');};
const snapshotKey=key=>typeof key==='string'&&['leg-economy','overnight','advance-sales','slot-market','slot-reservation','slot-utilization','customer-strategy','rival-network'].some(kind=>key.startsWith(SAVE_KEY+':'+kind+':')&&validMigrationId(key.slice((SAVE_KEY+':'+kind+':').length)));
const refs=g=>[
 g.legEconomy&&{key:legBackupKey(g.legEconomy.migrationId),label:'Trước JET-201',read:readLegBackup},
 g.legEconomy?.overnight&&{key:overnightBackupKey(g.legEconomy.overnight.migrationId),label:'Trước JET-202',read:readOvernightBackup},
 g.legEconomy?.advance&&{key:advanceBackupKey(g.legEconomy.advance.migrationId),label:'Trước JET-209',read:readAdvanceBackup},
 g.slotMarket&&{key:slotMarketBackupKey(g.slotMarket.migrationId),label:'Trước JET-204',read:readSlotMarketBackup},
 g.slotMarket?.conditional&&{key:slotReservationBackupKey(g.slotMarket.conditional.migrationId),label:'Trước điều khoản quyền mới',read:readSlotReservationBackup},
 g.slotMarket?.utilization&&{key:slotUtilizationBackupKey(g.slotMarket.utilization.migrationId),label:'Trước điều kiện khai thác thực tế',read:readSlotUtilizationBackup},
 g.customerStrategy&&{key:customerBackupKey(g.customerStrategy.migrationId),label:'Trước JET-205',read:readCustomerBackup},
 g.strategy?.expansion&&{key:rivalNetworkBackupKey(g.strategy.expansion.migrationId),label:'Trước JET-206',read:readRivalNetworkBackup}
].filter(Boolean);
export function saveSummary(raw){const g=restoreGame(raw);return {founded:g.setupComplete,name:g.airline.name,day:g.day,cash:g.cash,fleet:g.fleet.length,routes:g.openedRoutes.length,schedules:g.tycoon.schedules.length,economy:g.economyVersion,features:[g.legEconomy&&'JET-201',g.legEconomy?.overnight&&'JET-202',g.legEconomy?.disruptions&&'JET-203',g.legEconomy?.advance&&'JET-209',g.slotMarket&&'JET-204',g.customerStrategy&&'JET-205',g.strategy?.expansion&&'JET-206',g.slotMarket?.conditional&&'Quyền mới có điều kiện',g.slotMarket?.utilization&&'Khai thác slot 14 ngày'].filter(Boolean)};}
function collectSnapshots(current,previous,lookup,strict){
 const queue=[current,...(previous?[previous]:[])],seen=new Set(),snapshots=new Map(),missing=new Map();
 while(queue.length){const g=restoreGame(queue.shift());for(const ref of refs(g)){
  const raw=lookup(ref.key);if(raw===null){missing.set(ref.key,ref.label);continue;}
  try{ref.read({getItem:lookup},g);}catch(error){if(strict)throw Error(ref.label+': '+error.message);missing.set(ref.key,ref.label+' (hỏng hoặc không khớp)');continue;}
  if(seen.has(ref.key))continue;seen.add(ref.key);if(seen.size>SNAPSHOT_LIMIT)throw Error('Gói có quá nhiều bản dự phòng.');snapshots.set(ref.key,raw);queue.push(raw);
 }}return {snapshots:[...snapshots].map(([key,raw])=>({key,raw})),missing:[...missing.values()]};
}
export function inspectSaveFile(text){
 if(typeof text!=='string'||bytes(text)>SAVE_FILE_LIMIT)throw Error('File save phải nhỏ hơn hoặc bằng 16 MiB.');
 let value;try{value=JSON.parse(text);}catch{throw Error('File không phải JSON hợp lệ.');}
 let current=text,previous=null,snapshots=[];
 if(value?.format!==undefined){
  if(value.format!==FORMAT||value.version!==1)throw Error('Định dạng hoặc phiên bản gói save chưa được hỗ trợ.');
  if(typeof value.current!=='string'||!(value.previous===null||typeof value.previous==='string')||!Array.isArray(value.snapshots)||value.snapshots.length>SNAPSHOT_LIMIT)throw Error('Cấu trúc gói save không hợp lệ.');
  current=value.current;previous=value.previous;snapshots=value.snapshots;
 }
 const game=restoreGame(current);if(previous!==null)restoreGame(previous);
 const map=new Map();for(const row of snapshots){if(!row||!snapshotKey(row.key)||typeof row.raw!=='string'||map.has(row.key))throw Error('Khóa backup không hợp lệ hoặc bị lặp.');restoreGame(row.raw);map.set(row.key,row.raw);}
 const graph=collectSnapshots(current,previous,key=>map.get(key)??null,true);
 if(graph.snapshots.length!==map.size)throw Error('Gói có backup không thuộc các career được nhập.');
 return {current,previous,snapshots:graph.snapshots,missing:graph.missing,summary:saveSummary(current),game,package:value?.format===FORMAT};
}
export function exportSaveFile(storage,raw,includePrevious=true){
 restoreGame(raw);let previous=includePrevious?storage.getItem(BACKUP_KEY):null;
 if(previous===raw)previous=null;if(previous!==null){try{restoreGame(previous);}catch{previous=null;}}
 const graph=collectSnapshots(raw,previous,key=>storage.getItem(key),false);
 const text=JSON.stringify({format:FORMAT,version:1,exportedAt:new Date().toISOString(),current:raw,previous,snapshots:graph.snapshots});
 if(bytes(text)>SAVE_FILE_LIMIT)throw Error('Gói vượt 16 MiB. Tải riêng save hiện tại và các bản dự phòng.');
 return {text,missing:graph.missing,bytes:bytes(text),summary:saveSummary(raw),snapshots:graph.snapshots.length};
}
export function archiveSave(storage,raw,reason){
 if(raw===null)return null;if(typeof raw!=='string'||!REASONS.includes(reason))throw Error('Bản lưu trữ không hợp lệ.');
 const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),key=ARCHIVE_PREFIX+id;
 if(storage.getItem(key)!==null)throw Error('Trùng mã bản lưu trữ. Thử lại.');
 writeVerified(storage,key,JSON.stringify({version:1,createdAt:new Date().toISOString(),reason,raw}));return key;
}
function replaceCareer(storage,raw,expected,reason){
 revision(storage,expected);const game=restoreGame(raw),archive=archiveSave(storage,expected,reason);
 if(expected!==null){let valid=true;try{restoreGame(expected);}catch{valid=false;}writeVerified(storage,valid?BACKUP_KEY:DAMAGED_KEY,expected);}
 writeVerified(storage,SAVE_KEY,raw);return {game,raw,archive,message:reason==='restart'?'Đã lưu trữ hãng cũ và bắt đầu hãng mới.':'Đã khôi phục toàn bộ career; tiến độ trước đó được lưu riêng.'};
}
export function restartCareer(storage,expected){return replaceCareer(storage,JSON.stringify(createGame()),expected,'restart');}
export function importSaveFile(storage,text,expected){
 revision(storage,expected);const file=inspectSaveFile(text);
 // Preflight every collision before any archive or snapshot write.
 for(const row of file.snapshots){const existing=storage.getItem(row.key);if(existing!==null&&existing!==row.raw)throw Error('Trùng mã backup nhưng khác dữ liệu. Bản hiện tại được giữ nguyên; không thể nhập đè backup bất biến.');}
 // Archive first so a quota failure never leaves an unprotected current career.
 const archive=archiveSave(storage,expected,'import');
 for(const row of file.snapshots)if(storage.getItem(row.key)===null)writeVerified(storage,row.key,row.raw);
 if(file.previous!==null&&file.previous!==expected&&file.previous!==file.current)archiveSave(storage,file.previous,'package-backup');
 if(expected!==null){let valid=true;try{restoreGame(expected);}catch{valid=false;}writeVerified(storage,valid?BACKUP_KEY:DAMAGED_KEY,expected);}
 writeVerified(storage,SAVE_KEY,file.current);
 return {game:file.game,raw:file.current,archive,message:'Đã nhập career '+file.summary.name+' · ngày '+file.summary.day+'. Tiến độ trước đó được lưu riêng.'};
}
function managedKey(key){return key===BACKUP_KEY||key===DAMAGED_KEY||snapshotKey(key)||typeof key==='string'&&key.endsWith(':rollback')&&snapshotKey(key.slice(0,-9))||typeof key==='string'&&key.startsWith(ARCHIVE_PREFIX)&&validMigrationId(key.slice(ARCHIVE_PREFIX.length));}
export function readSaveEntry(storage,key){
 if(!managedKey(key))throw Error('Không phải bản lưu do JETRISE quản lý.');const stored=storage.getItem(key);if(stored===null)throw Error('Bản lưu này không còn trên thiết bị.');
 let raw=stored,reason=null,createdAt=null;
 if(key.startsWith(ARCHIVE_PREFIX)){let a;try{a=JSON.parse(stored);}catch{throw Error('Bản lưu trữ bị hỏng.');}if(!a||a.version!==1||typeof a.raw!=='string'||!REASONS.includes(a.reason)||typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt)))throw Error('Bản lưu trữ không hợp lệ.');raw=a.raw;reason=a.reason;createdAt=a.createdAt;}
 let summary=null,error=null;try{summary=saveSummary(raw);}catch(e){error=e.message;}
 return {key,stored,raw,summary,error,reason,createdAt,bytes:bytes(stored),removable:key.startsWith(ARCHIVE_PREFIX),label:key===BACKUP_KEY?'Phiên lưu trước':key===DAMAGED_KEY?'Dữ liệu lỗi được giữ lại':key.startsWith(ARCHIVE_PREFIX)?'Bản lưu trữ':key.endsWith(':rollback')?'Nhánh sau rollback':'Backup trước '+({'leg-economy':'JET-201','overnight':'JET-202','advance-sales':'JET-209','slot-market':'JET-204','slot-reservation':'điều khoản quyền mới','slot-utilization':'điều kiện khai thác thực tế','customer-strategy':'JET-205','rival-network':'JET-206'}[key.slice((SAVE_KEY+':').length).split(':')[0]]||'chuyển đổi')};
}
export function listSaveEntries(storage){
 const entries=[];let totalBytes=0;
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key===SAVE_KEY){const raw=storage.getItem(key);if(raw!==null)totalBytes+=bytes(raw);continue;}if(!managedKey(key))continue;
  try{const entry=readSaveEntry(storage,key);entries.push(entry);totalBytes+=entry.bytes;}catch(e){const stored=storage.getItem(key);if(stored!==null){totalBytes+=bytes(stored);entries.push({key,stored,raw:stored,summary:null,error:e.message,label:'Bản lưu không đọc được',removable:key.startsWith(ARCHIVE_PREFIX),bytes:bytes(stored)});}}
 }
 entries.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||a.key.localeCompare(b.key));return {entries,totalBytes};
}
export function restoreSaveEntry(storage,key,stored,expected){
 revision(storage,expected);const entry=readSaveEntry(storage,key);if(entry.stored!==stored)throw Error('Bản dự phòng vừa thay đổi. Tải lại danh sách.');if(entry.error)throw Error('Bản dự phòng không hợp lệ: '+entry.error);
 return replaceCareer(storage,entry.raw,expected,'restore');
}
export function removeSaveArchive(storage,key,stored,expected){
 revision(storage,expected);if(typeof key!=='string'||!key.startsWith(ARCHIVE_PREFIX)||!managedKey(key))throw Error('Không được xóa save chính hoặc backup chuyển đổi.');
 if(storage.getItem(key)!==stored)throw Error('Bản lưu trữ vừa thay đổi. Tải lại danh sách.');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Không xác minh được việc xóa bản lưu trữ.');
 return {message:'Đã xóa bản lưu trữ được chọn; save hiện tại và backup chuyển đổi được giữ nguyên.'};
}

export function manageSave(storage,expected,action){
 revision(storage,expected);if(action.basis!==expected)throw Error('Tiến độ đã đổi từ lúc mở bản xem trước. Kiểm tra và xác nhận lại.');
 if(action.kind==='list')return {...listSaveEntries(storage),current:expected===null?null:(()=>{try{return saveSummary(expected);}catch{return null;}})()};
 if(action.kind==='restart')return restartCareer(storage,expected);
 if(action.kind==='recover')return recoverBackup(storage,expected);
 if(action.kind==='import')return importSaveFile(storage,action.text,expected);
 if(action.kind==='restore')return restoreSaveEntry(storage,action.key,action.stored,expected);
 if(action.kind==='delete')return removeSaveArchive(storage,action.key,action.stored,expected);
 if(['export','raw','entry-export','entry-raw'].includes(action.kind)){
  let raw=expected;if(action.kind.startsWith('entry-')){if(!managedKey(action.key)||storage.getItem(action.key)!==action.stored)throw Error('Bản dự phòng vừa thay đổi. Tải lại danh sách.');try{raw=readSaveEntry(storage,action.key).raw;}catch(e){if(action.kind!=='entry-raw')throw e;raw=action.stored;}}
  if(raw===null)throw Error('Chưa có tiến độ được lưu.');
  if(action.kind.endsWith('raw'))return {download:{text:raw,name:'jetrise-save-original.json'},message:'Đã yêu cầu tải dữ liệu gốc. Giữ file ở nơi an toàn.'};
  const bundle=exportSaveFile(storage,raw,action.kind==='export');return {download:{text:bundle.text,name:'jetrise-save-day-'+bundle.summary.day+'.json'},message:'Đã yêu cầu tải gói save · '+bundle.snapshots+' backup chuyển đổi.'+(bundle.missing.length?' Không kèm: '+bundle.missing.join(', ')+'.':'')};
 }
 throw Error('Thao tác Save Manager không hợp lệ.');
}
