import {LOGOS,airportList,getAirport,routeQuote} from './network.js';
import Engine from './engine.js';
export const STARTING_MODELS=['A223','A320','A321','B738','B38M'];
const sample=(items,count,random)=>{const pool=[...items],out=[];for(let i=0;i<count&&pool.length;i++)out.push(pool.splice(Math.min(pool.length-1,Math.floor(random()*pool.length)),1)[0]);return out;};
export const drawLogos=(random=Math.random,previous=[])=>sample(LOGOS.filter(([id])=>!previous.some(([key])=>key===id)),3,random);
export const drawStartingAircraft=(random=Math.random)=>sample(STARTING_MODELS,2,random);
export {abbreviation} from './registration.js';
const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
export const whiteContrast=hex=>1.05/(luminance(hex)+.05);
function hslHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
export function drawColors(random=Math.random){const base=random()*360;return Array.from({length:6},(_,i)=>{const hue=(base+i*137.508+random()*20)%360,sat=60+random()*25;let light=42+random()*8,hex=hslHex(hue,sat,light);while(whiteContrast(hex)<4.5){light-=1;hex=hslHex(hue,sat,light);}return hex;});}
export function suggestedRoutes(ctx){
 const from=ctx.airline.origin,origin=getAirport(ctx,from),range=Math.max(...ctx.fleet.map(p=>ctx.types[p.type].range));
 const candidates=airportList(ctx).filter(a=>a.iata!==from).map(a=>{let route;try{route=ctx.routes.find(r=>r.from===from&&r.to===a.iata)||routeQuote(ctx,from,a.iata);}catch{return null;}if(route.km>range)return null;return {route,domestic:a.country===origin.country,score:(ctx.routes.some(r=>r.from===from&&r.to===a.iata)?1000:0)+(a.major?500:0)-Math.abs(route.km-1500)/10};}).filter(Boolean).sort((a,b)=>b.score-a.score||a.route.to.localeCompare(b.route.to));
 const enrich=c=>{const route=c.route,planes=ctx.fleet.filter(p=>ctx.types[p.type].range>=route.km).map(p=>{const state={...ctx.tycoon,prices:[[route.baseFare,Math.round(route.baseFare*2.5),route.baseFare*5]],schedules:[{id:1,plane:p.id,route:0,start:(ctx.day-1)%7*24}]},report=Engine.evaluate({...ctx,routes:[route]},state,ctx.day);return {id:p.id,model:p.type,hours:Engine.modelDuration(route,ctx.types[p.type]),profit:report.profit};});return {route,planes,domestic:c.domestic};};
 return {domestic:candidates.filter(c=>c.domestic).slice(0,2).map(enrich),international:candidates.filter(c=>!c.domestic).slice(0,1).map(enrich)};
}
