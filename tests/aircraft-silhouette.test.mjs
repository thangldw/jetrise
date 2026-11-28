import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES} from '../src/game.js';
import {silhouetteClass} from '../src/fleet-display.js';

test('every aircraft type maps to a silhouette class by cabin size',()=>{
 assert.equal(silhouetteClass(TYPES.E190.seats),'regional');assert.equal(silhouetteClass(TYPES.A320.seats),'narrow');assert.equal(silhouetteClass(TYPES.B789.seats),'wide');assert.equal(silhouetteClass(TYPES.A388.seats),'super');
 for(const t of Object.values(TYPES))assert.ok(['regional','narrow','wide','super'].includes(silhouetteClass(t.seats)));
});
