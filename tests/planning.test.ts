import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus, computeNetWorth, dailyDigest, findDuplicateGroups, upcomingEvents } from '../lib/planning';

const e = (o: any) => ({ id: 'x', date: '2026-09-27', amount: 100, currency: 'ARS', type: 'expense', operation_type: 'purchase', description: 'x', ...o });

test('duplicados: la misma línea del resumen con texto agregado se marca', () => {
  const g = findDuplicateGroups([
    e({ id: '1', amount: 2360.4, description: 'IVA Operaciones Identificadas con *' }),
    e({ id: '2', amount: 2360.4, description: 'IVA Operaciones Identificadas con * (Base Imponible $11.240,00)' }),
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].items.map((i: any) => i.id).sort(), ['1', '2']);
});

test('duplicados: dos compras idénticas de monto bajo no se marcan', () => {
  const g = findDuplicateGroups([
    e({ id: '1', date: '2026-09-19', amount: 7800, description: 'Pago con QR' }),
    e({ id: '2', date: '2026-09-19', amount: 7800, description: 'Pago con QR' }),
  ]);
  assert.equal(g.length, 0);
});

test('vencimiento de tarjeta: el saldo en dólares a favor no baja lo que hay que pagar', () => {
  const ev = upcomingEvents([{ name: 'Naranja', closing_day: 27, due_day: 10, balance_ars: 427471.89, balance_usd: -39.31 }], [], [], new Date('2026-10-03T12:00:00'), 30, 1350);
  const due = ev.find(x => x.kind === 'card_due');
  assert.equal(due?.amount, 427471.89);
});

test('vencimiento de tarjeta: la deuda en dólares sí se suma', () => {
  const ev = upcomingEvents([{ name: 'Visa', closing_day: 27, due_day: 10, balance_ars: 100000, balance_usd: 10 }], [], [], new Date('2026-10-03T12:00:00'), 30, 1000);
  assert.equal(ev.find(x => x.kind === 'card_due')?.amount, 110000);
});

test('presupuesto: avisa al llegar al porcentaje de alerta y al pasarse', () => {
  const txs = [e({ category: 'Supermercado', amount: 85000 })];
  const [row] = budgetStatus([{ id: 'b', category: 'Supermercado', monthly_limit: 100000, alert_pct: 80 }], txs, '2026-09', 'personal', 1350);
  assert.equal(row.status, 'warn');
  const [over] = budgetStatus([{ id: 'b', category: 'Supermercado', monthly_limit: 80000, alert_pct: 80 }], txs, '2026-09', 'personal', 1350);
  assert.equal(over.status, 'over');
});

test('patrimonio: el valor de la casa suma como bien y la hipoteca como deuda', () => {
  const nw = computeNetWorth([], [
    { kind: 'wallet', balance_ars: 100000, balance_usd: 0 },
    { kind: 'loan', total_amount: 5000000, asset_value: 10000, asset_currency: 'USD' },
  ], 1000);
  assert.equal(nw.property, 10000000);
  assert.equal(nw.loansDebt, 5000000);
  assert.equal(nw.net, 100000 + 10000000 - 5000000);
});

test('resumen diario: las transferencias de cambio de moneda no cuentan como "sin asignar"', () => {
  const d = dailyDigest([
    e({ id: 'a', operation_type: 'transfer', category: 'Transferencia propia' }),
    e({ id: 'b', operation_type: 'transfer', category: 'Cambio de moneda' }),
    e({ id: 'c', operation_type: 'transfer', category: 'Transferencia propia', transfer_account: 'loan:1' }),
  ], 'personal', 1350, new Date('2026-09-28T12:00:00'));
  assert.equal(d.unassignedTransfers, 1);
});
