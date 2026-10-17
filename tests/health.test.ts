import test from 'node:test';
import assert from 'node:assert/strict';
import { dayStreaks, financialHealth } from '../lib/health';
import { safeToSpend, spentTodayCash } from '../lib/safespend';
import { detectSubscriptions } from '../lib/planning';

const today = new Date(2026, 9, 16); // 16/oct/2026
const ev = (kind: any, label: string, daysLeft: number, amount?: number) => ({ kind, label, date: '', daysLeft, amount });

test('cuánto puedo gastar hoy: sin ingreso se estira hasta fin de mes', () => {
  const s = safeToSpend({ available: 300000, today, events: [ev('card_due', 'Vence Visa', 5, 100000), ev('card_close', 'Cierre', 2, 0), ev('loan', 'Cuota', 20, 50000)], spentToday: 4000 });
  assert.equal(s.horizonKind, 'month');
  assert.equal(s.horizonDays, 16);                 // del 16/10 al 31/10 inclusive
  assert.equal(s.duesTotal, 100000);               // la cuota de 20 días cae después del fin de mes
  assert.equal(s.perDay, Math.floor(200000 / 16));
  assert.equal(s.leftToday, 12500 - 4000);
});

test('cuánto puedo gastar hoy: con ingreso el período termina el día de cobro y avisa si no alcanza', () => {
  const s = safeToSpend({ available: 50000, today, income: { amount: 900000, day: 20 }, events: [ev('card_due', 'Vence Naranja', 2, 80000), ev('recurring', 'Alquiler', 4, 20000)] });
  assert.equal(s.horizonKind, 'income');
  assert.equal(s.horizonDays, 4);
  assert.equal(s.duesTotal, 80000);                // el alquiler del día 20 ya cuenta con el sueldo
  assert.equal(s.perDay, 0);
  assert.equal(s.shortfall, 30000);
  const c = safeToSpend({ available: 10000, today: new Date(2026, 9, 20), income: { amount: 1, day: 20 }, events: [] });
  assert.equal(c.horizonEnd, '2026-11-20');        // si cobrás hoy, el período es hasta el próximo cobro
});

test('gasto de hoy: solo billeteras o efectivo, sin transferencias', () => {
  const txs = [
    { date: '2026-10-16', type: 'expense', operation_type: 'purchase', amount: 1500, loan_id: 'w' },
    { date: '2026-10-16', type: 'expense', operation_type: 'purchase', amount: 9000, credit_card_id: 'c' },
    { date: '2026-10-16', type: 'expense', operation_type: 'payment', amount: 7000, loan_id: 'w' },
  ];
  assert.equal(spentTodayCash(txs, 'personal', 1000, today), 1500);
});

test('rachas: no se corta hasta que pasa un día entero sin cargar', () => {
  const d = (s: string) => ({ date: s });
  assert.deepEqual(dayStreaks([d('2026-10-16'), d('2026-10-15'), d('2026-10-14'), d('2026-10-10')], today), { current: 3, best: 3 });
  assert.equal(dayStreaks([d('2026-10-15'), d('2026-10-14')], today).current, 2);          // hoy todavía no cargó
  assert.equal(dayStreaks([d('2026-10-13')], today).current, 0);                           // se cortó
  assert.equal(dayStreaks([d('2026-10-01'), d('2026-10-02'), d('2026-10-03'), d('2026-10-13')], today).best, 3);
});

test('salud financiera: puntaje con datos y sin datos', () => {
  assert.equal(financialHealth({ txs: [], profile: 'personal', usdRate: 1000, today, liquid: 0, cardsDebt: 0, loanMonthly: 0 }).score, null);
  const txs = [
    { date: '2026-10-01', type: 'income', operation_type: 'income', amount: 1000000, loan_id: 'w' },
    { date: '2026-10-05', type: 'expense', operation_type: 'purchase', amount: 600000, loan_id: 'w' },
    { date: '2026-09-01', type: 'income', operation_type: 'income', amount: 1000000, loan_id: 'w' },
    { date: '2026-09-05', type: 'expense', operation_type: 'purchase', amount: 600000, loan_id: 'w' },
  ];
  const h = financialHealth({ txs, profile: 'personal', usdRate: 1000, today, liquid: 900000, cardsDebt: 100000, loanMonthly: 0 });
  assert.ok(h.score !== null && h.score > 40 && h.score <= 100);
  assert.equal(h.parts.find(p => p.key === 'ahorro')!.score, 100);   // ahorra 40% (> 20%)
  assert.equal(h.parts.find(p => p.key === 'deuda')!.score, 100);    // 10% de un mes de ingresos
  assert.equal(h.positiveMonths, 1);                                  // septiembre cerró en positivo
});

test('suscripciones: avisa cuánto subió el importe', () => {
  const mk = (m: string, a: number) => ({ date: `2026-${m}-10`, type: 'expense', operation_type: 'purchase', amount: a, currency: 'ARS', description: 'Netflix', category: 'Entretenimiento' });
  const s = detectSubscriptions([mk('07', 10000), mk('08', 10000), mk('09', 11000), mk('10', 11500)], [], '2026-10');
  assert.equal(s.length, 1);
  assert.equal(s[0].firstAmount, 10000);
  assert.equal(s[0].lastAmount, 11500);
  assert.equal(s[0].increasePct, 15);
});
