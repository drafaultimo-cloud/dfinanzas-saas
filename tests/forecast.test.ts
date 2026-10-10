import test from 'node:test';
import assert from 'node:assert/strict';
import { cashDailySpend, expandMonthly, forecastBalance } from '../lib/forecast';
import { buildRealSeries, deflators, summarizeReal } from '../lib/realterms';

const today = new Date(2026, 9, 10); // 10/oct/2026
const ev = (kind: any, label: string, daysLeft: number, amount?: number) => ({ kind, label, date: '', daysLeft, amount });

test('gasto diario de bolsillo: ignora tarjeta, transferencias y fuera de ventana', () => {
  const txs = [
    { date: '2026-10-09', type: 'expense', operation_type: 'purchase', amount: 3000, loan_id: 'w' },
    { date: '2026-10-08', type: 'expense', operation_type: 'purchase', amount: 9999, credit_card_id: 'c' },
    { date: '2026-10-07', type: 'expense', operation_type: 'payment', amount: 5000, loan_id: 'w' },
    { date: '2026-08-01', type: 'expense', operation_type: 'purchase', amount: 7000, loan_id: 'w' },
    { date: '2026-10-05', type: 'expense', operation_type: 'purchase', amount: 600, loan_id: 'w', description: 'x' },
  ];
  assert.equal(cashDailySpend(txs, 'personal', 1000, today, 30), 120);   // (3000+600)/30
});

test('proyección: resta gasto diario y vencimientos, detecta el primer día en rojo', () => {
  const f = forecastBalance({
    start: 100000, today, horizonDays: 10, dailySpend: 1000,
    events: [ev('card_due', 'Vence Visa', 3, 60000), ev('card_close', 'Cierre', 2, 0), ev('recurring', 'Netflix', 5, undefined)],
  });
  assert.equal(f.points.length, 11);
  assert.equal(f.points[0].balance, 100000);
  assert.equal(f.points[3].balance, 100000 - 3000 - 60000);
  assert.equal(f.totalDues, 60000);
  assert.equal(f.end, 100000 - 10000 - 60000);
  assert.equal(f.firstNegative, null);
  const g = forecastBalance({ start: 50000, today, horizonDays: 5, dailySpend: 1000, events: [ev('card_due', 'Vence Visa', 2, 60000)] });
  assert.equal(g.firstNegative, '2026-10-12');
  assert.equal(g.min.balance, 50000 - 2000 - 60000 - 3000);
});

test('ingreso esperado suma el día elegido', () => {
  const f = forecastBalance({ start: 0, today, horizonDays: 10, dailySpend: 0, events: [], income: { amount: 500000, day: 15 } });
  assert.equal(f.totalIncome, 500000);
  assert.equal(f.points[5].balance, 500000);
  assert.equal(f.points[4].balance, 0);
});

test('deflactores: producto de la inflación de los meses siguientes; meses sin dato usan el último y se marcan', () => {
  const infl = [{ month: '2026-08', pct: 2 }, { month: '2026-09', pct: 3 }];
  const d = deflators(['2026-07', '2026-08', '2026-09', '2026-10'], '2026-10', infl)!;
  assert.ok(Math.abs(d['2026-07'].factor - 1.02 * 1.03 * 1.03) < 1e-9);
  assert.equal(d['2026-07'].estimated, true);       // octubre no tiene dato
  assert.equal(d['2026-10'].factor, 1);
  assert.equal(d['2026-10'].estimated, false);
  assert.equal(deflators(['2026-10'], '2026-10', []), null);
});

test('serie real: pesos, pesos constantes y dólares; los USD cargados usan la cotización del mes', () => {
  const txs = [
    { date: '2026-09-10', type: 'expense', operation_type: 'purchase', amount: 100000, currency: 'ARS', description: 'a' },
    { date: '2026-10-10', type: 'expense', operation_type: 'purchase', amount: 110000, currency: 'ARS', description: 'b' },
    { date: '2026-10-11', type: 'expense', operation_type: 'purchase', amount: 10, currency: 'USD', description: 'c' },
  ];
  const macro = { inflation: [{ month: '2026-10', pct: 10 }], dollar: { oficial: { '2026-09': 1000, '2026-10': 1100 } } };
  const rows = buildRealSeries({ txs, profile: 'personal', kind: 'expense', endMonth: '2026-10', months: 2, macro, dollar: 'oficial', fallbackRate: 1500 });
  assert.equal(rows[0].nominal, 100000);
  assert.equal(rows[0].real, 110000);                       // septiembre llevado a pesos de octubre
  assert.equal(rows[0].usd, 100);
  assert.equal(rows[1].nominal, 110000 + 10 * 1100);        // 10 USD a la cotización de octubre
  assert.equal(rows[1].usd, 110);                           // 10 + 110000/1100
  const s = summarizeReal(rows);
  assert.equal(s.nominalPct, 21);                           // 121000 vs 100000
  assert.equal(s.realPct, 10);                              // 121000 vs 110000
  assert.equal(s.usdPct, 10);
});

test('sin datos macro la serie sigue funcionando (sin real ni dólares)', () => {
  const rows = buildRealSeries({ txs: [], profile: 'personal', kind: 'expense', endMonth: '2026-10', months: 3, macro: null, dollar: 'blue', fallbackRate: 1500 });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].real, null);
  assert.equal(rows[0].usd, null);
  assert.deepEqual(summarizeReal(rows).nominalPct, null);
});

test('horizontes largos: préstamos y recurrentes se repiten cada mes, las tarjetas no', () => {
  const e = [ev('loan', 'Cuota', 5, 1000), ev('card_due', 'Visa', 6, 5000)];
  (e[0] as any).date = '2026-10-15'; (e[1] as any).date = '2026-10-16';
  const x = expandMonthly(e as any, today, 60);
  assert.deepEqual(x.filter(i => i.kind === 'loan').map(i => i.date), ['2026-10-15', '2026-11-15', '2026-12-15'].filter(d => d <= '2026-12-09'));
  assert.equal(x.filter(i => i.kind === 'card_due').length, 1);
});
