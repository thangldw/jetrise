import {chooseWeeklyGoal} from './weekly-review.js';
import {advanceAction,guardAdvanceSales,validateAdvanceSales} from './advance-sales.js';
import {applyDecisionComparison} from './decision-comparison.js';
import {enableRivalNetwork,validateRivalNetwork} from './rival-network.js';
import {customerAction,validateCustomers} from './customer-strategy.js';
import {sharedSlotAction,validateSlotMarket,reconcileConditionalSlots} from './slot-market.js';
import {applyDisruption,guardDisruptionChanges,validateDisruptions} from './disruption-recovery.js';
import {validateResearch,completeResearch,RESEARCH} from './research.js';
import {validatePositioning} from './positioning.js';
import {enableOvernight,validateOvernight,guardJourneyChanges,cancelJourney} from './overnight-connections.js';
import {enableLegEconomy,validateLegEconomy} from './live-leg-economy.js';
import {connectionAction,validateConnections} from './network-economy.js';
import {slotAction,slotConflict,validateSlots} from './airport-slots.js';
import {fleetPolicyAction,validateFleetPolicy} from './fleet-policy.js';
import {newGameplay,restoreGameplay,marketPrices,marketEvents,RESEARCH_FEE,acceptContract,campaignStatus,settleGameplay,logDecision} from './gameplay.js';
import {newStrategy,validateStrategy,settleStrategy} from './strategy.js';
import {recoverFlight,pruneRecoveries,validateRecoveries} from './recovery.js';
import {pricedTypes,leaseDailyRate} from './economy.js';
import {atDay,oneOff,maintenanceWindows,planConflict,nextPlanStart,displayAt} from './maintenance.js';
import {STARTING_MODELS} from './founding.js';
import {abbreviation,aircraftNumber,reserveAircraftId} from './registration.js';
import {airportList,getAirport,routeQuote,restoreNetwork,DEFAULT_AIRLINE,validateAirline,validateAirport} from './network.js';
import Engine from './engine.js';
import {proposeSchedule,applyProposal} from './planner.js';
import {repairCost,createHQ,restoreHQ,dailyHQ,modifiers,hqAction} from './hq.js';
import {normalizePlane,fleetAction,settleFleet,usedPrice,deliveryDays,flightUnavailable} from './fleet.js';

