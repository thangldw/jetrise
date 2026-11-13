import test from 'node:test';
import assert from 'node:assert/strict';
import {frameNetwork} from '../src/map-framing.js';
test('local framing separates domestic endpoints and keeps all endpoints in frame',()=>{const a={lon:105.8,lat:21.2},b={lon:106.6,lat:10.8},f=frameNetwork([a,b],a);assert(f.box.w<1000);for(const p of [a,b]){const v=f.point(p);assert(v.x>0&&v.x<100&&v.y>0&&v.y<100);}assert(Math.abs(f.point(a).y-f.point(b).y)>20);});
test('dateline routes wrap together while global coordinates remain canonical',()=>{const a={lon:175,lat:30},b={lon:-175,lat:15},f=frameNetwork([a,b],a);assert(Math.abs(f.raw(a).x-f.raw(b).x)<30);assert.deepEqual(frameNetwork([a,b],a,true).box,{x:0,y:0,w:1000,h:500});});
