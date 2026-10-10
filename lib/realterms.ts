// Gasto/ingreso en pesos corrientes, pesos constantes (ajustados por inflación) y en dólares. Lógica pura.
import { addMonths, isRefundTx, isTransferTx, monthOf, txProfile, type Profile, type Tx } from './planning';

export type DollarKind = 'oficial' | 'blue';
export interface MacroData {
  inflation: { month: string; pct: number }[];                       // IPC mensual (INDEC), en %
  dollar: Partial<Record<DollarKind, Record<string, number>>>;       // promedio mensual de venta
}

export interface RealRow {
  month: string;
  nominal: number;           // pesos de ese mes
  real: number | null;       // en pesos del último mes del período (null si no hay inflación)
  usd: number | null;        // en dólares (null si no hay cotización)
  rate: number | null;       // cotización usada ese mes
  estimated: boolean;        // el ajuste usó una inflación estimada (mes todavía sin publicar)
}

/** Suma por mes separando lo cargado en pesos de lo cargado en dólares (sin convertir). */
export function monthlySums(txs: Tx[], profile: Profile, kind: 'expense' | 'income', months: string[]): Record<string, { ars: number; usd: number }> {
  const out: Record<string, { ars: number; usd: number }> = Object.fromEntries(months.map(m => [m, { ars: 0, usd: 0 }]));
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile || isTransferTx(t)) continue;
    const bucket = out[monthOf(t.date)];
    if (!bucket) continue;
    const key = t.currency === 'USD' ? 'usd' : 'ars';
    const amt = Number(t.amount || 0);
    if (kind === 'expense') {
      if (isRefundTx(t)) bucket[key] -= amt; else if (t.type === 'expense') bucket[key] += amt;
    } else if (t.type === 'income' && !isRefundTx(t)) bucket[key] += amt;
  }
  for (const b of Object.values(out)) { b.ars = Math.max(0, b.ars); b.usd = Math.max(0, b.usd); }
  return out;
}

/**
 * Factor para llevar pesos de cada mes a pesos del mes `endMonth`: producto de (1 + inflación) de los meses siguientes.
 * Los meses sin dato publicado usan la última inflación conocida y quedan marcados como estimados.
 */
export function deflators(months: string[], endMonth: string, inflation: MacroData['inflation']): Record<string, { factor: number; estimated: boolean }> | null {
  const rates = new Map(inflation.map(i => [i.month, i.pct]));
  if (rates.size === 0) return null;
  const lastKnown = [...rates.keys()].sort().pop()!;
  const out: Record<string, { factor: number; estimated: boolean }> = {};
  for (const m of months) {
    let factor = 1, estimated = false;
    for (let k = addMonths(m, 1); k <= endMonth; k = addMonths(k, 1)) {
      const r = rates.get(k);
      if (r === undefined) { factor *= 1 + (rates.get(lastKnown) as number) / 100; estimated = true; }
      else factor *= 1 + r / 100;
    }
    out[m] = { factor, estimated };
  }
  return out;
}

export function buildRealSeries(opts: {
  txs: Tx[]; profile: Profile; kind: 'expense' | 'income'; endMonth: string; months: number;
  macro: MacroData | null; dollar: DollarKind; fallbackRate: number;
}): RealRow[] {
  const list = Array.from({ length: opts.months }, (_, i) => addMonths(opts.endMonth, i - (opts.months - 1)));
  const sums = monthlySums(opts.txs, opts.profile, opts.kind, list);
  const defl = opts.macro ? deflators(list, opts.endMonth, opts.macro.inflation) : null;
  const rates = opts.macro?.dollar?.[opts.dollar] || {};
  return list.map(month => {
    const hasRate = rates[month] > 0;
    // Los montos cargados en dólares se pasan a pesos con la cotización de ese mes (o la actual si no hay dato).
    const rateForUsd = hasRate ? rates[month] : opts.fallbackRate;
    const nominal = Math.round(sums[month].ars + sums[month].usd * rateForUsd);
    return {
      month,
      nominal,
      real: defl ? Math.round(nominal * defl[month].factor) : null,
      usd: hasRate ? Math.round((sums[month].usd + sums[month].ars / rates[month]) * 100) / 100 : null,
      rate: hasRate ? rates[month] : null,
      estimated: defl ? defl[month].estimated : false,
    };
  });
}

export interface RealSummary { months: number; nominalPct: number | null; realPct: number | null; usdPct: number | null; }
const pct = (a: number | null, b: number | null) => (a !== null && b !== null && a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : null);

/** Variación entre el primer mes con datos y el último. */
export function summarizeReal(rows: RealRow[]): RealSummary {
  const used = rows.slice(rows.findIndex(r => r.nominal > 0));
  if (rows.findIndex(r => r.nominal > 0) < 0 || used.length < 2) return { months: used.length, nominalPct: null, realPct: null, usdPct: null };
  const f = used[0], l = used[used.length - 1];
  return { months: used.length, nominalPct: pct(f.nominal, l.nominal), realPct: pct(f.real, l.real), usdPct: pct(f.usd, l.usd) };
}