export const SAVE_KEY='jetrise-career-v1';
export const TYPES={
 A320:{speed:830,name:'Airbus A320neo',seats:180,range:6300,burn:8.5,nonfuel:10500,price:4800000},
 E190:{speed:800,name:'Embraer E190',seats:100,range:4500,burn:5,nonfuel:6500,price:2400000},
 B788:{speed:900,name:'Boeing 787-8',seats:250,range:14500,burn:17,nonfuel:19000,price:19411920},
 A223:{speed:820,name:'Airbus A220-300',seats:145,range:6300,burn:6.2,nonfuel:8200,price:3600000},
 A321:{speed:830,name:'Airbus A321neo',seats:220,range:7400,burn:10.2,nonfuel:12500,price:6500000},
 A339:{speed:870,name:'Airbus A330-900neo',seats:300,range:13300,burn:19,nonfuel:22000,price:21800000},
 A359:{speed:900,name:'Airbus A350-900',seats:325,range:15000,burn:18.5,nonfuel:24000,price:27800000},
 A351:{speed:905,name:'Airbus A350-1000',seats:370,range:16000,burn:21.5,nonfuel:28000,price:33500000},
 A388:{speed:890,name:'Airbus A380-800',seats:555,range:15000,burn:36,nonfuel:42000,price:46500000},
 B738:{speed:825,name:'Boeing 737-800',seats:189,range:5400,burn:10.5,nonfuel:10500,price:4200000},
 B38M:{speed:830,name:'Boeing 737 MAX 8',seats:200,range:6500,burn:8.2,nonfuel:11200,price:5600000},
 B789:{speed:900,name:'Boeing 787-9',seats:290,range:14000,burn:18.2,nonfuel:21800,price:23500000},
 B77W:{speed:890,name:'Boeing 777-300ER',seats:396,range:13600,burn:28,nonfuel:31000,price:31800000}
};
export const ROUTES=[
 {from:'HAN',code:'HAN → BKK',to:'BKK',name:'Bangkok',country:'Thái Lan',km:990,cycle:5.8,baseFare:145,demand:850,x:.22,y:.30},
 {from:'HAN',code:'HAN → SGN',to:'SGN',name:'TP. Hồ Chí Minh',country:'Việt Nam',km:1160,cycle:5.4,baseFare:130,demand:1000,x:.35,y:.34},
 {from:'HAN',code:'HAN → NRT',to:'NRT',name:'Tokyo Narita',country:'Nhật Bản',km:3720,cycle:10.2,baseFare:220,demand:620,x:.57,y:.14},
 {from:'HAN',code:'HAN → DAD',to:'DAD',name:'Đà Nẵng',country:'Việt Nam',price:120000,km:600,cycle:3.4,baseFare:100,demand:780,x:.37,y:.28},
 {from:'HAN',code:'HAN → SIN',to:'SIN',name:'Singapore',country:'Singapore',km:2200,cycle:8.2,baseFare:190,demand:720,x:.28,y:.43},
 {from:'SGN',code:'SGN → BKK',to:'BKK',name:'Bangkok',country:'Thái Lan',km:720,cycle:4.8,baseFare:125,demand:820,x:.22,y:.30},
 {from:'SGN',code:'SGN → SIN',to:'SIN',name:'Singapore',country:'Singapore',km:1090,cycle:5.4,baseFare:155,demand:950,x:.28,y:.43},
 {from:'SGN',code:'SGN → NRT',to:'NRT',name:'Tokyo Narita',country:'Nhật Bản',km:4380,cycle:12,baseFare:255,demand:700,x:.57,y:.14},
 {from:'DAD',code:'DAD → SGN',to:'SGN',name:'TP. Hồ Chí Minh',country:'Việt Nam',km:605,cycle:3.5,baseFare:100,demand:680,x:.35,y:.34},
 {from:'DAD',code:'DAD → BKK',to:'BKK',name:'Bangkok',country:'Thái Lan',km:845,cycle:4.8,baseFare:130,demand:620,x:.22,y:.30},
 {from:'HAN',code:'HAN → LAX',to:'LAX',name:'Los Angeles',country:'Hoa Kỳ',km:12300,cycle:30,baseFare:780,demand:950,price:950000,x:.83,y:.28},
 {from:'SGN',code:'SGN → LHR',to:'LHR',name:'London Heathrow',country:'Anh',km:10200,cycle:27,baseFare:720,demand:840,price:850000,x:.08,y:.12},
 {from:'DAD',code:'DAD → SYD',to:'SYD',name:'Sydney',country:'Úc',km:7600,cycle:23,baseFare:550,demand:720,price:650000,x:.75,y:.5}
];
export const typesFor=s=>pricedTypes(s,TYPES);
export const routesFor=s=>[...ROUTES.map(r=>s.economyVersion===2?{...r,...routeQuote(s,r.from,r.to),cycle:r.cycle,km:r.km}:r),...(s.network?.routes||[]).map(r=>routeQuote(s,r.from,r.to))];
// Keep legacy indices for saved schedules; retire unopened demo routes from discovery.
export const routeEntries=s=>routesFor(s).map((r,i)=>({r,i})).filter(({i})=>i>=ROUTES.length||s.openedRoutes.includes(i));
export const DAYS=['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'];
export const SHORT_DAYS=['T2','T3','T4','T5','T6','T7','CN'];
export const CLASSES=['Phổ thông (Y)','Thương gia (J)','Hạng nhất (F)'];
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
export const number=n=>Math.round(n).toLocaleString('vi-VN');
export const time=h=>`${String(Math.floor(h)%24).padStart(2,'0')}:${String(Math.round(h%1*60)).padStart(2,'0')}`;
export function context(s){return {...s,types:typesFor(s),legacyRouteCount:ROUTES.length,routes:routesFor(s),active:[],locations:{},modifiers:modifiers(s),...marketPrices(s)};}
// JET-209 guard: same aircraft availability rule the engine applies at departure (maintenance windows, lease, life).
const advanceUnavailable=g=>{const c=context(g);return (day,x)=>{const p=c.fleet.find(p=>p.id===x.plane);return p?flightUnavailable(p,day,x.start%24,Engine.duration(c,p.id,x.route),g.day):'Không tìm thấy máy bay';};};
export function createGame(){
 const s={schema:1,economyVersion:1,cash:8600000,day:1,fuel:120,average:710,co2:20000000,co2Average:.1,openedRoutes:[0,1,2],fleet:[
  {id:'VN-A101',type:'A320',wear:22,route:0,freq:1,fare:145,cabin:'dense'},
  {id:'VN-A102',type:'E190',wear:15,route:1,freq:1,fare:130,cabin:'dense'},
  {id:'VN-A104',type:'A320',wear:96,route:null,freq:1,fare:145,cabin:'dense'}
 ]};
 s.gameplay=newGameplay(s.day);s.nextAircraftNumber=105;s.network={airports:[],routes:[]};s.airline={...DEFAULT_AIRLINE};s.setupComplete=false;s.orders=[];s.hq=createHQ();s.fleet.forEach(p=>normalizePlane(p,s.day));
 s.tycoon=Engine.create(context(s));s.tycoon.schedules=[];s.tycoon.nextId=1;
 // Retain the original legacy fixture; new careers receive an empty schedule at setup.
 for(const [route,start] of [[0,6],[2,25],[0,62],[2,78],[0,104],[2,122]])s.tycoon.schedules.push({id:s.tycoon.nextId++,plane:'VN-A101',route,start});
 for(let d=0;d<7;d++)Engine.add(context(s),s.tycoon,'VN-A102',1,d*24+6);
 return s;
}
export function restoreGame(raw){
 const s=JSON.parse(raw);if(!s||typeof s!=='object')throw Error('Invalid save');if(s.economyVersion!==undefined&&![1,2].includes(s.economyVersion))throw Error('Invalid economy');s.economyVersion??=1;restoreNetwork(s,ROUTES);const routes=routesFor(s);s.airline??={...DEFAULT_AIRLINE};s.setupComplete??=true;validateAirline(s.airline);if(s.airline.abbreviation&&s.airline.abbreviation!==abbreviation(s.airline.name))throw Error('Invalid airline abbreviation');if(typeof s.setupComplete!=='boolean')throw Error('Invalid setup');const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
 if(s.schema!==1||!Number.isInteger(s.day)||!finite(s.day,1,9999)||!finite(s.cash,-1e9,1e10)||!finite(s.fuel,0,10000)||!finite(s.average,1,10000)||!finite(s.co2,0,1e10)||!finite(s.co2Average,0,100)||!Array.isArray(s.fleet)||s.fleet.length<1||s.fleet.length>8||!Array.isArray(s.openedRoutes)||s.openedRoutes.some(i=>!Number.isInteger(i)||!routes[i]))throw Error('Invalid save');
 s.orders??=[];if(!Array.isArray(s.orders)||s.orders.length+s.fleet.length>8||s.orders.some(o=>!o||!Object.hasOwn(TYPES,o.model)||!Number.isInteger(o.deliverDay)||o.deliverDay<=s.day||o.deliverDay>s.day+4))throw Error('Invalid orders');
 s.hq=restoreHQ(s.hq,s.day,s);if(!s.hq.hubs[s.airline.origin])throw Error('Invalid airline origin');if(s.orders.some(o=>o.hub&&!s.hq.hubs[o.hub]))throw Error('Invalid delivery hub');if(s.network.routes.some((_,i)=>routes[ROUTES.length+i].km>Math.max(...Object.values(TYPES).map(t=>t.range))))throw Error('Invalid route range');
 const missingAirborne=new Set(s.fleet.filter(p=>p.airborneUntilAt===undefined).map(p=>p.id)),ids=new Set();for(const p of s.fleet){if(!(/^[A-Z]{1,5}-\d{3,7}$/.test(p.id)||/^VN-A\d{3,5}$/.test(p.id))||ids.has(p.id)||!Object.hasOwn(TYPES,p.type)||!finite(p.wear,0,100))throw Error('Invalid fleet');ids.add(p.id);normalizePlane(p,s.day);if(!s.hq.hubs[p.hub])throw Error('Invalid aircraft hub');}
 s.nextAircraftNumber??=Math.max(100,...s.fleet.map(p=>aircraftNumber(p.id)),...s.orders.map(o=>aircraftNumber(o.id||'')))+1;
 if(!Number.isInteger(s.nextAircraftNumber)||s.nextAircraftNumber<101||s.nextAircraftNumber>9999999||s.fleet.some(p=>aircraftNumber(p.id)>=s.nextAircraftNumber))throw Error('Invalid aircraft sequence');
 for(const o of s.orders)if(o.id&&(!/^[A-Z]{1,5}-\d{3,7}$/.test(o.id)||ids.has(o.id)||aircraftNumber(o.id)>=s.nextAircraftNumber))throw Error('Invalid pending aircraft registration');else if(o.id)ids.add(o.id);
 if(s.founding!==undefined&&(!s.founding||!['fleet','routes','done'].includes(s.founding.stage)||!s.setupComplete||(s.founding.stage!=='done'&&s.day!==1)))throw Error('Invalid founding stage');
 if([5,10].includes(s.tycoon?.prices?.length))for(const r of routes.slice(s.tycoon.prices.length))s.tycoon.prices.push([r.baseFare,Math.round(r.baseFare*2.5),r.baseFare*5]);
 if(Object.keys(s.hq.targets).some(k=>!routes[k]||!s.openedRoutes.includes(Number(k))))throw Error('Invalid route targets');
 if(s.openedRoutes.some(i=>!s.hq.hubs[routes[i].from]))throw Error('Invalid route hub');
 restoreGameplay(s,routes);validateStrategy(s,routes);validateFleetPolicy(s);validateConnections(s);validateSlots(s);validateSlotMarket(s,context(s));validateRivalNetwork(s,context(s));s.tycoon=Engine.restore(s.tycoon,context(s));if(!s.tycoon)throw Error('Missing schedule');validateResearch(s);validatePositioning(s);validateDisruptions(s,routes);validateLegEconomy(s,routes,TYPES);validateAdvanceSales(s,routes);validateOvernight(context(s),s.tycoon);validateCustomers(s);if(s.legEconomy?.disruptions)validateRecoveries(context(s),s.tycoon,false);if(slotConflict(context(s),s.tycoon))throw Error('Invalid slot capacity');for(const p of s.fleet)if(missingAirborne.has(p.id)){const until=Engine.airborneUntil(context(s),s.tycoon,p.id,s.day,true);p.airborneUntilAt=until>s.day?Math.round((until-1)*96)/4:null;}return s;
}
export const forecast=s=>{const r=Engine.evaluate(context(s),s.tycoon,s.day),h=dailyHQ(r.slotMarketState?{...s,slotMarket:r.slotMarketState}:s,TYPES);r.operatingNonfuel=r.nonfuel;Object.assign(r,h);r.maintenancePrepaid=s.hq.maintenancePaid||0;r.recurringMaintenance=s.fleet.flatMap(p=>maintenanceWindows(p,atDay(s.day),atDay(s.day+1)).filter(w=>w.kind==='light'&&w.start>=atDay(s.day)&&(!p.fault||(oneOff(p)?.end??Infinity)<=w.start)).map(w=>({plane:p.id,start:w.start,end:w.end,cost:Math.round(repairCost(s,p.id)*.35)})));r.maintenanceCash=r.recurringMaintenance.reduce((n,w)=>n+w.cost,0);r.maintenanceCost=r.maintenancePrepaid+r.maintenanceCash;r.nonfuel+=h.overhead+r.maintenanceCost;r.profit-=h.overhead+r.maintenanceCost;r.leaseRefunds=s.fleet.reduce((n,p)=>n+(p.lease?.remaining===1?p.lease.deposit:0),0);r.cashDelta+=r.leaseRefunds-r.maintenanceCash-h.overhead-h.principal+h.prepaidRent;return r;};
export function routeInfo(s,ri,pid){const temp=structuredClone(s),plane=s.fleet.find(p=>p.id===pid),r=routesFor(s)[ri];temp.tycoon.schedules=plane&&plane.hub===r.from&&TYPES[plane.type].range>=r.km?[{id:1,plane:pid,route:ri,start:(s.day-1)%7*24}]:[];const estimate=Engine.evaluate(context(temp),temp.tycoon,temp.day),demand=Engine.demand(context(s),s.tycoon,ri,s.day),capacity=Engine.capacity(context(s),s.tycoon,ri,s.day);return {estimate,demand,capacity,remaining:demand.map((v,i)=>v-capacity[i])};}
export const dayCashRequired=r=>(r.connections?.refund||0)+(r.advanceRefund||0)+r.nonfuel+(r.prepaidNonfuelDelta||0)+r.fuelPurchase+r.co2Purchase+r.principal-r.prepaidRent-(r.maintenancePrepaid??r.maintenanceCost??0)-(r.disruptionPrepaid||0);
export function transition(current,action){
 if(action.type==='decision-apply'){try{return {game:applyDecisionComparison(current,action.proposal),message:'Đã áp dụng phương án đã so sánh; chưa chạy ngày.',report:null};}catch(error){return {game:current,error:error.message};}}
 const s=structuredClone(current);s.gameplay??=newGameplay(s.day);s.hq.prepaidRent??=0;s.hq.maintenancePaid??=0;const c=context(s),routes=c.routes;let message='',report=null;
 try{
  if(['transfer','repair','maintenance','sell','return-lease'].includes(action.type)){const start=action.type==='maintenance'?action.day+(action.hour||0)/24:s.day;if(start<Engine.airborneUntil(c,s.tycoon,action.plane,s.day))throw Error('Máy bay còn đang thực hiện vòng khứ hồi từ ngày trước. Chọn ngày sau khi về hub.');}
  let maintenanceMessage=null;
  if(['service-plan','service-plan-remove'].includes(action.type)){
   const p=s.fleet.find(p=>p.id===action.plane);if(!p)throw Error('Không tìm thấy máy bay.');
   if(action.type==='service-plan-remove'){
    const now=atDay(s.day);if(maintenanceWindows(p,now,now+.001).some(w=>w.kind==='light'))throw Error('Ca bảo dưỡng đang diễn ra, không thể gỡ.');
    p.servicePlan=null;maintenanceMessage='Đã gỡ lịch bảo dưỡng lặp. Hạn bảo dưỡng vẫn được giữ.';
   }else{
    if(maintenanceWindows(p,atDay(s.day),atDay(s.day)+.001).some(w=>w.kind==='light'))throw Error('Ca bảo dưỡng đang diễn ra, không thể đổi giờ.');
    if(p.fault||p.wear>=90)throw Error('Cần bảo dưỡng lớn hoặc sửa sự cố trước khi lập ca định kỳ.');
    const error=planConflict(s,p,action.start,x=>Engine.duration(c,p.id,x.route));if(error)throw Error(error);
    p.servicePlan={start:action.start,activeFrom:nextPlanStart(s.day,action.start)};
    maintenanceMessage='Đã đặt ca bảo dưỡng 5 giờ từ '+displayAt(p.servicePlan.activeFrom)+', lặp mỗi tuần. Phí được trừ khi ca bắt đầu; lịch bay được giữ.';
   }
  }
  const managed=maintenanceMessage||advanceAction(s,action)||customerAction(s,action)||connectionAction(s,action)||sharedSlotAction(s,action,c)||slotAction(s,action)||fleetPolicyAction(s,action)||hqAction(s,action,TYPES,routes,c)||fleetAction(s,action,c.types);
  if(action.type==='weekly-goal'){if(action.basis!==JSON.stringify(current))throw Error('Snapshot đã thay đổi. Kiểm tra lại mục tiêu trước khi lưu.');message=chooseWeeklyGoal(s,action);
  }else if(managed){message=managed;if(['fleet-reserve','fleet-program'].includes(action.type))logDecision(s,message);}else if(action.type==='disruption-apply'){message=applyDisruption(s,c,action.preview);logDecision(s,message);}else if(action.type==='overnight-enable'){message=enableOvernight(s,action);}else if(action.type==='journey-refund'){message=cancelJourney(s,action.id);}else if(action.type==='leg-economy-enable'){
   enableLegEconomy(s,action.migrationId);message='Đã bật kinh tế theo chặng. Vé và chi phí được giữ theo từng chuyến thực tế.';
  }else if(action.type==='rival-network-enable'){message=enableRivalNetwork(s,action,c);
  }else if(action.type==='rival-growth'){
   if(!s.strategy||s.strategy.growth||s.strategy.expansion)throw Error('Bật cạnh tranh AI trước; tăng trưởng chỉ bật một lần.');s.strategy.growth=true;message='Đối thủ AI có thể thuê tối đa 2 máy bay bổ sung, trả cọc và tiền thuê từ vốn riêng.';logDecision(s,message);
  }else if(action.type==='strategy-enable'){
   if(s.strategy)throw Error('Chế độ cạnh tranh đã được bật.');s.strategy=newStrategy(c,action.difficulty??'normal');message='Đã bật cạnh tranh AI. Giá, giờ bay và tiện nghi cùng quyết định khách chọn hãng.';logDecision(s,message);
  }else if(['contract-accept','contract-decline'].includes(action.type)){
   message=acceptContract(s,c,action);logDecision(s,message);
  }else if(action.type==='market-research'){
   const event=marketEvents(c).find(e=>e.id===action.id&&e.start>s.day);if(!event||s.gameplay.research.includes(event.id))throw Error('Sự kiện đã diễn ra hoặc đã nghiên cứu.');if(s.cash<RESEARCH_FEE)throw Error('Cần $5.000 để nghiên cứu.');s.cash-=RESEARCH_FEE;s.gameplay.research.push(event.id);message='Đã nghiên cứu '+event.title+'. Dự báo dùng mức tác động đã xác định trong mô phỏng.';logDecision(s,message);
  }else if(action.type==='recovery-remove'){
   const i=(s.tycoon.exceptions||[]).findIndex(e=>e.day===action.day&&e.slot===action.slot);if(i<0)throw Error('Phương án không còn tồn tại.');s.tycoon.exceptions.splice(i,1);message='Đã gỡ phương án riêng lượt; dùng lại lịch tuần. Máy bay lease vẫn được thuê đến khi trả.';logDecision(s,message);
  }else if(action.type==='recover-flight'){
   message=recoverFlight(s,c,action);logDecision(s,message);
  }else if(action.type==='campaign-claim'){
   const goal=campaignStatus(s).find(g=>g.id===action.id);if(!goal?.ready)throw Error('Mục tiêu chưa đạt hoặc đã nhận thưởng.');s.cash+=goal.reward;s.gameplay.claimed.push(goal.id);message='Hoàn thành '+goal.name+' · thưởng '+money(goal.reward)+'.';logDecision(s,message);
  }else if(action.type==='setup'){
   if(s.setupComplete||s.day!==1)throw Error('Hãng đã được thiết lập. Chỉ lập hãng mới khi bắt đầu lại.');
   const airline={name:String(action.name||'').trim(),logo:action.logo,color:action.color,origin:action.origin,personalized:true};validateAirline(airline);
   if(!Array.isArray(action.models)||action.models.length!==2||new Set(action.models).size!==2||action.models.some(k=>!STARTING_MODELS.includes(k)))throw Error('Cần hai mẫu máy bay tầm trung khác nhau từ lượt random.');
   airline.abbreviation=abbreviation(airline.name);s.airline=airline;s.setupComplete=true;s.cash=500000000;s.economyVersion=2;s.gameplay=newGameplay(s.day);s.hq=createHQ();s.hq.hubs={[airline.origin]:{hangar:1}};s.orders=[];s.nextAircraftNumber=101;
   s.fleet=action.models.map(type=>normalizePlane({id:reserveAircraftId(s),hub:airline.origin,type,wear:0,route:null,freq:1,fare:145,cabin:'dense'},s.day));
   s.hq.staff={pilots:8,cabin:s.fleet.reduce((n,p)=>n+Math.ceil(TYPES[p.type].seats/50),0),tech:4,ground:5};s.tycoon=Engine.create(context(s));s.openedRoutes=[];s.founding={stage:'fleet'};
   message='Đã thành lập '+airline.name+' · cấp $500.000.000 và 2 máy bay tầm trung. Chuẩn bị đội bay trước khi chọn tuyến.';
  }else if(action.type==='founding-next'){
   if(s.founding?.stage!=='fleet')throw Error('Không ở bước chuẩn bị đội bay.');s.founding.stage='routes';message='Đội bay đã sẵn sàng. Chọn tuyến gợi ý hoặc tự tạo tuyến.';
  }else if(action.type==='founding-back'){
   if(s.founding?.stage!=='routes')throw Error('Không ở bước chọn tuyến.');s.founding.stage='fleet';message='Đã quay lại chuẩn bị đội bay.';
  }else if(action.type==='founding-finish'){
   if(s.founding?.stage!=='routes'||!s.openedRoutes.length)throw Error('Mở ít nhất một tuyến để bắt đầu điều hành.');s.founding.stage='done';message='Đã hoàn tất lập hãng. Phân công máy bay và lập lịch để bắt đầu khai thác.';
  }else if(action.type==='airport-add'){
   const a={iata:String(action.iata||'').trim().toUpperCase(),name:String(action.name||'').trim(),city:action.city===undefined?'':typeof action.city==='string'?action.city.trim():action.city,country:action.country,lat:action.lat,lon:action.lon,major:false};validateAirport(a);
   if(getAirport(s,a.iata))throw Error('Mã IATA đã tồn tại. Chọn sân bay từ danh mục hoặc dùng mã khác.');if(s.network.airports.length>=30)throw Error('Đã đạt giới hạn 30 sân bay tùy chọn.');s.network.airports.push(a);message='Đã thêm sân bay '+a.name+' ('+a.iata+').';
  }else if(action.type==='route-create'){
   if(!s.hq.hubs[action.from])throw Error('Cần sở hữu hub xuất phát.');if(routes.some(r=>r.from===action.from&&r.to===action.to))throw Error('Tuyến đã có trong danh mục. Chọn tuyến đó để mở hoặc xếp lịch.');if(s.network.routes.length>=100)throw Error('Đã đạt giới hạn 100 tuyến tùy chọn.');
   const q=routeQuote(s,action.from,action.to);if(!Object.values(TYPES).some(t=>t.range>=q.km))throw Error('Không có mẫu máy bay nào trong game đủ tầm bay cho tuyến này.');if(s.cash<q.price)throw Error('Cần '+money(q.price)+' để mở tuyến.');s.cash-=q.price;s.network.routes.push({from:q.from,to:q.to});s.openedRoutes.push(routes.length);s.tycoon.prices.push([q.baseFare,Math.round(q.baseFare*2.5),q.baseFare*5]);message='Đã mua và mở tuyến '+q.code.replace('→','↔')+'.';
  }else if(action.type==='optimize'){const proposal=action.proposal||proposeSchedule(c,s.tycoon);if(!proposal.added)throw Error('Không tìm thấy vòng khứ hồi có lãi trong khoảng trống.');const applied=applyProposal(c,s.tycoon,proposal);s.tycoon=applied.state;s.fleet=applied.fleet;message='Đã bổ sung '+proposal.added+' vòng khứ hồi vào lịch tuần.'+(proposal.maintenance.length?' Đã đặt '+proposal.maintenance.length+' ca bảo dưỡng tuần; phí trừ khi ca bắt đầu.':''); }else if(action.type==='edit-weekly'){
   const original=s.tycoon.schedules.find(x=>x.id===action.id);if(!original)throw Error('Không tìm thấy chuyến.');
   if(!Number.isFinite(action.at)||action.at<0||action.at>=24||action.at%.25)throw Error('Chọn giờ khởi hành theo mốc 15 phút.');
   const targets=s.tycoon.schedules.filter(x=>x.plane===original.plane&&x.route===original.route&&x.start%24===original.start%24),days=targets.map(x=>Math.floor(x.start/24));
   targets.forEach((x,i)=>Object.assign(x,{plane:action.plane,route:action.route,start:days[i]*24+action.at}));
   for(const x of targets){const error=Engine.slotError(c,s.tycoon,x.plane,x.route,x.start,x.id);if(error)throw Error(DAYS[Math.floor(x.start/24)]+' '+time(x.start)+': '+error);}
   message='Đã sửa '+targets.length+' chuyến cùng giờ trên các ngày trong tuần.';
  }else if(action.type==='edit'){const slot=s.tycoon.schedules.find(x=>x.id===action.id);if(!slot)throw Error('Không tìm thấy chuyến.');const error=Engine.slotError(c,s.tycoon,action.plane,action.route,action.start,slot.id);if(error)throw Error(error);Object.assign(slot,{plane:action.plane,route:action.route,start:action.start});message='Đã điều chỉnh chuyến trong lịch tuần.';}else if(action.type==='add-weekly'){
   const days=action.days,at=action.at;
   if(!Array.isArray(days)||!days.length||days.length>7||days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(days).size!==days.length||!Number.isFinite(at)||at<0||at>=24||at%.25!==0)throw Error('Chọn thứ trong tuần và giờ khởi hành theo mốc 15 phút.');
   const added=[];
   for(const day of [...days].sort((a,b)=>(a-(s.day-1)%7+7)%7-(b-(s.day-1)%7+7)%7)){
    const start=day*24+at,result=Engine.add(c,s.tycoon,action.plane,action.route,start);
    if(result.error)throw Error(DAYS[day]+' '+time(start)+': '+result.error);
    added.push(s.tycoon.schedules.at(-1));
   }
   for(const x of added){const error=Engine.slotError(c,s.tycoon,x.plane,x.route,x.start,x.id);if(error)throw Error(DAYS[Math.floor(x.start/24)]+': '+error);}
   message='Đã thêm '+added.length+' vòng khứ hồi, lặp theo thứ và giờ mỗi tuần.';
  }else if(action.type==='add'){
   const result=Engine.add(c,s.tycoon,action.plane,action.route,action.start);if(result.error)throw Error(result.error);message='Đã thêm vòng khứ hồi. Lịch sẽ lặp mỗi tuần.';
  }else if(action.type==='remove'){
   const slot=s.tycoon.schedules.find(x=>x.id===action.id);if(!slot)throw Error('Không tìm thấy chuyến trong lịch.');s.tycoon.schedules=s.tycoon.schedules.filter(x=>x.id!==action.id);message='Đã xóa vòng khứ hồi khỏi lịch tuần.';
  }else if(action.type==='auto'){
   const error=Engine.slotError(c,{...s.tycoon,schedules:[]},action.plane,action.route,0);if(error)throw Error(error);const n=Engine.auto(c,s.tycoon,action.plane,action.route);message=n?`Đã thêm ${n} vòng vào khoảng trống. Kiểm tra công suất từng hạng.`:'Không còn khoảng trống phù hợp hoặc tuyến đã đủ công suất.';
  }else if(action.type==='cabin'){
   const p=s.fleet.find(p=>p.id===action.plane),v=action.values;if(!p||!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isInteger(n)||n<0||n>1000)||!v.some(n=>n>0))throw Error('Số ghế phải là số nguyên không âm; cabin cần ít nhất một ghế.');if(v[0]+v[1]*1.8+v[2]*4.2>TYPES[p.type].seats+.001)throw Error(`Cấu hình vượt giới hạn ${TYPES[p.type].seats} đơn vị cabin.`);s.tycoon.cabins[p.id]=v;message='Đã lưu cấu hình cabin. Nhu cầu và dự báo đã cập nhật.';
  }else if(action.type==='prices'){
   if(!s.openedRoutes.includes(action.route)||!Array.isArray(action.values)||action.values.length!==3||action.values.some(n=>!Number.isInteger(n)||n<20||n>10000))throw Error('Giá vé phải là số nguyên từ $20 đến $10.000.');if(s.tycoon.priceDays[action.route]===s.day)throw Error('Tuyến đã đổi giá hôm nay. Chờ sang ngày tiếp theo.');if(s.cash<5000)throw Error('Cần $5.000 để áp dụng bảng giá.');s.cash-=5000;s.tycoon.prices[action.route]=action.values;s.tycoon.priceDays[action.route]=s.day;message='Đã áp dụng giá vé cho cả ba hạng ghế.';
  }else if(['buy','buy-used','lease'].includes(action.type)){
   if(!Object.hasOwn(TYPES,action.model))throw Error('Mẫu máy bay không tồn tại.');const t=c.types[action.model];if(s.fleet.length+s.orders.length>=8)throw Error('Đội bay và đơn đặt đã đạt giới hạn 8 chiếc.');
   if(action.type==='buy'){if(s.cash<t.price)throw Error('Ngân quỹ chưa đủ.');s.cash-=t.price;s.orders.push({id:reserveAircraftId(s),model:action.model,deliverDay:s.day+deliveryDays(t),hub:s.airline.origin});message='Đã đặt '+t.name+'. Giao đầu ngày '+(s.day+deliveryDays(t))+'.';}
   else {
    const ages=[5,12,20],wears=[20,45,70],tier=action.tier??0;if(action.type==='buy-used'&&(!Number.isInteger(tier)||!ages[tier]))throw Error('Chọn mức tuổi hợp lệ.');
    const lease=action.type==='lease',deposit=Math.round(t.price*.05),rate=leaseDailyRate(s,t.price),cost=lease?deposit+rate:usedPrice(t,ages[tier],wears[tier]);if(s.cash<cost)throw Error('Ngân quỹ chưa đủ.');
    const id=reserveAircraftId(s);s.cash-=cost;const p=normalizePlane({id,hub:s.airline.origin,type:action.model,wear:lease?5:wears[tier],ageDays:lease?2*365:ages[tier]*365,route:null,freq:1,fare:145,cabin:'dense'},s.day);
    if(lease){p.lease={deposit,rate,remaining:14,paidDay:s.day};s.hq.prepaidRent+=rate;}s.fleet.push(p);Engine.ensure(context(s),s.tycoon);message=id+(lease?' đã nhận lease 14 ngày. Phí ngày đầu đã trả.':' đã nhận máy bay cũ.');
   }
  }else if(action.type==='unlock'){
   if(!Number.isInteger(action.route)||!routes[action.route]||!s.hq.hubs[routes[action.route].from]||s.openedRoutes.includes(action.route))throw Error('Tuyến này đã mở hoặc không thể mua.');const cost=routes[action.route].price||(action.route===3?120000:180000);if(s.cash<cost)throw Error('Không đủ tiền mua tuyến.');s.cash-=cost;s.openedRoutes.push(action.route);message='Đã mở đường bay '+routes[action.route].code.replace('→','↔')+'.';
  }else if(action.type==='advance'){
   if(s.founding&&s.founding.stage!=='done')throw Error('Hoàn tất chuẩn bị đội bay và chọn tuyến trước khi khai thác.');if(s.day>=9999)throw Error('Đã đạt giới hạn ngày của PoC.');const r=forecast(s);const reserve=dayCashRequired(r);if(s.cash+1e-6<reserve)throw Error('Cần '+money(reserve)+' để chạy lịch hôm nay. Giảm số chuyến trước khi khai thác.');s.cash+=r.cashDelta;s.fuel=Math.max(0,s.fuel-(r.fuelAllocated??r.burn));s.co2=Math.max(0,s.co2-(r.co2Allocated??r.co2));s.fleet.forEach(p=>p.wear=r.wear[p.id]);if(r.legEconomyState)s.legEconomy=r.legEconomyState;settleGameplay(s,r,c);settleStrategy(s,r);if(r.slotMarketState)s.slotMarket=r.slotMarketState;if(r.customerStrategyState)s.customerStrategy=r.customerStrategyState;settleFleet(s,r);s.hq.prepaidRent=0;s.hq.maintenancePaid=0;if(s.hq.loan){s.hq.loan.balance-=r.principal;if(s.hq.loan.balance===0)s.hq.loan=null;}report={...r};delete report.rows;delete report.operatedRounds;delete report.departureManifests;delete report.legEconomyState;delete report.contractState;delete report.wear;delete report.serviceState;delete report.strategyState;delete report.slotMarketState;delete report.customerStrategyState;s.tycoon.history.unshift(report);s.tycoon.history=s.tycoon.history.slice(0,28);s.day++;const researchCompleted=completeResearch(s);if(researchCompleted)report.researchCompleted=researchCompleted;r.deliveries=[];for(const order of s.orders.filter(o=>o.deliverDay<=s.day)){const id=order.id||reserveAircraftId(s);s.fleet.push(normalizePlane({id,hub:order.hub||s.airline.origin,type:order.model,wear:0,route:null,freq:1,fare:145,cabin:'dense'},s.day));r.deliveries.push(id);}s.orders=s.orders.filter(o=>o.deliverDay>s.day);Engine.ensure(context(s),s.tycoon);report.deliveries=r.deliveries;message=`Ngày ${r.day}: ${number(r.pax)} khách · lợi nhuận ${money(r.profit)}.`;if(report.researchCompleted)message+=' Hoàn tất '+RESEARCH[report.researchCompleted].name+'.';
  }else throw Error('Thao tác không được hỗ trợ.');
  if(!['advance','disruption-apply'].includes(action.type)&&current.legEconomy?.disruptions)guardDisruptionChanges(context(current),context(s));
  if(s.legEconomy?.disruptions&&['optimize','service-plan','service-plan-remove','maintenance','repair','transfer','sell','return-lease','fleet-reserve'].includes(action.type))validateRecoveries(context(s),s.tycoon);
  if(action.type!=='advance'&&s.legEconomy?.overnight)guardJourneyChanges(context(s),s.tycoon,['optimize','service-plan','service-plan-remove','maintenance','repair','transfer','sell','return-lease','fleet-reserve'].includes(action.type));
  if(['add','add-weekly','auto','edit','edit-weekly','remove','optimize','recover-flight','recovery-remove','disruption-apply','journey-refund','sell','transfer','return-lease'].includes(action.type)){const released=reconcileConditionalSlots(context(s),s.tycoon);if(released.length)message+=' Đã trả '+released.reduce((n,r)=>n+r.quantity,0)+' quyền mới dư; không hoàn phí mua.';}
  if(action.type!=='advance')message+=guardAdvanceSales(current,s,action,Engine.dailySlots,advanceUnavailable);
  const slotError=slotConflict(context(s),s.tycoon);if(slotError)throw Error(slotError);
  pruneRecoveries(s);if(['add','add-weekly','auto','edit','edit-weekly','optimize'].includes(action.type))validateRecoveries(context(s),s.tycoon,false);
  if(!Number.isFinite(s.cash)||!Number.isFinite(s.hq.prepaidRent)||(report&&['profit','cashDelta','nonfuel'].some(k=>!Number.isFinite(report[k]))))throw Error('Dữ liệu tài chính không hợp lệ. Tải lại phiên trước khi tiếp tục.');
  if(s.cash!==current.cash)s.hq.ledger.unshift({day:current.day,label:message.slice(0,120),amount:action.type==='setup'?500000000:s.cash-current.cash});s.hq.ledger=s.hq.ledger.slice(0,60);
  return {game:s,message,report};
 }catch(e){return {game:current,error:e.message,...(e.advanceRefund?{advanceRefund:e.advanceRefund}:{})};}
}
export {Engine};
