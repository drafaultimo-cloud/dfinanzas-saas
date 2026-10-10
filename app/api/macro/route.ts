import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Datos públicos para ajustar por inflación y pasar a dólares: IPC mensual (INDEC, vía argentinadatos.com)
// y cotización histórica del dólar (bluelytics.com.ar). Se resume por mes y se guarda 12 horas.
type Macro = {
  inflation: { month: string; pct: number }[];
  dollar: { oficial?: Record<string, number>; blue?: Record<string, number> };
};
let cache: { at: number; data: Macro } | null = null;
const TTL = 12 * 60 * 60 * 1000;
const MONTHS_BACK = 30;

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

async function inflation(): Promise<Macro['inflation']> {
  const raw = (await getJson('https://api.argentinadatos.com/v1/finanzas/indices/inflacion')) as { fecha: string; valor: number }[];
  return raw
    .filter(r => typeof r?.fecha === 'string' && typeof r?.valor === 'number')
    .map(r => ({ month: r.fecha.slice(0, 7), pct: r.valor }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-MONTHS_BACK);
}

async function dollar(): Promise<Macro['dollar']> {
  const raw = (await getJson('https://api.bluelytics.com.ar/v2/evolution.json')) as { date: string; source: string; value_sell: number }[];
  const acc: Record<'oficial' | 'blue', Record<string, { sum: number; n: number }>> = { oficial: {}, blue: {} };
  for (const r of raw) {
    const kind = r?.source === 'Oficial' ? 'oficial' : r?.source === 'Blue' ? 'blue' : null;
    if (!kind || typeof r.date !== 'string' || !(r.value_sell > 0)) continue;
    const m = r.date.slice(0, 7);
    const a = (acc[kind][m] ||= { sum: 0, n: 0 });
    a.sum += r.value_sell; a.n += 1;
  }
  const finish = (o: Record<string, { sum: number; n: number }>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).slice(-MONTHS_BACK).map(([m, v]) => [m, Math.round((v.sum / v.n) * 100) / 100]));
  return { oficial: finish(acc.oficial), blue: finish(acc.blue) };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json(cache.data);
  const [inf, dol] = await Promise.allSettled([inflation(), dollar()]);
  const data: Macro = {
    inflation: inf.status === 'fulfilled' ? inf.value : cache?.data.inflation ?? [],
    dollar: dol.status === 'fulfilled' ? dol.value : cache?.data.dollar ?? {},
  };
  const hasAny = data.inflation.length > 0 || Object.keys(data.dollar).length > 0;
  if (!hasAny) return NextResponse.json({ error: 'No se pudieron obtener los datos de inflación y dólar.' }, { status: 502 });
  if (inf.status === 'fulfilled' && dol.status === 'fulfilled') cache = { at: Date.now(), data };
  return NextResponse.json(data);
}
