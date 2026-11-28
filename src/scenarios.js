// Ready-made starting points. A scenario is only a preset for the existing `setup` action
// (name, hub, logo, colour and the two starting aircraft); it never changes cash or accounting.
// Each market gets its own set so new players start near home; unknown markets get global hubs.
/** @typedef {{id: string, name: string, detail: string, airline: string, origin: string, logo: string, color: string, models: string[]}} Scenario */

/** @type {Record<string, Scenario[]>} */
export const SCENARIO_SETS = {
  vn: [
    {id: 'northern-gateway', name: 'Cửa ngõ phía Bắc', detail: 'Hà Nội làm hub, hai máy bay tầm trung cân bằng. Tuyến nội địa đông đúc.', airline: 'Red River Air', origin: 'HAN', logo: 'bird', color: '#C2410C', models: ['A320', 'B738']},
    {id: 'southern-hub', name: 'Hub phía Nam', detail: 'TP. Hồ Chí Minh làm hub, hai máy bay lớn hơn cho các tuyến đông khách.', airline: 'Mekong Wings', origin: 'SGN', logo: 'waves', color: '#0F766E', models: ['A321', 'B38M']},
    {id: 'island-hopper', name: 'Đảo và du lịch', detail: 'Đà Nẵng làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Coast Air', origin: 'DAD', logo: 'horizon', color: '#1D4ED8', models: ['A223', 'A320']},
    {id: 'regional-gateway', name: 'Cổng khu vực', detail: 'Singapore làm hub, tầm hoạt động rộng ra cả khu vực châu Á.', airline: 'Lion City Link', origin: 'SIN', logo: 'compass', color: '#7E22CE', models: ['A321', 'A320']},
  ],
  jp: [
    {id: 'jp-tokyo', name: 'Cửa ngõ Tokyo', detail: 'Tokyo Haneda làm hub, hai máy bay thân hẹp cho trục nội địa dày đặc.', airline: 'Sakura Link', origin: 'HND', logo: 'bird', color: '#BE123C', models: ['A320', 'B738']},
    {id: 'jp-kansai', name: 'Kansai', detail: 'Osaka Kansai làm hub, hai máy bay lớn hơn cho tuyến nội địa và châu Á gần.', airline: 'Kansai Air Bridge', origin: 'KIX', logo: 'waves', color: '#0F766E', models: ['A321', 'B38M']},
    {id: 'jp-hokkaido', name: 'Phương Bắc Hokkaido', detail: 'Sapporo New Chitose làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Northern Star Air', origin: 'CTS', logo: 'star', color: '#1D4ED8', models: ['A223', 'A320']},
    {id: 'jp-kyushu', name: 'Cửa ngõ Kyushu', detail: 'Fukuoka làm hub, gần Hàn Quốc và Đài Loan.', airline: 'Genkai Wings', origin: 'FUK', logo: 'compass', color: '#7E22CE', models: ['A221', 'B738']},
  ],
  kr: [
    {id: 'kr-incheon', name: 'Cửa ngõ Incheon', detail: 'Seoul Incheon làm hub, hai máy bay lớn hơn cho các tuyến quốc tế gần.', airline: 'Han River Air', origin: 'ICN', logo: 'globe', color: '#1D4ED8', models: ['A321', 'B38M']},
    {id: 'kr-gimpo', name: 'Seoul Gimpo', detail: 'Seoul Gimpo làm hub, hai máy bay tầm trung cho tuyến nội địa và thành phố gần.', airline: 'Capital Shuttle', origin: 'GMP', logo: 'wing', color: '#BE123C', models: ['A320', 'B738']},
    {id: 'kr-jeju', name: 'Đảo Jeju', detail: 'Jeju làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Jeju Breeze', origin: 'CJU', logo: 'horizon', color: '#0F766E', models: ['A223', 'A320']},
    {id: 'kr-busan', name: 'Cảng Busan', detail: 'Busan làm hub, gần Nhật Bản và các tuyến biển.', airline: 'Busan Harbor Air', origin: 'PUS', logo: 'waves', color: '#7E22CE', models: ['A221', 'B738']},
  ],
  th: [
    {id: 'th-bangkok', name: 'Cửa ngõ Bangkok', detail: 'Bangkok làm hub, hai máy bay lớn hơn cho các tuyến đông khách.', airline: 'Chao Phraya Air', origin: 'BKK', logo: 'bird', color: '#C2410C', models: ['A321', 'B38M']},
    {id: 'th-phuket', name: 'Đảo Phuket', detail: 'Phuket làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Andaman Wings', origin: 'HKT', logo: 'waves', color: '#0F766E', models: ['A223', 'A320']},
    {id: 'th-chiang-mai', name: 'Phương Bắc Chiang Mai', detail: 'Chiang Mai làm hub, hai máy bay tầm trung cân bằng.', airline: 'Lanna Air', origin: 'CNX', logo: 'mountain', color: '#1D4ED8', models: ['A320', 'B738']},
    {id: 'th-asean', name: 'Cổng ASEAN', detail: 'Kuala Lumpur làm hub, tầm hoạt động rộng ra cả Đông Nam Á.', airline: 'Straits Link', origin: 'KUL', logo: 'compass', color: '#7E22CE', models: ['A321', 'A320']},
  ],
  au: [
    {id: 'au-sydney', name: 'Cửa ngõ Sydney', detail: 'Sydney làm hub, hai máy bay lớn hơn cho trục nội địa đông khách.', airline: 'Harbour Air', origin: 'SYD', logo: 'waves', color: '#1D4ED8', models: ['A321', 'B38M']},
    {id: 'au-melbourne', name: 'Melbourne', detail: 'Melbourne làm hub, hai máy bay tầm trung cân bằng.', airline: 'Southern Cross Link', origin: 'MEL', logo: 'star', color: '#BE123C', models: ['A320', 'B738']},
    {id: 'au-brisbane', name: 'Bờ biển Queensland', detail: 'Brisbane làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Sunshine Coast Air', origin: 'BNE', logo: 'horizon', color: '#0F766E', models: ['A223', 'A320']},
    {id: 'au-perth', name: 'Miền Tây Perth', detail: 'Perth làm hub, xa các thành phố lớn nên mỗi tuyến đều dài.', airline: 'Swan River Air', origin: 'PER', logo: 'compass', color: '#C2410C', models: ['A321', 'B738']},
  ],
  us: [
    {id: 'us-atlanta', name: 'Hub Atlanta', detail: 'Atlanta làm hub, hai máy bay tầm trung cho mạng nội địa dày đặc.', airline: 'Peachtree Air', origin: 'ATL', logo: 'bird', color: '#C2410C', models: ['A320', 'B738']},
    {id: 'us-los-angeles', name: 'Bờ Tây', detail: 'Los Angeles làm hub, hai máy bay lớn hơn cho các tuyến đông khách.', airline: 'Pacific Coast Air', origin: 'LAX', logo: 'waves', color: '#0F766E', models: ['A321', 'B38M']},
    {id: 'us-denver', name: 'Miền núi Denver', detail: 'Denver làm hub với máy bay tiết kiệm nhiên liệu, ở giữa lục địa.', airline: 'Front Range Air', origin: 'DEN', logo: 'mountain', color: '#1D4ED8', models: ['A223', 'A320']},
    {id: 'us-new-york', name: 'Cửa ngõ New York', detail: 'New York JFK làm hub, thị trường lớn nhưng cạnh tranh.', airline: 'Empire Link', origin: 'JFK', logo: 'star', color: '#7E22CE', models: ['A321', 'A320']},
  ],
  gb: [
    {id: 'gb-london', name: 'Cửa ngõ London', detail: 'London Heathrow làm hub, hai máy bay lớn hơn cho các tuyến châu Âu đông khách.', airline: 'Thames Air', origin: 'LHR', logo: 'globe', color: '#1D4ED8', models: ['A321', 'A320']},
    {id: 'gb-manchester', name: 'Miền Bắc nước Anh', detail: 'Manchester làm hub, hai máy bay tầm trung cân bằng.', airline: 'Pennine Air', origin: 'MAN', logo: 'wing', color: '#BE123C', models: ['A320', 'B738']},
    {id: 'gb-edinburgh', name: 'Scotland', detail: 'Edinburgh làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn.', airline: 'Highland Air', origin: 'EDI', logo: 'mountain', color: '#0F766E', models: ['A223', 'E295']},
    {id: 'gb-dublin', name: 'Cửa ngõ Ireland', detail: 'Dublin làm hub, nối Anh, châu Âu và Bắc Đại Tây Dương.', airline: 'Liffey Wings', origin: 'DUB', logo: 'feather', color: '#15803D', models: ['A321', 'B38M']},
  ],
  eu: [
    {id: 'eu-frankfurt', name: 'Hub Frankfurt', detail: 'Frankfurt làm hub, trung tâm của mạng châu Âu.', airline: 'Main River Air', origin: 'FRA', logo: 'globe', color: '#1D4ED8', models: ['A321', 'A320']},
    {id: 'eu-paris', name: 'Cửa ngõ Paris', detail: 'Paris Charles de Gaulle làm hub, hai máy bay tầm trung cân bằng.', airline: 'Seine Air', origin: 'CDG', logo: 'star', color: '#BE123C', models: ['A320', 'B738']},
    {id: 'eu-amsterdam', name: 'Amsterdam', detail: 'Amsterdam làm hub với máy bay tiết kiệm nhiên liệu, dày tuyến ngắn.', airline: 'Polder Air', origin: 'AMS', logo: 'wind', color: '#C2410C', models: ['A223', 'E295']},
    {id: 'eu-madrid', name: 'Bán đảo Iberia', detail: 'Madrid làm hub, hai máy bay lớn hơn cho tuyến nắng và du lịch.', airline: 'Meseta Air', origin: 'MAD', logo: 'horizon', color: '#7E22CE', models: ['A321', 'B38M']},
  ],
  global: [
    {id: 'global-singapore', name: 'Cổng châu Á', detail: 'Singapore làm hub, tầm hoạt động rộng ra cả khu vực châu Á.', airline: 'Lion City Link', origin: 'SIN', logo: 'compass', color: '#7E22CE', models: ['A321', 'A320']},
    {id: 'global-dubai', name: 'Ngã tư Trung Đông', detail: 'Dubai làm hub, nằm giữa châu Âu, châu Á và châu Phi.', airline: 'Desert Falcon Air', origin: 'DXB', logo: 'bird', color: '#C2410C', models: ['A321', 'B38M']},
    {id: 'global-london', name: 'Cửa ngõ London', detail: 'London Heathrow làm hub, hai máy bay lớn hơn cho các tuyến châu Âu đông khách.', airline: 'Thames Air', origin: 'LHR', logo: 'globe', color: '#1D4ED8', models: ['A320', 'B738']},
    {id: 'global-new-york', name: 'Cửa ngõ New York', detail: 'New York JFK làm hub, thị trường lớn nhưng cạnh tranh.', airline: 'Empire Link', origin: 'JFK', logo: 'star', color: '#0F766E', models: ['A223', 'A320']},
  ],
};

