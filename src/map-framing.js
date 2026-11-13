export function frameNetwork(airports,origin,global=false){
 const raw=a=>{let x=(a.lon+180)/360*1000;const anchor=(origin.lon+180)/360*1000;if(!global){while(x-anchor>500)x-=1000;while(x-anchor< -500)x+=1000;}return {x,y:(90-a.lat)/180*500};},points=airports.map(raw);
 let box={x:0,y:0,w:1000,h:500};
 if(!global){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,h=Math.min(500,Math.max(70,Math.max(...ys)-Math.min(...ys)+40,(Math.max(...xs)-Math.min(...xs)+70)/2));box={x:cx-h,y:Math.max(0,Math.min(500-h,cy-h/2)),w:h*2,h};}
 return {box,raw,point:a=>{const p=raw(a);return {x:(p.x-box.x)/box.w*100,y:(p.y-box.y)/box.h*100};}};
}
