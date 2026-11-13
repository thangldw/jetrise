import {AIRPORTS, airportLabel as canonicalLabel, getAirport} from './network.js';
import {airportNames} from './data/airport-display-names.js';
import {translate} from './language.js';

const displayLanguage = language => language === 'en' || language === 'ja' ? language : 'vi';

function names(game, code, language) {
  const airport = getAirport(game, code);
  if (!airport) return null;
  const copy = Object.hasOwn(AIRPORTS, code) ? airportNames[code] : undefined;
  const english = copy?.en;
  const localized = displayLanguage(language) === 'ja' ? copy?.ja : english;
  if (displayLanguage(language) === 'vi' || !Object.hasOwn(AIRPORTS, code)) return {name: airport.name, city: airport.city || ''};
  return {
    name: localized?.name ?? english?.name ?? airport.name,
    city: localized?.city ?? english?.city ?? airport.city ?? '',
  };
}

export function airportName(game, code, language = 'vi') {
  return names(game, code, language)?.name ?? code;
}

export function cityName(game, code, language = 'vi') {
  return names(game, code, language)?.city ?? '';
}

export function airportLabel(game, code, language = 'vi') {
  if (displayLanguage(language) === 'vi' || !Object.hasOwn(AIRPORTS, code)) return canonicalLabel(game, code);
  const place = names(game, code, language);
  if (!place) return code;
  const city = place.city.trim(), name = place.name.trim();
  const prefix = city && city.toLocaleLowerCase() !== name.toLocaleLowerCase() ? city + ' · ' : '';
  return `${prefix}${name} (${code})`;
}

export const routeLabel = (game, route, language = 'vi') => `${airportLabel(game, route.from, language)} ↔ ${airportLabel(game, route.to, language)}`;

const searchCache = new Map();
export function airportSearchText(game, code) {
  const airport = getAirport(game, code);
  if (!airport) return code;
  if (!Object.hasOwn(AIRPORTS, code)) return `${canonicalLabel(game, code)} ${airport.city || ''}`;
  if (!searchCache.has(code)) {
    searchCache.set(code, [...new Set([
      code, airport.name, airport.city,
      ...['vi', 'en', 'ja'].map(language => airportLabel(null, code, language)),
    ].filter(Boolean))].join(' '));
  }
  return searchCache.get(code);
}

// Explicit captures keep a route atomic even when its airport labels contain " · ".
// These helpers are used only for engine-owned alert and comparison messages.
export function airportMessage(game, source, language = 'vi') {
  if (typeof source !== 'string' || displayLanguage(language) === 'vi') return source;
  const label = value => {
    const code = /\(([A-Z]{3})\)$/.exec(value)?.[1];
    return code && Object.hasOwn(AIRPORTS, code) && canonicalLabel(game, code) === value
      ? airportLabel(game, code, language) : value;
  };
  let match = /^(.+) · (thiếu quyền slot|vượt gói slot hiện tại)$/.exec(source);
  if (match) return translate(language, `{0} · ${match[2]}`, {0: label(match[1])});
  match = /^Vé đã bán: (.+) → (.+)\. Dự báo có hoàn phần chưa bay vào ngày (\d+)\. Kiểm tra chuyến bị hủy, máy bay và phương án cứu chuyến; đây chưa phải hoàn vé đã thực hiện\.$/.exec(source);
  if (match) return translate(language, 'Vé đã bán: {0} → {1}. Dự báo có hoàn phần chưa bay vào ngày {2}. Kiểm tra chuyến bị hủy, máy bay và phương án cứu chuyến; đây chưa phải hoàn vé đã thực hiện.', {0: label(match[1]), 1: label(match[2]), 2: match[3]});
  match = /^Giá Y\/J\/F: (\d+(?:\.\d+)? \/ \d+(?:\.\d+)? \/ \d+(?:\.\d+)?) USD · (.+) ↔ (.+)$/.exec(source);
  if (match) return translate(language, 'Giá Y/J/F: {0} USD · {1}', {0: match[1], 1: `${label(match[2])} ↔ ${label(match[3])}`});
  match = /^Xếp (\d+) vòng\/tuần · (.+) ↔ (.+) · ([A-Z0-9-]+)\.$/.exec(source);
  if (match) return translate(language, 'Xếp {0} vòng/tuần · {1} · {2}.', {0: match[1], 1: `${label(match[2])} ↔ ${label(match[3])}`, 2: match[4]});
  return translate(language, source);
}
