// Lógica pura de planificación financiera (sin React ni Supabase): se usa en el cliente y en el servidor.
// Todos los importes se devuelven en pesos (ARS); los dólares se convierten con la cotización recibida.

export type Tx = any;
export type Profile = 'personal' | 'business';

export const BUSINESS_TAG = '[NEGOCIO]';
export const isBizDesc = (d?: string | null) => (d || '').startsWith(BUSINESS_TAG);
export const isTransferTx = (t: Tx) => t.operation_type === 'payment' || t.operation_type === 'transfer';
export const isRefundTx = (t: Tx) => t.operation_type === 'refund';
export const cleanDesc = (d?: string | null) => (d || '').replace(/^(\[(USD|NEGOCIO)\]\s*)+/i, '').trim();
export const txProfile = (t: Tx): Profile => (isBizDesc(t.description) ? 'business' : 'personal');
export const cardDebtArs = (c: Tx) => Number(c.balance_ars ?? c.credit_limit ?? 0);

export const toArs = (amount: number, cur: string | undefined, usdRate: number) =>
  (cur === 'USD' ? amount * usdRate : amount);

// ---------- Fechas ----------
export const monthOf = (date: string) => (date || '').slice(0, 7);
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate(); // m1: 1..12
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const currentMonthOf = (d: Date) => ymd(d).slice(0, 7);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);

/** Próxima fecha (hoy o después) cuyo día del mes es `day` (ajustado al largo del mes). */
export function nextOccurrence(day: number, today: Date): Date {
  const clamp = (y: number, m0: number) => Math.min(day, daysInMonth(y, m0 + 1));
  let y = today.getFullYear();
  let m0 = today.getMonth();
  let d = new Date(y, m0, clamp(y, m0));
  if (diffDays(d, today) < 0) {
    m0 += 1;
    if (m0 > 11) { m0 = 0; y += 1; }
    d = new Date(y, m0, clamp(y, m0));
  }
  return d;
}

// ---------- 1) Presupuestos ----------
/** Gasto neto por categoría de un mes y perfil (compras − reintegros), en ARS. Excluye pagos y transferencias. */
export function spendByCategory(txs: Tx[], month: string, profile: Profile, usdRate: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (!t.date || monthOf(t.date) !== month) continue;
    if (txProfile(t) !== profile || isTransferTx(t)) continue;
    const cat = t.category || 'Otros';
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (t.type === 'expense') out[cat] = (out[cat] || 0) + amt;
    else if (isRefundTx(t)) out[cat] = (out[cat] || 0) - amt;
  }
  for (const k of Object.keys(out)) out[k] = Math.max(0, out[k]);
  return out;
}

export interface BudgetRow {
  id?: string;
  category: string;
  limit: number;
  spent: number;
  pct: number;
  alertPct: number;
  status: 'ok' | 'warn' | 'over';
}
export function budgetStatus(budgets: any[], txs: Tx[], month: string, profile: Profile, usdRate: number): BudgetRow[] {
  const spent = spendByCategory(txs, month, profile, usdRate);
  return budgets
    .filter(b => (b.profile || 'personal') === profile)
    .map(b => {
      const limit = Number(b.monthly_limit || 0);
      const s = spent[b.category] || 0;
      const pct = limit > 0 ? (s / limit) * 100 : 0;
      const alertPct = Number(b.alert_pct || 80);
      return { id: b.id, category: b.category, limit, spent: s, pct, alertPct, status: pct >= 100 ? 'over' : pct >= alertPct ? 'warn' : 'ok' } as BudgetRow;
    })
    .sort((a, b) => b.pct - a.pct);
}

