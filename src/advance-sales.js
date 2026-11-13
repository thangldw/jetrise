// JET-209: opt-in advance direct sales on top of JET-201 live leg economics.
// Bookings sell a bounded share of the canonical projection of a dated round before its departure day.
// Cash is collected at sale as a liability; the fare is locked per lot. On the departure day the
// existing allocation runs unchanged and advance passengers replace part of it (never add demand
// unless the day-of result falls below what was already sold). Recognition stays at leg arrival.
import {validMigrationId} from './live-leg-economy.js';

export const ADVANCE_HORIZON = 6;
// Cumulative share of projected public passengers sold by the close of day D-k (k days ahead).
export const ADVANCE_CURVE = {6: .04, 5: .09, 4: .15, 3: .22, 2: .30, 1: .40};
export const ADVANCE_CAP = .4;
const MAX_BOOKINGS = 960, MAX_LOTS = ADVANCE_HORIZON, MAX_PAX = 2000;

const sum = values => values.reduce((n, v) => n + v, 0);
const lotCents = lot => sum(lot.passengers.map((n, k) => n * lot.fares[k] * 100));
const bookingCents = b => sum(b.lots.map(lotCents));
const soldOf = b => [0, 1, 2].map(k => sum(b.lots.map(l => l.passengers[k])));
export const advanceLiability = a => a ? sum(a.bookings.map(b => b.cents)) : 0;
const id = (day, slot) => `${day}:${slot}`;
const hourOf = start => Math.round((start % 24) * 4) / 4;

export function enableAdvanceSales(s, action) {
  const e = s.legEconomy;
  if (!e) throw Error('Bật Sổ theo chặng (JET-201) trước khi mở bán vé trước.');
  if (e.advance) throw Error('Bán vé trước đã được bật.');
  if (!validMigrationId(action.migrationId)) throw Error('Mã chuyển đổi không hợp lệ.');
  e.advance = {version: 1, migrationId: action.migrationId, enabledDay: s.day, horizon: ADVANCE_HORIZON, stopped: false, basis: [], bookings: [], liabilityCents: 0};
  return 'Đã bật bán vé trước. Vé đầu tiên được bán khi chốt ngày hôm nay, cho các chuyến trong 6 ngày tới.';
}

export function advanceAction(s, action) {
  if (action.type === 'advance-sales-enable') return enableAdvanceSales(s, action);
  if (action.type === 'advance-sales-stop' || action.type === 'advance-sales-resume') {
    const a = s.legEconomy?.advance;
    if (!a) throw Error('Chưa bật bán vé trước.');
    a.stopped = action.type === 'advance-sales-stop';
    return a.stopped ? 'Đã dừng bán vé trước. Vé đã bán vẫn được giữ và bay theo lịch.' : 'Đã mở lại bán vé trước từ lần chốt ngày tiếp theo.';
  }
  return null;
}

export function validateAdvanceSales(s, routes) {
  const a = s.legEconomy?.advance;
  if (a === undefined) return;
  const fail = () => { throw Error('Invalid advance sales'); };
  if (!a || a.version !== 1 || !validMigrationId(a.migrationId) || !Number.isInteger(a.enabledDay) || a.enabledDay < s.legEconomy.enabledDay || a.enabledDay > s.day || a.horizon !== ADVANCE_HORIZON || typeof a.stopped !== 'boolean' || !Array.isArray(a.bookings) || a.bookings.length > MAX_BOOKINGS) fail();
  if (!Array.isArray(a.basis) || a.basis.length > 480) fail();
  const based = new Set();
  for (const b of a.basis) {
    if (!b || !Number.isFinite(b.hour) || b.hour < 0 || b.hour >= 24 || b.hour % .25 || based.has(b.route + ':' + b.hour) || !routes[b.route] || !Number.isInteger(b.day) || b.day < a.enabledDay || b.day >= s.day || !Array.isArray(b.passengers) || b.passengers.length !== 3 || b.passengers.some(n => !Number.isInteger(n) || n < 0 || n > MAX_PAX) || !Number.isInteger(b.reservedY) || b.reservedY < 0 || b.reservedY > MAX_PAX) fail();
    based.add(b.route + ':' + b.hour);
  }
  const seen = new Set();
  for (const b of a.bookings) {
    if (!b || !Number.isInteger(b.day) || b.day < s.day || b.day > s.day + ADVANCE_HORIZON - 1 || !Number.isInteger(b.slot) || b.slot < 1 || b.slot >= s.tycoon.nextId || b.id !== id(b.day, b.slot) || seen.has(b.id) || !routes[b.route] || !s.openedRoutes.includes(b.route) || !Number.isFinite(b.start) || b.start < 0 || b.start >= 24 || b.start % .25 || !Array.isArray(b.lots) || !b.lots.length || b.lots.length > MAX_LOTS) fail();
    seen.add(b.id);
    for (const l of b.lots) if (!l || !Number.isInteger(l.soldDay) || l.soldDay < a.enabledDay || l.soldDay >= b.day || l.soldDay >= s.day || !Array.isArray(l.passengers) || l.passengers.length !== 3 || l.passengers.some(n => !Number.isInteger(n) || n < 0 || n > MAX_PAX) || !sum(l.passengers) || !Array.isArray(l.fares) || l.fares.length !== 3 || l.fares.some(n => !Number.isInteger(n) || n < 20 || n > 10000)) fail();
    if (!Number.isSafeInteger(b.cents) || b.cents !== bookingCents(b)) fail();
  }
  if (a.liabilityCents !== advanceLiability(a)) fail();
}

