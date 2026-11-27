import {useI18n} from './i18n.jsx';
import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {CloudFog, CloudLightning, FastForward, Pause, Play, Prohibit} from '@phosphor-icons/react';
import {WORLD_LAND} from './data/world-land.js';
import {getAirport} from './network.js';
import {frameNetwork} from './map-framing.js';
import {rivalOperation} from './strategy.js';
import {routesFor, context, money, time} from './game.js';
import {buildDayReplay, replayFrame, rivalLegs, loadFactor, placeLabels, arcControl, arcPoint} from './day-replay.js';

// One game hour per second at 1x keeps a full day under half a minute.
const HOURS_PER_SECOND = 1;
const SPEEDS = [1, 2, 4];
// A simple aircraft silhouette pointing along +x, in unit size.
const AIRCRAFT = 'M1 0L-.2 .18L-.55 .75L-.75 .75L-.5 .15L-.9 .1L-1.05 .4L-1.2 .4L-1.1 0L-1.2 -.4L-1.05 -.4L-.9 -.1L-.5 -.15L-.75 -.75L-.55 -.75L-.2 -.18Z';
const WEATHER = {fog: {label: 'Sương mù', Icon: CloudFog}, storm: {label: 'Bão', Icon: CloudLightning}};
const percent = share => Math.round(share * 100);

