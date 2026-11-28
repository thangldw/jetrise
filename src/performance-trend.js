// Daily results from recorded history only: profit bars over a revenue line.
// History is stored newest first; the chart reads oldest → newest.
export const trendSeries = history => [...history].sort((a, b) => a.day - b.day).slice(-28).map(d => ({day: d.day, profit: d.profit, revenue: d.revenue, pax: d.pax}));
