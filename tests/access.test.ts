import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAccess, isReceiptValid } from '../lib/access';

const now = new Date('2026-10-10T12:00:00Z');
const base = { email: 'cliente@x.com', createdAt: '2026-01-01T00:00:00Z', now };

test('comprobante aprobado por IA habilita provisoriamente', () => {
  const r = [{ created_at: '2026-10-09T00:00:00Z', ai_status: 'approved_by_ai', admin_status: 'pending', plan: 'pro' }];
  assert.equal(computeAccess({ ...base, receipts: r }).status, 'paid');
});

test('revisión manual pendiente NO habilita hasta que el admin autorice', () => {
  const pend = { created_at: '2026-10-09T00:00:00Z', ai_status: 'pending_manual', admin_status: 'pending', plan: 'pro' };
  assert.equal(isReceiptValid(pend), false);
  assert.equal(computeAccess({ ...base, receipts: [pend] }).status, 'expired');
  assert.equal(computeAccess({ ...base, receipts: [{ ...pend, admin_status: 'verified' }] }).status, 'paid');
});

test('el rechazo del admin gana sobre la IA (cancelación)', () => {
  const r = [{ created_at: '2026-10-09T00:00:00Z', ai_status: 'approved_by_ai', admin_status: 'rejected', plan: 'pro' }];
  assert.equal(computeAccess({ ...base, receipts: r }).status, 'expired');
});

test('acceso gratuito (cortesía): Pro sin vencimiento; si se borra la fila vuelve a lo normal', () => {
  const g = { created_at: '2026-01-02T00:00:00Z', ai_status: 'free_grant', admin_status: 'verified', plan: 'pro' };
  const a = computeAccess({ ...base, receipts: [g] });
  assert.equal(a.status, 'paid');
  assert.equal(a.free, true);
  assert.equal(a.plan, 'pro');
  assert.equal(computeAccess({ ...base, receipts: [] }).status, 'expired');
});
