import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, restoreGame, transition, forecast, dayCashRequired} from '../src/game.js';
import {LOAN_TERMS, createLoan, loanPayment, loanSchedule} from '../src/loans.js';

const act = (s, action) => { const r = transition(s, action); assert(!r.error, r.error); return r.game; };
const idle = () => { const s = createGame(); s.cash = 20000000; s.tycoon.schedules = []; return s; };
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test('each quoted term settles its exact principal and interest once, through the existing day close', () => {
  const comparisons = [];
  for (const {days, dailyRateBps} of LOAN_TERMS) {
    let s = act(idle(), {type: 'loan', amount: 1000000, termDays: days, dailyRateBps: 0});
    assert.equal(s.cash, 21000000); assert.equal(s.hq.loan.dailyRateBps, dailyRateBps);
    const quote = loanSchedule(s.hq.loan, s.day); assert.equal(quote.rows.length, days);
    assert.equal(quote.totalPrincipal, 1000000); assert.equal(quote.rows.at(-1).balance, 0);
    let interest = 0, principal = 0;
    for (const expected of quote.rows) {
      s = restoreGame(JSON.stringify(s));
      const f = forecast(s), before = s.cash;
      assert.equal(f.interest, expected.interest); assert.equal(f.principal, expected.principal);
      const debtFree = structuredClone(s); debtFree.hq.loan = null; const free = forecast(debtFree);
      close(f.profit, free.profit - f.interest);
      close(f.cashDelta, free.cashDelta - f.interest - f.principal);
      close(dayCashRequired(f), dayCashRequired(free) + f.interest + f.principal);
      interest += f.interest; principal += f.principal; s = act(s, {type: 'advance'});
      close(s.cash, before + f.cashDelta); assert.equal(s.hq.loan?.balance ?? 0, expected.balance);
    }
    assert.equal(s.hq.loan, null); assert.equal(principal, 1000000); assert.equal(interest, quote.totalInterest);
    assert.equal(forecast(s).interest, 0); assert.equal(forecast(s).principal, 0);
    comparisons.push({interest, principal: quote.rows[0].principal});
  }
  assert(comparisons[0].interest < comparisons[1].interest && comparisons[1].interest < comparisons[2].interest);
  assert(comparisons[0].principal > comparisons[1].principal && comparisons[1].principal > comparisons[2].principal);
});

test('partial prepayment reduces future interest and duration without recharging principal at day close', () => {
  let s = act(idle(), {type: 'loan', amount: 1000000, termDays: 56});
  const before = structuredClone(s), original = loanSchedule(s.hq.loan), oldForecast = forecast(s);
  s = act(s, {type: 'repay', amount: 250000});
  assert.equal(s.cash, before.cash - 250000); assert.equal(s.hq.loan.balance, 750000);
  assert.equal(s.hq.loan.installment, before.hq.loan.installment);
  const next = loanSchedule(s.hq.loan), f = forecast(s);
  assert(next.remainingDays < original.remainingDays); assert(next.totalInterest < original.totalInterest);
  assert.equal(f.interest, 525); assert.equal(f.principal, before.hq.loan.installment);
  close(f.profit, oldForecast.profit + 175); close(f.cashDelta, oldForecast.cashDelta + 175);
  assert.deepEqual(restoreGame(JSON.stringify(s)), s);
  const cash = s.cash; s = act(s, {type: 'advance'}); close(s.cash, cash + f.cashDelta);
  assert.equal(s.hq.loan.balance, 750000 - f.principal);
  const left = s.hq.loan.balance, wallet = s.cash; s = act(s, {type: 'repay'});
  assert.equal(s.cash, wallet - left); assert.equal(s.hq.loan, null);
  assert.equal(forecast(s).interest, 0);
});

