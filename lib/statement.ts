// Controles sobre los totales de un resumen importado (lógica pura).

export interface StmtItem { amount: number | string; currency?: string; operation_type?: string; date?: string }

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Suma en pesos de lo que debería explicar el total de un resumen de TARJETA: compras, cuotas, intereses e impuestos,
 * menos reintegros. Los pagos no cuentan. Si el total leído por la IA se aparta mucho de esa suma, casi seguro
 * tomó otro importe del PDF (por ejemplo el del resumen anterior).
 */
export function reconcileTotal(totalArs: number | null | undefined, items: StmtItem[]) {
  let sum = 0;
  for (const i of items) {
    if ((i.currency || 'ARS') === 'USD') continue;
    const a = Math.abs(Number(i.amount) || 0);
    if (i.operation_type === 'purchase') sum += a;
    else if (i.operation_type === 'refund') sum -= a;
  }
  sum = round2(sum);
  if (totalArs === null || totalArs === undefined || !(sum > 0)) return { sum, diff: 0, mismatch: false };
  const diff = round2(Math.abs(Number(totalArs) - sum));
  const base = Math.max(Math.abs(Number(totalArs)), sum);
  return { sum, diff, mismatch: diff > Math.max(2000, base * 0.05) };
}

/** Fecha de cierre a guardar: la que informa el resumen, o la fecha del último movimiento como respaldo. */
export function statementCloseDate(declared: string | null | undefined, items: StmtItem[]): string | null {
  if (declared && /^\d{4}-\d{2}-\d{2}$/.test(declared)) return declared;
  const dates = items.map(i => i.date || '').filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/** true si el resumen que se importa es anterior al último que ya se cargó (no debe pisar el saldo). */
export const isOlderStatement = (incoming: string | null, stored: string | null | undefined) =>
  !!incoming && !!stored && incoming < stored;
