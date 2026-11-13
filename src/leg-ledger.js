// Read-only direct-flight shadow ledger. Never used by the authoritative day close.
import {expandRoundTrip, allocateJourneys, journeyMarket, validateLegs} from './connection-core.js';
import {connectionBoardingCost} from './network-economy.js';
import {projectedWeekReports} from './planner.js';

const MAX_ROUNDS = 480;
const moneyFields = ['ticketCents', 'serviceCents', 'nonfuelCents', 'fuelCents', 'co2Cents', 'fuelPurchaseCents', 'co2PurchaseCents'];
const totalFields = ['cashCents', 'revenueCents', 'expenseCents', 'profitCents', 'ticketCashCents', 'ticketRevenueCents', 'deferredCents', 'boardings'];
const emptyTotals = () => Object.fromEntries(totalFields.map(k => [k, 0]));
const validMoney = n => Number.isSafeInteger(n) && n >= 0;
const cents = n => {
  const value = Math.round(n * 100);
  if (!Number.isFinite(n) || !validMoney(value)) throw Error('Invalid shadow monetary amount');
  return value;
};
const split = n => [Math.ceil(n / 2), Math.floor(n / 2)];
const sum = values => values.reduce((a, b) => a + b, 0);
const addTotals = (target, delta) => { for (const k of totalFields) target[k] += delta[k] || 0; };

// Mixed contract prices become at most two cent-exact cohorts; no average-fare loss.
function cohorts(leg, source, classIndex, passengers, amount) {
  if (!passengers) {
    if (amount) throw Error('Revenue without passengers');
    return [];
  }
  const base = Math.floor(amount / passengers), extra = amount % passengers;
  return [[passengers - extra, base], [extra, base + 1]].filter(([n]) => n).map(([requested, fareCents], i) => ({
    id: `${leg.id}:${source}:${classIndex}:${i}`, source, legIds: [leg.id], classIndex, requested, fareCents,
  }));
}

function reserve(legs, requests) {
  const byId = new Map(legs.map(l => [l.id, l])), markets = {};
  for (const r of requests) {
    const key = journeyMarket([byId.get(r.legIds[0])], r.classIndex);
    markets[key] = (markets[key] || 0) + r.requested;
  }
  const result = allocateJourneys(legs, requests, markets);
  if (result.bookings.some((b, i) => b.passengers !== requests[i].requested)) throw Error('Shadow manifest exceeds capacity');
  return {...result, bookings: result.bookings.map((b, i) => ({...b, source: requests[i].source}))};
}

function legEvents(leg) {
  const cost = leg.nonfuelCents + leg.fuelCents + leg.co2Cents;
  const cashCost = leg.nonfuelCents + leg.fuelPurchaseCents + leg.co2PurchaseCents;
  return [
    {id: `${leg.id}:book`, leg: leg.id, kind: 'booking', at: leg.bookedAt, delta: {cashCents: leg.ticketCents - cashCost, ticketCashCents: leg.ticketCents, deferredCents: leg.ticketCents}},
    {id: `${leg.id}:depart`, leg: leg.id, kind: 'departure', at: leg.departure, delta: {expenseCents: cost, profitCents: -cost}},
    {id: `${leg.id}:arrive`, leg: leg.id, kind: 'arrival', at: leg.arrival, delta: {cashCents: leg.serviceCents, revenueCents: leg.ticketCents + leg.serviceCents, profitCents: leg.ticketCents + leg.serviceCents, ticketRevenueCents: leg.ticketCents, deferredCents: -leg.ticketCents, boardings: sum(leg.reserved)}},
  ];
}
const eventOrder = {booking: 0, departure: 1, arrival: 2};
const makeEvents = legs => legs.flatMap(legEvents).sort((a, b) => a.at - b.at || eventOrder[a.kind] - eventOrder[b.kind] || a.id.localeCompare(b.id));

