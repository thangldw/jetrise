import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRPORTS, airportLabel as canonicalAirportLabel, routeLabel as canonicalRouteLabel} from '../src/network.js';
import {airportName, cityName, airportLabel, routeLabel, airportSearchText, airportMessage} from '../src/airport-display.js';
import {airportNames} from '../src/data/airport-display-names.js';
import {createGame, transition, restoreGame, routesFor} from '../src/game.js';
import {translate} from '../src/language.js';
import {normalizeMapSearch} from '../src/map-markers.js';
import {operationAlerts} from '../src/operation-alerts.js';
import {compareDecisions} from '../src/decision-comparison.js';
import {decisionFixture, decisionSpecs} from './fixtures/decision-comparison.mjs';
import {disruptionFixture} from './fixtures/disruption.mjs';
import {longRunFixture} from './fixtures/long-run.mjs';

const languages = ['vi', 'en', 'ja'];
const englishNames = {
  BKK: 'Suvarnabhumi Airport', DAD: 'Da Nang International Airport',
  HAN: 'Noi Bai International Airport', HND: 'Tokyo Haneda International Airport',
  LAX: 'Los Angeles International Airport', LHR: 'London Heathrow Airport',
  NRT: 'Narita International Airport', SGN: 'Tan Son Nhat International Airport',
  SIN: 'Singapore Changi Airport', SYD: 'Sydney Kingsford Smith International Airport',
};
const act = (game, action) => {
  const result = transition(game, action);
  assert.ok(!result.error, result.error);
  return result.game;
};
const includesQuery = (game, code, query) => normalizeMapSearch(airportSearchText(game, code)).includes(normalizeMapSearch(query));

function customGame() {
  let game = act(createGame(), {type: 'setup', name: 'Nội Bài (HAN)', origin: 'HAN', logo: 'wing', color: '#123abc', models: ['A320', 'B738']});
  game = act(game, {type: 'airport-add', iata: 'ZZQ', name: 'Nội Bài (HAN) <custom>', city: 'Hà Nội đến Tokyo', country: 'VN', lat: 12, lon: 108});
  return game;
}

test('Vietnamese labels retain all 4,008 canonical airport identities and exact display text', () => {
  const before = JSON.stringify(AIRPORTS);
  assert.equal(Object.keys(AIRPORTS).length, 4008);
  for (const [code, airport] of Object.entries(AIRPORTS)) {
    assert.equal(airportLabel(null, code, 'vi'), canonicalAirportLabel(null, code), code);
    assert.equal(airportName(null, code, 'vi'), airport.name, code);
    assert.equal(cityName(null, code, 'vi'), airport.city || '', code);
    for (const language of languages) assert.ok(airportLabel(null, code, language).endsWith(`(${code})`), `${language} ${code}`);
  }
  assert.equal(airportLabel(null, 'HAN', 'vi'), 'Hà Nội · Nội Bài (HAN)');
  assert.equal(airportLabel(null, 'DAD', 'vi'), 'Đà Nẵng (DAD)');
  assert.equal(JSON.stringify(AIRPORTS), before);
});

test('English restores the ten legacy display overrides without rewriting canonical names or cities', () => {
  const before = JSON.stringify(AIRPORTS);
  for (const [code, expected] of Object.entries(englishNames)) {
    assert.equal(airportName(null, code, 'en'), expected, code);
    assert.ok(airportLabel(null, code, 'en').includes(expected), code);
  }
  assert.equal(cityName(null, 'HAN', 'en'), 'Hanoi (Soc Son)');
  assert.equal(cityName(null, 'SGN', 'en'), 'Ho Chi Minh City');
  assert.equal(cityName(null, 'DAD', 'en'), 'Da Nang');
  assert.equal(cityName(null, 'CXR', 'en'), 'Cam Ranh');
  assert.equal(cityName(null, 'UIH', 'en'), 'Quy Nhon');
  assert.equal(AIRPORTS.HAN.name, 'Nội Bài');
  assert.equal(AIRPORTS.SGN.name, 'Tân Sơn Nhất');
  assert.equal(JSON.stringify(AIRPORTS), before);
});

