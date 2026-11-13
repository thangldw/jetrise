// Synthetic game financing. Rates are fixed at signing; legacy loans keep 5 bps/day.
export const LOAN_TERMS = Object.freeze([
  Object.freeze({days: 14, dailyRateBps: 4}),
  Object.freeze({days: 28, dailyRateBps: 5}),
  Object.freeze({days: 56, dailyRateBps: 7}),
]);

export function createLoan(amount, termDays = 28) {
  const terms = LOAN_TERMS.find(t => t.days === termDays);
  if (!Number.isInteger(amount) || amount < 500000 || amount > 5000000 || amount % 500000)
    throw Error('Khoản vay từ $500.000 đến $5.000.000, bước $500.000.');
  if (!terms) throw Error('Chọn kỳ hạn 14, 28 hoặc 56 ngày khai thác.');
  return {balance: amount, installment: Math.ceil(amount / termDays), originalAmount: amount, termDays, dailyRateBps: terms.dailyRateBps};
}

export function validateLoan(loan) {
  if (loan === null) return;
  const int = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  if (!loan || !int(loan.balance, 1, 5000000)) throw Error('Invalid loan');
  const hasTerms = ['originalAmount', 'termDays', 'dailyRateBps'].some(key => Object.hasOwn(loan, key));
  if (!hasTerms) {
    if (!int(loan.installment, 1, 178572)) throw Error('Invalid legacy loan');
    return;
  }
  const quote = createLoan(loan.originalAmount, loan.termDays);
  if (loan.termDays !== quote.termDays || loan.dailyRateBps !== quote.dailyRateBps || loan.installment !== quote.installment || loan.balance > loan.originalAmount)
    throw Error('Invalid loan terms');
}

export function loanPayment(loan) {
  return {principal: loan ? Math.min(loan.balance, loan.installment) : 0, interest: loan ? Math.round(loan.balance * ((loan.dailyRateBps ?? 5) / 10000)) : 0};
}

export function repayLoan(loan, amount) {
  if (!loan) throw Error('Không có khoản vay.');
  if (!Number.isInteger(amount) || amount < 1 || amount > loan.balance) throw Error('Số trả trước phải từ $1 đến dư nợ hiện tại.');
  return amount === loan.balance ? null : {...loan, balance: loan.balance - amount};
}

export function loanSchedule(loan, day = 1) {
  const remainingDays = loan ? Math.ceil(loan.balance / loan.installment) : 0;
  let balance = loan?.balance ?? 0, totalInterest = 0, totalPrincipal = 0;
  const rows = [];
  // Old schema accepted very small installments. Never allocate an unbounded table.
  for (let i = 0; i < Math.min(remainingDays, 56); i++) {
    const {principal, interest} = loanPayment({...loan, balance});
    balance -= principal; totalInterest += interest; totalPrincipal += principal;
    rows.push({day: day + i, principal, interest, payment: principal + interest, balance});
  }
  return {rows, remainingDays, totalInterest, totalPrincipal, totalPayment: totalInterest + totalPrincipal, balance, complete: balance === 0};
}
