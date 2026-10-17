import test from 'node:test';
import assert from 'node:assert/strict';
import { arDate, buildDigest, isWeeklyDay } from '../lib/digest';

const base = {
  today: new Date(2026, 9, 16), txs: [] as any[], cards: [] as any[], loans: [] as any[], recurring: [] as any[], budgets: [] as any[],
  usdRate: 1350, daysBefore: 3, weekly: false, appUrl: 'https://x.test', unsubscribeUrl: 'https://x.test/u', alertsEnabled: true, digestEnabled: true,
};

test('sin vencimientos ni presupuestos pasados: no hay correo', () => {
  assert.equal(buildDigest(base).hasContent, false);
});

test('vencimiento dentro de la ventana: avisa con importe y link de baja', () => {
  const m = buildDigest({ ...base, recurring: [{ description: 'Alquiler', amount: 300000, currency: 'ARS', type: 'expense', day_of_month: 18, active: true, profile: 'personal' }] });
  assert.ok(m.hasContent && m.kinds.alert);
  assert.match(m.html, /Alquiler/);
  assert.match(m.html, /Dejar de recibir/);
  assert.match(m.text, /https:\/\/x\.test\/u/);
});

test('vencimiento fuera de la ventana no avisa', () => {
  const m = buildDigest({ ...base, daysBefore: 1, recurring: [{ description: 'Alquiler', amount: 300000, currency: 'ARS', type: 'expense', day_of_month: 25, active: true, profile: 'personal' }] });
  assert.equal(m.hasContent, false);
});

test('resumen semanal con gastos de la semana', () => {
  const txs = [{ id: '1', date: '2026-10-14', amount: 20000, currency: 'ARS', type: 'expense', category: 'Comida', profile: 'personal', description: 'Super' }];
  const m = buildDigest({ ...base, txs, weekly: true });
  assert.ok(m.kinds.weekly);
  assert.match(m.subject, /resumen semanal/i);
});

test('alertas desactivadas: no avisa; texto con < se escapa en HTML', () => {
  const rec = [{ description: '<b>X</b>', amount: 1, currency: 'ARS', type: 'expense', day_of_month: 17, active: true, profile: 'personal' }];
  assert.equal(buildDigest({ ...base, alertsEnabled: false, recurring: rec }).hasContent, false);
  assert.ok(!buildDigest({ ...base, recurring: rec }).html.includes('<b>X</b>'));
});

test('lunes y fecha en hora argentina', () => {
  assert.ok(isWeeklyDay(new Date('2026-10-19T11:00:00Z')));
  assert.ok(!isWeeklyDay(new Date('2026-10-19T01:00:00Z'))); // todavía domingo 22h en Argentina
  assert.equal(arDate(new Date('2026-10-19T01:00:00Z')), '2026-10-18');
});
