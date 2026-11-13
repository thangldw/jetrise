import {marketProfile} from './economy.js';
import data from './data/airports.js';
export const AIRPORTS=Object.fromEntries(data.map(([iata,name,country,lat,lon,city,major])=>[iata,{iata,name,country,lat,lon,city,major}]));
export const airportList=s=>[...Object.values(AIRPORTS),...(s?.network?.airports||[])];
export const getAirport=(s,code)=>Object.hasOwn(AIRPORTS,code)?AIRPORTS[code]:s?.network?.airports?.find(a=>a.iata===code);
const localCities={HAN:'Hà Nội',SGN:'TP. Hồ Chí Minh',DAD:'Đà Nẵng'};
export const airportLabel=(s,code)=>{const a=getAirport(s,code);if(!a)return code;const city=(localCities[code]||a.city||'').trim();return `${city&&city.toLocaleLowerCase()!==a.name.trim().toLocaleLowerCase()?city+' · ':''}${a.name} (${code})`;};
export const routeLabel=(s,r)=>`${airportLabel(s,r.from)} ↔ ${airportLabel(s,r.to)}`;
const countryNames=new Intl.DisplayNames(['vi'],{type:'region'});
export const countryName=code=>countryNames.of(code);
export function distance(a,b){const rad=n=>n*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon),h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return Math.round(6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h)))));}
export function routeQuote(s,from,to){
 const a=getAirport(s,from),b=getAirport(s,to);if(!a||!b||from===to)throw Error('Chọn hai sân bay khác nhau.');
 const km=distance(a,b);if(km<50)throw Error('Hai sân bay cần cách nhau ít nhất 50 km.');
 return {from,to,code:from+' → '+to,name:b.name,country:b.country,km,cycle:1+km*2/800,baseFare:Math.min(1800,Math.round(70+km*.055)),demand:b.major?850:550,price:s?.economyVersion===2?Math.round((4000000+km*2500)/1000)*1000:Math.round((90000+km*60)/1000)*1000,x:Math.max(.05,Math.min(.95,(b.lon+180)/360)),y:Math.max(.08,Math.min(.88,(90-b.lat)/180)),...(s?.economyVersion===2?marketProfile(a,b,km):{})};
}
export function validateAirport(a){
 if(!a||!/^[A-Z]{3}$/.test(a.iata)||typeof a.name!=='string'||a.name.trim().length<2||a.name.length>80||(a.city!==undefined&&(typeof a.city!=='string'||a.city.length>80))||typeof a.country!=='string'||!new Set(data.map(r=>r[2])).has(a.country)||!Number.isFinite(a.lat)||a.lat< -90||a.lat>90||!Number.isFinite(a.lon)||a.lon< -180||a.lon>180)throw Error('Sân bay cần mã IATA 3 chữ, tên 2–80 ký tự, quốc gia và tọa độ hợp lệ.');
}
export function restoreNetwork(s,baseRoutes){
 s.network??={airports:[],routes:[]};const n=s.network;
 if(!n||!Array.isArray(n.airports)||n.airports.length>30||!Array.isArray(n.routes)||n.routes.length>100)throw Error('Invalid network');
 const airports=new Set(Object.keys(AIRPORTS));for(const a of n.airports){validateAirport(a);if(airports.has(a.iata))throw Error('Duplicate airport');airports.add(a.iata);}
 const pairs=new Set(baseRoutes.map(r=>r.from+'-'+r.to));for(const r of n.routes){if(!r||!airports.has(r.from)||!airports.has(r.to)||pairs.has(r.from+'-'+r.to))throw Error('Invalid custom route');routeQuote(s,r.from,r.to);pairs.add(r.from+'-'+r.to);}
 return n;
}
export const DEFAULT_AIRLINE={name:'VANTIS AIR',logo:'wing',color:'#ff5955',origin:'HAN',personalized:false};
export const BRAND_COLORS=[['San hô','#ff5955'],['Đại dương','#2563eb'],['Ngọc lục bảo','#047857'],['Tím hoàng gia','#7c3aed'],['Hổ phách','#a65b00'],['Than chì','#334155']];
export const LOGOS=[['wing','Đôi cánh'],['compass','La bàn'],['horizon','Chân trời'],['wind','Làn gió'],['rose','Hoa gió'],['paper','Cánh giấy'],['globe','Địa cầu'],['mountain','Đỉnh núi'],['star','Sao dẫn đường'],['bird','Chim trời'],['planet','Quỹ đạo'],['lightning','Tia chớp'],['feather','Lông vũ'],['rocket','Bứt phá'],['waves','Sóng biển'],['infinity','Vô tận']];
export function validateAirline(a){if(!a||(a.abbreviation!==undefined&&!/^[A-Z]{1,5}$/.test(a.abbreviation))||(a.personalized!==undefined&&typeof a.personalized!=='boolean')||typeof a.name!=='string'||a.name.trim().length<2||a.name.length>32||!LOGOS.some(l=>l[0]===a.logo)||!/^#[0-9a-f]{6}$/i.test(a.color)||!Object.hasOwn(AIRPORTS,a.origin))throw Error('Tên hãng cần 2–32 ký tự; chọn logo, màu và sân bay khởi đầu hợp lệ.');}
