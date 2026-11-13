import {useI18n,LocalizedText} from './i18n.jsx';
import React, {useState} from 'react';
import {LOAN_TERMS, createLoan, loanPayment, loanSchedule, repayLoan} from './loans.js';

export function LoanOffice({game, forecast, reserve, act, Button, RangeControl, money}) {
 const {t:tx,locale}=useI18n();
  const [amount, setAmount] = useState(1000000), [termDays, setTermDays] = useState(28);
  const [repayPercent, setRepayPercent] = useState(0), [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const current = game.hq.loan, repayment = current ? Math.floor(current.balance * repayPercent / 100) : 0;
  const draft = current ? (repayment ? repayLoan(current, repayment) : current) : createLoan(amount, termDays);
  const schedule = loanSchedule(draft, game.day), currentSchedule = loanSchedule(current, game.day);
  const payment = loanPayment(draft), existing = loanPayment(current);
  const cashAfterSigning = game.cash + (current ? -repayment : amount);
  const debtChange = payment.principal + payment.interest - existing.principal - existing.interest;
  const cashAfterDay = cashAfterSigning + forecast.cashDelta - debtChange, reserveAfter = reserve + debtChange;
  const submit = async action => {
    setPending(true); setMessage('');
    try { const result = await act(action); if (!result?.error) { setMessage(result.message); setRepayPercent(0); } }
    finally { setPending(false); }
  };
  const rate = bps => (bps / 100).toLocaleString(locale, {maximumFractionDigits: 2}) + '%';
  return <article className="management-card loan-office" aria-busy={pending}>
    <small>{tx("NGÂN HÀNG · TIỀN TRONG GAME")}</small><h3>{tx("Tài trợ khai thác")}</h3>
    <p>{tx("Một khoản vay, tối đa $5 triệu. Lãi cố định trên dư nợ đầu mỗi ngày khai thác; gốc trả đều, kỳ cuối trả phần còn lại. Không có phí vay hoặc trả trước.")}</p>
    {current ? <>
      <p><LocalizedText source={"{0} dư nợ {1} · lãi {2}/ngày · còn {3} ngày nếu trả theo lịch."} values={{0:<b>{tx("Đang áp dụng:")}</b>,1:tx(money(current.balance)),2:tx(rate(current.dailyRateBps ?? 5)),3:tx(currentSchedule.remainingDays)}}/></p>
      <p>{tx("Hôm nay: gốc {0} + lãi {1}. {2}",{0:tx(money(existing.principal)),1:tx(money(existing.interest)),2:current.termDays?tx("Kỳ hạn ban đầu {0} ngày.",{0:current.termDays}):tx("Khoản vay cũ giữ nguyên điều khoản.")})}</p>
      <RangeControl id="loan-repayment" label="Tỷ lệ dư nợ trả trước" value={repayPercent} min={0} max={100} step={5} unit="%" onChange={setRepayPercent}/>
      <p>{tx("Bản nháp: trả {0}, còn {1}. Trả một phần giữ gốc mỗi ngày {2} và rút ngắn thời gian; lãi tính trên dư nợ đã giảm ngay trong ngày.",{0:tx(money(repayment)),1:tx(money(draft?.balance || 0)),2:tx(money(current.installment))})}</p>
    </> : <>
      <RangeControl id="loan-amount" label="Khoản vay" value={amount} min={500000} max={5000000} step={500000} unit="USD" onChange={setAmount}/>
      <label className="field" htmlFor="loan-term"><span>{tx("Kỳ hạn vay")}</span><select id="loan-term" value={termDays} onChange={e => setTermDays(Number(e.target.value))}>{LOAN_TERMS.map(t => <option key={t.days} value={t.days}>{tx("{0} ngày · {1} dư nợ/ngày",{0:tx(t.days),1:tx(rate(t.dailyRateBps))})}</option>)}</select></label>
      <p>{tx("Kỳ hạn ngắn giảm tổng lãi nhưng cần trả nhiều gốc mỗi ngày. Kỳ hạn dài giữ thêm tiền cho khai thác, đổi lại tổng lãi cao hơn.")}</p>
      <div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("So sánh kỳ hạn vay")}>
        <table className="schedule-table"><thead><tr><th>{tx("Kỳ hạn")}</th><th>{tx("Lãi / ngày")}</th><th>{tx("Gốc kỳ đầu")}</th><th>{tx("Tổng lãi")}</th></tr></thead><tbody>{LOAN_TERMS.map(t => {
          const quote = createLoan(amount, t.days), comparison = loanSchedule(quote);
          return <tr key={t.days}><th scope="row">{tx("{0} ngày{1}",{0:tx(t.days),1:termDays === t.days?tx(" · đang xem"):''})}</th><td>{tx(rate(t.dailyRateBps))}</td><td>{tx(money(quote.installment))}</td><td>{tx(money(comparison.totalInterest))}</td></tr>;
        })}</tbody></table>
      </div>
    </>}
    <section className="decision-preview" aria-label={tx("Bản nháp khoản vay")}>
      <small>{current?repayment?tx("SAU KHI TRẢ TRƯỚC · CHƯA LƯU"):tx("LỊCH HIỆN TẠI · CHƯA CÓ TRẢ TRƯỚC"):tx("BÁO GIÁ · CHƯA GIẢI NGÂN")}</small>
      <div className="operation-metrics"><div><small>{tx("Tiền ngay sau giao dịch")}</small><strong>{tx(money(cashAfterSigning))}</strong></div><div><small>{tx("Tiền sau khi chạy ngày {0}",{0:tx(game.day)})}</small><strong>{tx(money(cashAfterDay))}</strong></div></div>
      <p>{tx("Nợ trả khi chốt hôm nay: {0} gốc + {1} lãi. Cần sẵn {2} trước khi chạy lịch hôm nay.",{0:tx(money(payment.principal)),1:tx(money(payment.interest)),2:tx(money(reserveAfter))})}</p>
      <p><LocalizedText source={"{0}: {1}, gồm {2} lãi. Còn {3} ngày khai thác."} values={{0:schedule.complete?tx("Tổng còn trả theo lịch"):tx("Tổng trả trong 56 ngày đầu"),1:<b>{tx(money(schedule.totalPayment))}</b>,2:tx(money(schedule.totalInterest)),3:tx(schedule.remainingDays)}}/></p>
      {cashAfterSigning < reserveAfter && <p className="inline-warning">{tx("Sau giao dịch, tiền chưa đủ chạy lịch hôm nay. Cân nhắc giảm số tiền trả trước hoặc điều chỉnh kế hoạch khai thác.")}</p>}
      <p className="micro">{tx("Dự báo hôm nay giữ nguyên kế hoạch hiện tại. Bảng nợ giả định trả đều và không trả thêm trước hạn. Vay và trả gốc chỉ đổi tiền mặt; lãi nằm trong chi phí quản trị. Đây là thông số cân bằng game, không phải lãi suất thị trường.")}</p>
      <Button primary disabled={pending || (current && (!repayment || repayment > game.cash))} onClick={() => submit(current ? {type: 'repay', amount: repayment} : {type: 'loan', amount, termDays})}>
        {pending?tx("Đang lưu…"):current?tx("{0} · {1}",{0:repayment === current.balance ? tx('Tất toán') : tx('Trả trước'),1:money(repayment)}):tx("Vay {0} · {1} ngày",{0:money(amount),1:termDays})}
      </Button>
    </section>
    <p role="status">{tx(message)}</p>
    {schedule.rows.length > 0 && <details><summary>{tx("Xem lịch trả nợ dự kiến")}{current && repayment?tx(" sau trả trước"):''}</summary>
      <div className="schedule-table-wrap" tabIndex={0} role="region" aria-label={tx("Lịch trả nợ dự kiến")}><table className="schedule-table"><thead><tr><th>{tx("Ngày game")}</th><th>{tx("Gốc")}</th><th>{tx("Lãi")}</th><th>{tx("Tổng trả")}</th><th>{tx("Dư nợ cuối ngày")}</th></tr></thead><tbody>{schedule.rows.map(row => <tr key={row.day}><th scope="row">{tx(row.day)}</th><td>{tx(money(row.principal))}</td><td>{tx(money(row.interest))}</td><td>{tx(money(row.payment))}</td><td>{tx(money(row.balance))}</td></tr>)}</tbody></table></div>
      {!schedule.complete && <p>{tx("Chỉ hiển thị 56 ngày đầu của khoản vay cũ; dư nợ sau đó {0}.",{0:tx(money(schedule.balance))})}</p>}
    </details>}
  </article>;
}
