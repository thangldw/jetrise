import {useI18n} from './i18n.jsx';
import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {FastForward, Pause, Play} from '@phosphor-icons/react';
import {WORLD_LAND} from './data/world-land.js';
import {getAirport} from './network.js';
import {frameNetwork} from './map-framing.js';
import {routesFor, money, time} from './game.js';
import {buildDayReplay, replayFrame, arcControl, arcPoint} from './day-replay.js';

// One game hour per second at 1x keeps a full day under half a minute.
const HOURS_PER_SECOND = 1;
const SPEEDS = [1, 2, 4];
// A simple aircraft silhouette pointing along +x, in unit size.
const AIRCRAFT = 'M1 0L-.2 .18L-.55 .75L-.75 .75L-.5 .15L-.9 .1L-1.05 .4L-1.2 .4L-1.1 0L-1.2 -.4L-1.05 -.4L-.9 -.1L-.5 -.15L-.75 -.75L-.55 -.75L-.2 -.18Z';

export function DayReplay({game, rows, report, Button, onDone}) {
  const {t: tx, number} = useI18n();
  const uid = useId().replace(/:/g, '');
  const replay = useMemo(() => buildDayReplay(rows, routesFor(game), report), [rows, report, game]);
  const [hour, setHour] = useState(replay.from), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const finished = hour >= replay.to;
  const host = useRef(null), [width, setWidth] = useState(880);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width) setWidth(entry.contentRect.width); });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || finished) return;
    let frame, last = performance.now();
    const tick = now => {
      // Clamp long gaps (a background tab) so the day does not jump ahead unseen.
      const elapsed = Math.min(now - last, 100) / 1000; last = now;
      setHour(h => Math.min(replay.to, h + elapsed * HOURS_PER_SECOND * speed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, finished, replay]);

  const view = replayFrame(replay, hour);
  const map = useMemo(() => {
    const codes = [...new Set(replay.legs.flatMap(l => [l.from, l.to]))], airports = codes.map(code => getAirport(game, code)).filter(Boolean);
    const home = getAirport(game, game.airline.origin) || airports[0];
    const frame = frameNetwork(airports.length ? airports : [home], home), lift = frame.box.h * .14;
    const pairs = new Map();
    for (const leg of replay.legs) { const key = [leg.from, leg.to].sort().join('|'); if (!pairs.has(key)) pairs.set(key, [leg.from, leg.to]); }
    const at = code => frame.raw(getAirport(game, code));
    return {frame, lift, at, airports, hubs: new Set(Object.keys(game.hq.hubs)),
      arcs: [...pairs].map(([key, [from, to]]) => { const a = at(from), b = at(to), c = arcControl(a, b, lift); return {key, d: `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`}; })};
  }, [replay, game]);
  // Glyphs and labels are sized in map units so that they stay about 13px on screen at any width.
  const {box} = map.frame, size = box.w * 13 / width;
  const clock = h => tx(time(h)) + (h >= 24 ? ' (+1)' : '');
  const progress = (view.hour - replay.from) / (replay.to - replay.from);

  return <div className="day-replay">
    <div className="replay-hud">
      <div className="replay-clock"><small>{finished ? tx("NGÀY {0} ĐÃ HOÀN TẤT", {0: tx(report.day)}) : tx("NGÀY {0} · ĐANG KHAI THÁC", {0: tx(report.day)})}</small><strong>{clock(view.hour)}</strong></div>
      <dl>
        <div><dt>{tx("Doanh thu vé")}</dt><dd>{tx(money(view.revenue))}</dd></div>
        <div><dt>{tx("Hành khách")}</dt><dd>{tx(number(view.pax))}</dd></div>
        <div><dt>{tx("Chặng đã cất cánh")}</dt><dd>{tx(view.departed)} / {tx(replay.totals.legs)}</dd></div>
        {finished && <div className={report.profit < 0 ? 'negative' : 'positive'}><dt>{tx("Lợi nhuận ngày")}</dt><dd>{tx(money(report.profit))}</dd></div>}
      </dl>
    </div>
    <div className="replay-map" ref={host} role="img" aria-label={tx("Bản đồ phát lại các chuyến bay trong ngày")}>
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} aria-hidden="true">
        <defs><linearGradient id={uid + 'land'} gradientUnits="userSpaceOnUse" x1={box.x} y1={box.y} x2={box.x + box.w} y2={box.y + box.h}><stop stopColor="#123450"/><stop offset=".5" stopColor="#16425a"/><stop offset="1" stopColor="#0b223b"/></linearGradient></defs>
        <g className="replay-land">{[-1000, 0, 1000].map(offset => <g key={offset} transform={`translate(${offset} 0)`}>{WORLD_LAND.map((d, i) => <path key={i} d={d} style={{fill: `url(#${uid}land)`}}/>)}</g>)}</g>
        {map.arcs.map(arc => <path key={arc.key} className="replay-arc" d={arc.d} vectorEffect="non-scaling-stroke"/>)}
        {view.aircraft.map(leg => {
          // The flown part of the arc is its own curve (de Casteljau split), so the stroke can stay non-scaling.
          const a = map.at(leg.from), c = arcControl(a, map.at(leg.to), map.lift), t = leg.progress, p = arcPoint(a, map.at(leg.to), map.lift, t);
          return <path key={leg.id + 'trail'} className="replay-trail" d={`M ${a.x} ${a.y} Q ${a.x + (c.x - a.x) * t} ${a.y + (c.y - a.y) * t} ${p.x} ${p.y}`} vectorEffect="non-scaling-stroke"/>;
        })}
        {map.airports.map(a => { const p = map.frame.raw(a), hub = map.hubs.has(a.iata); return <g key={a.iata} className={hub ? 'replay-airport hub' : 'replay-airport'}><circle cx={p.x} cy={p.y} r={size * (hub ? .42 : .3)}/><text x={p.x} y={p.y + size * 1.5} fontSize={size * .95} textAnchor="middle">{a.iata}</text></g>; })}
        {view.aircraft.map(leg => { const p = arcPoint(map.at(leg.from), map.at(leg.to), map.lift, leg.progress); return <g key={leg.id} className="replay-aircraft" transform={`translate(${p.x} ${p.y})`}><path d={AIRCRAFT} transform={`rotate(${p.angle}) scale(${size * .8})`}/><text y={-size * 1.25} fontSize={size * .8} textAnchor="middle">{leg.plane}</text></g>; })}
      </svg>
      <div className="replay-progress" aria-hidden="true"><i style={{width: Math.max(0, Math.min(1, progress)) * 100 + '%'}}/></div>
    </div>
    <ul className="replay-airborne" aria-live="off">{view.aircraft.length ? view.aircraft.map(leg => <li key={leg.id}><b>{leg.plane}</b>{leg.from} → {leg.to}<span>{clock(leg.departure)} – {clock(leg.arrival)}</span></li>) : <li className="idle">{finished ? tx("Mọi chuyến trong ngày đã được ghi nhận.") : tx("Chưa có máy bay nào đang bay.")}</li>}</ul>
    <div className="replay-controls">
      {finished ? <Button onClick={() => { setHour(replay.from); setPlaying(true); }}>{tx("Phát lại từ đầu")}</Button>
        : <Button icon={playing ? Pause : Play} onClick={() => setPlaying(p => !p)}>{playing ? tx("Tạm dừng") : tx("Tiếp tục")}</Button>}
      <div className="replay-speed" role="group" aria-label={tx("Tốc độ phát lại")}>{SPEEDS.map(s => <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
      {finished ? <Button primary data-initial onClick={onDone}>{tx("Xem báo cáo ngày")}</Button>
        : <Button icon={FastForward} onClick={() => setHour(replay.to)}>{tx("Bỏ qua đến kết quả")}</Button>}
    </div>
    <p className="replay-note">{tx("Phát lại từ kết quả đã chốt; doanh thu vé được cộng khi chặng cất cánh.")}</p>
  </div>;
}