// ---------- 2) Vencimientos ----------
export interface DueEvent {
  kind: 'card_due' | 'card_close' | 'loan' | 'recurring';
  label: string;
  date: string;      // YYYY-MM-DD
  daysLeft: number;
  amount?: number;   // ARS, si se conoce
}
const loanRemaining = (l: Tx) => {
  const total = Number(l.total_installments || 0);
  const paid = Number(l.paid_installments || 0);
  return total > 1 ? Math.max(0, total - paid) : 12;
};
export function upcomingEvents(cards: Tx[], loans: Tx[], recurring: Tx[], today: Date, horizonDays = 30, usdRate = 1): DueEvent[] {
  const ev: DueEvent[] = [];
  const push = (kind: DueEvent['kind'], label: string, day: number, amount?: number) => {
    if (!day) return;
    const d = nextOccurrence(day, today);
    const daysLeft = diffDays(d, today);
    if (daysLeft <= horizonDays) ev.push({ kind, label, date: ymd(d), daysLeft, amount });
  };
  for (const c of cards) {
    const debt = cardDebtArs(c) + Math.max(0, Number(c.balance_usd || 0)) * usdRate; // un saldo en dólares a favor no baja lo que hay que pagar en pesos
    push('card_close', `Cierre de ${c.name}`, Number(c.closing_day));
    push('card_due', `Vence ${c.name}`, Number(c.due_day), debt > 0 ? debt : undefined);
  }
  for (const l of loans) {
    if ((l.kind === 'loan' || (l.kind == null && (l.balance_ars === null || l.balance_ars === undefined))) &&
        Number(l.installment_amount) > 0 && loanRemaining(l) > 0) {
      push('loan', `Cuota ${l.entity}`, Number(l.due_day), Number(l.installment_amount));
    }
  }
  for (const r of recurring) {
    if (!r.active || r.type !== 'expense') continue;
    push('recurring', r.description, Number(r.day_of_month), toArs(Number(r.amount), r.currency, usdRate));
  }
  return ev.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ---------- 3) Recurrentes y suscripciones ----------
const normKey = (d: string) =>
  cleanDesc(d)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\bc\.?\s*\d{1,2}\s*\/\s*\d{1,2}\b/g, ' ')        // C.01/06
    .replace(/\bcuota\s*\d{1,2}\s*(de|\/)\s*\d{1,2}\b/g, ' ')  // cuota 1 de 6
    .replace(/\d{1,2}\s*\/\s*\d{1,2}/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22)
    .trim();

export interface SubscriptionSuggestion {
  key: string;
  description: string;
  amount: number;
  currency: string;
  day: number;
  category: string;
  months: number;
  profile: Profile;
}
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
/** Busca gastos que se repiten todos los meses con importe parecido (≥3 meses distintos). */
export function detectSubscriptions(txs: Tx[], existing: Tx[], refMonth: string): SubscriptionSuggestion[] {
  const groups = new Map<string, Tx[]>();
  for (const t of txs) {
    if (t.type !== 'expense' || isTransferTx(t) || isRefundTx(t) || !t.date) continue;
    if (Number(t.total_installments || 1) > 1) continue; // cuotas no son suscripciones
    const key = normKey(t.description);
    if (key.length < 3) continue;
    const k = `${key}|${t.currency || 'ARS'}|${txProfile(t)}`;
    groups.set(k, [...(groups.get(k) || []), t]);
  }
  const have = existing.map(r => normKey(r.description));
  const earliest = addMonths(refMonth, -6);
  const out: SubscriptionSuggestion[] = [];
  for (const [k, list] of groups) {
    const recent = list.filter(t => monthOf(t.date) >= earliest && monthOf(t.date) <= refMonth);
    const byMonth = new Map<string, Tx>();
    for (const t of recent) if (!byMonth.has(monthOf(t.date))) byMonth.set(monthOf(t.date), t);
    if (byMonth.size < 3) continue;
    const amounts = [...byMonth.values()].map(t => Number(t.amount));
    const med = median(amounts);
    if (med <= 0 || !amounts.every(a => Math.abs(a - med) / med <= 0.15)) continue;
    const key = k.split('|')[0];
    if (have.some(h => h && (h.includes(key) || key.includes(h)))) continue;
    const sample = [...byMonth.values()][0];
    const days = [...byMonth.values()].map(t => Number(t.date.slice(8, 10)));
    const cats = [...byMonth.values()].map(t => t.category || 'Otros');
    const cat = cats.sort((a, b) => cats.filter(c => c === b).length - cats.filter(c => c === a).length)[0];
    out.push({
      key: k,
      description: cleanDesc(sample.description),
      amount: Math.round(med * 100) / 100,
      currency: sample.currency || 'ARS',
      day: Math.round(median(days)),
      category: cat,
      months: byMonth.size,
      profile: txProfile(sample),
    });
  }
  return out.sort((a, b) => b.months - a.months || b.amount - a.amount);
}

