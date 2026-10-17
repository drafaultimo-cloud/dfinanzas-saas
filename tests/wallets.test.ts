import test from 'node:test';
import assert from 'node:assert/strict';
import { walletBalance, walletDelta } from '../lib/wallets';

const w = { id: 'w1', balance_ars: 527000, balance_usd: 10, last_statement_close: '2026-10-05' };
const tx = (date: string, type: string, amount: number, over: any = {}) => ({ loan_id: 'w1', date, type, amount, currency: 'ARS', ...over });

test('billetera: saldo cargado más movimientos posteriores', () => {
  const txs = [tx('2026-10-10', 'expense', 262846.71), tx('2026-10-11', 'income', 144.74), tx('2026-10-05', 'expense', 999), tx('2026-10-12', 'expense', 5, { loan_id: 'otra' })];
  assert.equal(walletBalance(w, txs, 'ARS'), 264298.03);
  assert.equal(walletDelta(w, txs, 'ARS'), -262701.97);
});
test('billetera: dólares aparte, tarjeta no cuenta y sin fecha base no se ajusta', () => {
  assert.equal(walletBalance(w, [tx('2026-10-10', 'expense', 3, { currency: 'USD' })], 'USD'), 7);
  assert.equal(walletBalance(w, [tx('2026-10-10', 'expense', 100, { credit_card_id: 'c' })], 'ARS'), 527000);
  assert.equal(walletBalance({ id: 'w1', balance_ars: 100 }, [tx('2026-10-10', 'expense', 50)], 'ARS'), 100);
});
