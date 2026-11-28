import React from 'react';
import {liveryStyle} from './liveries.js';
import {silhouetteClass} from './fleet-display.js';

// Procedural side view sized by cabin: regional, narrowbody, widebody or double-deck, tinted with the aircraft's livery.
const SHAPES = {
  regional: {len: .78, h: 14, engines: 1, deck: 1},
  narrow: {len: .9, h: 16, engines: 1, deck: 1},
  wide: {len: 1, h: 21, engines: 2, deck: 1},
  super: {len: 1, h: 28, engines: 2, deck: 2},
};

export function AircraftSilhouette({type, livery = 0, brand, title}) {
  const kind = silhouetteClass(type.seats), s = SHAPES[kind], color = liveryStyle(livery, brand).color;
  const L = 112 * s.len, x0 = (120 - L) / 2, cy = 30, top = cy - s.h / 2, bottom = cy + s.h / 2, nose = x0 + L;
  const body = `M${x0 + 8} ${top + 2} L${nose - 12} ${top} Q${nose} ${top + 1} ${nose} ${cy + 2} Q${nose - 2} ${bottom} ${nose - 14} ${bottom} L${x0 + 10} ${bottom - 2} Q${x0} ${bottom - 4} ${x0} ${cy} Z`;
  const tail = `M${x0 + 2} ${top + 3} L${x0 + 6} ${top - s.h * .9} L${x0 + 15} ${top - s.h * .9} L${x0 + 24} ${top + 1} Z`;
  const wing = `M${x0 + L * .42} ${cy + 2} L${x0 + L * .3} ${bottom + 9} L${x0 + L * .38} ${bottom + 9} L${x0 + L * .58} ${cy + 2} Z`;
  const windows = Array.from({length: Math.floor(L / 6)}, (_, i) => x0 + 20 + i * 5.2).filter(x => x < nose - 16);
  return <svg className={'aircraft-silhouette sil-' + kind} viewBox="0 0 120 60" role="img" aria-label={title}>
    <path d={tail} fill={color}/>
    <path d={body} fill="#f7f9fc" stroke="#c9d3e2" strokeWidth=".6"/>
    <path d={`M${x0 + 4} ${bottom - 4} L${nose - 10} ${bottom - 2}`} stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <path d={wing} fill="#b8c4d6"/>
    {Array.from({length: s.engines}, (_, i) => <rect key={i} x={x0 + L * (.4 + i * .14)} y={bottom + 2} width={L * .11} height={s.h * .32} rx="2.5" fill="#8392aa"/>)}
    {Array.from({length: s.deck}, (_, d) => windows.map(x => <rect key={d + '-' + x} x={x} y={top + 3 + d * (s.h / 2 - 1)} width="2.2" height="2" rx=".6" fill="#3d5a80"/>))}
    <path d={`M${nose - 9} ${top + 3} Q${nose - 3} ${top + 4} ${nose - 2} ${top + 7} L${nose - 9} ${top + 7} Z`} fill="#3d5a80"/>
  </svg>;
}
