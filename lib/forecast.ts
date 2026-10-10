// Proyección de plata disponible: saldo de hoy − vencimientos − gasto diario esperado (+ ingreso esperado). Lógica pura.
import { isRefundTx, isTransferTx, toArs, txProfile, ymd, type DueEvent, type Profile, type Tx } from './planning';

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Gasto diario "de bolsillo": lo que sale de billeteras y efectivo (sin tarjeta, que se paga recién al vencimiento
 * y ya figura como vencimiento) en los últimos `window` días, sin pagos ni transferencias propias.
 */
export function cashDailySpend(txs: Tx[], profile: Profile, usdRate: number, today: Date, window = 30): number {
  const end = startOfDay(today).getTime();
  const from = end - (window - 1) * DAY;
  let total = 0;
  for (const t of txs) {
    if (!t.date || t.credit_card_id || txProfile(t) !== profile || isTransferTx(t)) continue;
    const ts = new Date(`${t.date}T00:00:00`).getTime();
    if (!(ts >= from && ts <= end)) continue;
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) total -= amt;
    else if (t.type === 'expense') total += amt;
  }
  return Math.max(0, Math.round(total / window));
}

export interface ExpectedIncome { amount: number; day: number; }   // día del mes en que lo esperás

export interface ForecastPoint { date: string; balance: number; events: { label: string; amount: number }[]; }
export interface Forecast {
  points: ForecastPoint[];
  end: number;                                   // saldo al final del horizonte
  min: { balance: number; date: string };        // el punto más bajo
  firstNegative: string | null;                  // primer día en que quedarías en rojo
  totalDues: number;
  totalSpend: number;
  totalIncome: number;
}

/**
 * `upcomingEvents` da solo la próxima ocurrencia de cada vencimiento. Para horizontes largos, las cuotas de
 * préstamos y los gastos recurrentes se repiten cada mes. Las tarjetas no: su próximo resumen todavía no se conoce.
 */
export function expandMonthly(events: DueEvent[], today: Date, horizonDays: number): DueEvent[] {
  const base = startOfDay(today);
  const out: DueEvent[] = [...events];
  for (const e of events) {
    if (e.kind !== 'loan' && e.kind !== 'recurring') continue;
    const [y, m, d] = e.date.split('-').map(Number);
    for (let n = 1; n <= 24; n++) {
      const last = new Date(y, m - 1 + n + 1, 0).getDate();
      const when = new Date(y, m - 1 + n, Math.min(d, last));
      const daysLeft = Math.round((when.getTime() - base.getTime()) / DAY);
      if (daysLeft > horizonDays) break;
      out.push({ ...e, date: ymd(when), daysLeft });
    }
  }
  return out;
}

export function forecastBalance(opts: {
  start: number; today: Date; horizonDays: number; events: DueEvent[]; dailySpend: number; income?: ExpectedIncome | null;
}): Forecast {
  const { start, horizonDays, dailySpend } = opts;
  const base = startOfDay(opts.today);
  const dues = expandMonthly(opts.events, opts.today, horizonDays).filter(e => e.kind !== 'card_close' && typeof e.amount === 'number' && (e.amount as number) > 0 && e.daysLeft >= 0 && e.daysLeft <= horizonDays);

  // Ingreso esperado: cada vez que cae el día elegido dentro del horizonte.
  const incomeDays = new Map<number, number>();
  if (opts.income && opts.income.amount > 0 && opts.income.day >= 1 && opts.income.day <= 31) {
    for (let i = 0; i <= horizonDays; i++) {
      const d = new Date(base.getTime() + i * DAY);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      if (d.getDate() === Math.min(opts.income.day, last)) incomeDays.set(i, opts.income.amount);
    }
  }

  let balance = start, totalDues = 0, totalSpend = 0, totalIncome = 0;
  const points: ForecastPoint[] = [];
  let min = { balance: start, date: ymd(base) };
  let firstNegative: string | null = null;
  for (let i = 0; i <= horizonDays; i++) {
    const date = ymd(new Date(base.getTime() + i * DAY));
    const events: ForecastPoint['events'] = [];
    if (i > 0) { balance -= dailySpend; totalSpend += dailySpend; }
    for (const e of dues.filter(x => x.daysLeft === i)) {
      balance -= e.amount as number; totalDues += e.amount as number;
      events.push({ label: e.label, amount: -(e.amount as number) });
    }
    const inc = incomeDays.get(i);
    if (inc) { balance += inc; totalIncome += inc; events.push({ label: 'Ingreso esperado', amount: inc }); }
    const b = Math.round(balance);
    points.push({ date, balance: b, events });
    if (b < min.balance) min = { balance: b, date };
    if (b < 0 && firstNegative === null) firstNegative = date;
  }
  return {
    points, end: points[points.length - 1].balance, min, firstNegative,
    totalDues: Math.round(totalDues), totalSpend: Math.round(totalSpend), totalIncome: Math.round(totalIncome),
  };
}
