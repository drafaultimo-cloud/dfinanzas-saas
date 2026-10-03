/** Filtros, búsqueda y exportación del Historial (puro, sin React). */

export type HistoryKind = 'all' | 'expense' | 'income' | 'transfer' | 'refund';

export interface HistoryFilter {
  query: string;
  kind: HistoryKind;
  category: string; // '' = todos
  account: string;  // '' = todas · 'none' = sin cuenta · 'card:<id>' / 'loan:<id>'
}

export const EMPTY_FILTER: HistoryFilter = { query: '', kind: 'all', category: '', account: '' };

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const isTransferTx = (t: any) => t.operation_type === 'transfer' || t.operation_type === 'payment';
const isRefundTx = (t: any) => t.operation_type === 'refund';

export function accountKey(t: any): string {
  return t.credit_card_id ? `card:${t.credit_card_id}` : t.loan_id ? `loan:${t.loan_id}` : '';
}

export function isFilterActive(f: HistoryFilter): boolean {
  return !!(f.query.trim() || f.kind !== 'all' || f.category || f.account);
}

export function filterHistory(list: any[], f: HistoryFilter, describe: (t: any) => string = t => t.description): any[] {
  const words = norm(f.query).split(/\s+/).filter(Boolean);
  return list.filter(t => {
    if (f.kind === 'transfer' && !isTransferTx(t)) return false;
    if (f.kind === 'refund' && !isRefundTx(t)) return false;
    if (f.kind === 'expense' && !(t.type === 'expense' && !isTransferTx(t) && !isRefundTx(t))) return false;
    if (f.kind === 'income' && !(t.type === 'income' && !isTransferTx(t) && !isRefundTx(t))) return false;
    if (f.category && (t.category || 'Otros') !== f.category) return false;
    if (f.account) {
      const k = accountKey(t);
      if (f.account === 'none' ? k !== '' : k !== f.account) return false;
    }
    if (words.length) {
      const hay = norm(`${describe(t)} ${t.category || ''} ${t.date || ''} ${t.amount}`);
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  // Evita que Excel interprete el texto como fórmula.
  if (/^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

/** CSV con ';' y BOM (abre bien en Excel en español). */
export function toCsv(list: any[], accountName: (t: any) => string, describe: (t: any) => string = t => t.description): string {
  const head = ['Fecha', 'Descripción', 'Tipo', 'Rubro', 'Cuenta', 'Moneda', 'Monto'];
  const rows = list.map(t => {
    const kind = isRefundTx(t) ? 'Reintegro' : t.operation_type === 'payment' ? 'Pago de tarjeta'
      : t.operation_type === 'transfer' ? 'Transferencia' : t.type === 'income' ? 'Ingreso' : 'Gasto';
    const amt = (t.type === 'income' ? 1 : -1) * Number(t.amount || 0);
    return [t.date, describe(t), kind, t.category || '', accountName(t), t.currency === 'USD' ? 'USD' : 'ARS', String(amt).replace('.', ',')];
  });
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
}
