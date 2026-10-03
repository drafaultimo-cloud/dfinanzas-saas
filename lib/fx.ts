// Compra y venta de moneda extranjera: no es gasto ni ingreso, es pasar plata propia de una moneda a otra.
// Lógica pura, sin React ni Supabase.

/** Categoría con la que se guardan estos movimientos (operation_type = 'transfer'). */
export const FX_CATEGORY = 'Cambio de moneda';

const fold = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Detecta la descripción de una operación de cambio de moneda:
 *  - código bancario: "DEB.CPRA.VTA.M.E.LINK" (débito por compra de moneda extranjera), "CRE.CPRA.VTA.M.E" (venta)
 *  - texto: "Compra de dólares", "Venta de moneda extranjera", "Compra de divisas"
 */
export function isFxDescription(desc?: string | null): boolean {
  const d = fold(desc || '');
  if (!d) return false;
  if (/\bcpra\W*vta\W*m\W*e\b/.test(d)) return true;
  return /\b(compra|venta)\s+(de\s+|d[oó]lar(es)?\s+)?(moneda\s+extranjera|divisas?|dolar(es)?)\b/.test(d);
}

/** Si el código indica el sentido: DEB = pesos que salen (compra de USD); CRE/CRED = pesos que entran (venta de USD). */
export function fxDirectionFromDescription(desc?: string | null): 'out' | 'in' | null {
  const d = fold(desc || '');
  if (/\b(deb|debito)\W*cpra/.test(d) || /\bcompra\b/.test(d)) return 'out';
  if (/\b(cre|cred|credito)\W*cpra/.test(d) || /\bventa\b/.test(d)) return 'in';
  return null;
}

/** Texto para mostrar. En pesos: sale = compra de dólares, entra = venta. En dólares es al revés. */
export function fxLabel(t: { type?: string; currency?: string }): string {
  const usd = t.currency === 'USD';
  const buy = usd ? t.type === 'income' : t.type !== 'income';
  return buy ? 'Compra de dólares' : 'Venta de dólares';
}

/** Un movimiento guardado que ya es un cambio de moneda. */
export const isFxTx = (t: { category?: string; operation_type?: string; description?: string }) =>
  t.category === FX_CATEGORY || (t.operation_type === 'transfer' && isFxDescription(t.description));

/** Movimientos que parecen cambio de moneda pero quedaron guardados como gasto o ingreso. */
export const needsFxFix = (t: { operation_type?: string; description?: string; category?: string }) =>
  isFxDescription(t.description) && t.operation_type !== 'transfer' && t.operation_type !== 'payment' && t.category !== FX_CATEGORY;

/** Retiro de efectivo (cajero/ventanilla): la plata pasa de la cuenta al efectivo propio, no es un gasto. */
export function isCashWithdrawal(desc?: string | null): boolean {
  const d = fold(desc || '');
  return /\b(retiro|extraccion)\s+(de\s+)?(dinero|efectivo|fondos)\b|\bretiro\s+(en\s+)?(cajero|atm|ventanilla)\b|\bcajero\s+(automatico|atm)\b/.test(d);
}

/** Movimientos guardados como gasto que en realidad son plata propia (retiro de efectivo o rubro "Transferencia propia"). */
export const needsOwnTransferFix = (t: { operation_type?: string; description?: string; category?: string; type?: string }) =>
  t.type === 'expense' && (t.operation_type === 'purchase' || !t.operation_type) &&
  (isCashWithdrawal(t.description) || t.category === 'Transferencia propia') && !isFxDescription(t.description);
