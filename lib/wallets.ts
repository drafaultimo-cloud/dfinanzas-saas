// Saldo de billeteras y efectivo: saldo cargado (de un extracto o a mano) más los movimientos posteriores. Lógica pura.

export type WalletLike = {
  id: string;
  balance_ars?: number | string | null;
  balance_usd?: number | string | null;
  balance_date?: string | null;
  last_statement_close?: string | null;
};
export type WalletTx = {
  type?: string;
  currency?: string | null;
  amount?: number | string;
  date?: string | null;
  loan_id?: string | null;
  credit_card_id?: string | null;
};

/** Desde cuándo valen los movimientos: la fecha del saldo o el cierre del último extracto. Vacío = no se ajusta. */
export const walletBase = (w: WalletLike): string => w.balance_date || w.last_statement_close || '';

/** Movimientos de esta billetera posteriores a la fecha base, en la moneda indicada. */
export function walletMovementsSince(w: WalletLike, txs: WalletTx[], currency: 'ARS' | 'USD'): WalletTx[] {
  const base = walletBase(w);
  if (!base) return [];
  return txs.filter(t =>
    t.loan_id === w.id && !t.credit_card_id &&
    (t.currency || 'ARS') === currency &&
    (t.type === 'income' || t.type === 'expense') &&
    !!t.date && t.date > base
  );
}

export const walletDelta = (w: WalletLike, txs: WalletTx[], currency: 'ARS' | 'USD'): number =>
  Math.round(walletMovementsSince(w, txs, currency).reduce((a, t) => a + (t.type === 'income' ? 1 : -1) * Number(t.amount || 0), 0) * 100) / 100;

export const walletBalance = (w: WalletLike, txs: WalletTx[], currency: 'ARS' | 'USD'): number =>
  Math.round((Number(currency === 'ARS' ? w.balance_ars : w.balance_usd) || 0) * 100 + walletDelta(w, txs, currency) * 100) / 100;