function grossPublic(row) {
  return row.passengers.map((n, k) => n - (k === 0 ? (row.contractPax || 0) + (row.connectionBoardings || 0) : 0));
}
function bookableCapacity(seats, row) {
  return seats.map((n, k) => n * 2 - (k === 0 ? (row.contractPax || 0) + sum(row.connectingReserved || []) + (row.connectionBoardings || 0) : 0));
}
// Keep the first lots (earliest fares) and refund the most recent ones when capacity shrank.
function trimLots(lots, keep) {
  const kept = [], bumped = [];
  const left = [...keep];
  for (const lot of lots) {
    const take = lot.passengers.map((n, k) => Math.max(0, Math.min(n, left[k])));
    take.forEach((n, k) => left[k] -= n);
    const rest = lot.passengers.map((n, k) => n - take[k]);
    if (sum(take)) kept.push({...lot, passengers: take});
    if (sum(rest)) bumped.push({...lot, passengers: rest});
  }
  return {kept, bumped};
}

// Seats already sold for `day`, per slot (route-checked) and per market, so day-of allocation and
// competition neither resell them nor hand their demand to earlier flights of the same market.
export function advanceReservations(ctx, day, marketOf) {
  const a = ctx.legEconomy?.advance, slots = new Map(), markets = new Map();
  if (!a) return {slot: () => [0, 0, 0], market: () => [0, 0, 0]};
  for (const b of a.bookings) if (b.day === day) {
    const sold = soldOf(b), key = marketOf(b.route);
    slots.set(b.slot + ':' + b.route, sold);
    markets.set(key, (markets.get(key) || [0, 0, 0]).map((n, k) => n + sold[k]));
  }
  return {slot: (slot, route) => slots.get(slot + ':' + route) || [0, 0, 0], market: key => markets.get(key) || [0, 0, 0]};
}

