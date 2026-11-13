// Read only: historical reports, never current schedules or reconstructed forecasts.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const sum = values => values.every(finite) ? values.reduce((n, v) => n + v, 0) : null;
const value = (r, key) => finite(r[key]) ? r[key] : null;
const optional = (r, key) => r[key] === undefined ? 0 : value(r, key);
export function reportBridge(r) {
 const pnl = [
  ['revenue', 'Doanh thu', value(r, 'revenue')],
  ['nonfuel', 'Khai thác, quản trị & bảo dưỡng', finite(r.nonfuel) ? -r.nonfuel : null],
  ['fuelCost', 'Giá vốn nhiên liệu', finite(r.fuelCost) ? -r.fuelCost : null],
  ['co2Cost', 'Giá vốn CO₂', finite(r.co2Cost) ? -r.co2Cost : null]
 ];
 const stock = sum([value(r,'fuelCost'),value(r,'co2Cost'),finite(r.fuelPurchase)?-r.fuelPurchase:null,finite(r.co2Purchase)?-r.co2Purchase:null]);
 const adjustments = [
  ['stock', 'Giá vốn trừ tiền mua kho / cấp trước', stock],
  ...(r.legAccounting ? [
   ['deferred', 'Thay đổi doanh thu chưa thực hiện', value(r,'deferredRevenueDelta')],
   ['prepaidFlight', 'Trừ tăng chi phí phi nhiên liệu trả trước', finite(r.prepaidNonfuelDelta)?-r.prepaidNonfuelDelta:null]
  ] : []),
  ['maintenance', 'Bảo dưỡng đã trả trước khi chốt', finite(r.maintenancePrepaid)?r.maintenancePrepaid:finite(r.maintenanceCost)?r.maintenanceCost:null],
  ['disruption', 'Xử lý sự cố đã trả trước', optional(r,'disruptionPrepaid')],
  ['rent', 'Lease đã trả trước', optional(r,'prepaidRent')],
  ['principal', 'Trừ gốc vay', finite(r.principal)?-r.principal:null],
  ['deposit', 'Hoàn cọc lease', optional(r,'leaseRefunds')]
 ];
 const pnlSum=sum(pnl.map(x=>x[2])),cashSum=sum([value(r,'profit'),...adjustments.map(x=>x[2])]);
 return {pnl,adjustments,profit:value(r,'profit'),cash:value(r,'cashDelta'),
  profitResidual:pnlSum===null||!finite(r.profit)?null:r.profit-pnlSum,
  cashResidual:cashSum===null||!finite(r.cashDelta)?null:r.cashDelta-cashSum};
}
function groups(reports, kind) {
 const result=new Map();
 for(const r of reports) {
  if(kind==='aircraft') {
   if(!r.aircraft||!Object.values(r.aircraft).every(x=>finite(x.profit)))return null;
   for(const [id,x] of Object.entries(r.aircraft))result.set(id,(result.get(id)||0)+x.profit);
  } else {
   if(!Array.isArray(r.legEvents)||!r.legEvents.every(x=>Number.isInteger(x.route)&&finite(x.revenue)&&finite(x.cost)))return null;
   for(const x of r.legEvents)result.set(x.route,(result.get(x.route)||0)+x.revenue-x.cost);
  }
 }
 return result;
}
export function profitReview(history, days=1) {
 if(![1,7].includes(days))throw Error('Unsupported review period');
 const latest=Math.max(0,...history.filter(r=>Number.isInteger(r.day)).map(r=>r.day));
 const window=end=>Array.from({length:days},(_,i)=>history.filter(r=>r.day===end-days+1+i));
 const current=window(latest),previous=window(latest-days);
 const valid=rows=>rows.every(matches=>matches.length===1);
 if(!latest||!valid(current))return {ready:false,days,latest,reason:'Chưa đủ báo cáo liên tiếp cho kỳ này.'};
 const reports=current.flat(),prior=valid(previous)?previous.flat():null;
 const totals=rows=>Object.fromEntries(['revenue','nonfuel','fuelCost','co2Cost','profit','cashDelta','pax','cancelled'].map(k=>[k,sum(rows.map(r=>value(r,k)))]));
 const total=totals(reports),before=prior?totals(prior):null;
 const detailKeys=['maintenanceCost','slotFee','salary','agency','leaseExpense','interest','recoveryCost','disruptionPrepaid'];
 const details=before?detailKeys.map(key=>({key,amount:sum(reports.map(r=>value(r,key)))===null||sum(prior.map(r=>value(r,key)))===null?null:sum(prior.map(r=>value(r,key)))-sum(reports.map(r=>value(r,key)))})):[];
 const changes=before?['revenue','nonfuel','fuelCost','co2Cost'].map(k=>({key:k,amount:finite(total[k])&&finite(before[k])?(total[k]-before[k])*(k==='revenue'?1:-1):null})):[];
 const rankings=kind=>{
  const now=groups(reports,kind),old=prior?groups(prior,kind):null;
  if(!now)return null;
  const ids=new Set([...now.keys(),...(old?.keys()||[])]);
  return [...ids].map(id=>({id,profit:now.get(id)||0,delta:old?(now.get(id)||0)-(old.get(id)||0):null}))
   .sort((a,b)=>Math.abs(b.delta??b.profit)-Math.abs(a.delta??a.profit)).slice(0,5);
 };
 return {ready:true,days,latest,start:latest-days+1,total,before,changes,details,bridges:reports.map(reportBridge),aircraft:rankings('aircraft'),routes:rankings('routes')};
}
