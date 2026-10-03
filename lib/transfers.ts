// Emparejado de transferencias propias: la misma plata que sale de una cuenta y entra en otra.
// Lógica pura, sin React ni Supabase.

export type TransferTx = {
  id: string;
  date?: string;
  amount?: number | string;
  currency?: string | null;
  type?: string;
  operation_type?: string;
  category?: string | null;
  description?: string | null;
  credit_card_id?: string | null;
  loan_id?: string | null;
  transfer_account?: string | null;
};

export interface TransferPair { out: TransferTx; in: TransferTx; days: number; }

/** Cuenta a la que pertenece el movimiento: 'card:<id>' | 'loan:<id>' | ''. */
export const accountKey = (t: TransferTx): string =>
  t.credit_card_id ? `card:${t.credit_card_id}` : t.loan_id ? `loan:${t.loan_id}` : '';

const dayMs = (d: string) => new Date(`${d}T00:00:00`).getTime();
const gap = (a: string, b: string) => Math.abs(Math.round((dayMs(a) - dayMs(b)) / 86400000));

const isPairable = (t: TransferTx) =>
  (t.operation_type === 'transfer' || t.operation_type === 'payment') &&
  t.category !== 'Cambio de moneda' &&          // la compra de dólares tiene su propio tratamiento
  !t.transfer_account &&                          // ya asignada: no se toca
  !!t.date && Number(t.amount) > 0 && !!accountKey(t);

/**
 * Busca pares: una salida y una entrada con el mismo importe y moneda, en cuentas DISTINTAS,
 * con hasta `maxDays` días de diferencia. Solo propone cuando el emparejado es inequívoco
 * (si hay dos candidatos igual de buenos, no adivina).
 */
export function suggestTransferPairs(txs: TransferTx[], maxDays = 3): TransferPair[] {
  const cands = txs.filter(isPairable);
  const outs = cands.filter(t => t.type === 'expense');
  const ins = cands.filter(t => t.type === 'income');
  const matches = (o: TransferTx, i: TransferTx) =>
    (o.currency || 'ARS') === (i.currency || 'ARS') &&
    Math.abs(Number(o.amount) - Number(i.amount)) < 0.01 &&
    accountKey(o) !== accountKey(i) &&
    gap(o.date!, i.date!) <= maxDays;

  // Candidatos por cada lado
  const forOut = new Map<string, TransferTx[]>();
  const forIn = new Map<string, TransferTx[]>();
  for (const o of outs) for (const i of ins) {
    if (!matches(o, i)) continue;
    forOut.set(o.id, [...(forOut.get(o.id) || []), i]);
    forIn.set(i.id, [...(forIn.get(i.id) || []), o]);
  }

  const best = (base: TransferTx, list: TransferTx[]) => {
    const sorted = [...list].sort((a, b) => gap(base.date!, a.date!) - gap(base.date!, b.date!));
    if (sorted.length > 1 && gap(base.date!, sorted[0].date!) === gap(base.date!, sorted[1].date!)) return null; // empate: ambiguo
    return sorted[0];
  };

  const pairs: TransferPair[] = [];
  const used = new Set<string>();
  for (const o of outs) {
    const list = forOut.get(o.id);
    if (!list || used.has(o.id)) continue;
    const i = best(o, list);
    if (!i || used.has(i.id)) continue;
    // Confirmación cruzada: la entrada también tiene que elegir a esta salida
    const back = best(i, forIn.get(i.id) || []);
    if (!back || back.id !== o.id) continue;
    used.add(o.id); used.add(i.id);
    pairs.push({ out: o, in: i, days: gap(o.date!, i.date!) });
  }
  return pairs;
}
