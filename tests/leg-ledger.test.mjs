import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, context, transition, forecast, restoreGame} from '../src/game.js';
import {projectedWeekReports, plannerBasis} from '../src/planner.js';
import {marketEvents} from '../src/gameplay.js';
import {createShadowLedger, validateShadowLedger, settleShadowThrough, restoreShadowCheckpoint, studyLegLedger} from '../src/leg-ledger.js';

const act = (s, a) => { const r = transition(s, a); assert(!r.error, r.error); return r.game; };
function fixture() {
  const s = createGame(); s.setupComplete = true; s.tycoon.schedules = []; s.openedRoutes = [0, 1, 2, 3];
  for (const p of s.fleet) { p.wear = 0; p.fault = null; p.serviceDueAt = 300; }
  return s;
}
const add = (s, start = 0, plane = s.fleet[0].id, route = 0) => act(s, {type: 'add', plane, route, start});
const ledgerFor = s => createShadowLedger(context(s), s.tycoon);
const allZero = o => Object.values(o).every(v => v === 0);

test('shadow mode preserves the complete career, authoritative forecast and planner basis', () => {
  const s = add(fixture()), before = JSON.stringify(s), actual = forecast(s), basis = plannerBasis(context(s), s.tycoon);
  const study = studyLegLedger(context(s), s.tycoon);
  assert.equal(JSON.stringify(s), before); assert.deepEqual(forecast(s), actual);
  assert.equal(plannerBasis(context(s), s.tycoon), basis); assert.deepEqual(restoreGame(before), s);
  assert.equal(study.legs.length, 2); assert.equal(study.totals.deferredCents, 0);
  assert.deepEqual(study.totals, study.reference);
});

test('same-day direct flights reconcile daily cent-normalized revenue, cost, cash and customers', () => {
  const s = add(fixture()), study = studyLegLedger(context(s), s.tycoon), row = forecast(s).rows[0];
  assert.deepEqual(study.days[0].shadow, study.totals);
  assert.equal(study.totals.revenueCents, Math.round(row.revenue * 100));
  assert.equal(study.totals.expenseCents, Math.round(row.nonfuel * 100) + Math.round(row.fuelCost * 100) + Math.round(row.co2Cost * 100));
  assert.equal(study.totals.cashCents, Math.round(row.revenue * 100) - Math.round(row.nonfuel * 100) - Math.round(row.fuelPurchase * 100) - Math.round(row.co2Purchase * 100));
  assert.equal(study.totals.boardings, row.pax);
  assert(study.days.slice(1).every(d => allZero(d.shadow)));
});

test('Sunday flights retain dated return inventory and deferred revenue into the next week', () => {
  const s = add(fixture(), 166), ledger = ledgerFor(s), legs = ledger.legs;
  assert.equal(legs.length, 2); assert(legs[1].departure >= 168);
  assert.equal(legs[0].id, `7:${s.tycoon.schedules[0].id}:out`);
  assert.equal(legs[1].id, `7:${s.tycoon.schedules[0].id}:back`);
  const first = settleShadowThrough(ledger, null, 168);
  assert(first.checkpoint.totals.deferredCents > 0);
  assert.equal(first.checkpoint.totals.ticketCashCents, first.checkpoint.totals.ticketRevenueCents + first.checkpoint.totals.deferredCents);
  const next = settleShadowThrough(ledger, first.checkpoint, ledger.drainEnd);
  assert.equal(next.checkpoint.totals.deferredCents, 0);
  assert.equal(next.delta.ticketCashCents, 0); assert(next.delta.revenueCents > 0);
  const study = studyLegLedger(context(s), s.tycoon);
  assert.equal(study.days.length, 8); assert.equal(study.days[7].reference.revenueCents, 0);
  assert.deepEqual(study.totals, study.reference);
});

test('an exact-midnight arrival is settled in the next half-open day', () => {
  const s = add(fixture()), days = projectedWeekReports(context(s), s.tycoon, false);
  days[0].report.rows[0].start = 23; days[0].report.rows[0].hours = 3;
  const ledger = createShadowLedger(context(s), s.tycoon, days);
  assert.equal(ledger.legs[0].arrival, 24);
  const today = settleShadowThrough(ledger, null, 24);
  assert.equal(today.checkpoint.totals.revenueCents, 0);
  const tomorrow = settleShadowThrough(ledger, today.checkpoint, 48);
  assert.equal(tomorrow.events.filter(e => e.kind === 'arrival').length, 2);
  assert.equal(tomorrow.checkpoint.totals.deferredCents, 0);
});

