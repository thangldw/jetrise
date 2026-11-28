// Read-only presentation model for the living network map: today's scheduled legs, great-circle paths and
// the day/night terminator. Nothing here changes rules or save data.
import {expandRoundTrip} from './connection-core.js';

const WEEK = 168, RAD = Math.PI / 180;

/**
 * Today's legs from the repeating weekly schedule, timed relative to today's 00:00 (a leg may start before 0 or end after 24).
 * @param {{day:number, tycoon:{schedules:Array<{id:number,plane:string,route:number,start:number}>}}} game
 * @param {Array<{from:string,to:string}>} routes
 * @param {(plane:string, route:number)=>number} durationOf round-trip block hours
 * @param {(route:number)=>boolean} [include]
 */
export function scheduledLegs(game, routes, durationOf, include = () => true) {
  const today = ((game.day - 1) % 7) * 24, legs = [];
  for (const s of game.tycoon.schedules) {
    const route = routes[s.route];
    if (!route || !include(s.route)) continue;
    const hours = durationOf(s.plane, s.route);
    if (!(hours > 1 && hours < WEEK)) continue;
    for (const leg of expandRoundTrip({id: 'w' + s.id, plane: s.plane, route: s.route, from: route.from, to: route.to, start: s.start, hours, capacity: [0, 0, 0]})) {
      // The schedule repeats weekly, so a leg from late last week can still be airborne today.
      for (const shift of [-WEEK, 0, WEEK]) {
        const departure = leg.departure + shift - today, arrival = leg.arrival + shift - today;
        if (arrival > 0 && departure < 24) legs.push({id: leg.id + '@' + shift, plane: leg.plane, route: leg.route, from: leg.from, to: leg.to, departure, arrival});
      }
    }
  }
  return legs.sort((a, b) => a.departure - b.departure || a.id.localeCompare(b.id));
}

/** Legs airborne at `hour`, with progress 0..1. */
export const airborneAt = (legs, hour) => legs.filter(l => hour >= l.departure && hour < l.arrival).map(l => ({...l, t: (hour - l.departure) / (l.arrival - l.departure)}));

/**
 * Points along the great circle from a to b ({lat, lon} in degrees), `steps` segments.
 * Longitudes are unwrapped so consecutive points never jump by more than 180°.
 */
export function greatCircle(a, b, steps = 48) {
  const [p1, l1, p2, l2] = [a.lat * RAD, a.lon * RAD, b.lat * RAD, b.lon * RAD];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2));
  const points = [];
  let previous = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    let lat, lon;
    if (d < 1e-9) ({lat, lon} = a);
    else {
      const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
      lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
      lon = Math.atan2(y, x) / RAD;
    }
    if (previous === null) lon = a.lon;
    else {
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
    }
    points.push({lat, lon});
    previous = lon;
  }
  return points;
}

/** Point and heading (degrees, screen space) at fraction t of a projected polyline. */
export function alongPath(points, t) {
  if (points.length < 2) return {...points[0], angle: 0};
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const target = Math.max(0, Math.min(1, t)) * lengths.at(-1);
  let i = 1;
  while (i < points.length - 1 && lengths[i] < target) i++;
  const span = lengths[i] - lengths[i - 1] || 1, f = (target - lengths[i - 1]) / span, a = points[i - 1], b = points[i];
  return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) / RAD};
}

/**
 * Sub-solar point for a game day and hour. The game clock is shared and not zoned, so it is read as local time at `lon`.
 * Game day 1 is treated as 1 January for the seasonal tilt.
 */
export function subsolar(day, hour, lon = 0) {
  const n = ((day - 1) % 365 + 365) % 365, declination = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365);
  const utc = hour - lon / 15;
  let sunLon = (12 - utc) * 15;
  sunLon = ((sunLon + 540) % 360) - 180;
  return {lat: declination, lon: sunLon};
}

/** Latitude of the terminator at each longitude (equirectangular), and which pole is dark. */
export function terminator(sun, step = 5) {
  const dec = (Math.abs(sun.lat) < 0.1 ? 0.1 : sun.lat) * RAD, line = [];
  for (let lon = -180; lon <= 180; lon += step) line.push({lon, lat: Math.atan(-Math.cos((lon - sun.lon) * RAD) / Math.tan(dec)) / RAD});
  return {line, darkPole: sun.lat > 0 ? -90 : 90};
}
