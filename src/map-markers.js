// Cluster screen-space hit targets, never airport coordinates or route geometry.
export const MAP_MARKER_WIDTH=88;
export const MAP_MARKER_HEIGHT=44;
export function clusterMapMarkers(points,width,height){
 const w=Math.max(1,width),h=Math.max(1,height);
 const clamp=(n,size,half)=>size<half*2?size/2:Math.max(half,Math.min(size-half,n));
 const position=members=>({
  x:clamp(members.reduce((sum,p)=>sum+p.x*w/100,0)/members.length,w,MAP_MARKER_WIDTH/2+6),
  y:clamp(members.reduce((sum,p)=>sum+p.y*h/100,0)/members.length,h,MAP_MARKER_HEIGHT/2+6)
 });
 const groups=[...points].sort((a,b)=>a.id.localeCompare(b.id)).map(p=>({members:[p],...position([p])}));
 // Recheck after every merge: a new centroid can overlap another hit target.
 for(let merged=true;merged;){
  merged=false;
  outer:for(let a=0;a<groups.length;a++)for(let b=a+1;b<groups.length;b++){
   if(Math.abs(groups[a].x-groups[b].x)<MAP_MARKER_WIDTH+10&&Math.abs(groups[a].y-groups[b].y)<MAP_MARKER_HEIGHT+10){
    const members=[...groups[a].members,...groups[b].members];
    groups[a]={members,...position(members)};groups.splice(b,1);merged=true;break outer;
   }
  }
 }
 return groups.map(g=>({...g,key:g.members.map(p=>p.id).sort().join('|'),x:g.x/w*100,y:g.y/h*100}));
}

export const normalizeMapSearch=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase().trim();
