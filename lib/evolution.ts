// Cálculos de la pestaña "Evolución": ingresos/gastos, ahorro, ritmo del mes y rubros. Lógica pura.
import { addMonths, daysInMonth, isRefundTx, isTransferTx, monthOf, monthlyComparison, toArs, txProfile, type Profile, type Tx } from './planning';

export interface SavingsPoint { month: string; income: number; expense: number; net: number; rate: number | null; }

/** Tasa de ahorro = resultado / ingresos (en %). Sin ingresos el mes no tiene tasa. */
export function savingsSeries(txs: Tx[], profile: Profile, usdRate: number, endMonth: string, months = 12): SavingsPoint[] {
  return monthlyComparison(txs, profile, usdRate, endMonth, months).map(r => ({
    ...r,
    rate: r.income > 0 ? Math.round((r.net / r.income) * 1000) / 10 : null,
  }));
}

/** Promedio simple de las tasas disponibles (ignora meses sin ingresos). */
export function averageRate(points: SavingsPoint[]): number | null {
  const v = points.map(p => p.rate).filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

/** Gasto neto de cada día del mes (compras − reintegros), sin pagos de tarjeta ni transferencias. */
function dailyExpense(txs: Tx[], profile: Profile, usdRate: number, month: string): number[] {
  const [y, m] = month.split('-').map(Number);
  const out = Array(daysInMonth(y, m)).fill(0);
  for (const t of txs) {
    if (!t.date || monthOf(t.date) !== month || txProfile(t) !== profile || isTransferTx(t)) continue;
    const day = Number(t.date.slice(8, 10));
    if (!(day >= 1 && day <= out.length)) continue;
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) out[day - 1] -= amt;
    else if (t.type === 'expense') out[day - 1] += amt;
  }
  return out;
}

export interface PacePoint { day: number; current: number | null; previous: number | null; }
export interface Pace {
  points: PacePoint[];
  currentToDate: number;     // lo gastado en el mes hasta hoy
  previousSameDay: number;   // lo gastado el mes anterior a esta misma altura
  previousTotal: number;     // total del mes anterior
  projected: number | null;  // proyección lineal al cierre (solo mes en curso)
  deltaPct: number | null;   // % contra el mes anterior a la misma altura
  isCurrentMonth: boolean;
}

/** Gasto acumulado día a día del mes elegido contra el mes anterior. */
export function paceByDay(txs: Tx[], profile: Profile, usdRate: number, month: string, today: Date): Pace {
  const cur = dailyExpense(txs, profile, usdRate, month);
  const prev = dailyExpense(txs, profile, usdRate, addMonths(month, -1));
  const todayYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = month === todayYm;
  const lastDay = isCurrentMonth ? today.getDate() : cur.length;
  const days = Math.max(cur.length, prev.length);
  let a = 0, b = 0;
  const points: PacePoint[] = [];
  for (let d = 1; d <= days; d++) {
    if (d <= cur.length) a += cur[d - 1];
    if (d <= prev.length) b += prev[d - 1];
    points.push({
      day: d,
      current: d <= lastDay && d <= cur.length ? Math.max(0, Math.round(a)) : null,
      previous: d <= prev.length ? Math.max(0, Math.round(b)) : null,
    });
  }
  const currentToDate = Math.max(0, Math.round(cur.slice(0, lastDay).reduce((x, y) => x + y, 0)));
  const previousSameDay = Math.max(0, Math.round(prev.slice(0, Math.min(lastDay, prev.length)).reduce((x, y) => x + y, 0)));
  const previousTotal = Math.max(0, Math.round(prev.reduce((x, y) => x + y, 0)));
  return {
    points, currentToDate, previousSameDay, previousTotal, isCurrentMonth,
    projected: isCurrentMonth && lastDay > 0 ? Math.round((currentToDate / lastDay) * cur.length) : null,
    deltaPct: previousSameDay > 0 ? Math.round(((currentToDate - previousSameDay) / previousSameDay) * 1000) / 10 : null,
  };
}

/** Nombre del grupo que junta los rubros fuera del top (distinto de un rubro real llamado "Otros"). */
export const REST_LABEL = 'Otros rubros';

export interface CategoryTrend {
  months: string[];
  categories: string[];                       // los `top` rubros + "Otros rubros" si corresponde
  rows: ({ month: string } & Record<string, number | string>)[];
  changes: { category: string; current: number; average: number; deltaPct: number | null }[];
}

/** Evolución mensual de los rubros más grandes (el resto se agrupa en "Otros"). */
export function categoryTrend(txs: Tx[], profile: Profile, usdRate: number, endMonth: string, months = 6, top = 5): CategoryTrend {
  const list = Array.from({ length: months }, (_, i) => addMonths(endMonth, i - (months - 1)));
  const perMonth: Record<string, Record<string, number>> = Object.fromEntries(list.map(m => [m, {}]));
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile || isTransferTx(t)) continue;
    const m = monthOf(t.date);
    if (!perMonth[m]) continue;
    const cat = t.category || 'Otros';
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) perMonth[m][cat] = (perMonth[m][cat] || 0) - amt;
    else if (t.type === 'expense') perMonth[m][cat] = (perMonth[m][cat] || 0) + amt;
  }
  const totals: Record<string, number> = {};
  for (const m of list) for (const [c, v] of Object.entries(perMonth[m])) totals[c] = (totals[c] || 0) + Math.max(0, v);
  const ranked = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const topCats = ranked.slice(0, top);
  const rest = ranked.slice(top);
  const rows = list.map(m => {
    const row: any = { month: m };
    for (const c of topCats) row[c] = Math.round(Math.max(0, perMonth[m][c] || 0));
    if (rest.length) row[REST_LABEL] = Math.round(rest.reduce((a, c) => a + Math.max(0, perMonth[m][c] || 0), 0));
    return row;
  });
  const categories = rest.length ? [...topCats, REST_LABEL] : topCats;
  const changes = categories.map(category => {
    const vals = rows.map(r => Number(r[category] || 0));
    const current = vals[vals.length - 1] || 0;
    const before = vals.slice(0, -1).filter(v => v > 0);
    const average = before.length ? Math.round(before.reduce((a, b) => a + b, 0) / before.length) : 0;
    return { category, current, average, deltaPct: average > 0 ? Math.round(((current - average) / average) * 1000) / 10 : null };
  });
  return { months: list, categories, rows, changes };
}

/** Quita los meses vacíos del principio (antes de que empezaras a cargar datos). */
export function trimLeadingEmpty<T extends { income: number; expense: number }>(rows: T[]): T[] {
  const i = rows.findIndex(r => r.income > 0 || r.expense > 0);
  return i <= 0 ? rows : rows.slice(i);
}