// Departure-day merge. Runs after allocation/competition (which reserved these seats and removed their
// demand from the market) and before same-day connections and JET-201 snapshots.
export function applyAdvanceSales(ctx, s, report, day, perPax) {
  const a = ctx.legEconomy?.advance;
  report.advanceRefundCents = 0; report.advanceConsumedCents = 0; report.advanceBoardings = 0; report.advanceBumped = 0;
  if (!a) return;
  for (const b of a.bookings.filter(b => b.day === day)) {
    const row = report.rows.find(r => r.slot === b.slot && r.route === b.route);
    if (!row) { report.advanceRefundCents += b.cents; continue; }
    // Day-of public sales were already capped at capacity minus these seats; trim only if contracts took them.
    const pub = grossPublic(row), capacity = bookableCapacity(s.cabins[row.plane], row).map((n, k) => n - pub[k]), sold = soldOf(b);
    const {kept, bumped} = trimLots(b.lots, sold.map((n, k) => Math.max(0, Math.min(n, capacity[k]))));
    const bumpedCents = sum(bumped.map(lotCents));
    report.advanceRefundCents += bumpedCents; report.advanceBumped += sum(bumped.map(l => sum(l.passengers)));
    if (!kept.length) continue;
    const keep = [0, 1, 2].map(k => sum(kept.map(l => l.passengers[k]))), cents = sum(kept.map(lotCents));
    const extraPax = sum(keep), {revenue, cost} = perPax(row.plane), delta = cents / 100;
    row.passengers = row.passengers.map((n, k) => n + keep[k]);
    // JET-205 splits passengers by segment bookings; attribute advance seats to the class's largest segment.
    if (row.segmentBookings) for (let k = 0; k < 3; k++) if (keep[k]) {
      const column = row.segmentBookings.map(x => x[k]), j = column.indexOf(Math.max(...column));
      row.segmentBookings[j][k] += keep[k];
    }
    row.pax += extraPax; row.revenue += delta + extraPax * revenue; row.nonfuel += Math.round(extraPax * cost);
    const profitDelta = delta + extraPax * revenue - Math.round(extraPax * cost);
    row.profit += profitDelta;
    report.pax += extraPax; report.revenue += delta + extraPax * revenue; report.nonfuel += Math.round(extraPax * cost); report.profit += profitDelta;
    row.advance = {passengers: keep, lots: kept, cents};
    report.advanceConsumedCents += cents; report.advanceBoardings += sum(keep);
  }
}

// Split one round's advance lots between its outbound/return public seats, exactly in cents.
export function splitAdvance(advance, publicSeats) {
  if (!advance) return [null, null];
  const first = advance.passengers.map((n, k) => Math.max(n - publicSeats[1][k], Math.min(Math.ceil(n / 2), publicSeats[0][k])));
  const legs = [{passengers: [0, 0, 0], cents: 0, classCents: [0, 0, 0]}, {passengers: [0, 0, 0], cents: 0, classCents: [0, 0, 0]}], left = [...first];
  for (const lot of advance.lots) for (let k = 0; k < 3; k++) {
    const out = Math.min(lot.passengers[k], left[k]), back = lot.passengers[k] - out;
    left[k] -= out;
    legs[0].passengers[k] += out; legs[0].cents += out * lot.fares[k] * 100; legs[0].classCents[k] += out * lot.fares[k] * 100;
    legs[1].passengers[k] += back; legs[1].cents += back * lot.fares[k] * 100; legs[1].classCents[k] += back * lot.fares[k] * 100;
  }
  return legs.map(l => sum(l.passengers) ? l : null);
}

