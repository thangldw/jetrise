import React from 'react';
import {useI18n} from './i18n.jsx';
import {trendSeries} from './performance-trend.js';

const W = 640, H = 180, PAD = {l: 8, r: 8, t: 12, b: 22};

export function PerformanceTrend({game, money}) {
  const {t: tx} = useI18n();
  const series = trendSeries(game.tycoon.history);
  if (series.length < 2) return null;
  const n = series.length, plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b, step = plotW / n, bar = Math.max(2, step * .62);
  const hi = Math.max(1, ...series.map(s => Math.max(s.revenue, s.profit))), lo = Math.min(0, ...series.map(s => s.profit));
  const y = v => PAD.t + (hi - v) / (hi - lo) * plotH, x = i => PAD.l + step * i + step / 2;
  const revenue = series.map((s, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s.revenue).toFixed(1)).join(' ');
  const total = series.reduce((sum, s) => sum + s.profit, 0), last = series.at(-1), first = series[0];
  return <section className="workspace-panel performance-trend" aria-labelledby="performance-trend-title">
    <div className="panel-heading"><div><h2 id="performance-trend-title">{tx("Kết quả {0} ngày gần nhất", {0: tx(n)})}</h2><p>{tx("Lợi nhuận mỗi ngày (cột) và doanh thu (đường), từ kết quả đã chốt.")}</p></div>
      <dl className="trend-totals"><div><dt>{tx("Tổng lợi nhuận")}</dt><dd className={total < 0 ? 'negative' : ''}>{money(total)}</dd></div><div><dt>{tx("Tiền mặt")}</dt><dd>{money(game.cash)}</dd></div></dl></div>
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx("Biểu đồ lợi nhuận và doanh thu theo ngày")}>
      <line className="trend-zero" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)}/>
      {series.map((s, i) => <rect key={s.day} className={s.profit < 0 ? 'loss' : 'gain'} x={x(i) - bar / 2} width={bar} y={Math.min(y(0), y(s.profit))} height={Math.max(1, Math.abs(y(s.profit) - y(0)))} rx="2"><title>{tx("Ngày {0}: lợi nhuận {1} · doanh thu {2}", {0: s.day, 1: money(s.profit), 2: money(s.revenue)})}</title></rect>)}
      <path className="trend-revenue" d={revenue}/>
      {[first, last].map((s, k) => <text key={k} className="trend-axis" x={k ? W - PAD.r : PAD.l} y={H - 6} textAnchor={k ? 'end' : 'start'}>{tx("Ngày {0}", {0: s.day})}</text>)}
    </svg>
  </section>;
}