test('Japanese names keep airport and municipality identities distinct and fall back per field', () => {
  const expected = {
    HAN: ['ノイバイ国際空港', 'ハノイ (Soc Son)'],
    SGN: ['タンソンニャット国際空港', 'ホーチミン市'],
    DAD: ['ダナン国際空港', 'ダナン'],
    NRT: ['成田国際空港', '成田'],
    HND: ['羽田空港', '東京都'],
    CXR: ['カムラン国際空港', 'カムラン'],
    UIH: ['フーカット空港', 'クイニョン'],
    KKJ: ['北九州空港', '北九州'],
    JFK: ['ジョン・F・ケネディ国際空港', 'ニューヨーク'],
    LHR: ['ロンドン・ヒースロー空港', 'ロンドン'],
  };
  const before = JSON.stringify(AIRPORTS);
  for (const [code, [name, city]] of Object.entries(expected)) {
    assert.equal(airportName(null, code, 'ja'), name, code);
    assert.equal(cityName(null, code, 'ja'), city, code);
    assert.equal(airportLabel(null, code, 'ja'), `${city} · ${name} (${code})`, code);
  }
  assert.equal(airportLabel(null, 'AAE', 'ja'), 'アンナバ · Annaba Rabah Bitat Airport (AAE)', 'city-only Japanese coverage preserves the Latin airport name');
  assert.equal(airportLabel(null, 'AAK', 'ja'), 'Buariki · アラヌカ空港 (AAK)', 'airport-only Japanese coverage preserves the Latin municipality');
  assert.equal(airportLabel(null, 'AAA', 'ja'), 'Anaa · Anaa Airport (AAA)', 'uncovered fields retain the canonical Latin fallback');
  assert.equal(routeLabel(null, {from: 'HND', to: 'NRT'}, 'ja'), '東京都 · 羽田空港 (HND) ↔ 成田 · 成田国際空港 (NRT)');
  assert.equal(JSON.stringify(AIRPORTS), before);
});

test('localized views preserve custom names, player airline identity, routes and serialized saves', () => {
  const game = customGame(), original = JSON.stringify(game), canonical = JSON.stringify(AIRPORTS);
  const custom = canonicalAirportLabel(game, 'ZZQ');
  for (const language of languages) {
    assert.equal(airportLabel(game, 'ZZQ', language), custom);
    assert.equal(airportName(game, 'ZZQ', language), 'Nội Bài (HAN) <custom>');
    assert.equal(cityName(game, 'ZZQ', language), 'Hà Nội đến Tokyo');
    assert.equal(routeLabel(game, {from: 'HAN', to: 'ZZQ'}, language), `${airportLabel(game, 'HAN', language)} ↔ ${custom}`);
    for (const route of routesFor(game)) {
      assert.equal(routeLabel(game, route, language), `${airportLabel(game, route.from, language)} ↔ ${airportLabel(game, route.to, language)}`);
      if (language === 'vi') assert.equal(routeLabel(game, route, language), canonicalRouteLabel(game, route));
    }
  }
  assert.equal(game.airline.name, 'Nội Bài (HAN)');
  assert.equal(game.airline.origin, 'HAN');
  assert.deepEqual(restoreGame(original), game);
  assert.equal(JSON.stringify(game), original);
  assert.equal(JSON.stringify(AIRPORTS), canonical);
});

test('unknown codes and unsupported locales use deterministic canonical fallbacks', () => {
  for (const language of languages) {
    assert.equal(airportName(null, 'ZZZ', language), 'ZZZ');
    assert.equal(airportLabel(null, 'ZZZ', language), 'ZZZ');
    assert.equal(cityName(null, 'ZZZ', language), '');
    assert.equal(airportSearchText(null, 'ZZZ'), 'ZZZ');
    assert.equal(routeLabel(null, {from: 'ZZZ', to: 'QQQ'}, language), 'ZZZ ↔ QQQ');
  }
  assert.equal(airportLabel(null, 'HAN', 'fr'), canonicalAirportLabel(null, 'HAN'));
  assert.equal(airportName(null, 'HAN', 'fr'), AIRPORTS.HAN.name);
});

test('search aliases retain canonical Vietnamese, English, codes and every supplied Japanese field', () => {
  for (const query of ['HAN', 'Hà Nội', 'ha noi', 'Nội Bài', 'noi bai', 'Hanoi', 'Noi Bai International Airport']) {
    assert.ok(includesQuery(null, 'HAN', query), query);
  }
  assert.ok(includesQuery(null, 'SGN', 'Ho Chi Minh City'));
  assert.ok(includesQuery(null, 'SGN', 'Tân Sơn Nhất'));
  assert.ok(includesQuery(null, 'HND', 'Tokyo Haneda'));
  for (const [code, copy] of Object.entries(airportNames)) {
    for (const field of ['name', 'city']) {
      if (copy.ja?.[field]) assert.ok(includesQuery(null, code, copy.ja[field]), `${code} ${field}`);
    }
  }
  const game = customGame();
  assert.ok(includesQuery(game, 'ZZQ', 'Ha Noi den Tokyo'));
  const other = structuredClone(game);
  other.network.airports[0].name = 'Different airport';
  other.network.airports[0].city = 'Different city';
  assert.ok(includesQuery(other, 'ZZQ', 'Different city'));
  assert.ok(!includesQuery(other, 'ZZQ', 'Ha Noi den Tokyo'), 'custom aliases must not leak across careers through the static cache');
  assert.ok(includesQuery(game, 'ZZQ', 'Ha Noi den Tokyo'));
});

