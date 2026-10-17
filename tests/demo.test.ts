import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoData, createDemoClient, DEMO_MESSAGE, isDemoActive, startDemo, stopDemo, withDemo } from '../lib/demo';
import { financialHealth } from '../lib/health';
import { detectSubscriptions, computeNetWorth, monthlyComparison } from '../lib/planning';

const today = new Date(2026, 9, 16);

test('datos demo: sin fechas futuras, ids únicos y números razonables', () => {
  const d = buildDemoData(today);
  const ids = new Set(d.transactions.map(t => t.id));
  assert.equal(ids.size, d.transactions.length);
  assert.ok(d.transactions.every(t => t.date <= '2026-10-16'));
  assert.ok(d.transactions.length > 150);
  const m = monthlyComparison(d.transactions, 'personal', 1350, '2026-10', 6);
  assert.ok(m.every(x => x.income > 0 && x.expense > 0));
  const nw = computeNetWorth(d.credit_cards, d.loans, 1350);
  assert.ok(nw.digital > 0);
});

test('datos demo: muestran suscripciones, puntaje y racha', () => {
  const d = buildDemoData(today);
  const subs = detectSubscriptions(d.transactions, d.recurring_items, '2026-10');
  assert.ok(subs.some(s => s.description === 'Netflix' && s.increasePct > 0));
  assert.ok(subs.some(s => s.description === 'Spotify'));
  const nw = computeNetWorth(d.credit_cards, d.loans, 1350);
  const h = financialHealth({ txs: d.transactions, profile: 'personal', usdRate: 1350, today, liquid: nw.digital + nw.cash, cardsDebt: nw.cardsDebt, loanMonthly: 65000 });
  assert.ok(h.score !== null && h.score > 20);
  assert.ok(h.dayStreak >= 10);
});

test('cliente demo: lee con filtros y orden, y rechaza escrituras', async () => {
  const d = buildDemoData(today);
  const db = createDemoClient(d, () => {});
  const r = await db.from('transactions').select('*').eq('user_id', 'demo-user').order('date', { ascending: false });
  assert.equal(r.error, null);
  assert.ok(r.data[0].date >= r.data[r.data.length - 1].date);
  const cards = await db.from('credit_cards').select('*').eq('user_id', 'demo-user');
  assert.equal(cards.data.length, 2);
  const w = await db.from('transactions').insert([{ amount: 1 }]);
  assert.equal(w.error.message, DEMO_MESSAGE);
  const u = await db.from('loans').update({ balance_ars: 1 }).eq('id', 'x').select('id');
  assert.equal(u.error.code, 'DEMO');
  const missing = await db.from('card_plans').select('*').eq('user_id', 'demo-user');
  assert.deepEqual(missing.data, []);
});

test('interruptor: el cliente real se usa salvo en modo demo', async () => {
  const real: any = { from: () => 'real-from', auth: { x: 1 }, other() { return this === real; } };
  const wrapped = withDemo(real);
  assert.equal(wrapped.from('t'), 'real-from');
  assert.equal(wrapped.other(), true);
  startDemo(createDemoClient(buildDemoData(today), () => {}));
  assert.ok(isDemoActive());
  const r = await (wrapped as any).from('credit_cards').select('*').eq('user_id', 'demo-user');
  assert.equal(r.data.length, 2);
  stopDemo();
  assert.equal(wrapped.from('t'), 'real-from');
});