// New sales at day close for the next six days. The basis is the actual public passengers of the most
// recent operated flight on the same route at the nearest departure hour (exact hour first); routes
// without an operated flight yet are not sold.
// This keeps the close cheap and explainable; the 40% cap bounds forecast error.
export function sellAdvanceSales(ctx, s, report, day, dailySlots, unavailable) {
  const a = ctx.legEconomy?.advance;
  if (!a || !report.legEconomyState) return;
  const keyOf = (route, hour) => route + ':' + hour, basis = new Map((a.basis || []).map(b => [keyOf(b.route, b.hour), b]));
  for (const row of report.operatedRounds || report.rows) if (!row.recovery && !row.timing) basis.set(keyOf(row.route, hourOf(row.start)), {route: row.route, hour: hourOf(row.start), day, passengers: grossPublic(row), reservedY: (row.contractPax || 0) + sum(row.connectingReserved || []) + (row.connectionBoardings || 0)});
  for (const [key, b] of basis) if (!s.schedules.some(x => x.route === b.route && hourOf(x.start) === b.hour)) basis.delete(key);
  const bookings = new Map(a.bookings.filter(b => b.day > day).map(b => [b.id, structuredClone(b)]));
  let salesCents = 0, salesPax = 0;
  // Projections sell too, so the 7-day ledger forecast matches the real close; recovery what-ifs opt out.
  if (!a.stopped && !ctx.noNewConnectionSales) {
    for (let k = 1; k <= a.horizon; k++) {
      const d = day + k;
      for (const x of dailySlots(s, d)) {
        const hour = hourOf(x.start), gap = h => Math.min(Math.abs(h - hour), 24 - Math.abs(h - hour));
        const base = basis.get(keyOf(x.route, hour)) || [...basis.values()].filter(b => b.route === x.route).sort((p, q) => gap(p.hour) - gap(q.hour) || q.day - p.day || p.hour - q.hour)[0], seats = s.cabins[x.plane];
        // Never sell a dated flight the engine already knows will not operate (e.g. planned maintenance).
        if (x.cancel || x.recovery || x.timing || !base || !seats || unavailable?.(d, x)) continue;
        const key = id(d, x.id), existing = bookings.get(key), sold = existing ? soldOf(existing) : [0, 0, 0];
        const capacity = seats.map((n, c) => n * 2 - (c === 0 ? base.reservedY : 0));
        // The curve follows the basis; the cap applies to this dated flight's own bookable seats.
        const add = base.passengers.map((n, c) => Math.max(0, Math.min(Math.floor(n * ADVANCE_CURVE[k]), Math.floor(Math.max(0, capacity[c]) * ADVANCE_CAP)) - sold[c]));
        if (!sum(add)) continue;
        const lot = {soldDay: day, passengers: add, fares: [...s.prices[x.route]]};
        const b = existing || {id: key, day: d, slot: x.id, route: x.route, start: hourOf(x.start), lots: [], cents: 0};
        b.lots.push(lot); b.cents += lotCents(lot);
        bookings.set(key, b);
        salesCents += lotCents(lot); salesPax += sum(add);
      }
    }
  }
  const next = {...a, basis: [...basis.values()].sort((x, y) => x.route - y.route || x.hour - y.hour), bookings: [...bookings.values()].sort((x, y) => x.day - y.day || x.slot - y.slot)};
  next.liabilityCents = advanceLiability(next);
  report.legEconomyState = {...report.legEconomyState, advance: next};
  report.advanceSalesCents = salesCents; report.advanceSalesPax = salesPax;
  report.advanceSales = salesCents / 100; report.advanceRefund = report.advanceRefundCents / 100;
  report.advanceLiability = next.liabilityCents / 100;
  const net = (salesCents - report.advanceRefundCents) / 100;
  report.cashDelta += net;
  report.deferredRevenueDelta = (report.deferredRevenueDelta || 0) + net;
  // Reported unearned balance covers both the per-leg ledger and the advance book (reconciled separately).
  if (report.deferredRevenue !== undefined) report.deferredRevenue = (report.legEconomyState.deferredCents + next.liabilityCents) / 100;
}

// Bookings that a proposed state no longer honors (template removed/moved/re-routed, capacity shrunk,
// or the aircraft is unavailable, e.g. a newly planned maintenance window). `unavailable(s)` returns a
// (day, slot) => reason|null checker for that state.
export function invalidAdvanceBookings(s, dailySlots, unavailable) {
  const a = s.legEconomy?.advance;
  if (!a) return [];
  const blocked = unavailable?.(s);
  return a.bookings.filter(b => {
    const x = dailySlots(s.tycoon, b.day).find(x => x.id === b.slot);
    if (!x || x.cancel || x.route !== b.route || hourOf(x.start) !== b.start) return true;
    const seats = s.tycoon.cabins[x.plane];
    return !seats || soldOf(b).some((n, k) => n > seats[k] * 2) || !!blocked?.(b.day, x);
  });
}

export function guardAdvanceSales(current, s, action, dailySlots, unavailable) {
  if (!s.legEconomy?.advance) return '';
  const before = new Set(invalidAdvanceBookings(current, dailySlots, unavailable).map(b => b.id));
  const invalid = invalidAdvanceBookings(s, dailySlots, unavailable).filter(b => !before.has(b.id));
  if (!invalid.length) return '';
  const cents = sum(invalid.map(b => b.cents)), pax = sum(invalid.map(b => sum(soldOf(b))));
  if (!action.refundAdvance) {
    const error = Error(`Thay đổi này huỷ ${invalid.length} chuyến đã bán trước ${pax} vé. Cần hoàn ${(cents / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'})} cho khách.`);
    error.advanceRefund = {flights: invalid.length, passengers: pax, cents};
    throw error;
  }
  const ids = new Set(invalid.map(b => b.id)), a = s.legEconomy.advance;
  a.bookings = a.bookings.filter(b => !ids.has(b.id));
  a.liabilityCents = advanceLiability(a);
  s.cash = Math.round(s.cash * 100 - cents) / 100;
  return ` Đã hoàn ${(cents / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'})} cho ${pax} vé bán trước.`;
}
