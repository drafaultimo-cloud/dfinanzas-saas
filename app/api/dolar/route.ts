import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Cotizaciones públicas del dólar. Se consulta dolarapi.com y, si falla, bluelytics.
// La respuesta se guarda 10 minutos para no pedirla en cada visita.
type Rates = { oficial?: number; mep?: number; ccl?: number; blue?: number };
let cache: { at: number; rates: Rates; source: string } | null = null;
const TTL = 10 * 60 * 1000;

async function fromDolarApi(): Promise<Rates> {
  const r = await fetch('https://dolarapi.com/v1/dolares', { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  if (!r.ok) throw new Error('dolarapi ' + r.status);
  const list = (await r.json()) as { casa: string; venta: number }[];
  const pick = (casa: string) => list.find(d => d.casa === casa)?.venta;
  return { oficial: pick('oficial'), mep: pick('bolsa'), ccl: pick('contadoconliqui'), blue: pick('blue') };
}
async function fromBluelytics(): Promise<Rates> {
  const r = await fetch('https://api.bluelytics.com.ar/v2/latest', { signal: AbortSignal.timeout(6000), cache: 'no-store' });
  if (!r.ok) throw new Error('bluelytics ' + r.status);
  const j = await r.json();
  return { oficial: j?.oficial?.value_sell, blue: j?.blue?.value_sell };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ rates: cache.rates, source: cache.source, updatedAt: new Date(cache.at).toISOString() });
  }
  for (const [source, fn] of [['dolarapi.com', fromDolarApi], ['bluelytics.com.ar', fromBluelytics]] as const) {
    try {
      const rates = await fn();
      if (Object.values(rates).some(v => typeof v === 'number' && v > 0)) {
        cache = { at: Date.now(), rates, source };
        return NextResponse.json({ rates, source, updatedAt: new Date().toISOString() });
      }
    } catch { /* se prueba la fuente siguiente */ }
  }
  if (cache) return NextResponse.json({ rates: cache.rates, source: cache.source, updatedAt: new Date(cache.at).toISOString(), stale: true });
  return NextResponse.json({ error: 'No se pudo obtener la cotización. Cargala a mano.' }, { status: 502 });
}
