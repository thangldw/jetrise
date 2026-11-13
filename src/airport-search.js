// Pure search/ranking for AirportPicker, kept apart from React so it can be unit tested.
export const AIRPORT_LIMIT = 60;
export const normalizeSearch = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');

// candidates: airports ({iata, country}); searchText(a) and labelOf(a) return display strings (any accents/case).
// Without a query the list is the seed country's airports and the current choice is pinned so it stays visible.
// With a query it is ranked: exact IATA, label prefix, word prefix, other substring; the choice is never pinned.
export function searchAirports({candidates, query = '', country = 'all', searchText, labelOf, selected = null, limit = AIRPORT_LIMIT}) {
  const q = normalizeSearch(String(query).trim());
  const text = a => normalizeSearch(searchText(a));
  const found = candidates.filter(a => q ? text(a).includes(q) : (country === 'all' || a.country === country));
  const rank = a => a.iata.toLowerCase() === q ? 0
    : normalizeSearch(labelOf(a)).startsWith(q) ? 1
    : text(a).split(/[^a-z0-9]+/).some(w => w.startsWith(q)) ? 2 : 3;
  const matches = q ? found.map(a => [rank(a), a]).sort((x, y) => x[0] - y[0]).map(x => x[1]) : found;
  const options = matches.slice(0, limit);
  if (selected && !q && !options.some(a => a.iata === selected.iata)) {
    if (options.length === limit) options.pop();
    options.unshift(selected);
  }
  return {q, matches, options};
}
