// Read-only presentation model for replaying one settled day on the map.
// It never changes rules or state: it only re-reads the rows `forecast()` produced for the day that was just settled,
// plus facts the day report already records (rivals, cancellations) and the deterministic airport weather.
import {expandRoundTrip} from './connection-core.js';
import {weatherKind, WEATHER_EFFECT} from './gameplay.js';

const PAD = .5;
// How long, in game hours, a revenue figure stays on the map after a leg departs.
export const POPUP_HOURS = 1.5;

// Per-leg ledger rows describe one leg each and are already timed relative to the day's 00:00.
// Legacy rows describe a whole round trip; split it with the engine's own leg expansion.
function legsOf(row, routes, seatsOf) {
  const route = routes[row.route];
  if (!route) return [];
  const round = row.plane + ':' + row.slot, seats = seatsOf(row.plane);
  if (typeof row.leg === 'string') {
    const back = row.leg.endsWith(':back'), hours = row.arrival - row.departure;
    if (!(hours > 0)) return [];
    return [{id: row.leg, round, plane: row.plane, route: row.route, from: back ? route.to : route.from, to: back ? route.from : route.to,
      departure: row.start, arrival: row.start + hours, pax: row.pax, revenue: row.revenue, profit: row.profit || 0, seats,
      // The ledger settles a leg that lands after midnight on the next day, where it returns as a carried row.
      deferred: row.flights > 0 && row.start + hours > 24}];
  }
  const pair = expandRoundTrip({id: 'r' + row.slot, plane: row.plane, route: row.route, from: route.from, to: route.to, start: row.start, hours: row.hours, capacity: [0, 0, 0]});
  const pax = Math.ceil(row.pax / 2), revenue = Math.round(row.revenue / 2), profit = (row.profit || 0) / 2;
  return pair.map((leg, i) => ({id: leg.id, round, plane: leg.plane, route: leg.route, from: leg.from, to: leg.to, departure: leg.departure, arrival: leg.arrival,
    pax: i ? row.pax - pax : pax, revenue: i ? row.revenue - revenue : revenue, profit, seats, deferred: false}));
}

// Share of seats filled on a leg, or null when the day does not settle that leg (or the cabin is unknown).
export const loadFactor = leg => leg.deferred || !(leg.seats > 0) ? null : Math.min(1, leg.pax / leg.seats);

/**
 * Rival flights of the settled day, from what the day report records about competition.
 * With rival network growth the report lists every rival leg. Otherwise it records one round trip per rival, and its
 * timing comes from `timingOf`, which the caller answers with the engine's own rival operation.
 * @param {{day:number, competition?:{rivals:Array<any>}}} report
 * @param {Array<{from:string,to:string}>} routes
 * @param {(rival:any)=>({hour:number,hours:number}|null)} timingOf start hour and block hours of a rival's round trip
 */
export function rivalLegs(report, routes, timingOf) {
  const base = (report.day - 1) * 24, legs = [];
  for (const rival of report.competition?.rivals || []) {
    if (Array.isArray(rival.legs)) {
      for (const leg of rival.legs) legs.push({id: leg.id, airline: rival.id, plane: leg.plane, from: leg.from, to: leg.to, departure: leg.departure - base, arrival: leg.arrival - base, pax: leg.pax});
      continue;
    }
    const route = rival.route === null || rival.route === undefined ? null : routes[rival.route];
    // Shared slots add `rotations` to the report; without them a rival that sold seats flew its one round trip.
    const flew = route && (rival.rotations === undefined ? rival.seats > 0 : rival.rotations > 0), timing = flew ? timingOf(rival) : null;
    const hours = timing?.hours, start = Number.isFinite(rival.hour) ? rival.hour : timing?.hour;
    if (!(hours > 1) || !Number.isFinite(start) || start < 0) continue;
    for (const leg of expandRoundTrip({id: rival.id, plane: rival.id, route: rival.route, from: route.from, to: route.to, start, hours, capacity: [0, 0, 0]}))
      legs.push({id: leg.id, airline: rival.id, plane: rival.id, from: leg.from, to: leg.to, departure: leg.departure, arrival: leg.arrival, pax: Math.round((rival.pax || 0) / 2)});
  }
  return legs.filter(leg => leg.arrival > leg.departure && leg.from !== leg.to).sort((a, b) => a.departure - b.departure || a.id.localeCompare(b.id));
}

// Fog and storms at the given airports on one day, with the demand change the engine applies for them.
export function airportWeather(codes, day) {
  return codes.map(code => ({code, kind: weatherKind(code, day)})).filter(w => w.kind !== 'clear')
    .map(w => ({...w, demand: Math.round((WEATHER_EFFECT[w.kind] - 1) * 100)}));
}

/**
 * @param {Array<any>} rows per-flight rows from the settled day's forecast
 * @param {Array<{from:string,to:string}>} routes route catalog of the career
 * @param {{day:number,revenue:number,pax:number,profit:number,cancellations?:Array<any>}} report the settled day report
 * @param {{seatsOf?:(plane:string)=>number, rivals?:Array<any>}} [extras] cabin sizes and rival legs, both optional
 */
