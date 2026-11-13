import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, context, transition, restoreGame, forecast, dayCashRequired, Engine} from '../src/game.js';
import {RESEARCH, RESEARCH_BRANCHES, researchEffects} from '../src/research.js';
import {POSITIONINGS, positioningPreferences, positioningDemand} from '../src/positioning.js';
import {modifiers} from '../src/hq.js';
import {projectedWeekReports, plannerBasis} from '../src/planner.js';
import {previewDevelopment} from '../src/development-preview.js';
import {persistGame, readSession} from '../src/save-store.js';
import {marketEvents} from '../src/gameplay.js';

const act = (s, action) => { const r = transition(s, action); assert(!r.error, r.error); return r.game; };
const close = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function fixture(idle = false) {
  const s = createGame(); s.cash = 20000000; s.setupComplete = true;
  s.fleet.forEach(p => { p.wear = 0; p.fault = null; p.serviceDueAt = 300; });
  if (idle) s.tycoon.schedules = [];
  return s;
}
function advance(s) {
  const r = transition(s, {type: 'advance'}); assert(!r.error, r.error);
  return {...r, game: restoreGame(JSON.stringify(r.game))};
}

test('legacy research rights, fares, schedules, balances and existing service survive unchanged without opt-in', () => {
  let s = fixture();
  for (const key of ['fuel', 'comfort', 'maintenance']) s = act(s, {type: 'research', key});
  s = act(s, {type: 'service', level: 2});
  const before = JSON.stringify(s), restored = restoreGame(before);
  assert.deepEqual(restored, s); assert.equal(JSON.stringify(s), before);
  assert.equal(restored.hq.positioning, undefined); assert.equal(restored.hq.researchProject, undefined);
  assert.deepEqual(restored.tycoon.research, ['fuel', 'comfort', 'maintenance']);
  assert.deepEqual(forecast(restored), forecast(s)); assert.equal(forecast(restored).positioningFee, 0);
  for (const key of s.tycoon.research) assert(transition(s, {type: 'research', key}).error);
});

test('all branches retain prerequisites and complete exactly once on their due day, across save/reload', () => {
  for (const branch of RESEARCH_BRANCHES) {
    let s = fixture(true); const [root, first, second] = branch.keys;
    assert(transition(s, {type: 'research', key: second}).error);
    const cash = s.cash; s = act(s, {type: 'research', key: root});
    assert.equal(s.cash, cash - RESEARCH[root].price); assert(s.tycoon.research.includes(root));
    for (const key of [first, second]) {
      const paid = s.cash, start = s.day; s = act(s, {type: 'research', key});
      assert.equal(s.cash, paid - RESEARCH[key].price); assert(!s.tycoon.research.includes(key));
      assert.deepEqual(s.hq.researchProject, {key, startedDay: start, readyDay: start + RESEARCH[key].days});
      for (let n = 1; n <= RESEARCH[key].days; n++) {
        s = restoreGame(JSON.stringify(s)); const before = s.cash, f = forecast(s), r = advance(s); s = r.game;
        close(s.cash, before + f.cashDelta);
        assert.equal(s.tycoon.research.includes(key), n === RESEARCH[key].days);
        assert.equal(r.report.researchCompleted, n === RESEARCH[key].days ? key : undefined);
      }
      assert.equal(s.hq.researchProject, undefined); assert.equal(s.tycoon.research.filter(k => k === key).length, 1);
      const r = advance(s); assert.equal(r.report.researchCompleted, undefined); s = r.game;
    }
    assert.deepEqual(s.tycoon.research, branch.keys);
  }
});

test('one active project, failed actions and cancellation preserve completed work and never refund or silently spend', () => {
  let s = act(fixture(true), {type: 'research', key: 'fuel'});
  s = act(s, {type: 'research', key: 'dispatch'});
  const before = JSON.stringify(s);
  for (const a of [{type: 'research', key: 'dispatch'}, {type: 'research', key: 'comfort'}, {type: 'research', key: 'lightweight'}, {type: 'research', key: '__proto__'}]) {
    const r = transition(s, a); assert(r.error); assert.equal(r.game, s); assert.equal(JSON.stringify(s), before);
  }
  s = advance(s).game; const cash = s.cash; s = act(s, {type: 'research-cancel'});
  assert.equal(s.cash, cash); assert.deepEqual(s.tycoon.research, ['fuel']); assert.equal(s.hq.researchProject, undefined);
  assert(transition(s, {type: 'research-cancel'}).error);
  s = act(s, {type: 'research', key: 'dispatch'}); assert.equal(s.hq.researchProject.readyDay, s.day + 3);
  assert.equal(s.cash, cash - RESEARCH.dispatch.price);
  const poor = fixture(true); poor.cash = 1; assert(transition(poor, {type: 'research', key: 'fuel'}).error); assert.equal(poor.cash, 1);
});

