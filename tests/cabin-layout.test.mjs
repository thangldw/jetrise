import test from 'node:test';
import assert from 'node:assert/strict';
import {cabinLayout,CABIN_PROFILES} from '../src/cabin-layout.js';
import {TYPES} from '../src/game.js';

test('every aircraft has a deliberate single- or twin-aisle plan',()=>{
 assert.deepEqual(Object.keys(CABIN_PROFILES).sort(),Object.keys(TYPES).sort());
 for(const model of ['A320','A321','A223','E190','B738','B38M'])assert.equal(cabinLayout([1,1,1],model).blocks,2);
 for(const model of ['B788','B789','B77W','A339','A359','A351','A388'])assert.equal(cabinLayout([1,1,1],model).blocks,3);
 assert.deepEqual(CABIN_PROFILES.E190[0],[2,2]);assert.deepEqual(CABIN_PROFILES.A223[0],[2,3]);assert.deepEqual(CABIN_PROFILES.A339[0],[2,4,2]);
});
test('all models plot exact counts, unique seat numbers and non-overlapping geometry',()=>{
 for(const model of Object.keys(TYPES))for(const counts of [[146,14,2],[81,8,1],[5,44,2],[250,0,0],[0,0,0],[0,0,59],[555,0,0]]){
  const plan=cabinLayout(counts,model),numbers=[];let last=0;
  for(const s of plan.sections){
   assert.equal(s.seats.length,counts[s.index]);if(!s.count)continue;
   assert(s.y>=last);last=s.y+s.height;
   for(const seat of s.seats){
    assert(seat.x>=plan.left&&seat.x+seat.width<=plan.right);
    assert(seat.y>=s.y&&seat.y+seat.height<=s.y+s.height);
    assert(s.aisles.every(a=>seat.x+seat.width<=a.x||seat.x>=a.x+a.width),'seat crosses aisle');
    numbers.push(`${seat.row}${seat.letter}`);
   }
   for(let i=0;i<s.seats.length;i++)for(let j=i+1;j<s.seats.length;j++){
    const a=s.seats[i],b=s.seats[j];assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'seat overlap');
   }
   for(let i=s.across;i<s.seats.length;i++)assert.equal(s.seats[i].x,s.seats[i-s.across].x);
  }
  assert.equal(new Set(numbers).size,numbers.length);assert(last<plan.height-90);
 }
});
test('one-seat adjustments change one mark without shifting other seats in that class',()=>{
 for(const model of Object.keys(TYPES))for(let c=0;c<3;c++){
  const counts=[31,13,7],a=cabinLayout(counts,model).sections.find(s=>s.index===c);counts[c]++;
  const b=cabinLayout(counts,model).sections.find(s=>s.index===c);
  assert.equal(b.seats.length-a.seats.length,1);assert.deepEqual(b.seats.slice(0,-1),a.seats);
 }
});
