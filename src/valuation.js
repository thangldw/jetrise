// Airline valuation and long-term standing, from state only: cash + resale value of owned aircraft − loan balance.
// Leased aircraft and pending orders are excluded. Tiers are multiples of the starting capital, so both economies scale;
// a new airline (cash plus its two starter aircraft) is worth roughly 1.7–2.5× and starts as a start-up.
import {usedPrice} from './fleet.js';

export const TIERS = [
  {id: 'startup', name: 'Hãng khởi nghiệp', multiple: 0},
  {id: 'regional', name: 'Hãng khu vực', multiple: 3},
  {id: 'national', name: 'Hãng quốc gia', multiple: 6},
  {id: 'continental', name: 'Hãng châu lục', multiple: 12},
  {id: 'global', name: 'Hãng toàn cầu', multiple: 24},
];
export const startingCapital = s => s.economyVersion === 2 ? 100000000 : 8600000;

export function airlineValue(s, types) {
  const fleet = s.fleet.filter(p => !p.lease).reduce((n, p) => n + usedPrice(types[p.type], p.ageDays / 365, p.wear), 0);
  const debt = s.hq?.loan?.balance || 0;
  return {cash: s.cash, fleet, debt, total: s.cash + fleet - debt};
}

export function standing(s, types) {
  const value = airlineValue(s, types), base = startingCapital(s), ratio = value.total / base;
  let index = 0;
  TIERS.forEach((t, i) => { if (ratio >= t.multiple) index = i; });
  const next = TIERS[index + 1] || null;
  const floor = TIERS[index].multiple * base, target = next ? next.multiple * base : null;
  return {value, tier: TIERS[index], next, target, progress: next ? Math.max(0, Math.min(1, (value.total - floor) / (target - floor))) : 1};
}