test('restore rejects malformed projects, missing predecessors and malformed positioning without accepting free upgrades', () => {
  const base = act(act(fixture(), {type: 'research', key: 'fuel'}), {type: 'research', key: 'dispatch'});
  for (const mutate of [s => s.hq.researchProject.readyDay--, s => s.hq.researchProject.startedDay = 0, s => s.hq.researchProject.startedDay = 2, s => s.hq.researchProject.key = 'fuel', s => s.tycoon.research = [], s => s.tycoon.research.push('dispatch'), s => s.hq.researchProject = null, s => s.tycoon.research.push('lightweight')]) {
    const s = structuredClone(base); mutate(s); assert.throws(() => restoreGame(JSON.stringify(s)));
  }
  for (const positioning of [null, {key: 'none', startedDay: 1}, {key: 'fake', startedDay: 1}, {key: 'value', startedDay: 2}, {key: 'value', startedDay: 0}, {key: 'value', startedDay: 1.5}]) {
    const s = fixture(); s.hq.positioning = positioning; assert.throws(() => restoreGame(JSON.stringify(s)));
  }
});

test('fixed positioning fees settle once even on idle days, commitment is seven days, and switching is explicit', () => {
  let s = fixture(true), old = structuredClone(s); s = act(s, {type: 'positioning', key: 'business', fee: 0, daily: 0});
  assert.equal(s.cash, old.cash - POSITIONINGS.business.fee);
  for (let n = 0; n < 7; n++) {
    assert(transition(s, {type: 'positioning', key: 'none'}).error);
    assert(transition(s, {type: 'positioning', key: 'leisure'}).error);
    const f = forecast(s), free = structuredClone(s); delete free.hq.positioning; const f0 = forecast(free);
    assert.equal(f.positioningFee, 3000); close(f.profit, f0.profit - 3000); close(f.cashDelta, f0.cashDelta - 3000);
    close(dayCashRequired(f), dayCashRequired(f0) + 3000);
    const before = s.cash; s = advance(s).game; close(s.cash, before + f.cashDelta);
  }
  const cash = s.cash; s = act(s, {type: 'positioning', key: 'leisure'});
  assert.equal(s.cash, cash - 50000); assert.equal(s.hq.positioning.startedDay, 8);
  for (let n = 0; n < 7; n++) s = advance(s).game;
  const stopped = act(s, {type: 'positioning', key: 'none'});
  assert.equal(stopped.cash, s.cash); assert.equal(forecast(stopped).positioningFee, 0);
  const poor = fixture(); poor.cash = 39999; assert(transition(poor, {type: 'positioning', key: 'value'}).error);
});

test('service variable cost/revenue is per carried passenger, keeps capacity and fuel, and compounds with legacy packages', () => {
  let s = act(fixture(), {type: 'service', level: 2});
  const f = forecast(s), next = act(s, {type: 'positioning', key: 'value'}), g = forecast(next);
  // The legacy fixture is capacity-limited, so the only differences here are service economics and the fixed fee.
  assert.equal(g.pax, f.pax); assert(g.pax > 0); close(g.revenue - f.revenue, f.pax * 10);
  close(g.operatingNonfuel - f.operatingNonfuel, f.pax * 3); close(g.profit - f.profit, f.pax * 7 - 1500);
  close(g.burn, f.burn); assert.equal(g.co2, f.co2); assert.deepEqual(next.tycoon.cabins, s.tycoon.cabins);
  assert.equal(next.hq.service, 2); const day = advance(next); close(day.report.profit, g.profit);
  const empty = structuredClone(next); empty.tycoon.prices = empty.tycoon.prices.map(() => [10000, 10000, 10000]);
  const out = forecast(empty); assert.equal(out.pax, 0); assert.equal(out.revenue, 0); assert(out.burn > 0);
});

