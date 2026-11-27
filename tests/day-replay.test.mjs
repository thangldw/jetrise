import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, transition, forecast, routesFor} from '../src/game.js';
import {context} from '../src/game.js';
import {rivalOperation} from '../src/strategy.js';
import {weatherKind} from '../src/gameplay.js';
import {buildDayReplay, replayFrame, rivalLegs, airportWeather, loadFactor, placeLabels, arcPoint, POPUP_HOURS} from '../src/day-replay.js';
import {replayEnabled, setReplay, REPLAY_KEY} from '../src/replay-setting.js';
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
    assert.equal(replay.totals.legs, report.flights, `day ${report.day}`);
    assert.equal(end.departed, report.flights, `day ${report.day}`);
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

const seatsIn = game => plane => (game.tycoon.cabins[plane] || []).reduce((n, seats) => n + seats, 0);

test('load factor comes from the cabin and is withheld for legs the day does not settle', () => {
  const career = simpleCareer(), {report, rows, game} = career.apply({type: 'advance'});
  const replay = buildDayReplay(rows, routesFor(game), report, {seatsOf: seatsIn(game)});
  for (const leg of replay.legs) { const load = loadFactor(leg); assert.ok(load > 0 && load <= 1, leg.id); assert.equal(leg.pax <= leg.seats, true, leg.id); }
  assert.equal(loadFactor({pax: 10, seats: 0, deferred: false}), null);
  assert.equal(loadFactor({pax: 0, seats: 150, deferred: true}), null);
  const run = longRunFixture({economy: 2, stage: 206}), first = run.apply({type: 'advance'});
  const ledger = buildDayReplay(first.rows, routesFor(first.game), first.report, {seatsOf: seatsIn(first.game)});
  assert.ok(ledger.legs.some(leg => leg.deferred && leg.arrival > 24 && loadFactor(leg) === null));
  assert.ok(ledger.legs.filter(leg => !leg.deferred).every(leg => loadFactor(leg) !== null));
});

test('highlights rank round trips by profit and add up to the flown revenue', () => {
  const career = simpleCareer(), {report, rows, game} = career.apply({type: 'advance'});
  const replay = buildDayReplay(rows, routesFor(game), report, {seatsOf: seatsIn(game)});
  assert.equal(replay.flights.length, 2);
  assert.ok(replay.flights[0].profit >= replay.flights[1].profit);
  assert.equal(replay.flights.reduce((n, f) => n + f.revenue, 0), report.revenue);
  assert.deepEqual(replay.flights.map(f => [f.from, f.to]).sort(), [['HAN', 'DAD'], ['HAN', 'NRT']]);
  assert.ok(replay.flights.every(f => f.load > 0 && f.load <= 1));
});

test('a revenue figure appears at departure and fades', () => {
  const career = simpleCareer(), {report, rows, game} = career.apply({type: 'advance'});
  const replay = buildDayReplay(rows, routesFor(game), report);
  assert.equal(replayFrame(replay, 5.9).popups.length, 0);
  const shown = replayFrame(replay, 6.5).popups;
  assert.deepEqual(shown.map(p => [p.from, p.departure]), [['HAN', 6]]);
  assert.ok(shown[0].age > 0 && shown[0].age < 1);
  assert.equal(replayFrame(replay, 6 + POPUP_HOURS).popups.some(p => p.departure === 6), false);
  assert.equal(replayFrame(replay, replay.to).popups.length, 0);
});

