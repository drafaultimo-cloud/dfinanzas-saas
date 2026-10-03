import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_FILTER, filterHistory, isFilterActive, toCsv } from '../lib/history';

const txs = [
  { id: 1, date: '2026-10-01', description: 'Supermercado Día', category: 'Alimentos', type: 'expense', amount: 5000, credit_card_id: 'c1' },
  { id: 2, date: '2026-10-02', description: 'Sueldo', category: 'Ingresos', type: 'income', amount: 900000, loan_id: 'w1' },
  { id: 3, date: '2026-10-03', description: 'Pago tarjeta', category: 'Pagos', type: 'expense', operation_type: 'payment', amount: 20000, loan_id: 'w1' },
  { id: 4, date: '2026-10-04', description: 'Reintegro TDF', category: 'Gastos por TDF', type: 'income', operation_type: 'refund', amount: 1000 },
];

test('búsqueda ignora tildes y mayúsculas, y exige todas las palabras', () => {
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, query: 'DIA super' }).map(t => t.id), [1]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, query: 'xyz' }), []);
});

test('tipo: gastos excluye pagos y reintegros; transferencias incluye pagos', () => {
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, kind: 'expense' }).map(t => t.id), [1]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, kind: 'income' }).map(t => t.id), [2]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, kind: 'transfer' }).map(t => t.id), [3]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, kind: 'refund' }).map(t => t.id), [4]);
});

test('filtro por cuenta y rubro', () => {
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, account: 'loan:w1' }).map(t => t.id), [2, 3]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, account: 'none' }).map(t => t.id), [4]);
  assert.deepEqual(filterHistory(txs, { ...EMPTY_FILTER, category: 'Alimentos' }).map(t => t.id), [1]);
  assert.equal(isFilterActive(EMPTY_FILTER), false);
});

test('CSV: BOM, separador ;, signo, escape de comillas y fórmulas', () => {
  const csv = toCsv([{ date: '2026-10-01', description: '=SUMA(1;2) "x"', type: 'expense', amount: 10.5, category: 'Otros' }], () => 'Efectivo');
  assert.ok(csv.startsWith('﻿Fecha;'));
  assert.ok(csv.includes(`"'=SUMA(1;2) ""x"""`));
  assert.ok(csv.includes(';-10,5'));
});