export function DayReplay({game, rows, report, Button, onDone}) {
  const {t: tx, number} = useI18n();
  const uid = useId().replace(/:/g, '');
  const replay = useMemo(() => {
    const routes = routesFor(game);
    const seatsOf = plane => (game.tycoon.cabins[plane] || []).reduce((n, seats) => n + seats, 0);
    // Without rival network growth the report does not time a rival's round trip, so ask the engine's own rival operation.
    const timingOf = rival => {
      const state = game.strategy?.rivals?.find(r => r.id === rival.id);
      try { return state ? rivalOperation(context(game), {...state, route: rival.route}, report.day) : null; } catch { return null; }
    };
    return buildDayReplay(rows, routes, report, {seatsOf, rivals: rivalLegs(report, routes, timingOf)});
  }, [rows, report, game]);
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

  // Space pauses and resumes unless a control has focus, where Space already activates that control.
  useEffect(() => {
    const onKey = event => {
      if (event.key !== ' ' || event.defaultPrevented || finished || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName)) return;
      event.preventDefault(); setPlaying(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished]);

  const view = replayFrame(replay, hour);
  // A soft cue for each departure; the audio engine stays silent unless the player has turned sound on.
  const heard = useRef(view.departed);
  useEffect(() => { if (view.departed > heard.current && !finished) window.jetriseAudio?.cue('click'); heard.current = view.departed; }, [view.departed, finished]);

  const map = useMemo(() => {
    const all = [...replay.legs, ...replay.rivals], codes = [...new Set(all.flatMap(l => [l.from, l.to]))], airports = codes.map(code => getAirport(game, code)).filter(Boolean);
    const home = getAirport(game, game.airline.origin) || airports[0];
    const frame = frameNetwork(airports.length ? airports : [home], home), lift = frame.box.h * .14;
    const at = code => frame.raw(getAirport(game, code));
    const arcsOf = legs => { const pairs = new Map(); for (const leg of legs) { const key = [leg.from, leg.to].sort().join('|'); if (!pairs.has(key)) pairs.set(key, [leg.from, leg.to]); } return pairs; };
    const own = arcsOf(replay.legs), path = ([from, to]) => { const a = at(from), b = at(to), c = arcControl(a, b, lift); return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`; };
    return {frame, lift, at, airports, hubs: new Set(Object.keys(game.hq.hubs)), weather: new Map(replay.weather.map(w => [w.code, w])),
      arcs: [...own].map(([key, pair]) => ({key, d: path(pair)})),
      // A route only rivals fly gets its own fainter arc.
      rivalArcs: [...arcsOf(replay.rivals)].filter(([key]) => !own.has(key)).map(([key, pair]) => ({key, d: path(pair)}))};
  }, [replay, game]);
  // Glyphs and labels are sized in map units so that they stay about 13px on screen at any width.
  const {box} = map.frame, size = box.w * 13 / width;
  const labelled = useMemo(() => placeLabels(map.airports.map(a => ({...map.frame.raw(a), iata: a.iata})), size * .95), [map, size]);
  const clock = h => tx(time(h)) + (h >= 24 ? ' (+1)' : '');
  const progress = (view.hour - replay.from) / (replay.to - replay.from);
  const airlines = [...new Set(replay.rivals.map(l => l.airline))];
  const best = replay.flights[0], worst = replay.flights.length > 1 ? replay.flights[replay.flights.length - 1] : null;
  const flightCard = (flight, title) => <div className={flight.profit < 0 ? 'negative' : ''}><small>{tx(title)}</small><b>{flight.plane} · {flight.from} ↔ {flight.to}</b>
    <span>{tx(money(flight.profit))}{flight.load !== null && <> · {tx("Lấp đầy {0}%", {0: percent(flight.load)})}</>}</span></div>;

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
        {map.rivalArcs.map(arc => <path key={arc.key} className="replay-arc rival" d={arc.d} vectorEffect="non-scaling-stroke"/>)}
        {map.arcs.map(arc => <path key={arc.key} className="replay-arc" d={arc.d} vectorEffect="non-scaling-stroke"/>)}
        {labelled.filter(p => map.weather.has(p.iata)).map(p => <circle key={p.iata + 'weather'} className={'replay-weather ' + map.weather.get(p.iata).kind} cx={p.x} cy={p.y} r={size * 1.9} vectorEffect="non-scaling-stroke"/>)}
        {view.aircraft.map(leg => {
          // The flown part of the arc is its own curve (de Casteljau split), so the stroke can stay non-scaling.
          const a = map.at(leg.from), c = arcControl(a, map.at(leg.to), map.lift), t = leg.progress, p = arcPoint(a, map.at(leg.to), map.lift, t);
          return <path key={leg.id + 'trail'} className="replay-trail" d={`M ${a.x} ${a.y} Q ${a.x + (c.x - a.x) * t} ${a.y + (c.y - a.y) * t} ${p.x} ${p.y}`} vectorEffect="non-scaling-stroke"/>;
        })}
        {labelled.map(p => { const hub = map.hubs.has(p.iata); return <g key={p.iata} className={hub ? 'replay-airport hub' : 'replay-airport'}><circle cx={p.x} cy={p.y} r={size * (hub ? .42 : .3)}/><text x={p.label.x} y={p.label.y} fontSize={size * .95} textAnchor="middle" dominantBaseline="central">{p.iata}</text></g>; })}
        {view.rivals.map(leg => {
          // Rivals on the same route at the same time would sit on one point, so each airline is nudged off the arc a little.
          const p = arcPoint(map.at(leg.from), map.at(leg.to), map.lift, leg.progress), lane = airlines.indexOf(leg.airline);
          return <g key={leg.id} className={'replay-aircraft rival rival-' + (lane % 2)} transform={`translate(${p.x} ${p.y + size * .7 * (lane % 2 ? 1 : -1)})`}><path d={AIRCRAFT} transform={`rotate(${p.angle}) scale(${size * .6})`}/></g>; })}
        {view.aircraft.map(leg => { const p = arcPoint(map.at(leg.from), map.at(leg.to), map.lift, leg.progress); return <g key={leg.id} className="replay-aircraft" transform={`translate(${p.x} ${p.y})`}><path d={AIRCRAFT} transform={`rotate(${p.angle}) scale(${size * .8})`}/><text y={-size * 1.25} fontSize={size * .8} textAnchor="middle">{leg.plane}</text></g>; })}
        {view.popups.map((leg, i) => {
          // Figures from the same airport stack instead of covering each other.
          const p = map.at(leg.from), rank = view.popups.slice(0, i).filter(other => other.from === leg.from).length;
          return <text key={leg.id + 'pop'} className="replay-popup" x={p.x} y={p.y - size * (1.9 + rank * 1.2)} fontSize={size} textAnchor="middle" opacity={1 - leg.age}>+{tx(money(leg.revenue))}</text>;
        })}
      </svg>
      <div className="replay-progress" aria-hidden="true"><i style={{width: Math.max(0, Math.min(1, progress)) * 100 + '%'}}/></div>
    </div>
    {(replay.weather.length > 0 || airlines.length > 0) && <ul className="replay-legend">
      {replay.weather.map(w => { const {label, Icon} = WEATHER[w.kind]; return <li key={w.code} className={'weather-' + w.kind}><Icon size={16} aria-hidden="true"/>{tx("{0} tại {1} · nhu cầu {2}%", {0: tx(label), 1: w.code, 2: w.demand})}</li>; })}
      {airlines.map((id, i) => <li key={id} className={'rival-' + (i % 2)}><svg viewBox="-1.3 -1 2.4 2" aria-hidden="true"><path d={AIRCRAFT}/></svg>{tx("Đối thủ {0}", {0: id.toUpperCase()})}</li>)}
    </ul>}
    {finished && best ? <div className="replay-highlights" aria-label={tx("Điểm nổi bật trong ngày")}>
      {flightCard(best, "Chuyến lãi nhất")}
      {worst && flightCard(worst, "Chuyến yếu nhất")}
    </div> : <ul className="replay-airborne" aria-live="off">{view.aircraft.length ? view.aircraft.map(leg => { const load = loadFactor(leg); return <li key={leg.id}><b>{leg.plane}</b>{leg.from} → {leg.to}<span>{clock(leg.departure)} – {clock(leg.arrival)}</span>{load !== null && <span>{tx("Lấp đầy {0}%", {0: percent(load)})}</span>}</li>; }) : <li className="idle">{tx("Chưa có máy bay nào đang bay.")}</li>}</ul>}
    {view.cancelled.length > 0 && <ul className="replay-cancelled">{view.cancelled.map(c => <li key={c.id}><Prohibit size={16} aria-hidden="true"/><b>{c.plane}</b>{c.from} ↔ {c.to}<span>{tx("Hủy lúc {0}", {0: clock(c.at)})}</span><em>{tx(c.reason)}</em></li>)}</ul>}
    <div className="replay-controls">
      {finished ? <Button onClick={() => { setHour(replay.from); setPlaying(true); }}>{tx("Phát lại từ đầu")}</Button>
        : <Button icon={playing ? Pause : Play} onClick={() => setPlaying(p => !p)}>{playing ? tx("Tạm dừng") : tx("Tiếp tục")}</Button>}
      <div className="replay-speed" role="group" aria-label={tx("Tốc độ phát lại")}>{SPEEDS.map(s => <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>)}</div>
      {finished ? <Button primary data-initial onClick={onDone}>{tx("Xem báo cáo ngày")}</Button>
        : <Button icon={FastForward} onClick={() => setHour(replay.to)}>{tx("Bỏ qua đến kết quả")}</Button>}
    </div>
    <p className="replay-note">{tx("Phát lại từ kết quả đã chốt; doanh thu vé được cộng khi chặng cất cánh. Tắt phát lại trong Tùy chọn.")}</p>
  </div>;
}
