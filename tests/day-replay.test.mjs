import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, transition, forecast, routesFor} from '../src/game.js';
import {buildDayReplay, replayFrame, arcPoint} from '../src/day-replay.js';
import {longRunFixture} from './fixtures/long-run.mjs';

function simpleCareer() {
  let game = createGame();
  const apply = action => { const r = transition(game, action); assert.equal(r.error, undefined, action.type); game = r.game; return r; };
  apply({type: 'setup', name: 'Replay Air', origin: 'HAN', logo: 'wing', color: '#123abc', models: ['A320', 'B738']});
  apply({type: 'founding-next'}); apply({type: 'unlock', route: 3}); apply({type: 'unlock', route: 2}); apply({type: 'founding-finish'});
  apply({type: 'add', plane: game.fleet[0].id, route: 3, start: 6});
  apply({type: 'add', plane: game.fleet[1].id, route: 2, start: 8});
  return {get game() { return game; }, apply};
}

test('advance returns the settled rows without storing them in the career', () => {
  const career = simpleCareer(), expected = forecast(career.game).rows;
  const result = career.apply({type: 'advance'});
  assert.deepEqual(result.rows, expected);
  assert.equal('rows' in result.report, false);
  assert.equal(JSON.stringify(result.game).includes('"rows"'), false);
  assert.equal('rows' in career.apply({type: 'prices', route: 3, values: [150, 375, 750]}), false);
});

test('a round trip replays as two legs and ends on the day report totals', () => {
  const career = simpleCareer(), {report, rows, game} = career.apply({type: 'advance'});
  const replay = buildDayReplay(rows, routesFor(game), report);
  assert.equal(replay.legs.length, 4);
  assert.equal(replay.legs.length, report.flights);
  assert.deepEqual(replay.legs.map(l => [l.from, l.to, l.departure]).slice(0, 2), [['HAN', 'DAD', 6], ['DAD', 'HAN', 7.75]]);
  assert.equal(replay.from, 5.5);
  const before = replayFrame(replay, replay.from), mid = replayFrame(replay, 6.5), end = replayFrame(replay, replay.to);
  assert.deepEqual([before.revenue, before.pax, before.aircraft.length], [0, 0, 0]);
  assert.deepEqual(mid.aircraft.map(a => a.plane), [game.fleet[0].id]);
  assert.ok(mid.aircraft[0].progress > 0 && mid.aircraft[0].progress < 1);
  assert.ok(mid.revenue > 0 && mid.revenue < report.revenue);
  assert.deepEqual([end.done, end.revenue, end.pax, end.departed, end.aircraft.length], [true, report.revenue, report.pax, 4, 0]);
});

test('revenue never decreases during a replay', () => {
  const career = simpleCareer(), {report, rows, game} = career.apply({type: 'advance'});
  const replay = buildDayReplay(rows, routesFor(game), report);
  let last = 0;
  for (let hour = replay.from; hour <= replay.to; hour += .25) { const {revenue} = replayFrame(replay, hour); assert.ok(revenue >= last); last = revenue; }
});

test('per-leg ledger days replay inside 24 hours and still match the report', () => {
  const run = longRunFixture({economy: 2, stage: 206});
  for (let i = 0; i < 3; i++) {
    const {report, rows, game} = run.apply({type: 'advance'});
    const replay = buildDayReplay(rows, routesFor(game), report), end = replayFrame(replay, replay.to);
    assert.ok(replay.from >= 0 && replay.to <= 24, `day ${report.day}`);
    assert.deepEqual([end.revenue, end.pax], [report.revenue, report.pax], `day ${report.day}`);
    // A leg that left before midnight is already airborne when the next day opens.
    if (i) assert.ok(replayFrame(replay, replay.from).aircraft.length > 0, `day ${report.day}`);
    for (const leg of replay.legs) assert.ok(leg.arrival > leg.departure && leg.from !== leg.to);
  }
});

test('a day without flights produces an empty replay', () => {
  const replay = buildDayReplay([], [], {day: 3, revenue: 0, pax: 0, profit: -3360});
  assert.equal(replay.legs.length, 0);
  assert.deepEqual(replayFrame(replay, replay.to).revenue, 0);
});

test('an arc is the same curve in both directions', () => {
  const a = {x: 10, y: 40}, b = {x: 90, y: 60};
  for (const t of [0, .25, .5, 1]) {
    const out = arcPoint(a, b, 12, t), back = arcPoint(b, a, 12, 1 - t);
    assert.ok(Math.abs(out.x - back.x) < 1e-9 && Math.abs(out.y - back.y) < 1e-9);
  }
  assert.deepEqual([arcPoint(a, b, 12, 0).x, arcPoint(a, b, 12, 1).y], [10, 60]);
});