test('round snapshot identity is independent of rescue aircraft and survives template edits', () => {
  let s = add(fixture()); const original = ledgerFor(s), bytes = JSON.stringify(original);
  s = act(s, {type: 'recover-flight', day: 1, slot: s.tycoon.schedules[0].id, mode: 'swap', plane: s.fleet[2].id});
  const changed = ledgerFor(s);
  assert.deepEqual(changed.legs.map(l => l.id), original.legs.map(l => l.id));
  assert.notEqual(changed.legs[0].plane, original.legs[0].plane);
  s.tycoon.schedules = []; s.tycoon.cabins[s.fleet[0].id][0] = 0;
  assert.equal(JSON.stringify(original), bytes);
  assert.equal(settleShadowThrough(original).checkpoint.totals.deferredCents, 0);
});

test('contract reservations precede public sales and mixed contract cents are conserved', () => {
  const s = add(fixture()), days = projectedWeekReports(context(s), s.tycoon, false), row = days[0].report.rows[0];
  row.passengers = [5, 1, 0]; row.pax = 6; row.contractPax = 3; row.contractRevenue = 123.47;
  row.revenue = row.contractRevenue + 2 * s.tycoon.prices[0][0] + s.tycoon.prices[0][1] + 6 * 5;
  const ledger = createShadowLedger(context(s), s.tycoon, days);
  const contracts = ledger.bookings.filter(b => b.source === 'contract');
  assert.equal(contracts.reduce((n, b) => n + b.revenueCents, 0), 12347);
  assert.equal(contracts.reduce((n, b) => n + b.passengers, 0), 3);
  assert.deepEqual(ledger.legs.map(l => l.contractSeats), [[2, 0, 0], [1, 0, 0]]);
  assert.deepEqual(ledger.legs.map(l => l.reserved), [[3, 1, 0], [2, 0, 0]]);
  assert.equal(settleShadowThrough(ledger).checkpoint.totals.revenueCents, Math.round(row.revenue * 100));
  for (const l of ledger.legs) assert(l.reserved.every((n, k) => n <= l.capacity[k]));
});

test('empty flights still incur operating costs without ticket or ancillary revenue', () => {
  const s = add(fixture()); s.tycoon.prices[0] = [10000, 10000, 10000];
  const ledger = ledgerFor(s), close = settleShadowThrough(ledger);
  assert.equal(ledger.bookings.length, 0); assert.equal(close.checkpoint.totals.revenueCents, 0);
  assert(close.checkpoint.totals.expenseCents > 0); assert(close.checkpoint.totals.profitCents < 0);
});

test('repeated close and serialized checkpoint reload cannot replay money or boarding events', () => {
  const ledger = ledgerFor(add(fixture(), 23));
  const first = settleShadowThrough(ledger, null, 24), before = JSON.stringify(first.checkpoint);
  const restored = restoreShadowCheckpoint(before, JSON.parse(JSON.stringify(ledger)));
  const repeated = settleShadowThrough(ledger, restored, 24);
  assert.equal(repeated.events.length, 0); assert(allZero(repeated.delta));
  const next = settleShadowThrough(ledger, restored, ledger.drainEnd), once = settleShadowThrough(ledger, null, ledger.drainEnd);
  assert.deepEqual(next.checkpoint, once.checkpoint);
  assert.equal(new Set([...first.events, ...next.events].map(e => e.id)).size, once.events.length);
  assert.equal(JSON.stringify(first.checkpoint), before);
});

test('checkpoint damage, changed snapshot, time rewind and invalid boundaries fail before mutation', () => {
  const ledger = ledgerFor(add(fixture(), 23)), prior = settleShadowThrough(ledger, null, 24).checkpoint;
  const bytes = JSON.stringify(ledger);
  for (const mutate of [p => p.cursor++, p => p.totals.cashCents++, p => p.basis += 'x', p => p.version = 2, p => p.through = NaN]) {
    const p = structuredClone(prior); mutate(p);
    assert.throws(() => settleShadowThrough(ledger, p, 48));
  }
  for (const through of [23, -1, Infinity, NaN, ledger.drainEnd + 1]) assert.throws(() => settleShadowThrough(ledger, prior, through));
  const changed = structuredClone(ledger); changed.legs[0].plane = 'OTHER';
  assert.throws(() => settleShadowThrough(changed, prior, 48));
  assert.throws(() => restoreShadowCheckpoint('null', ledger));
  assert.equal(JSON.stringify(ledger), bytes);
});