function assertLocalizedMessage(game, source, codes, preserved = []) {
  const before = JSON.stringify(game);
  assert.equal(airportMessage(game, source, 'vi'), source);
  for (const language of ['en', 'ja']) {
    const presented = airportMessage(game, source, language);
    for (const code of codes) assert.ok(presented.includes(airportLabel(game, code, language)), `${language}: ${presented}`);
    for (const value of preserved) assert.ok(presented.includes(value), `${language}: missing ${value} in ${presented}`);
    assert.notEqual(presented, source, 'the approved system wrapper is localized');
    assert.equal(airportMessage(game, presented, language), presented, 'presentation should be idempotent');
  }
  assert.equal(JSON.stringify(game), before);
}

test('all five allowed message shapes localize airport fields from real engine producers', () => {
  const game = decisionFixture();
  const before = JSON.stringify(game);
  const comparison = compareDecisions(game, decisionSpecs(game).slice(0, 2));
  const fares = comparison.options[0];
  const frequency = comparison.options[1];
  assert.ok(!fares.error, fares.error);
  assert.ok(!frequency.error, frequency.error);
  const fareDetail = fares.details.find(detail => detail.startsWith('Giá Y/J/F: '));
  const scheduleDetail = frequency.details.find(detail => detail.startsWith('Xếp '));
  assert.ok(fareDetail);
  assert.ok(scheduleDetail);
  assertLocalizedMessage(game, fareDetail, ['HAN', 'DAD'], [fares.actions.find(action => action.type === 'prices').values.join(' / ')]);
  assertLocalizedMessage(game, scheduleDetail, ['HAN', 'DAD'], [game.fleet[0].id]);
  assert.equal(JSON.stringify(game), before);

  const slots = longRunFixture({stage: 204}).game;
  slots.slotMarket.rights.player = {};
  const deficit = operationAlerts(slots).alerts.find(alert => alert.id.startsWith('slot:HAN:'));
  assert.ok(deficit);
  assertLocalizedMessage(slots, deficit.title, ['HAN']);

  const legacy = createGame();
  legacy.slotRights = {HAN: {capacity: 0, unlockDay: 1}};
  const overCapacity = operationAlerts(legacy).alerts.find(alert => alert.id.startsWith('legacy-slot:HAN:'));
  assert.ok(overCapacity);
  assertLocalizedMessage(legacy, overCapacity.title, ['HAN']);

  const connections = disruptionFixture();
  const journey = connections.legEconomy.overnight.journeys[0];
  connections.fleet.find(plane => plane.id === journey.legs[1].plane).fault = 'Synthetic preflight failure';
  const affected = operationAlerts(connections).alerts.find(alert => alert.id === 'journey:' + journey.id);
  assert.ok(affected);
  assertLocalizedMessage(connections, affected.detail, [journey.legs[0].from, journey.legs[1].to]);
});

test('message localization is restricted to verified complete airport fields, not arbitrary names or text', () => {
  const game = customGame();
  const han = canonicalAirportLabel(game, 'HAN'), hnd = canonicalAirportLabel(game, 'HND');
  const custom = canonicalAirportLabel(game, 'ZZQ');
  const unchanged = [
    han,
    `Player airline: ${han}`,
    `Đã thành lập ${han} · cấp $500.000.000 và 2 máy bay tầm trung. Chuẩn bị đội bay trước khi chọn tuyến.`,
    `Đã thêm sân bay ${han} (ZZQ).`,
    `Note: ${han} · thiếu quyền slot`,
    `${han} · thiếu quyền slot — extra note`,
    ` ${han} · thiếu quyền slot`,
    `${han} · thiếu quyền slot `,
    `Note: Giá Y/J/F: 100 / 200 / 300 USD · ${han} ↔ ${hnd}`,
    `Xếp 3 vòng/tuần · ${han} ↔ ${hnd} · VN-A101. trailing`,
    'Wrong name (HAN) · thiếu quyền slot',
    `${custom} · thiếu quyền slot`,
    `Giá Y/J/F: 100 / 200 / 300 USD · Wrong name (HAN) ↔ Wrong name (HND)`,
    `Xếp 3 vòng/tuần · ${han} ↔ ${hnd} · ${han}.`,
  ];
  for (const language of ['en', 'ja']) {
    for (const source of unchanged) assert.equal(airportMessage(game, source, language), translate(language, source), `${language}: ${source}`);
    const source = `Giá Y/J/F: 100.5 / 200 / 300 USD · ${han} ↔ ${custom}`;
    assert.equal(airportMessage(game, source, language), translate(language, 'Giá Y/J/F: {0} USD · {1}', {0: '100.5 / 200 / 300', 1: `${airportLabel(game, 'HAN', language)} ↔ ${custom}`}));
    const maintenance = 'VN-A101 · đã đến hạn bảo dưỡng';
    assert.equal(airportMessage(game, maintenance, language), translate(language, maintenance));
    assert.notEqual(airportMessage(game, maintenance, language), maintenance);
    assert.equal(airportMessage(game, null, language), null);
    assert.equal(airportMessage(game, 123, language), 123);
  }
});
