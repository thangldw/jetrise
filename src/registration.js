export function abbreviation(name){const words=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'D').toUpperCase().match(/[A-Z]+/g)||[];return (words.length>1?words.map(w=>w[0]).join('').slice(0,5):words[0]?.slice(0,3))||'AIR';}
export const aircraftNumber=id=>Number(id.match(/(\d+)$/)?.[1]||0);
export function reserveAircraftId(s){const n=s.nextAircraftNumber;s.nextAircraftNumber++;return `${s.airline.abbreviation||abbreviation(s.airline.name)}-${n}`;}