test('positioning changes route-specific addressable demand and targeted AI preference while conserving market and seats', () => {
  const base = fixture(); base.tycoon.prices = base.tycoon.prices.map(v => v.map(n => Math.round(n * 1.5)));
  const value = act(base, {type: 'positioning', key: 'value'}), business = act(base, {type: 'positioning', key: 'business'});
  assert(positioningDemand(value, {segment: 'business'}, 1) < positioningDemand(business, {segment: 'business'}, 1));
  assert(positioningDemand(value, {}, 1) > positioningDemand(business, {}, 1));
  assert.notDeepEqual(Engine.demand(context(value), value.tycoon, 0, 1), Engine.demand(context(business), business.tycoon, 0, 1));
  const ai = act(base, {type: 'strategy-enable'}), runs = Object.keys(POSITIONINGS).map(key => forecast(key === 'none' ? ai : act(ai, {type: 'positioning', key})));
  assert(runs.some(f => f.pax !== runs[0].pax));
  for (const f of runs) for (const m of f.competition.markets) {
    assert.equal(m.potential, m.player + m.swift + m.aurelia + m.outside);
    for (const x of m.segments) assert.equal(x.total, x.player + x.swift + x.aurelia + x.outside);
    assert.equal(m.potential, runs[0].competition.markets.find(x => x.route === m.route).potential);
  }
  for (const f of runs) for (const r of f.rows) r.passengers.forEach((n, k) => assert(n <= base.tycoon.cabins[r.plane][k] * 2));
});

test('completed branches reduce actual fuel/CO2, wear and service costs without granting seats or repairing faults', () => {
  let s = act(fixture(), {type: 'positioning', key: 'business'}); s.tycoon.research = ['fuel', 'comfort', 'maintenance'];
  const f = forecast(s), old = structuredClone(s); s.tycoon.research = Object.keys(RESEARCH);
  const g = forecast(s); close(g.burn, f.burn * .97 * .98); assert(g.co2 < f.co2);
  close(modifiers(s).serviceCost, 12 * .8); assert(g.operatingNonfuel < f.operatingNonfuel);
  for (const p of s.fleet) if (f.wear[p.id] > p.wear) close(g.wear[p.id] - p.wear, (f.wear[p.id] - p.wear) * .85 * .9);
  assert.deepEqual(s.tycoon.cabins, old.tycoon.cabins); assert.deepEqual(s.tycoon.schedules, old.tycoon.schedules);
  close(positioningPreferences(s)[1], POSITIONINGS.business.preferences[1] * 1.06);
  const bad = structuredClone(s); bad.fleet[0].fault = 'Hydraulic fault';
  assert(!forecast(bad).rows.some(r => r.plane === bad.fleet[0].id)); assert(bad.fleet[0].fault);
  assert.deepEqual(restoreGame(JSON.stringify(s)).tycoon.research, s.tycoon.research);
});

test('seven-day projections agree with actual completion-day operations and remain read-only, with AI on and off', () => {
  for (const ai of [false, true]) {
    let s = act(act(fixture(), {type: 'research', key: 'fuel'}), {type: 'research', key: 'dispatch'});
    s = act(s, {type: 'positioning', key: 'value'}); if (ai) s = act(s, {type: 'strategy-enable'});
    s.gameplay.research = marketEvents(context(s)).map(e => e.id);
    const before = JSON.stringify(s), days = projectedWeekReports(context(s), s.tycoon, false);
    assert.equal(JSON.stringify(s), before);
    for (const {report} of days) {
      const r = advance(s); close(r.report.burn, report.burn); close(r.report.revenue, report.revenue);
      close(r.report.operatingNonfuel, report.nonfuel); assert.equal(r.report.pax, report.pax); s = r.game;
    }
  }
});

test('read-only quotes use canonical forecast and the planner basis invalidates on either development input', () => {
  let s = fixture(); const before = JSON.stringify(s), basis = plannerBasis(context(s), s.tycoon);
  const quote = previewDevelopment(context(s), s.tycoon, {type: 'positioning', key: 'business'}), trial = act(s, {type: 'positioning', key: 'business'});
  close(quote.after.profit, projectedWeekReports(context(trial), trial.tycoon, false).reduce((n, d) => n + d.report.profit - 3000, 0));
  assert.equal(JSON.stringify(s), before); assert.notEqual(plannerBasis(context(trial), trial.tycoon), basis);
  s = act(s, {type: 'research', key: 'fuel'}); const previous = JSON.stringify(s), q = previewDevelopment(context(s), s.tycoon, {type: 'research', key: 'dispatch'});
  assert(q.after.burn < q.before.burn); assert.equal(JSON.stringify(s), previous);
  assert.notEqual(plannerBasis(context(act(s, {type: 'research', key: 'dispatch'})), s.tycoon), plannerBasis(context(s), s.tycoon));
});

