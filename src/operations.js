import {forecast,dayCashRequired} from './game.js';
import {repairCost} from './hq.js';
import {aircraftUnavailable} from './fleet.js';
export function operationsOutlook(game){
 const report=forecast(game),ready=game.fleet.filter(p=>p.wear<90&&!aircraftUnavailable(p,game.day)),idle=ready.filter(p=>!p.reserve&&!game.tycoon.schedules.some(x=>x.plane===p.id)),reserve=dayCashRequired(report),provision=game.fleet.reduce((n,p)=>n+Math.round(repairCost(game,p.id)*.35)/7,0),recent=game.tycoon.history.slice(0,7),fuelNeed=report.fuelAllocated??report.burn,co2Need=report.co2Allocated??report.co2;
 const fixedCostsOnly=report.rows.length===0 && report.revenue===0 && report.profit===-report.overhead;
 return {report,fixedCostsOnly,ready:ready.length,idle,grounded:game.fleet.length-ready.length,reserve,provision,cashAfter:game.cash+report.cashDelta,fuelCoverage:fuelNeed?game.fuel/fuelNeed:null,co2Coverage:co2Need?game.co2/co2Need:null,firstFlight:game.tycoon.history.some(h=>h.flights>0),weekly:{pax:recent.reduce((n,h)=>n+h.pax,0),profitableDays:recent.filter(h=>h.profit>0&&h.flights>0).length,cancelled:recent.reduce((n,h)=>n+(h.cancelled||0),0),days:recent.filter(h=>h.flights>0).length}};
}