export function createShadowLedger(ctx, state, days = projectedWeekReports(ctx, state, false)) {
  const start = (ctx.day - 1) * 24;
  if (!Number.isSafeInteger(ctx.day) || ctx.day < 1 || !Array.isArray(days) || days.length !== 7 || days.some((d, i) => d.report.day !== ctx.day + i)) throw Error('Shadow projection requires seven consecutive days');
  if (sum(days.map(d => d.report.rows.length)) > MAX_ROUNDS) throw Error('Shadow projection exceeds 480 rounds');
  const legs = [], contractRequests = [], publicRequests = [], referenceDays = [], cancellations = [];
  const excluded = {connectionBoardings: 0, connectionRevenueCents: 0, airbornePlanes: ctx.fleet.filter(p => p.airborneUntilAt > start).map(p => p.id)};
  for (const {report} of days) {
    const totals = emptyTotals();
    cancellations.push(...report.cancellations.map(c => ({...c, day: report.day})));
    excluded.connectionBoardings += report.connections?.boardings || 0;
    excluded.connectionRevenueCents += cents(report.connections?.revenue || 0);
    for (const row of report.rows) {
      const route = ctx.routes[row.route], capacity = state.cabins[row.plane];
      const pair = expandRoundTrip({id: `${report.day}:${row.slot}`, plane: row.plane, route: row.route, from: route.from, to: route.to, start: (report.day - 1) * 24 + row.start, hours: row.hours, capacity});
      const direct = row.passengers.map((n, k) => n - (k === 0 ? row.connectionBoardings || 0 : 0));
      if (direct.some((n, k) => !Number.isSafeInteger(n) || n < 0 || n > capacity[k] * 2) || !Number.isSafeInteger(row.contractPax) || row.contractPax < 0 || row.contractPax > direct[0]) throw Error('Invalid shadow passenger manifest');
      const counts = direct.map(split), contractCounts = split(row.contractPax);
      const contractAmount = cents(row.contractRevenue);
      const contractShares = row.contractPax ? [Math.floor(contractAmount * contractCounts[0] / row.contractPax), 0] : [0, 0];
      contractShares[1] = contractAmount - contractShares[0];
      const directRevenue = cents(row.revenue - (row.connectionRevenue || 0));
      const publicRevenue = sum(direct.map((n, k) => (n - (k === 0 ? row.contractPax : 0)) * cents(state.prices[row.route][k])));
      const serviceAmount = directRevenue - contractAmount - publicRevenue;
      if (!validMoney(serviceAmount)) throw Error('Shadow revenue does not reconcile');
      const countTotal = sum(direct), firstCount = sum(counts.map(n => n[0]));
      const serviceShares = countTotal ? [Math.floor(serviceAmount * firstCount / countTotal), 0] : [0, 0];
      serviceShares[1] = serviceAmount - serviceShares[0];
      const plane = ctx.fleet.find(p => p.id === row.plane);
      const amounts = {
        nonfuelCents: cents(row.nonfuel - (row.connectionBoardings || 0) * connectionBoardingCost(ctx, state, plane)),
        fuelCents: cents(row.fuelCost), co2Cents: cents(row.co2Cost),
        fuelPurchaseCents: cents(row.fuelPurchase), co2PurchaseCents: cents(row.co2Purchase),
      };
      for (const [i, leg] of pair.entries()) {
        Object.assign(leg, {template: row.slot, departureDay: report.day, bookedAt: pair[0].departure, recovery: row.recovery, serviceCents: serviceShares[i]});
        for (const [k, amount] of Object.entries(amounts)) leg[k] = split(amount)[i];
        contractRequests.push(...cohorts(leg, 'contract', 0, contractCounts[i], contractShares[i]));
        for (let k = 0; k < 3; k++) {
          const passengers = counts[k][i] - (k === 0 ? contractCounts[i] : 0);
          publicRequests.push(...cohorts(leg, 'public', k, passengers, passengers * cents(state.prices[row.route][k])));
        }
        legs.push(leg);
      }
      const expense = amounts.nonfuelCents + amounts.fuelCents + amounts.co2Cents;
      addTotals(totals, {revenueCents: directRevenue, expenseCents: expense, profitCents: directRevenue - expense,
        cashCents: directRevenue - amounts.nonfuelCents - amounts.fuelPurchaseCents - amounts.co2PurchaseCents,
        ticketCashCents: contractAmount + publicRevenue, ticketRevenueCents: contractAmount + publicRevenue, boardings: countTotal});
    }
    referenceDays.push({day: report.day, ...totals});
  }
  // Import the authoritative allocation; do not introduce a second passenger-demand model.
  const contracts = reserve(legs, contractRequests);
  const publicSales = reserve(legs.map(l => ({...l, capacity: contracts.remaining[l.id]})), publicRequests);
  for (const leg of legs) {
    leg.reserved = leg.capacity.map((n, k) => n - publicSales.remaining[leg.id][k]);
    leg.contractSeats = leg.capacity.map((n, k) => n - contracts.remaining[leg.id][k]);
    leg.ticketCents = contracts.legRevenue[leg.id] + publicSales.legRevenue[leg.id];
  }
  const end = start + 168, lastArrival = Math.max(start, ...legs.map(l => l.arrival));
  const ledger = {version: 1, mode: 'shadow-direct', start, end, drainEnd: Math.max(end, (Math.floor(lastArrival / 24) + 1) * 24), legs, bookings: [...contracts.bookings, ...publicSales.bookings], referenceDays, cancellations, excluded};
  validateShadowLedger(ledger);
  return ledger;
}

