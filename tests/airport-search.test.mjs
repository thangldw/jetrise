import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRPORT_LIMIT, normalizeSearch, searchAirports} from '../src/airport-search.js';
import {createGame} from '../src/game.js';
import {airportList} from '../src/network.js';
import {airportLabel, airportSearchText} from '../src/airport-display.js';

const A = (iata, country, label, extra = '') => ({iata, country, label, extra});
const sample = [
  A('AAA', 'VN', 'Zeta City · Hanover Field (AAA)', 'zeta hanover'),
  A('HAN', 'VN', 'Hanoi (Soc Son) · Noi Bai International Airport (HAN)', 'hanoi noi bai'),
  A('BBB', 'JP', 'Osaka · Haneda Annex (BBB)', 'osaka haneda annex'),
  A('CCC', 'JP', 'Kyoto · Shahan Airport (CCC)', 'kyoto shahan'),
  A('HND', 'JP', 'Tokyo · Tokyo Haneda International Airport (HND)', 'tokyo haneda'),
];
const run = (query, extra = {}) => searchAirports({
  candidates: sample, query, searchText: a => a.label + ' ' + a.extra, labelOf: a => a.label, ...extra,
});

test('normalization removes accents and folds case and đ', () => {
  assert.equal(normalizeSearch('Đà Nẵng'), 'da nang');
  assert.equal(normalizeSearch('HÀ NỘI'), 'ha noi');
});

test('empty query lists only the seed country and pins the current choice', () => {
  const result = run('', {country: 'VN'});
  assert.deepEqual(result.options.map(a => a.iata), ['AAA', 'HAN']);
  const pinned = run('', {country: 'VN', selected: sample[4]});
  assert.deepEqual(pinned.options.map(a => a.iata), ['HND', 'AAA', 'HAN'], 'an outside choice stays visible when browsing');
  assert.equal(run('', {country: 'all'}).matches.length, sample.length);
});

test('a query ranks exact IATA, then label prefix, then word prefix, then substring', () => {
  assert.deepEqual(run('han').options.map(a => a.iata), ['HAN', 'AAA', 'BBB', 'HND', 'CCC']);
  assert.equal(run('HND').options[0].iata, 'HND', 'an exact IATA code wins regardless of case');
  assert.deepEqual(run('tokyo').options.map(a => a.iata), ['HND']);
});

test('the current choice is never pinned while searching', () => {
  const result = run('osaka', {selected: sample[1]});
  assert.deepEqual(result.options.map(a => a.iata), ['BBB']);
  assert.equal(result.matches.length, 1);
});

test('accent-insensitive queries match', () => {
  const accented = [A('DAD', 'VN', 'Đà Nẵng · Da Nang International Airport (DAD)')];
  const result = searchAirports({candidates: accented, query: 'da nang', searchText: a => a.label, labelOf: a => a.label});
  assert.equal(result.matches.length, 1);
  assert.equal(searchAirports({candidates: accented, query: 'đà', searchText: a => a.label, labelOf: a => a.label}).options[0].iata, 'DAD');
});

test('results are capped and the pinned choice replaces the last row, not the cap', () => {
  const many = Array.from({length: 100}, (_, i) => A('X' + String(i).padStart(2, '0'), 'VN', 'Place ' + i));
  const outsider = A('ZZZ', 'JP', 'Elsewhere');
  const browse = searchAirports({candidates: [...many, outsider], country: 'VN', selected: outsider, searchText: a => a.label, labelOf: a => a.label});
  assert.equal(browse.options.length, AIRPORT_LIMIT);
  assert.equal(browse.options[0].iata, 'ZZZ');
  assert.equal(browse.matches.length, 100, 'the status count reports every match, not the cap');
  const search = searchAirports({candidates: many, query: 'place', searchText: a => a.label, labelOf: a => a.label});
  assert.equal(search.options.length, AIRPORT_LIMIT);
});

test('real airport data: exact code and Vietnamese city names rank first', () => {
  const game = createGame();
  const candidates = airportList(game);
  const searchText = a => airportSearchText(game, a.iata) + ' ' + a.country;
  const labelOf = a => airportLabel(game, a.iata);
  assert.equal(searchAirports({candidates, query: 'sgn', searchText, labelOf}).options[0].iata, 'SGN');
  assert.equal(searchAirports({candidates, query: 'hanoi', searchText, labelOf}).options[0].iata, 'HAN');
  const prefix = searchAirports({candidates, query: 'ha', searchText, labelOf});
  const firstOther = prefix.options.findIndex(a => !normalizeSearch(labelOf(a)).startsWith('ha'));
  assert.ok(firstOther === -1 || prefix.options.slice(0, firstOther).every(a => normalizeSearch(labelOf(a)).startsWith('ha')),
    'every label that starts with the query precedes every other match');
});
