import {researchEffects} from './research.js';

// Synthetic, opt-in company policies; preference order is budget, business, leisure.
export const POSITIONING_DAYS = 7;
export const POSITIONINGS = {
  none: {name: 'Linh hoạt', fee: 0, daily: 0, revenue: 0, cost: 0, preferences: [1, 1, 1], target: -1, detail: 'Giữ dịch vụ hiện có, chưa có định vị chuyên biệt.'},
  value: {name: 'Giá trị tiết kiệm', fee: 40000, daily: 1500, revenue: 10, cost: 3, preferences: [1.18, .75, .92], target: 0, detail: 'Dịch vụ tách gói thu phụ trợ cao hơn; hấp dẫn khách tiết kiệm, kém phù hợp khách công vụ.'},
  business: {name: 'Ưu tiên công vụ', fee: 60000, daily: 3000, revenue: 4, cost: 12, preferences: [.78, 1.28, .97], target: 1, detail: 'Quy trình ưu tiên thu hút khách công vụ, đổi lại chi phí phục vụ cao và giảm sức hút với khách tiết kiệm.'},
  leisure: {name: 'Kỳ nghỉ trọn vẹn', fee: 50000, daily: 2400, revenue: 6, cost: 10, preferences: [.92, .88, 1.25], target: 2, detail: 'Chăm sóc chuyến nghỉ dưỡng, đánh đổi chi phí và sức hút với khách công vụ.'},
};
export const SEGMENT_NAMES = ['Tiết kiệm', 'Công vụ', 'Nghỉ dưỡng'];
export const positioningKey = s => s.hq?.positioning?.key || 'none';
export const positioningDaily = s => POSITIONINGS[positioningKey(s)].daily;
export const segmentMix = route => route.segment === 'business' ? [.3, .5, .2] : route.segment === 'leisure' ? [.4, .15, .45] : [.5, .25, .25];
export function positioningPreferences(s, day = s.day) {
  const profile = POSITIONINGS[positioningKey(s)], loyalty = researchEffects(s, day).loyalty;
  return profile.preferences.map((n, i) => n * (i === profile.target ? loyalty : 1));
}
// Without AI this adjusts addressable demand. With AI it changes only the player's choice weight.
export function positioningDemand(s, route, day) {
  const prefs = positioningPreferences(s, day);
  return segmentMix(route).reduce((n, weight, i) => n + weight * prefs[i], 0);
}
export function positioningBlock(s, key) {
  if (!Object.hasOwn(POSITIONINGS, key)) return 'Định vị hãng không hợp lệ.';
  if (positioningKey(s) === key) return 'Định vị này đang áp dụng.';
  if (s.hq.positioning && s.day < s.hq.positioning.startedDay + POSITIONING_DAYS) return 'Cam kết hiện tại đến hết ngày '+(s.hq.positioning.startedDay + POSITIONING_DAYS - 1)+'.';
  if (s.cash < POSITIONINGS[key].fee) return 'Ngân quỹ chưa đủ phí triển khai.';
  return null;
}
export function setPositioning(s, key) {
  const block = positioningBlock(s, key); if (block) throw Error(block);
  s.cash -= POSITIONINGS[key].fee;
  if (key === 'none') delete s.hq.positioning;
  else s.hq.positioning = {key, startedDay: s.day};
  return 'Đã áp dụng định vị '+POSITIONINGS[key].name+(key === 'none' ? '.' : '; cam kết 7 ngày khai thác, phí duy trì thu mỗi ngày.');
}
export function validatePositioning(s) {
  const p = s.hq.positioning; if (p === undefined) return;
  if (!p || !Object.hasOwn(POSITIONINGS, p.key) || p.key === 'none' || !Number.isInteger(p.startedDay) || p.startedDay < 1 || p.startedDay > s.day) throw Error('Invalid airline positioning');
}