// ---------- 4) Proyección de cuotas y compromisos ----------
export interface ProjectionMonth {
  month: string;
  cards: number;
  loans: number;
  recurring: number;
  total: number;
}
/**
 * Compromisos de los próximos meses: cuotas de tarjeta que faltan pagar, cuotas de préstamos y gastos recurrentes.
 * Una compra en cuotas aparece una vez por mes en los resúmenes; se toma la última cuota registrada de cada
 * serie y se proyectan las que faltan.
 */
export function projectCommitments(
  txs: Tx[], loans: Tx[], recurring: Tx[], today: Date, months: number, usdRate: number, profile?: Profile
): ProjectionMonth[] {
  const cur = currentMonthOf(today);
  const rows: ProjectionMonth[] = Array.from({ length: months }, (_, i) => ({ month: addMonths(cur, i), cards: 0, loans: 0, recurring: 0, total: 0 }));
  const idx = (m: string) => rows.findIndex(r => r.month === m);

  // Cuotas de tarjeta: una serie = misma descripción base + total de cuotas + importe
  const series = new Map<string, Tx>();
  for (const t of txs) {
    if (t.type !== 'expense' || isTransferTx(t) || isRefundTx(t) || !t.date) continue;
    if (profile && txProfile(t) !== profile) continue;
    const total = Number(t.total_installments || 1);
    if (total <= 1) continue;
    const key = `${normKey(t.description)}|${total}|${t.currency || 'ARS'}|${Math.round(Number(t.amount))}`;
    const prev = series.get(key);
    const n = Number(t.installment_number || 1);
    if (!prev || n > Number(prev.installment_number || 1) || (n === Number(prev.installment_number || 1) && t.date > prev.date)) series.set(key, t);
  }
  for (const t of series.values()) {
    const remaining = Number(t.total_installments) - Number(t.installment_number || 1);
    const amt = toArs(Number(t.amount), t.currency, usdRate);
    for (let k = 1; k <= remaining; k++) {
      const i = idx(addMonths(monthOf(t.date), k));
      if (i >= 0) rows[i].cards += amt;
    }
  }

  // Préstamos
  for (const l of loans) {
    const isLoan = l.kind === 'loan' || (l.kind == null && (l.balance_ars === null || l.balance_ars === undefined));
    if (!isLoan || !(Number(l.installment_amount) > 0)) continue;
    const remaining = loanRemaining(l);
    const start = Number(l.due_day || 10) >= today.getDate() ? 0 : 1;
    for (let k = 0; k < remaining; k++) {
      const i = start + k;
      if (i < rows.length) rows[i].loans += Number(l.installment_amount);
    }
  }

  // Recurrentes (gastos)
  for (const r of recurring) {
    if (!r.active || r.type !== 'expense') continue;
    if (profile && (r.profile || 'personal') !== profile) continue;
    const amt = toArs(Number(r.amount), r.currency, usdRate);
    const start = r.last_generated_month === cur ? 1 : 0;
    for (let i = start; i < rows.length; i++) rows[i].recurring += amt;
  }

  for (const r of rows) { r.cards = Math.round(r.cards); r.loans = Math.round(r.loans); r.recurring = Math.round(r.recurring); r.total = r.cards + r.loans + r.recurring; }
  return rows;
}

// ---------- 5) Patrimonio neto ----------
export interface NetWorth { assets: number; liabilities: number; net: number; digital: number; cash: number; cardsDebt: number; loansDebt: number; property: number; }
/** Valor del bien asociado a un préstamo (casa, auto…), en pesos. 0 si no se cargó. */
export const loanAssetArs = (l: Tx, usdRate: number) => {
  const v = Number(l.asset_value || 0);
  return v > 0 ? (l.asset_currency === 'USD' ? v * usdRate : v) : 0;
};
export function computeNetWorth(cards: Tx[], loans: Tx[], usdRate: number): NetWorth {
  let digital = 0, cash = 0, cardsNet = 0, loansDebt = 0, property = 0;
  for (const l of loans) {
    const kind = l.kind || (l.balance_ars !== null && l.balance_ars !== undefined ? 'wallet' : 'loan');
    if (kind === 'loan') {
      loansDebt += Math.max(0, Number(l.total_amount || 0));
      property += loanAssetArs(l, usdRate);
    } else {
      const v = Number(l.balance_ars || 0) + Number(l.balance_usd || 0) * usdRate;
      if (kind === 'cash') cash += v; else digital += v;
    }
  }
  for (const c of cards) cardsNet += cardDebtArs(c) + Number(c.balance_usd || 0) * usdRate;
  const assets = digital + cash + property + Math.max(0, -cardsNet);
  const liabilities = Math.max(0, cardsNet) + loansDebt;
  return { assets: Math.round(assets), liabilities: Math.round(liabilities), net: Math.round(assets - liabilities), digital: Math.round(digital), cash: Math.round(cash), cardsDebt: Math.round(Math.max(0, cardsNet)), loansDebt: Math.round(loansDebt), property: Math.round(property) };
}

