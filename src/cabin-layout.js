// Representative game layouts, not certified manufacturer seat plans.
// Class order is Y/J/F; each block is separated by a physical aisle.
const narrow = (economy=[3,3]) => [economy,[2,2],[1,1]];
const wide = (economy=[3,3,3]) => [economy,[1,2,1],[1,2,1]];
export const CABIN_PROFILES = {
 A320:narrow(), A321:narrow(), B738:narrow(), B38M:narrow(),
 A223:narrow([2,3]), E190:narrow([2,2]),
 B788:wide(), B789:wide(), A359:wide(), A351:wide(),
 A339:wide([2,4,2]), B77W:wide([3,4,3]), A388:wide([3,4,3])
};
export function cabinLayout(counts,model='A320') {
 const layouts=CABIN_PROFILES[model]||CABIN_PROFILES.A320;
 const width=360,left=54,right=306,floorWidth=right-left,aisleWidth=22;
 let cursor=150,rowNumber=1;
 const sections=[2,1,0].map(index=>{
  const blocks=layouts[index],across=blocks.reduce((n,x)=>n+x,0),count=counts[index],rows=Math.ceil(count/across);
  const cell=(floorWidth-(blocks.length-1)*aisleWidth)/across;
  const seatWidth=Math.min(cell-3,index===0?26:index===1?40:45),seatHeight=index===0?28:index===1?40:46,pitch=seatHeight+10;
  const y=cursor,aisles=[],columns=[];
  let x=left,column=0;
  for(let block=0;block<blocks.length;block++){
   for(let c=0;c<blocks[block];c++)columns.push({x:x+c*cell+(cell-seatWidth)/2,block,column:column++,letter:'ABCDEFGHJK'[column-1]});
   x+=blocks[block]*cell;
   if(block<blocks.length-1){aisles.push({x,width:aisleWidth});x+=aisleWidth;}
  }
  const seats=Array.from({length:count},(_,i)=>({...columns[i%across],y:y+44+Math.floor(i/across)*pitch,width:seatWidth,height:seatHeight,row:rowNumber+Math.floor(i/across)}));
  const height=count?44+rows*pitch+12:0,firstRow=rowNumber;
  rowNumber+=rows;if(count)cursor+=height+28;
  return {index,count,y,height,seats,blocks,across,rows,firstRow,columns,aisles,pitch};
 });
 return {sections,width,height:Math.max(360,cursor+100),left,right,blocks:layouts[0].length,aisles:layouts[0].length-1,model};
}
