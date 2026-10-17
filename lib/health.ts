// Puntaje de salud financiera (0 a 100) y rachas. Lógica pura: solo usa lo que ya está cargado en la app.
import { addMonths, currentMonthOf, monthlyComparison, ymd, type Profile, type Tx } from './planning';
import { cashDailySpend } from './forecast';

const DAY = 86400000;
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export interface HealthPart { key: 'ahorro' | 'colchon' | 'deuda' | 'constancia'; label: string; score: number; detail: string; weight: number; }
export interface Health {
  score: number | null;           // null = todavía faltan datos
  level: string;
  parts: HealthPart[];
  tip: string;
  dayStreak: number;              // días seguidos cargando movimientos (hasta hoy o ayer)
  bestStreak: number;
  positiveMonths: number;         // meses seguidos cerrando en positivo (sin contar el actual)
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const money = (n: number) => `$ ${Math.round(n).toLocaleString('es-AR')}`;

/** Días seguidos con al menos un movimiento cargado. La racha no se corta hasta que pasa un día entero sin cargar. */
export function dayStreaks(txs: Tx[], today: Date): { current: number; best: number } {
  const days = new Set<string>();
  const todayStr = ymd(today);
  for (const t of txs) if (t.date && t.date <= todayStr) days.add(String(t.date).slice(0, 10));
  if (days.size === 0) return { current: 0, best: 0 };
  const step = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  let cursor = days.has(todayStr) ? today : step(today, -1);
  let current = 0;
  while (days.has(ymd(cursor))) { current++; cursor = step(cursor, -1); }
  const sorted = [...days].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((new Date(`${sorted[i]}T00:00:00`).getTime() - new Date(`${sorted[i - 1]}T00:00:00`).getTime()) / DAY);
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return { current, best: Math.max(best, current) };
}

export function financialHealth(opts: {
  txs: Tx[]; profile: Profile; usdRate: number; today: Date;
  liquid: number;          // billeteras + efectivo en pesos
  cardsDebt: number;       // deuda de tarjetas en pesos
  loanMonthly: number;     // cuotas mensuales de préstamos
}): Health {
  const { txs, profile, usdRate, today, liquid, cardsDebt, loanMonthly } = opts;
  const month = currentMonthOf(today);
  const last3 = monthlyComparison(txs, profile, usdRate, month, 3).filter(m => m.income > 0);
  const avgIncome = last3.length ? last3.reduce((a, m) => a + m.income, 0) / last3.length : 0;
  const parts: HealthPart[] = [];

  if (last3.length > 0) {
    const inc = last3.reduce((a, m) => a + m.income, 0), exp = last3.reduce((a, m) => a + m.expense, 0);
    const rate = (inc - exp) / inc;
    parts.push({ key: 'ahorro', label: 'Ahorro', weight: 30, score: clamp((rate / 0.2) * 100),
      detail: rate >= 0 ? `Ahorrás ${pct(rate)} de lo que ingresa (la meta sana es 20%).` : `Gastás ${pct(-rate)} más de lo que ingresa.` });
  }
  const daily = cashDailySpend(txs, profile, usdRate, today, 30);
  if (daily > 0) {
    const days = liquid / daily;
    parts.push({ key: 'colchon', label: 'Colchón', weight: 25, score: clamp((days / 60) * 100),
      detail: `Tu plata disponible alcanza para ${Math.max(0, Math.round(days))} días de gastos (la meta son 60).` });
  }
  if (avgIncome > 0) {
    const ratio = (cardsDebt + loanMonthly) / avgIncome;
    parts.push({ key: 'deuda', label: 'Deuda', weight: 25, score: clamp(100 - ((ratio - 0.1) / 0.9) * 100),
      detail: `Tarjetas y cuotas equivalen al ${pct(ratio)} de un mes de ingresos (conviene menos de 30%).` });
  }
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  const loaded = new Set<string>();
  for (const t of txs) if (t.date && t.date >= ymd(from) && t.date <= ymd(today)) loaded.add(String(t.date).slice(0, 10));
  if (txs.length > 0) {
    const frac = loaded.size / 30;
    parts.push({ key: 'constancia', label: 'Constancia', weight: 20, score: clamp((frac / 0.5) * 100),
      detail: `Cargaste movimientos ${loaded.size} de los últimos 30 días.` });
  }

  const wsum = parts.reduce((a, p) => a + p.weight, 0);
  const score = parts.length >= 2 ? Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0) / wsum) : null;
  const level = score === null ? 'Faltan datos' : score >= 80 ? 'Muy buena' : score >= 60 ? 'Buena' : score >= 40 ? 'En construcción' : 'Para atender';

  const weakest = [...parts].sort((a, b) => a.score - b.score)[0];
  const TIPS: Record<HealthPart['key'], string> = {
    ahorro: 'Lo que más suma: separar un monto fijo apenas cobrás. Probá con una meta de ahorro.',
    colchon: 'Lo que más suma: juntar de a poco un colchón en una billetera aparte hasta cubrir 2 meses.',
    deuda: 'Lo que más suma: bajar la deuda de tarjetas. Probá el plan Bola de Nieve para ordenar los pagos.',
    constancia: 'Lo que más suma: cargar tus gastos un poco cada día, aunque sea desde el celular.',
  };
  const tip = score === null ? 'Cargá o importá un par de semanas de movimientos y vas a ver tu puntaje.' : weakest && weakest.score < 80 ? TIPS[weakest.key] : 'Vas muy bien: mantené el ritmo.';

  const streak = dayStreaks(txs, today);
  let positiveMonths = 0;
  const hist = monthlyComparison(txs, profile, usdRate, addMonths(month, -1), 12);
  for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].income > 0 && hist[i].net > 0) positiveMonths++; else break; }

  return { score, level, parts, tip, dayStreak: streak.current, bestStreak: streak.best, positiveMonths };
}
