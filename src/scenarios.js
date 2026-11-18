// Ready-made starting points. A scenario is only a preset for the existing `setup` action
// (name, hub, logo, colour and the two starting aircraft); it never changes cash or accounting.
/** @typedef {{id: string, name: string, detail: string, airline: string, origin: string, logo: string, color: string, models: string[]}} Scenario */

/** @type {Scenario[]} */
export const SCENARIOS = [
  {id: 'northern-gateway', name: 'Cửa ngõ phía Bắc', detail: 'Hà Nội làm hub, hai máy bay tầm trung cân bằng. Tuyến nội địa đông đúc.', airline: 'Red River Air', origin: 'HAN', logo: 'bird', color: '#C2410C', models: ['A320', 'B738']},
  {id: 'southern-hub', name: 'Hub phía Nam', detail: 'TP. Hồ Chí Minh làm hub, hai máy bay lớn hơn cho các tuyến đông khách.', airline: 'Mekong Wings', origin: 'SGN', logo: 'waves', color: '#0F766E', models: ['A321', 'B38M']},
  {id: 'island-hopper', name: 'Đảo và du lịch', detail: 'Đà Nẵng làm hub với máy bay tiết kiệm nhiên liệu, hợp tuyến ngắn và du lịch.', airline: 'Coast Air', origin: 'DAD', logo: 'horizon', color: '#1D4ED8', models: ['A223', 'A320']},
  {id: 'regional-gateway', name: 'Cổng khu vực', detail: 'Singapore làm hub, tầm hoạt động rộng ra cả khu vực châu Á.', airline: 'Lion City Link', origin: 'SIN', logo: 'compass', color: '#7E22CE', models: ['A321', 'A320']},
];

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
