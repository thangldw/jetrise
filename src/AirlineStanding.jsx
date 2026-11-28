import React from 'react';
import {useI18n} from './i18n.jsx';
import {standing, TIERS} from './valuation.js';

export function AirlineStanding({game, types, money}) {
  const {t: tx} = useI18n();
  const s = standing(game, types);
  return <section className="workspace-panel airline-standing" aria-labelledby="airline-standing-title">
    <div className="panel-heading"><div><small>{tx("VỊ THẾ HÃNG")}</small><h2 id="airline-standing-title">{tx(s.tier.name)}</h2>
      <p>{tx("Giá trị hãng {0} = tiền mặt {1} + máy bay sở hữu {2} − nợ vay {3}", {0: money(s.value.total), 1: money(s.value.cash), 2: money(s.value.fleet), 3: money(s.value.debt)})}</p></div></div>
    <ol className="standing-ladder" aria-label={tx("Các bậc vị thế")}>{TIERS.map(t => <li key={t.id} className={t.id === s.tier.id ? 'current' : TIERS.indexOf(t) < TIERS.indexOf(s.tier) ? 'reached' : ''}>{tx(t.name)}</li>)}</ol>
    {s.next ? <div className="standing-progress"><div className="standing-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)} aria-label={tx("Tiến độ lên {0}", {0: tx(s.next.name)})}><span style={{width: (s.progress * 100).toFixed(1) + '%'}}/></div><p>{tx("Cần giá trị {0} để lên {1}", {0: money(s.target), 1: tx(s.next.name)})}</p></div>
      : <p>{tx("Đã đạt bậc cao nhất.")}</p>}
  </section>;
}
