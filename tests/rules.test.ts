import test from 'node:test';
import assert from 'node:assert/strict';
import { ruleCovers, suggestRuleKeyword } from '../lib/rules';

test('transferencias a personas: usa el nombre', () => {
  assert.equal(suggestRuleKeyword('Transferencia enviada Pablo Cesar Mansilla'), 'pablo cesar mansilla');
  assert.equal(suggestRuleKeyword('Transferencia enviada PEREYRA, MARIO ADOLFO'), 'pereyra, mario adolfo');
});

test('si hay CUIT/CUIL usa el número', () => {
  assert.equal(suggestRuleKeyword('DB TRANSFERENCIA ENVIADA - CUIT/CUIL: 27321424231'), '27321424231');
});

test('Mercado Pago: usa el código del comercio', () => {
  assert.equal(suggestRuleKeyword('MERPAGO*OMARPEREDA'), 'merpago*omarpereda');
});

test('quita el número de sucursal y los prefijos genéricos', () => {
  assert.equal(suggestRuleKeyword('SUPERM LA ANONIMA 124'), 'superm la anonima');
  assert.equal(suggestRuleKeyword('[USD] GOOGLE YOUTUBE'), 'google youtube');
});

test('devuelve vacío si no hay nada útil', () => {
  assert.equal(suggestRuleKeyword(''), '');
  assert.equal(suggestRuleKeyword('Pago con QR'), '');
  assert.equal(suggestRuleKeyword(null), '');
});

test('detecta si una regla ya cubre la palabra', () => {
  assert.equal(ruleCovers([{ keyword: 'pereyra' }], 'pereyra, mario adolfo'), true);
  assert.equal(ruleCovers([{ keyword: 'anonima' }], 'merpago*zamudio'), false);
  assert.equal(ruleCovers([], 'x'), false);
});
