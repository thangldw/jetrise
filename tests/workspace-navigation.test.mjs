import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceDestination,WORKSPACE_DEFAULTS} from '../src/workspace-navigation.js';
test('management shortcuts resolve to the five workspaces without changing career state',()=>{
 assert.deepEqual(Object.keys(WORKSPACE_DEFAULTS),['home','fleet','network','schedule','strategy']);
 for(const [type,page,section] of [['hq','home','hubs'],['routes','network','manage'],['planner','schedule','company'],['gameplay','strategy','competition'],['market','fleet','market']])assert.deepEqual(workspaceDestination(type),{page,section,plane:undefined});
});
test('deep shortcuts retain requested subarea and aircraft, while transactional forms remain dialogs',()=>{
 assert.deepEqual(workspaceDestination('gameplay',{section:'recovery'}),{page:'strategy',section:'recovery',plane:undefined});
 assert.deepEqual(workspaceDestination('fleet-studio',{plane:'TA-102',tab:'maintenance'}),{page:'fleet',section:'maintenance',plane:'TA-102'});
 for(const type of ['cabin','prices','add','slot','report','day-brief','settings','reset','founding-route'])assert.equal(workspaceDestination(type),null);
});
