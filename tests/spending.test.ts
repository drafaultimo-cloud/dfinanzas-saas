import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPaymentsByMonth, topPayees, weekdayProfile } from '../lib/spending';

const ex = (date: string, amount: number, over: any = {}) => ({ date, amount, type: 'expense', operation_type: 'purchase', category: 'Otros', currency: 'ARS', description: 'Compra', ...over });

test('día de la semana: promedio por ocurrencia del día, sin transferencias', () => {
  // 2026-10-03 y 2026-10-10 son sábados; 2026-10-05 es lunes
  const txs = [ex('2026-10-03', 1000), ex('2026-10-10', 3000), ex('2026-10-05', 500), ex('2026-10-10', 9999, { operation_type: 'payment' })];
  const w = weekdayProfile(txs, 'personal', 1000, '2026-10', 1, new Date(2026, 9, 11));
  const sat = w.find(d => d.day === 'Sábado')!;
  assert.equal(sat.total, 4000);
  assert.equal(sat.count, 2);
  assert.equal(sat.perDay, 2000);                // dos sábados hasta el 11/10
  assert.equal(w.find(d => d.day === 'Lunes')!.perDay, 500); // un solo lunes (5/10) hasta el 11/10
  assert.equal(Math.round(w.reduce((a, d) => a + d.share, 0)), 100);
});

test('comercios: agrupa variantes del mismo nombre y ordena por monto', () => {
  const txs = [
    ex('2026-10-01', 1000, { description: 'Supermercado Dia 123' }),
    ex('2026-10-02', 2000, { description: 'SUPERMERCADO DIA 456' }),
    ex('2026-10-03', 500, { description: 'Farmacia Central' }),
    ex('2026-10-04', 700, { description: 'Farmacia Central', operation_type: 'refund', type: 'income' }),
  ];
  const t = topPayees(txs, 'personal', 1000, '2026-10', 1);
  assert.equal(t[0].total, 3000);
  assert.equal(t[0].count, 2);
  assert.equal(t[1].name, 'Farmacia Central');
  assert.equal(t[1].total, 500);                 // el reintegro no suma como gasto
});

test('pagos a tarjetas: cada pago cuenta una sola vez', () => {
  const txs = [
    { date: '2026-10-05', type: 'expense', operation_type: 'payment', amount: 100000, loan_id: 'w', transfer_account: 'card:c1' },      // billetera → tarjeta
    { date: '2026-10-05', type: 'income', operation_type: 'payment', amount: 100000, credit_card_id: 'c1', transfer_account: 'loan:w' },  // lado tarjeta, emparejado: no se suma
    { date: '2026-10-07', type: 'income', operation_type: 'payment', amount: 50000, credit_card_id: 'c2' },                              // lado tarjeta sin emparejar: se suma
    { date: '2026-09-07', type: 'expense', operation_type: 'transfer', amount: 20000, loan_id: 'w', transfer_account: 'loan:x' },       // transferencia a otra billetera: no
  ];
  const r = cardPaymentsByMonth(txs, '2026-10', 2);
  assert.deepEqual(r, [{ month: '2026-09', paid: 0 }, { month: '2026-10', paid: 150000 }]);
});