test('legacy loans and old action payloads keep their 28-day, 5-bps behavior without migration', () => {
  const legacy = idle(); legacy.hq.loan = {balance: 678570, installment: 35715};
  const s = restoreGame(JSON.stringify(legacy)); assert.deepEqual(s.hq.loan, legacy.hq.loan);
  assert.equal(forecast(s).interest, Math.round(678570 * .0005));
  const prepaid = act(s, {type: 'repay', amount: 100000});
  assert.deepEqual(prepaid.hq.loan, {balance: 578570, installment: 35715});
  assert.deepEqual(restoreGame(JSON.stringify(prepaid)).hq.loan, prepaid.hq.loan);
  const fresh = act(idle(), {type: 'loan', amount: 1000000});
  assert.equal(fresh.hq.loan.termDays, 28); assert.equal(fresh.hq.loan.installment, 35715);
  assert.equal(forecast(fresh).interest, 500);
});

test('invalid terms, duplicate loans and invalid or unaffordable repayments fail atomically', () => {
  const initial = idle();
  for (const action of [{type: 'loan', amount: 0}, {type: 'loan', amount: 5500000}, {type: 'loan', amount: 1000000, termDays: 0}, {type: 'loan', amount: 1000000, termDays: null}, {type: 'loan', amount: 1000000, termDays: '14'}, {type: 'repay', amount: 1}]) {
    const before = structuredClone(initial), result = transition(initial, action);
    assert(result.error); assert.strictEqual(result.game, initial); assert.deepEqual(initial, before);
  }
  let s = act(initial, {type: 'loan', amount: 5000000, termDays: 14});
  assert.deepEqual(restoreGame(JSON.stringify(s)), s);
  const before = structuredClone(s);
  for (const action of [{type: 'loan', amount: 1000000}, ...[0, -1, .5, NaN, Infinity, '100', 5000001].map(amount => ({type: 'repay', amount}))]) {
    const result = transition(s, action); assert(result.error); assert.strictEqual(result.game, s); assert.deepEqual(s, before);
  }
  s.cash = 1; const failed = transition(s, {type: 'repay', amount: 100});
  assert(failed.error); assert.strictEqual(failed.game, s); assert.equal(s.hq.loan.balance, 5000000);
});

test('restore rejects damaged financing metadata and preserves the legacy validation bound', () => {
  const valid = act(idle(), {type: 'loan', amount: 5000000, termDays: 14});
  for (const edit of [l => l.dailyRateBps = 0, l => l.termDays = 7, l => l.originalAmount = 6000000, l => l.installment--, l => delete l.termDays, l => delete l.dailyRateBps, l => delete l.originalAmount, l => l.balance = 5000001]) {
    const s = structuredClone(valid); edit(s.hq.loan); assert.throws(() => restoreGame(JSON.stringify(s)));
  }
  const legacy = idle(); legacy.hq.loan = {balance: 5000000, installment: 178573};
  assert.throws(() => restoreGame(JSON.stringify(legacy)));
  legacy.hq.loan.installment = 1;
  const restored = restoreGame(JSON.stringify(legacy)), bounded = loanSchedule(restored.hq.loan);
  assert.equal(bounded.rows.length, 56); assert.equal(bounded.remainingDays, 5000000); assert.equal(bounded.complete, false);
});

test('a one-dollar residual closes exactly and read-only quotes never mutate a loan', () => {
  let s = act(idle(), {type: 'loan', amount: 500000, termDays: 14});
  s = act(s, {type: 'repay', amount: 499999});
  const before = structuredClone(s.hq.loan), projection = loanSchedule(s.hq.loan, s.day);
  assert.deepEqual(s.hq.loan, before); assert.equal(projection.rows.length, 1);
  assert.deepEqual(loanPayment(s.hq.loan), {principal: 1, interest: 0});
  s = act(s, {type: 'advance'}); assert.equal(s.hq.loan, null);
  assert.deepEqual(loanSchedule(null).rows, []);
  assert.equal(createLoan(500000, 28).dailyRateBps, 5);
});
