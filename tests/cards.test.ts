import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPlansPending, nextInstallment, outstandingArs, paidSinceBase, planSchedule } from '../lib/cards';

const card = { id: 'c1', balance_ars: 262846.71, last_statement_close: '2026-09-25' };
const pay = (over: any = {}) => ({ type: 'expense', operation_type: 'payment', currency: 'ARS', amount: 100000, date: '2026-10-10', loan_id: 'w1', transfer_account: 'card:c1', ...over });

test('el pago desde una billetera baja el saldo de la tarjeta', () => {
  assert.equal(outstandingArs(card, [pay({ amount: 262846.71 })]), 0);
  assert.equal(outstandingArs(card, [pay()]), 162846.71);
});

test('pagos anteriores al cierre, en dólares, a otra tarjeta o del lado de la tarjeta no cuentan', () => {
  assert.equal(paidSinceBase(card, [pay({ date: '2026-09-20' })]), 0);
  assert.equal(paidSinceBase(card, [pay({ date: '2026-09-25' })]), 0);
  assert.equal(paidSinceBase(card, [pay({ currency: 'USD' })]), 0);
  assert.equal(paidSinceBase(card, [pay({ transfer_account: 'card:otra' })]), 0);
  assert.equal(paidSinceBase(card, [pay({ credit_card_id: 'c1', loan_id: null, type: 'income' })]), 0);
});

test('sin fecha base no se descuenta nada; balance_date manda sobre el cierre', () => {
  assert.equal(outstandingArs({ id: 'c1', balance_ars: 500 }, [pay()]), 500);
  assert.equal(outstandingArs({ ...card, balance_date: '2026-10-12' }, [pay()]), 262846.71);
});

test('pago de más deja saldo a favor (negativo)', () => {
  assert.equal(outstandingArs({ ...card, balance_ars: 1000 }, [pay({ amount: 1500 })]), -500);
});

test('Plan Z: reparte en 1, 2 o 3 pagos y la última absorbe los centavos', () => {
  const plan = { id: 'p', credit_card_id: 'c1', total_amount: 100, payments: 3, first_due: '2026-11-10' };
  const s = planSchedule(plan, '2026-10-10');
  assert.deepEqual(s.map(i => i.amount), [33.33, 33.33, 33.34]);
  assert.deepEqual(s.map(i => i.due), ['2026-11-10', '2026-12-10', '2027-01-10']);
  assert.equal(planSchedule({ ...plan, payments: 1 }, '2026-10-10').length, 1);
});

test('Plan Z: lo vencido deja de estar pendiente y el día 31 no se desborda', () => {
  const plan = { id: 'p', credit_card_id: 'c1', total_amount: 90, payments: 3, first_due: '2026-01-31' };
  assert.deepEqual(planSchedule(plan, '2026-01-01').map(i => i.due), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.equal(cardPlansPending('c1', [plan], '2026-02-15'), 60);
  assert.equal(nextInstallment(plan, '2026-02-15')?.n, 2);
  assert.equal(nextInstallment(plan, '2026-04-01'), null);
});

import { ignoredPayments } from '../lib/cards';
test('pagos ignorados: anteriores al resumen o sin fecha base', () => {
  const pay = (date: string) => ({ type: 'expense', operation_type: 'payment', amount: 100, date, transfer_account: 'card:c1', loan_id: 'w' });
  const r = ignoredPayments({ id: 'c1', balance_date: '2026-10-08' }, [pay('2026-10-05'), pay('2026-10-13')]);
  assert.equal(r.payments.length, 1);
  assert.equal(r.total, 100);
  assert.equal(ignoredPayments({ id: 'c1' }, [pay('2026-10-13')]).payments.length, 1);
});
