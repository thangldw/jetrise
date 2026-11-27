// Read-only presentation model for replaying one settled day on the map.
// It never changes rules or state: it only re-reads the rows `forecast()` produced for the day that was just settled.
import {expandRoundTrip} from './connection-core.js';

const PAD = .5;

// Per-leg ledger rows describe one leg each and are already timed relative to the day's 00:00.
// Legacy rows describe a whole round trip; split it with the engine's own leg expansion.
function legsOf(row, routes) {
  const route = routes[row.route];
  if (!route) return [];
  if (typeof row.leg === 'string') {
    const back = row.leg.endsWith(':back'), hours = row.arrival - row.departure;
    if (!(hours > 0)) return [];
    return [{id: row.leg, plane: row.plane, route: row.route, from: back ? route.to : route.from, to: back ? route.from : route.to,
      departure: row.start, arrival: row.start + hours, pax: row.pax, revenue: row.revenue}];
  }
  const pair = expandRoundTrip({id: 'r' + row.slot, plane: row.plane, route: row.route, from: route.from, to: route.to, start: row.start, hours: row.hours, capacity: [0, 0, 0]});
  const pax = Math.ceil(row.pax / 2), revenue = Math.round(row.revenue / 2);
  return pair.map((leg, i) => ({id: leg.id, plane: leg.plane, route: leg.route, from: leg.from, to: leg.to, departure: leg.departure, arrival: leg.arrival,
    pax: i ? row.pax - pax : pax, revenue: i ? row.revenue - revenue : revenue}));
}

/**
 * @param {Array<object>} rows per-flight rows from the settled day's forecast
 * @param {Array<{from:string,to:string}>} routes route catalog of the career
 * @param {{day:number,revenue:number,pax:number,profit:number}} report the settled day report
 */
export function buildDayReplay(rows, routes, report) {
  const legs = (rows || []).flatMap(row => legsOf(row, routes)).sort((a, b) => a.departure - b.departure || a.id.localeCompare(b.id));
  // In the per-leg ledger a leg still airborne at midnight returns in the next day's rows, so the window stops at 24:00.
  const carriesOver = (rows || []).some(row => typeof row.leg === 'string');
  const first = legs.length ? Math.min(...legs.map(l => l.departure)) : 0, last = legs.length ? Math.max(...legs.map(l => l.arrival)) : 0;
  const from = Math.max(0, first - PAD), to = Math.max(from + 1, carriesOver ? Math.min(24, last + PAD) : last + PAD);
  const flown = {revenue: legs.reduce((n, l) => n + l.revenue, 0), pax: legs.reduce((n, l) => n + l.pax, 0)};
  return {day: report.day, from, to, legs,
    // Anything the day earned outside individual flights (for example a contract bonus) is credited when the day closes.
    closing: {revenue: report.revenue - flown.revenue, pax: report.pax - flown.pax},
    totals: {revenue: report.revenue, pax: report.pax, profit: report.profit, legs: legs.length}};
}

// Ticket revenue is credited when a leg departs, matching the per-leg ledger's recognition rule.
export function replayFrame(replay, hour) {
  const done = hour >= replay.to, aircraft = [];
  let revenue = 0, pax = 0, departed = 0;
  for (const leg of replay.legs) {
    if (leg.departure <= hour || done) { revenue += leg.revenue; pax += leg.pax; departed++; }
    if (!done && leg.departure <= hour && hour < leg.arrival) aircraft.push({...leg, progress: (hour - leg.departure) / (leg.arrival - leg.departure)});
  }
  if (done) { revenue += replay.closing.revenue; pax += replay.closing.pax; }
  return {hour: Math.min(hour, replay.to), done, aircraft, revenue, pax, departed};
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