// ---------- 5b) Resumen diario para las alertas de la pantalla ----------
export interface DailyDigest {
  lastTxDate: string | null;     // fecha del último movimiento cargado
  daysSinceLast: number | null;  // días desde ese movimiento (0 = hoy)
  yesterdayTotal: number;        // gastos netos de ayer (ARS)
  yesterdayCount: number;
  weekTotal: number;             // gastos netos de los últimos 7 días (incluye hoy)
  prevWeekTotal: number;         // los 7 días anteriores
  unassignedTransfers: number;   // transferencias / pagos sin origen o destino asignado
}
export function dailyDigest(txs: Tx[], profile: Profile, usdRate: number, today: Date): DailyDigest {
  const t0 = startOfDay(today);
  const dayStr = (back: number) => ymd(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - back));
  const yesterday = dayStr(1);
  const w1 = new Set(Array.from({ length: 7 }, (_, i) => dayStr(i)));
  const w2 = new Set(Array.from({ length: 7 }, (_, i) => dayStr(i + 7)));
  let last: string | null = null, yT = 0, yC = 0, wT = 0, pT = 0, unassigned = 0;
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile) continue;
    if (t.date <= ymd(t0) && (!last || t.date > last)) last = t.date;
    if (isTransferTx(t)) {
      if (!t.transfer_account && t.operation_type === 'transfer' && t.category !== 'Cambio de moneda') unassigned++;
      continue;
    }
    if (t.type === 'income' && !isRefundTx(t)) continue;
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate) * (isRefundTx(t) ? -1 : 1);
    if (t.date === yesterday) { yT += amt; yC++; }
    if (w1.has(t.date)) wT += amt;
    else if (w2.has(t.date)) pT += amt;
  }
  return {
    lastTxDate: last,
    daysSinceLast: last ? Math.max(0, diffDays(t0, new Date(`${last}T00:00:00`))) : null,
    yesterdayTotal: Math.max(0, Math.round(yT)), yesterdayCount: yC,
    weekTotal: Math.max(0, Math.round(wT)), prevWeekTotal: Math.max(0, Math.round(pT)),
    unassignedTransfers: unassigned,
  };
}

// ---------- 6) Metas ----------
export function goalProgress(goal: Tx, today: Date) {
  const target = Number(goal.target_amount || 0);
  const saved = Number(goal.saved_amount || 0);
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  let monthsLeft: number | null = null;
  let monthlyNeeded: number | null = null;
  if (goal.target_date) {
    const td = new Date(`${goal.target_date}T00:00:00`);
    monthsLeft = Math.max(0, (td.getFullYear() - today.getFullYear()) * 12 + td.getMonth() - today.getMonth());
    const missing = Math.max(0, target - saved);
    monthlyNeeded = missing > 0 ? missing / Math.max(1, monthsLeft) : 0;
  }
  return { pct, saved, target, monthsLeft, monthlyNeeded };
}

// ---------- 7) Reglas de categorización ----------
const plain = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Devuelve la categoría de la regla más específica (palabra más larga) que aparece en la descripción. */
export function applyRules(description: string, rules: Tx[]): string | null {
  const d = plain(cleanDesc(description));
  let best: Tx | null = null;
  for (const r of rules) {
    const k = plain(r.keyword).trim();
    if (k && d.includes(k) && (!best || k.length > plain(best.keyword).trim().length)) best = r;
  }
  return best ? best.category : null;
}