/** All scenarios across markets, for validation and lookup. */
export const SCENARIOS = Object.values(SCENARIO_SETS).flat();

/** @type {Record<string, string>} */
const COUNTRY_MARKET = {VN: 'vn', JP: 'jp', KR: 'kr', TH: 'th', AU: 'au', NZ: 'au', US: 'us', GB: 'gb', IE: 'gb',
  DE: 'eu', FR: 'eu', ES: 'eu', IT: 'eu', NL: 'eu', BE: 'eu', AT: 'eu', CH: 'eu', PT: 'eu', LU: 'eu', DK: 'eu', SE: 'eu', NO: 'eu', FI: 'eu', PL: 'eu', CZ: 'eu'};
// Languages spoken almost only in one market; English, Spanish etc. say nothing about location.
/** @type {Record<string, string>} */
const LANGUAGE_MARKET = {vi: 'vn', ja: 'jp', ko: 'kr', th: 'th'};
/** @type {[RegExp, string][]} */
const ZONE_MARKET = [
  [/^Asia\/(Ho_Chi_Minh|Saigon)$/, 'vn'], [/^Asia\/Tokyo$/, 'jp'], [/^Asia\/Seoul$/, 'kr'], [/^Asia\/Bangkok$/, 'th'],
  [/^(Australia\/|Pacific\/Auckland$)/, 'au'], [/^(America\/(New_York|Detroit|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Indiana\/|Kentucky\/|Boise)|Pacific\/Honolulu$)/, 'us'],
  [/^Europe\/(London|Dublin)$/, 'gb'], [/^Europe\//, 'eu'],
];

/**
 * Picks the scenario market from where the player is, not which UI language they chose:
 * time zone first, then the region of a browser locale, then a single-market language.
 * @param {{languages?: readonly string[], timeZone?: string}} [env]
 */
export function detectMarket(env = browserEnv()) {
  const zone = ZONE_MARKET.find(([pattern]) => pattern.test(env.timeZone || ''));
  if (zone) return zone[1];
  const tags = (env.languages || []).map(tag => String(tag).split(/[-_]/));
  for (const [, region] of tags) if (region && COUNTRY_MARKET[region.toUpperCase()]) return COUNTRY_MARKET[region.toUpperCase()];
  for (const [language] of tags) if (LANGUAGE_MARKET[language?.toLowerCase()]) return LANGUAGE_MARKET[language.toLowerCase()];
  return 'global';
}

function browserEnv() {
  try {
    return {languages: globalThis.navigator?.languages || [globalThis.navigator?.language].filter(Boolean), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone};
  } catch {
    return {};
  }
}

/** @param {string} market */
export const scenariosFor = market => SCENARIO_SETS[market] ?? SCENARIO_SETS.global;

/** @param {string} id */
export const scenarioById = id => SCENARIOS.find(s => s.id === id) ?? null;

// The action the founding form would send for this preset.
/** @param {Scenario} scenario */
export const scenarioSetup = scenario => ({
  type: 'setup',
  name: scenario.airline,
  origin: scenario.origin,
  logo: scenario.logo,
  color: scenario.color,
  models: [...scenario.models],
});
