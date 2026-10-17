import test from 'node:test';
import assert from 'node:assert/strict';
import { canBeReferred, generateCode, isValidCode, normalizeCode, referralLink, whatsappShareUrl } from '../lib/referral';

test('código: largo correcto, sin caracteres confusos y distinto cada vez', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const c = generateCode();
    assert.equal(c.length, 7);
    assert.match(c, /^[A-HJ-NP-Z2-9]+$/);
    seen.add(c);
  }
  assert.ok(seen.size > 190);
});

test('normalizar código: mayúsculas, sin espacios ni símbolos', () => {
  assert.equal(normalizeCode(' ab-c d2e3f4 '), 'ABCD2E3F4');
  assert.equal(normalizeCode(undefined), '');
  assert.ok(isValidCode('ABCD234'));
  assert.ok(!isValidCode('ABC'));
});

test('solo cuentas nuevas pueden ser invitadas', () => {
  const now = new Date('2026-10-16T12:00:00Z');
  assert.ok(canBeReferred('2026-10-15T12:00:00Z', now));
  assert.ok(!canBeReferred('2026-08-01T00:00:00Z', now));
  assert.ok(!canBeReferred(undefined, now));
});

test('link y mensaje de WhatsApp', () => {
  assert.equal(referralLink('https://finanzas.drm-ia.com/', 'ABC1234'), 'https://finanzas.drm-ia.com/?ref=ABC1234');
  assert.ok(whatsappShareUrl('https://x/?ref=A').startsWith('https://wa.me/?text='));
});