test('a timed service-cost project also matches live-leg and overnight forecast settlement day by day', () => {
  for (const overnight of [false, true]) {
    let s = act(act(fixture(), {type: 'research', key: 'comfort'}), {type: 'research', key: 'serviceSystems'});
    s = act(s, {type: 'positioning', key: 'business'});
    s = act(s, {type: 'leg-economy-enable', migrationId: '0123456789abcdef0123456789abcdef'});
    if (overnight) s = act(s, {type: 'overnight-enable', migrationId: 'abcdef0123456789abcdef0123456789'});
    s.gameplay.research = marketEvents(context(s)).map(e => e.id);
    const days = projectedWeekReports(context(s), s.tycoon, false);
    for (const {report} of days) {
      const r = advance(s); close(r.report.operatingNonfuel, report.nonfuel); close(r.report.revenue, report.revenue);
      assert.deepEqual(r.game.legEconomy, report.legEconomyState); s = r.game;
    }
    assert(s.tycoon.research.includes('serviceSystems'));
  }
});

test('canonical save-store preserves optional projects and completed research without changing the root schema', () => {
  let s = act(act(fixture(), {type: 'research', key: 'comfort'}), {type: 'research', key: 'serviceSystems'});
  s = act(s, {type: 'positioning', key: 'leisure'});
  const data = new Map(), store = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value)};
  const raw = persistGame(store, s, null), session = readSession(store);
  assert.equal(session.raw, raw); assert.deepEqual(session.game, s); assert.equal(s.tycoon.schema, 1);
  s = advance(s).game; persistGame(store, s, raw); assert.deepEqual(readSession(store).game, s);
});

test('a frozen live return is not repriced by service activation or newly completed research', () => {
  let s = fixture(true); s = act(s, {type: 'add', plane: s.fleet[0].id, route: 0, start: 23});
  s = act(s, {type: 'leg-economy-enable', migrationId: '0123456789abcdef0123456789abcdef'});
  s = advance(s).game; assert(s.legEconomy.rounds.length > 0);
  const frozen = JSON.stringify(s.legEconomy), f = forecast(s);
  const next = act(s, {type: 'positioning', key: 'business'}); next.tycoon.research = Object.keys(RESEARCH);
  assert.equal(JSON.stringify(next.legEconomy), frozen);
  const g = forecast(next); close(g.revenue, f.revenue); close(g.operatingNonfuel, f.operatingNonfuel); close(g.burn, f.burn);
  close(g.cashDelta, f.cashDelta - 3000); assert.equal(advance(next).game.legEconomy.rounds.length, 0);
});

test('sold overnight itineraries retain both fare and serving cost when positioning changes', () => {
  let s = fixture(true); s.openedRoutes = [2, 3];
  s = act(s, {type: 'add', plane: s.fleet[2].id, route: 3, start: 19.5});
  s = act(s, {type: 'add', plane: s.fleet[0].id, route: 2, start: 25});
  s.tycoon.prices[3][0] = 200; s.tycoon.prices[2][0] = 360;
  s = act(s, {type: 'leg-economy-enable', migrationId: '0123456789abcdef0123456789abcdef'});
  s = act(s, {type: 'overnight-enable', migrationId: 'abcdef0123456789abcdef0123456789'});
  s = advance(s).game; const journey = structuredClone(s.legEconomy.overnight.journeys[0]); assert(journey);
  const old = forecast(s), next = act(s, {type: 'positioning', key: 'business'}), f = forecast(next);
  assert.deepEqual(next.legEconomy.overnight.journeys[0], journey);
  close(f.connections.revenue, old.connections.revenue); close(f.connections.revenue, journey.legs[1].fareCents / 100);
  const r = advance(next); assert.equal(r.game.legEconomy.overnight.journeys.length, 0);
  close(r.report.cashDelta, f.cashDelta);
});
