// Shared actual timing for JET-203 dated exceptions and departed JET-201 manifests.
import {expandRoundTrip} from './connection-core.js';

export const roundEnd = r => r.legs[1].arrival + .5;
export const roundHours = (ctx, plane, route) => Math.ceil((1 + (ctx.routes[route].cycle - 1) * 800 / (ctx.types[plane.type].speed || 800)) * 4) / 4;
export function timedLegs(round, route) {
  const pair = expandRoundTrip({id: round.id, plane: round.plane, route: round.route, from: route.from, to: route.to, start: round.start, hours: round.hours, capacity: round.capacity});
  if (round.timing !== undefined) {
    const timing = round.timing;
    if (!Array.isArray(timing) || timing.length !== 2) throw Error('Invalid dated leg timing');
    for (let i = 0; i < 2; i++) for (const key of ['departure', 'arrival']) {
      if (!timing[i] || Object.keys(timing[i]).length !== 2 || !Object.hasOwn(timing[i], 'departure') || !Object.hasOwn(timing[i], 'arrival')) throw Error('Invalid dated leg timing fields');
      const delta = timing[i][key] - pair[i][key];
      if (!Number.isFinite(delta) || delta < 0 || delta > 24 || Math.abs(delta * 4 - Math.round(delta * 4)) > 1e-6) throw Error('Invalid dated leg delay');
    }
    if (timing[0].departure >= Math.floor(round.start / 24) * 24 + 24 || timing[1].departure < timing[0].arrival + .5 || timing.some((l, i) => l.arrival - l.departure < pair[i].arrival - pair[i].departure - 1e-7)) throw Error('Invalid dated aircraft continuity');
    pair.forEach((l, i) => Object.assign(l, {departure: timing[i].departure, arrival: timing[i].arrival}));
  }
  return pair;
}

export function datedRound(ctx, state, day, slot) {
  const pending = ctx.legEconomy?.rounds.find(r => r.day === day && r.slot === slot);
  if (pending) return {...structuredClone(pending), departed: true};
  const x = state.schedules.find(x => x.id === slot && Math.floor(x.start / 24) === (day - 1) % 7);
  if (!x) return null;
  const e = state.exceptions?.find(e => e.slot === slot && e.day === day);
  const p = ctx.fleet.find(p => p.id === (e?.plane || x.plane));
  if (!p) return null;
  const r = {id: `${day}:${slot}`, day, slot, plane: p.id, route: x.route, start: (day - 1) * 24 + (e?.start ?? x.start % 24), hours: roundHours(ctx, p, x.route), capacity: [...state.cabins[p.id]], cancelled: !!e?.cancel};
  if (e?.timing !== undefined) r.timing = e.timing;
  r.legs = timedLegs(r, ctx.routes[r.route]);
  return r;
}

export function datedRounds(ctx, state, horizon = 7) {
  const rounds = new Map((ctx.legEconomy?.rounds || []).map(r => [r.id, {...structuredClone(r), departed: true}]));
  for (let day = ctx.day; day < ctx.day + horizon; day++) for (const x of state.schedules) {
    if (Math.floor(x.start / 24) !== (day - 1) % 7) continue;
    const r = datedRound(ctx, state, day, x.id); if (r) rounds.set(r.id, r);
  }
  return [...rounds.values()].sort((a, b) => a.legs[0].departure - b.legs[0].departure || a.id.localeCompare(b.id));
}

export function datedConflict(ctx,state){
 if(!ctx.legEconomy?.disruptions)return '';
 const endByPlane=new Map();
 for(const r of datedRounds(ctx,state)){
  if(r.cancelled)continue;
  if(r.legs[0].departure<(endByPlane.get(r.plane)??-Infinity)-1e-7)return 'Lịch thực tế bị trùng với phương án JET-203 của '+r.plane+'.';
  endByPlane.set(r.plane,roundEnd(r));
 }
 return '';
}