export function validateShadowLedger(ledger) {
  if (!ledger || ledger.version !== 1 || ledger.mode !== 'shadow-direct' || !Number.isSafeInteger(ledger.start) || ledger.start < 0 || ledger.start % 24 || ledger.end !== ledger.start + 168 || !Number.isSafeInteger(ledger.drainEnd) || ledger.drainEnd % 24 || ledger.drainEnd < ledger.end || ledger.drainEnd > ledger.end + 168 || !Array.isArray(ledger.legs) || ledger.legs.length > MAX_ROUNDS * 2 || !Array.isArray(ledger.bookings) || ledger.bookings.length > MAX_ROUNDS * 10) throw Error('Invalid shadow ledger');
  validateLegs(ledger.legs);
  const reserved = new Map(ledger.legs.map(l => [l.id, [0, 0, 0]])), contracts = new Map(ledger.legs.map(l => [l.id, [0, 0, 0]])), fares = new Map(ledger.legs.map(l => [l.id, 0])), ids = new Set();
  for (const b of ledger.bookings) {
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id) || !['public', 'contract'].includes(b.source) || b.legIds?.length !== 1 || !reserved.has(b.legIds[0]) || !Number.isSafeInteger(b.classIndex) || b.classIndex < 0 || b.classIndex > 2 || !Number.isSafeInteger(b.passengers) || b.passengers < 1 || b.passengers > 1000 || !validMoney(b.revenueCents)) throw Error('Invalid shadow booking');
    ids.add(b.id);
    reserved.get(b.legIds[0])[b.classIndex] += b.passengers;
    if (b.source === 'contract') contracts.get(b.legIds[0])[b.classIndex] += b.passengers;
    fares.set(b.legIds[0], fares.get(b.legIds[0]) + b.revenueCents);
  }
  for (const leg of ledger.legs) {
    if (!Number.isFinite(leg.bookedAt) || leg.bookedAt < ledger.start || leg.bookedAt >= ledger.end || leg.bookedAt > leg.departure || leg.arrival >= ledger.drainEnd || !moneyFields.every(k => validMoney(leg[k])) || !Array.isArray(leg.reserved) || leg.reserved.length !== 3 || !Array.isArray(leg.contractSeats) || leg.contractSeats.length !== 3 || leg.reserved.some((n, k) => n !== reserved.get(leg.id)[k] || n > leg.capacity[k] || leg.contractSeats[k] !== contracts.get(leg.id)[k]) || leg.ticketCents !== fares.get(leg.id)) throw Error('Invalid shadow leg accounting');
  }
}

function checkpointAt(ledger, events, through) {
  const totals = emptyTotals(); let cursor = 0;
  // Half-open days: an event at 24:00 belongs to the following day.
  for (const event of events) { if (event.at >= through) break; addTotals(totals, event.delta); cursor++; }
  if (totals.deferredCents < 0 || totals.ticketCashCents !== totals.ticketRevenueCents + totals.deferredCents || !totalFields.every(k => Number.isSafeInteger(totals[k]))) throw Error('Shadow accounting invariant failed');
  return {version: 1, basis: JSON.stringify(ledger.legs), through, cursor, totals};
}

export function settleShadowThrough(ledger, previous = null, through = ledger.end) {
  validateShadowLedger(ledger);
  if (!Number.isFinite(through) || through < ledger.start || through > ledger.drainEnd) throw Error('Invalid shadow close boundary');
  const events = makeEvents(ledger.legs);
  if (previous) {
    if (!Number.isFinite(previous.through) || previous.through < ledger.start || previous.through > through) throw Error('Shadow close cannot rewind');
    const expected = checkpointAt(ledger, events, previous.through);
    if (previous.version !== 1 || previous.basis !== expected.basis || previous.cursor !== expected.cursor || totalFields.some(k => previous.totals?.[k] !== expected.totals[k])) throw Error('Stale or damaged shadow checkpoint');
  }
  const checkpoint = checkpointAt(ledger, events, through);
  const delta = Object.fromEntries(totalFields.map(k => [k, checkpoint.totals[k] - (previous?.totals[k] || 0)]));
  return {checkpoint, delta, events: events.slice(previous?.cursor || 0, checkpoint.cursor)};
}

export function restoreShadowCheckpoint(raw, ledger) {
  const checkpoint = JSON.parse(raw);
  if (!checkpoint) throw Error('Invalid shadow checkpoint');
  return settleShadowThrough(ledger, checkpoint, checkpoint.through).checkpoint;
}

export function studyLegLedger(ctx, state) {
  const ledger = createShadowLedger(ctx, state), days = [];
  let previous = null;
  for (let through = ledger.start + 24; through <= ledger.drainEnd; through += 24) {
    const {checkpoint, delta} = settleShadowThrough(ledger, previous, through);
    const day = through / 24, reference = ledger.referenceDays.find(d => d.day === day) || {day, ...emptyTotals()};
    days.push({day, reference, shadow: delta, deferredCents: checkpoint.totals.deferredCents}); previous = checkpoint;
  }
  const reference = emptyTotals(); ledger.referenceDays.forEach(d => addTotals(reference, d));
  if (totalFields.some(k => reference[k] !== previous.totals[k])) throw Error('Shadow horizon does not reconcile');
  return {days, legs: ledger.legs, cancellations: ledger.cancellations, excluded: ledger.excluded, reference, totals: previous.totals, startDay: ctx.day, endDay: ctx.day + 6};
}