test('ledger rejects duplicate identities, overbooking, damaged cents and oversized inputs', () => {
  const ledger = ledgerFor(add(fixture()));
  for (const mutate of [l => l.legs.push(l.legs[0]), l => l.legs[0].capacity[0] = 0, l => l.legs[0].ticketCents++, l => l.legs[0].fuelCents = -.5, l => l.bookings.push(l.bookings[0]), l => l.bookings[0].passengers++, l => l.drainEnd = 100000, l => l.bookings = Array(4801).fill(l.bookings[0])]) {
    const invalid = structuredClone(ledger); mutate(invalid); assert.throws(() => validateShadowLedger(invalid));
  }
  const s = add(fixture()), days = projectedWeekReports(context(s), s.tycoon, false);
  assert.throws(() => createShadowLedger(context(s), s.tycoon, days.slice(0, 6)));
  days[0].report.rows = Array(481).fill(days[0].report.rows[0]);
  assert.throws(() => createShadowLedger(context(s), s.tycoon, days));
});

test('known faults, maintenance cancellations and expired leases follow the canonical forecast', () => {
  const s = add(fixture()); s.fleet[0].fault = 'Hydraulic fault';
  const days = projectedWeekReports(context(s), s.tycoon, false), ledger = ledgerFor(s);
  assert.equal(ledger.legs.length, 0);
  assert.deepEqual(ledger.cancellations, days.flatMap(({report}) => report.cancellations.map(c => ({...c, day: report.day}))));
  assert(allZero(studyLegLedger(context(s), s.tycoon).totals));
  const maintenance = add(fixture()); maintenance.fleet[0].servicePlan = {start: 0, activeFrom: 0};
  assert.equal(ledgerFor(maintenance).legs.length, 0);
  assert(ledgerFor(maintenance).cancellations.some(c => c.reason.includes('bảo dưỡng')));
  const leased = fixture(), p = leased.fleet[0];
  p.lease = {paidDay: 1, term: 3, remaining: 3, rate: 1000, deposit: 5000};
  leased.tycoon.schedules = [{id: 1, plane: p.id, route: 0, start: 96}];
  assert.equal(ledgerFor(leased).legs.length, 0);
});

test('existing airborne flights are disclosed instead of inventing historical bookings', () => {
  const s = fixture(); s.day = 8; s.fleet[0].airborneUntilAt = 173;
  const ledger = ledgerFor(s);
  assert.deepEqual(ledger.excluded.airbornePlanes, [s.fleet[0].id]); assert.equal(ledger.legs.length, 0);
});

test('live connecting fares and handling are excluded without changing the existing pilot', () => {
  let s = fixture(); s.openedRoutes = [2, 3];
  s = add(s, 0, s.fleet[2].id, 3); s = add(s, 5, s.fleet[0].id, 2);
  s = act(s, {type: 'strategy-enable'}); s = act(s, {type: 'connection-program', enabled: true, minimum: 60, maximum: 240});
  s.tycoon.prices[3][0] *= 2;
  s.hq.service = 1; s.hq.training.ground = 3; s.average = 219.875; s.co2Average = .1375;
  const before = JSON.stringify(s), report = forecast(s), study = studyLegLedger(context(s), s.tycoon);
  assert(report.connections.journeys > 0);
  assert.equal(study.excluded.connectionRevenueCents, Math.round(report.connections.revenue * 100));
  assert.equal(study.totals.boardings, report.pax - report.connections.boardings);
  assert.equal(study.totals.revenueCents, Math.round((report.revenue - report.connections.revenue) * 100));
  assert.deepEqual(study.totals, study.reference); assert.equal(JSON.stringify(s), before);
});

test('multi-day shadow import matches authoritative direct allocations after repeated day close and restore', () => {
  let s = fixture(); for (let d = 0; d < 7; d++) s = add(s, d * 24);
  s = act(s, {type: 'strategy-enable'}); s = act(s, {type: 'fleet-program', family: 'A320'});
  // Forecasts use midpoint estimates for unresearched future events. Compare known inputs.
  for (const e of marketEvents(context(s))) s = act(s, {type: 'market-research', id: e.id});
  const ledger = ledgerFor(s), original = structuredClone(s);
  for (let d = 0; d < 7; d++) {
    const report = forecast(s), legs = ledger.legs.filter(l => l.departureDay === s.day);
    assert.equal(legs.reduce((n, l) => n + l.reserved.reduce((a, b) => a + b, 0), 0), report.pax);
    assert.equal(legs.reduce((n, l) => n + l.ticketCents + l.serviceCents, 0), Math.round(report.rows.reduce((n, r) => n + r.revenue, 0) * 100));
    s = restoreGame(JSON.stringify(act(s, {type: 'advance'})));
  }
  assert.deepEqual(studyLegLedger(context(original), original.tycoon).totals, studyLegLedger(context(original), original.tycoon).reference);
});