test('rival flights replay from the report in both competition modes', () => {
  const plain = simpleCareer();
  plain.apply({type: 'strategy-enable'});
  for (const [stage, result] of [[0, plain.apply({type: 'advance'})], [204, longRunFixture({economy: 2, stage: 204}).apply({type: 'advance'})], [206, longRunFixture({economy: 2, stage: 206}).apply({type: 'advance'})]]) {
    const {report, rows, game} = result, routes = routesFor(game);
    const timingOf = rival => rivalOperation(context(game), {...game.strategy.rivals.find(r => r.id === rival.id), route: rival.route}, report.day);
    const legs = rivalLegs(report, routes, timingOf);
    const flying = report.competition.rivals.filter(r => r.rotations === undefined ? r.seats > 0 : r.rotations > 0);
    assert.ok(flying.length > 0, `stage ${stage}`);
    assert.deepEqual([...new Set(legs.map(l => l.airline))].sort(), flying.map(r => r.id).sort(), `stage ${stage}`);
    for (const leg of legs) assert.ok(leg.departure >= 0 && leg.departure < 24 && leg.arrival > leg.departure && leg.from !== leg.to, `stage ${stage} ${leg.id}`);
    // Each rival's first departure is the hour the report records for it.
    for (const rival of flying) assert.equal(Math.min(...legs.filter(l => l.airline === rival.id).map(l => l.departure)), rival.hour ?? timingOf(rival).hour, `stage ${stage} ${rival.id}`);
    const replay = buildDayReplay(rows, routes, report, {rivals: legs}), end = replayFrame(replay, replay.to);
    // Rivals are shown, never counted.
    assert.deepEqual([end.revenue, end.pax], [report.revenue, report.pax], `stage ${stage}`);
    assert.ok(replayFrame(replay, legs[0].departure + .1).rivals.length > 0, `stage ${stage}`);
  }
  assert.deepEqual(rivalLegs({day: 1}, [], () => null), []);
  assert.deepEqual(rivalLegs({day: 1, competition: {rivals: [{id: 'swift', route: 0, seats: 0, pax: 0}]}}, [{from: 'HAN', to: 'DAD'}], () => ({hour: 6, hours: 3.5})), []);
});

test('weather shown on the map is the engine weather for that day', () => {
  const codes = ['HAN', 'DAD', 'NRT', 'BKK', 'SGN', 'SIN'];
  let seen = 0;
  for (let day = 1; day <= 60; day++) {
    const weather = airportWeather(codes, day);
    assert.deepEqual(weather.map(w => w.code), codes.filter(code => weatherKind(code, day) !== 'clear'));
    for (const w of weather) { assert.equal(w.kind, weatherKind(w.code, day)); assert.equal(w.demand, w.kind === 'storm' ? -45 : -15); seen++; }
  }
  assert.ok(seen > 0);
});

test('cancelled flights are listed from the report at their scheduled time', () => {
  const run = longRunFixture({economy: 1, stage: 200});
  let result;
  for (let i = 0; i < 9 && !result?.report.cancelled; i++) result = run.apply({type: 'advance'});
  const {report, rows, game} = result, replay = buildDayReplay(rows, routesFor(game), report);
  assert.ok(report.cancelled > 0);
  assert.equal(replay.cancellations.length, report.cancellations.length);
  for (const c of replay.cancellations) assert.ok(c.plane && c.from && c.to && c.reason && c.at >= 0 && c.at < 24);
  assert.equal(replayFrame(replay, replay.from).cancelled.length, replay.cancellations.filter(c => c.at <= replay.from).length);
  assert.equal(replayFrame(replay, replay.to).cancelled.length, report.cancellations.length);
});

test('airport labels avoid each other and other airports', () => {
  const size = 10, points = [{x: 100, y: 100, iata: 'HAN'}, {x: 104, y: 106, iata: 'DAD'}, {x: 96, y: 108, iata: 'BKK'}, {x: 400, y: 100, iata: 'NRT'}];
  const placed = placeLabels(points, size), boxes = placed.map(p => p.label);
  assert.deepEqual(placed.map(p => p.iata), points.map(p => p.iata));
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++)
    assert.ok(Math.abs(boxes[a].x - boxes[b].x) >= size * 2.2 || Math.abs(boxes[a].y - boxes[b].y) >= size * 1.1, `${placed[a].iata}/${placed[b].iata}`);
  // An isolated airport keeps its label directly below the dot.
  assert.ok(placed[3].label.x === 400 && placed[3].label.y > 100);
});

test('the replay preference defaults to on, lives outside the career and survives blocked storage', () => {
  const values = new Map([['jetrise-career-v1', '{"schema":1}']]);
  const storage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
  assert.equal(replayEnabled(storage), true);
  setReplay(storage, false);
  assert.equal(replayEnabled(storage), false);
  assert.deepEqual([...values], [['jetrise-career-v1', '{"schema":1}'], [REPLAY_KEY, 'off']]);
  setReplay(storage, true);
  assert.equal(replayEnabled(storage), true);
  const blocked = {getItem() { throw Error('SecurityError'); }, setItem() { throw Error('QuotaExceededError'); }};
  assert.equal(replayEnabled(blocked), true);
  assert.doesNotThrow(() => setReplay(blocked, false));
});
