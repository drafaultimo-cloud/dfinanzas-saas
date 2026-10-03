import test from 'node:test';
import assert from 'node:assert/strict';
import { isOlderStatement, reconcileTotal, statementCloseDate } from '../lib/statement';

const items = [
  { amount: 300000, operation_type: 'purchase', currency: 'ARS' },
  { amount: 100000, operation_type: 'purchase', currency: 'ARS' },
  { amount: 10000, operation_type: 'refund', currency: 'ARS' },
  { amount: 50000, operation_type: 'payment', currency: 'ARS' },
  { amount: 20, operation_type: 'purchase', currency: 'USD' },
];

test('el total coincide con compras menos reintegros (los pagos y los USD no cuentan)', () => {
  const r = reconcileTotal(390000, items);
  assert.equal(r.sum, 390000);
  assert.equal(r.mismatch, false);
});

test('avisa si el total leído es el del resumen anterior', () => {
  const r = reconcileTotal(194535.86, [{ amount: 427471.89, operation_type: 'purchase' }]);
  assert.equal(r.mismatch, true);
});

test('tolera diferencias chicas y no avisa sin datos', () => {
  assert.equal(reconcileTotal(391500, items).mismatch, false);
  assert.equal(reconcileTotal(null, items).mismatch, false);
  assert.equal(reconcileTotal(1000, []).mismatch, false);
});

test('fecha de cierre: la declarada, o la del último movimiento', () => {
  assert.equal(statementCloseDate('2026-09-27', []), '2026-09-27');
  assert.equal(statementCloseDate(null, [{ amount: 1, date: '2026-09-02' }, { amount: 1, date: '2026-09-20' }]), '2026-09-20');
  assert.equal(statementCloseDate('basura', []), null);
});

test('un resumen viejo no pisa uno más nuevo', () => {
  assert.equal(isOlderStatement('2026-08-27', '2026-09-27'), true);
  assert.equal(isOlderStatement('2026-09-27', '2026-09-27'), false);
  assert.equal(isOlderStatement('2026-09-27', null), false);
});