// ---------- 8) Reportes ----------
export interface MonthSummary { month: string; income: number; expense: number; net: number; }
export function monthlyComparison(txs: Tx[], profile: Profile, usdRate: number, endMonth: string, months = 6): MonthSummary[] {
  const rows: MonthSummary[] = Array.from({ length: months }, (_, i) => ({ month: addMonths(endMonth, i - (months - 1)), income: 0, expense: 0, net: 0 }));
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile || isTransferTx(t)) continue;
    const r = rows.find(x => x.month === monthOf(t.date));
    if (!r) continue;
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) r.expense -= amt;
    else if (t.type === 'income') r.income += amt;
    else r.expense += amt;
  }
  for (const r of rows) { r.expense = Math.max(0, Math.round(r.expense)); r.income = Math.round(r.income); r.net = r.income - r.expense; }
  return rows;
}
export interface CategoryDelta { category: string; current: number; previous: number; delta: number; share: number; }
export function categoryComparison(txs: Tx[], profile: Profile, month: string, usdRate: number): CategoryDelta[] {
  const cur = spendByCategory(txs, month, profile, usdRate);
  const prev = spendByCategory(txs, addMonths(month, -1), profile, usdRate);
  const total = Object.values(cur).reduce((a, b) => a + b, 0) || 1;
  const cats = new Set([...Object.keys(cur), ...Object.keys(prev)]);
  return [...cats]
    .map(category => ({ category, current: Math.round(cur[category] || 0), previous: Math.round(prev[category] || 0), delta: Math.round((cur[category] || 0) - (prev[category] || 0)), share: ((cur[category] || 0) / total) * 100 }))
    .sort((a, b) => b.current - a.current);
}

/** CSV para Excel en español: separador ";", coma decimal y BOM UTF-8. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    if (typeof v === 'number') return String(v).replace('.', ',');
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
export function transactionsCsv(txs: Tx[], cards: Tx[], loans: Tx[]): string {
  const acc = (t: Tx) =>
    t.credit_card_id ? (cards.find(c => c.id === t.credit_card_id)?.name || '') :
    t.loan_id ? (loans.find(l => l.id === t.loan_id)?.entity || '') : '';
  const opLabel: Record<string, string> = { purchase: 'Gasto', income: 'Ingreso', payment: 'Pago de tarjeta', transfer: 'Transferencia propia', refund: 'Reintegro' };
  const rows: (string | number)[][] = [['Fecha', 'Descripción', 'Perfil', 'Tipo', 'Movimiento', 'Categoría', 'Moneda', 'Importe', 'Cuenta']];
  [...txs].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(t => {
    rows.push([
      t.date || '', cleanDesc(t.description), txProfile(t) === 'business' ? 'Negocio' : 'Personal',
      t.type === 'income' ? 'Ingreso' : 'Gasto', opLabel[t.operation_type || 'purchase'] || '', t.category || '',
      t.currency || 'ARS', Number(t.amount || 0) * (t.type === 'income' ? 1 : -1), acc(t),
    ]);
  });
  return toCsv(rows);
}

export const formatArs = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export function netWorthSnapshotRow(userId: string, cards: Tx[], loans: Tx[], usdRate: number, today: Date) {
  const nw = computeNetWorth(cards, loans, usdRate);
  return { user_id: userId, month: currentMonthOf(today), assets_ars: nw.assets, liabilities_ars: nw.liabilities, usd_rate: usdRate, updated_at: new Date().toISOString() };
}

// ---------- Duplicados ----------
const PAYEE_STOP = new Set([
  'transferencia', 'transfer', 'enviada', 'recibida', 'envio', 'pago', 'pagos', 'debito', 'credito', 'compra', 'compras',
  'cuit', 'cuil', 'tarjeta', 'cuenta', 'banco', 'mercado', 'servicio', 'servicios', 'varios', 'operacion', 'operaciones',
  'identificadas', 'con', 'para', 'del', 'los', 'las', 'por', 'valor', 'actualizado', 'indice', 'alquiler', 'deposito', 'garantia',
  'actualizacion', 'pesos', 'dolares', 'sucursal', 'interbanking', 'inmediata', 'inmediato', 'debin', 'cvu', 'cbu',
]);
/** Palabras que identifican a quién se le pagó (nombres, comercios); ignora las genéricas de los bancos y los números. */
export function payeeTokens(desc: string): string[] {
  return plain(cleanDesc(desc)).split(/[^a-z]+/).filter(t => t.length >= 4 && !PAYEE_STOP.has(t));
}
const dayDiff = (a: string, b: string) =>
  Math.abs(Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000));