export function buildDayReplay(rows, routes, report, {seatsOf = () => 0, rivals = []} = {}) {
  const legs = (rows || []).flatMap(row => legsOf(row, routes, seatsOf)).sort((a, b) => a.departure - b.departure || a.id.localeCompare(b.id));
  // In the per-leg ledger a leg still airborne at midnight returns in the next day's rows, so the window stops at 24:00.
  const carriesOver = (rows || []).some(row => typeof row.leg === 'string');
  const first = legs.length ? Math.min(...legs.map(l => l.departure)) : 0, last = legs.length ? Math.max(...legs.map(l => l.arrival)) : 0;
  const from = Math.max(0, first - PAD), to = Math.max(from + 1, carriesOver ? Math.min(24, last + PAD) : last + PAD);
  const flown = {revenue: legs.reduce((n, l) => n + l.revenue, 0), pax: legs.reduce((n, l) => n + l.pax, 0)};
  const cancellations = (report.cancellations || []).map((c, i) => { const route = routes[c.route]; return {id: 'x' + i, plane: c.plane, from: route?.from, to: route?.to, at: c.start, reason: c.reason}; })
    .filter(c => c.from && c.to).sort((a, b) => a.at - b.at);
  // One entry per round trip, best first, for the end-of-day highlights.
  const rounds = new Map();
  for (const leg of legs) {
    const r = rounds.get(leg.round) || {id: leg.round, plane: leg.plane, route: leg.route, revenue: 0, profit: 0, pax: 0, seats: 0};
    r.revenue += leg.revenue; r.profit += leg.profit;
    if (!leg.deferred) { r.pax += leg.pax; r.seats += leg.seats; }
    rounds.set(leg.round, r);
  }
  const flights = [...rounds.values()].map(r => ({...r, from: routes[r.route].from, to: routes[r.route].to, load: r.seats > 0 ? Math.min(1, r.pax / r.seats) : null}))
    .sort((a, b) => b.profit - a.profit || a.id.localeCompare(b.id));
  return {day: report.day, from, to, legs, rivals, cancellations, flights,
    weather: airportWeather([...new Set([...legs, ...rivals].flatMap(l => [l.from, l.to]))].sort(), report.day),
    // Anything the day earned outside individual flights (for example a contract bonus) is credited when the day closes.
    closing: {revenue: report.revenue - flown.revenue, pax: report.pax - flown.pax},
    // A carried leg left on the previous day, so it is not one of this day's departures.
    totals: {revenue: report.revenue, pax: report.pax, profit: report.profit, legs: legs.filter(l => l.departure >= 0).length}};
}

const airborne = (legs, hour) => legs.filter(leg => leg.departure <= hour && hour < leg.arrival).map(leg => ({...leg, progress: (hour - leg.departure) / (leg.arrival - leg.departure)}));

// Ticket revenue is credited when a leg departs, matching the per-leg ledger's recognition rule.
export function replayFrame(replay, hour) {
  const done = hour >= replay.to;
  let revenue = 0, pax = 0, departed = 0;
  for (const leg of replay.legs) if (leg.departure <= hour || done) { revenue += leg.revenue; pax += leg.pax; if (leg.departure >= 0) departed++; }
  if (done) { revenue += replay.closing.revenue; pax += replay.closing.pax; }
  return {hour: Math.min(hour, replay.to), done, revenue, pax, departed,
    aircraft: done ? [] : airborne(replay.legs, hour),
    rivals: done ? [] : airborne(replay.rivals || [], hour),
    popups: done ? [] : replay.legs.filter(leg => leg.revenue > 0 && leg.departure >= replay.from && leg.departure <= hour && hour - leg.departure < POPUP_HOURS).map(leg => ({...leg, age: (hour - leg.departure) / POPUP_HOURS})),
    cancelled: (replay.cancellations || []).filter(c => done || c.at <= hour)};
}

// Shared geometry for a route arc: a quadratic curve that is identical in both directions.
export function arcControl(a, b, lift) {
  return {x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - lift};
}
export function arcPoint(a, b, lift, t) {
  const c = arcControl(a, b, lift), u = 1 - t;
  return {x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    angle: Math.atan2(2 * u * (c.y - a.y) + 2 * t * (b.y - c.y), 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x)) * 180 / Math.PI};
}

// Put each airport code beside its dot (below, above, right or left) where it does not cover an earlier label or another dot.
// `size` is the label height in map units; a three-letter code is about two heights wide.
export function placeLabels(points, size) {
  const w = size * 2.2, h = size * 1.1, gap = size * .55, placed = [];
  const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const dots = points.map(p => ({x: p.x, y: p.y, w: size * .9, h: size * .9}));
  return points.map((p, i) => {
    const options = [{x: p.x, y: p.y + gap + h / 2, anchor: 'middle'}, {x: p.x, y: p.y - gap - h / 2, anchor: 'middle'},
      {x: p.x + gap + w / 2, y: p.y, anchor: 'middle'}, {x: p.x - gap - w / 2, y: p.y, anchor: 'middle'}].map(o => ({...o, w, h}));
    const free = options.find(o => !placed.some(b => overlaps(o, b)) && !dots.some((d, j) => j !== i && overlaps(o, d))) || options[0];
    placed.push(free);
    return {...p, label: {x: free.x, y: free.y}};
  });
}
