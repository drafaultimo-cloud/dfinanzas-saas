import test from 'node:test';
import assert from 'node:assert/strict';
import { trimLeadingEmpty, averageRate, categoryTrend, paceByDay, savingsSeries } from '../lib/evolution';

const tx = (date: string, amount: number, over: any = {}) => ({ date, amount, type: 'expense', operation_type: 'purchase', category: 'Alimentos', description: 'x', currency: 'ARS', ...over });
const txs = [
  tx('2026-09-02', 1000), tx('2026-09-10', 3000, { category: 'Salud' }), tx('2026-09-20', 6000),
  tx('2026-10-01', 2000), tx('2026-10-05', 500, { category: 'Salud' }),
  tx('2026-10-03', 10000, { type: 'income', operation_type: 'income', category: 'Ingresos' }),
  tx('2026-10-04', 99999, { operation_type: 'payment' }),            // pago de tarjeta: no cuenta
  tx('2026-10-06', 300, { operation_type: 'refund', type: 'income' }), // reintegro: resta del gasto
];

test('tasa de ahorro: resultado sobre ingresos; sin ingresos no hay tasa', () => {
  const s = savingsSeries(txs, 'personal', 1000, '2026-10', 2);
  assert.equal(s[0].rate, null);                 // septiembre sin ingresos
  assert.equal(s[1].income, 10000);
  assert.equal(s[1].expense, 2200);              // 2000 + 500 − 300
  assert.equal(s[1].rate, 78);
  assert.equal(averageRate(s), 78);
});

test('ritmo del mes: acumulado, comparación a la misma altura y proyección', () => {
  const p = paceByDay(txs, 'personal', 1000, '2026-10', new Date(2026, 9, 6));
  assert.equal(p.isCurrentMonth, true);
  assert.equal(p.currentToDate, 2200);
  assert.equal(p.previousSameDay, 1000);         // septiembre hasta el día 6
  assert.equal(p.previousTotal, 10000);
  assert.equal(p.deltaPct, 120);
  assert.equal(p.projected, Math.round((2200 / 6) * 31));
  assert.equal(p.points[5].current, 2200);
  assert.equal(p.points[6].current, null);       // el futuro no se dibuja
  assert.equal(p.points[29].previous, 10000);
});

test('ritmo de un mes cerrado: sin proyección y curva completa', () => {
  const p = paceByDay(txs, 'personal', 1000, '2026-09', new Date(2026, 9, 6));
  assert.equal(p.isCurrentMonth, false);
  assert.equal(p.projected, null);
  assert.equal(p.currentToDate, 10000);
  assert.equal(p.points[29].current, 10000);
});

test('rubros: top N + Otros y variación contra el promedio previo', () => {
  const t = categoryTrend(txs, 'personal', 1000, '2026-10', 2, 1);
  assert.deepEqual(t.categories, ['Alimentos', 'Otros rubros']);
  assert.equal(t.rows[0].Alimentos, 7000);
  assert.equal(t.rows[1].Alimentos, 1700);       // 2000 − reintegro de 300 (el reintegro baja su propio rubro)
  assert.equal(t.rows[1]['Otros rubros'], 500);            // Salud queda fuera del top 1 y se agrupa
});

test('se recortan los meses vacíos del principio pero no los del medio', () => {
  const r = trimLeadingEmpty([{ income: 0, expense: 0 }, { income: 5, expense: 0 }, { income: 0, expense: 0 }]);
  assert.equal(r.length, 2);
});
