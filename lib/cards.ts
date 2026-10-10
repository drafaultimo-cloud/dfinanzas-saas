// Saldo de tarjeta de crédito y planes de cuotas sin interés (Plan Z). Lógica pura.

export type CardLike = {
  id: string;
  balance_ars?: number | string | null;
  credit_limit?: number | string | null;
  balance_date?: string | null;
  last_statement_close?: string | null;
};
export type PayTx = {
  type?: string;
  operation_type?: string;
  currency?: string | null;
  amount?: number | string;
  date?: string | null;
  credit_card_id?: string | null;
  transfer_account?: string | null;
  loan_id?: string | null;
};
export type CardPlan = {
  id: string;
  credit_card_id: string;
  label?: string | null;
  total_amount: number | string;
  payments: number | string;
  first_due: string; // YYYY-MM-DD
};

/** Saldo cargado (el del último resumen o el que escribiste a mano). */
export const statedBalanceArs = (c: CardLike): number => Number(c.balance_ars ?? c.credit_limit ?? 0);

/** Desde cuándo valen los pagos: la fecha del saldo, o el cierre del último resumen. Vacío = no se descuenta. */
export const baseDate = (c: CardLike): string => c.balance_date || c.last_statement_close || '';

/**
 * Pagos hechos DESDE OTRA cuenta (billetera, caja de ahorro…) hacia esta tarjeta, posteriores a la fecha base.
 * Solo cuenta el lado de la cuenta que paga: el movimiento "espejo" dentro de la tarjeta no se suma dos veces.
 */
export function paymentsToCard(card: CardLike, txs: PayTx[]): PayTx[] {
  const base = baseDate(card);
  if (!base) return [];
  const key = `card:${card.id}`;
  return txs.filter(t =>
    t.transfer_account === key &&
    !t.credit_card_id &&                       // salió de una cuenta que no es esta tarjeta
    t.type === 'expense' &&
    (t.operation_type === 'payment' || t.operation_type === 'transfer') &&
    (t.currency || 'ARS') === 'ARS' &&
    !!t.date && t.date > base
  );
}

export const paidSinceBase = (card: CardLike, txs: PayTx[]): number =>
  Math.round(paymentsToCard(card, txs).reduce((a, t) => a + Number(t.amount || 0), 0) * 100) / 100;

/** Lo que queda por pagar: saldo cargado menos los pagos posteriores. Negativo = saldo a favor. */
export const outstandingArs = (card: CardLike, txs: PayTx[]): number =>
  Math.round((statedBalanceArs(card) - paidSinceBase(card, txs)) * 100) / 100;

// ---- Plan Z ----

export const addMonths = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const total = (m - 1) + n;
  const yy = y + Math.floor(total / 12);
  const mm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
  return `${yy}-${String(mm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

export interface PlanInstallment { n: number; due: string; amount: number; pending: boolean; }

/** Cuotas del plan con su vencimiento; la última absorbe los centavos del redondeo. */
export function planSchedule(plan: CardPlan, today: string): PlanInstallment[] {
  const n = Math.max(1, Math.round(Number(plan.payments) || 1));
  const total = Number(plan.total_amount) || 0;
  const each = Math.floor((total / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    n: i + 1,
    due: addMonths(plan.first_due, i),
    amount: i === n - 1 ? Math.round((total - each * (n - 1)) * 100) / 100 : each,
    pending: addMonths(plan.first_due, i) >= today,
  }));
}

export const planPendingArs = (plan: CardPlan, today: string): number =>
  Math.round(planSchedule(plan, today).filter(i => i.pending).reduce((a, i) => a + i.amount, 0) * 100) / 100;

export const nextInstallment = (plan: CardPlan, today: string): PlanInstallment | null =>
  planSchedule(plan, today).find(i => i.pending) || null;

export const cardPlansPending = (cardId: string, plans: CardPlan[], today: string): number =>
  Math.round(plans.filter(p => p.credit_card_id === cardId).reduce((a, p) => a + planPendingArs(p, today), 0) * 100) / 100;