export interface SimilarMatch { tx: Tx; strength: 'strong' | 'weak'; }
/**
 * Busca un movimiento ya guardado que sea el mismo hecho aunque el banco lo describa distinto
 * (ej: "Alquiler - transferencia a Desmonts Hugo" vs "Transferencia enviada Desmonts Hugo").
 * strong: mismo importe, misma moneda, mismo sentido, fecha a ≤2 días y comparten nombre del destinatario.
 * weak: mismo importe y mismo día pero sin nombre en común (solo se avisa, no se descarta).
 * `used` evita que un movimiento guardado "absorba" dos del extracto.
 */
export function findSimilarExisting(
  item: { date: string; amount: number; currency?: string; description: string; inflow: boolean },
  txs: Tx[],
  used: Set<string>
): SimilarMatch | null {
  const amt = Math.abs(Number(item.amount));
  const cur = item.currency || 'ARS';
  const want = payeeTokens(item.description);
  let weak: Tx | null = null;
  let best: { tx: Tx; d: number } | null = null;
  for (const t of txs) {
    if (used.has(t.id) || !t.date) continue;
    if ((t.currency || 'ARS') !== cur) continue;
    if (Math.abs(Math.abs(Number(t.amount)) - amt) > 0.01) continue;
    if ((t.type === 'income') !== item.inflow) continue;
    const d = dayDiff(t.date, item.date);
    if (d > 2) continue;
    const shared = payeeTokens(t.description).some(x => want.includes(x));
    if (shared) { if (!best || d < best.d) best = { tx: t, d }; }
    else if (d === 0 && amt >= 10000 && !weak) weak = t;
  }
  if (best) return { tx: best.tx, strength: 'strong' };
  if (weak) return { tx: weak, strength: 'weak' };
  return null;
}

export interface DuplicateGroup { key: string; strength: 'alta' | 'media'; items: Tx[]; }
/** Grupos de movimientos ya guardados que parecen el mismo hecho cargado dos veces. */
export function findDuplicateGroups(txs: Tx[]): DuplicateGroup[] {
  const buckets = new Map<string, Tx[]>();
  for (const t of txs) {
    if (!t.date || !(Number(t.amount) > 0)) continue;
    if (isTransferTx(t) && t.operation_type === 'payment') continue; // los pagos de tarjeta se comparan aparte
    const k = `${Math.abs(Number(t.amount)).toFixed(2)}|${t.currency || 'ARS'}|${t.type}`;
    buckets.set(k, [...(buckets.get(k) || []), t]);
  }
  const out: DuplicateGroup[] = [];
  for (const [k, list] of buckets) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const used = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].id)) continue;
      const group = [sorted[i]];
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(sorted[j].id)) continue;
        if (dayDiff(sorted[i].date, sorted[j].date) > 2) continue;
        group.push(sorted[j]);
      }
      if (group.length < 2) continue;
      const tokenSets = group.map(g => payeeTokens(g.description));
      const texts = group.map(g => plain(cleanDesc(g.description)).trim());
      // Un texto que es el otro con algo agregado ("IVA ..." / "IVA ... (Base Imponible ...)") es la misma línea del resumen.
      const contained = texts[0].length >= 8 && texts.slice(1).some(t => t !== texts[0] && (t.startsWith(texts[0]) || texts[0].startsWith(t)));
      const shared = contained || tokenSets[0].some(tok => tokenSets.slice(1).some(ts => ts.includes(tok)));
      const sameDesc = new Set(group.map(g => plain(cleanDesc(g.description)))).size === 1;
      const amountBig = Math.abs(Number(group[0].amount)) >= 10000;
      // El mismo texto exacto el mismo día suele ser una compra repetida legítima (dos cafés): solo se avisa si el importe es alto.
      if (!amountBig && (!shared || sameDesc)) continue;
      group.forEach(g => used.add(g.id));
      out.push({ key: `${k}|${sorted[i].date}|${sorted[i].id}`, strength: shared ? 'alta' : 'media', items: group });
    }
  }
  return out.sort((a, b) => (a.strength === b.strength ? Math.abs(Number(b.items[0].amount)) - Math.abs(Number(a.items[0].amount)) : a.strength === 'alta' ? -1 : 1));
}
