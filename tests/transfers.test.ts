import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestTransferPairs, TransferTx } from '../lib/transfers';

const tx = (o: Partial<TransferTx> & { id: string }): TransferTx => ({
  date: '2026-09-10', amount: 1000, currency: 'ARS', type: 'expense', operation_type: 'transfer', transfer_account: null, ...o,
});

test('empareja una salida de la billetera con la entrada de la tarjeta (pago de resumen)', () => {
  const pairs = suggestTransferPairs([
    tx({ id: 'out', amount: 141742.51, operation_type: 'payment', loan_id: 'w1' }),
    tx({ id: 'in', amount: 141742.51, operation_type: 'payment', type: 'income', credit_card_id: 'c1' }),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].out.id, 'out');
  assert.equal(pairs[0].in.id, 'in');
});

test('empareja en dólares y con un día de diferencia', () => {
  const pairs = suggestTransferPairs([
    tx({ id: 'o', amount: 45.66, currency: 'USD', loan_id: 'w1', date: '2026-09-23' }),
    tx({ id: 'i', amount: 45.66, currency: 'USD', type: 'income', credit_card_id: 'c1', date: '2026-09-24' }),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].days, 1);
});

test('no empareja monedas distintas ni importes distintos', () => {
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', amount: 100, currency: 'USD', loan_id: 'w1' }),
    tx({ id: 'i', amount: 100, currency: 'ARS', type: 'income', loan_id: 'w2' }),
  ]).length, 0);
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', amount: 100, loan_id: 'w1' }),
    tx({ id: 'i', amount: 100.5, type: 'income', loan_id: 'w2' }),
  ]).length, 0);
});

test('no empareja dentro de la misma cuenta ni más allá de 3 días', () => {
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1' }),
    tx({ id: 'i', type: 'income', loan_id: 'w1' }),
  ]).length, 0);
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1', date: '2026-09-01' }),
    tx({ id: 'i', type: 'income', loan_id: 'w2', date: '2026-09-09' }),
  ]).length, 0);
});

test('no toca las ya asignadas ni las de cambio de moneda ni las que no tienen cuenta', () => {
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1', transfer_account: 'loan:w2' }),
    tx({ id: 'i', type: 'income', loan_id: 'w2' }),
  ]).length, 0);
  assert.equal(suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1', category: 'Cambio de moneda' }),
    tx({ id: 'i', type: 'income', loan_id: 'w2', category: 'Cambio de moneda' }),
  ]).length, 0);
  assert.equal(suggestTransferPairs([
    tx({ id: 'o' }),
    tx({ id: 'i', type: 'income', loan_id: 'w2' }),
  ]).length, 0);
});

test('si hay dos candidatos igual de buenos no adivina', () => {
  const pairs = suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1' }),
    tx({ id: 'i1', type: 'income', loan_id: 'w2' }),
    tx({ id: 'i2', type: 'income', credit_card_id: 'c1' }),
  ]);
  assert.equal(pairs.length, 0);
});

test('elige el candidato más cercano en fecha', () => {
  const pairs = suggestTransferPairs([
    tx({ id: 'o', loan_id: 'w1', date: '2026-09-10' }),
    tx({ id: 'far', type: 'income', loan_id: 'w2', date: '2026-09-13' }),
    tx({ id: 'near', type: 'income', credit_card_id: 'c1', date: '2026-09-10' }),
  ]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].in.id, 'near');
});
