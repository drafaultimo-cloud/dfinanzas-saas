// "Cuánto puedo gastar hoy": plata disponible menos lo que vence antes del próximo ingreso, repartido por día. Lógica pura.
import { isRefundTx, isTransferTx, nextOccurrence, toArs, txProfile, ymd, type DueEvent, type Profile, type Tx } from './planning';
import type { ExpectedIncome } from './forecast';

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface SafeToSpend {
  available: number;        // billeteras + efectivo en pesos
  duesTotal: number;        // vencimientos hasta el final del período
  horizonDays: number;      // días que hay que estirar la plata (incluye hoy)
  horizonEnd: string;       // día en que llega el próximo ingreso o empieza el mes siguiente (YYYY-MM-DD)
  horizonKind: 'income' | 'month';
  free: number;             // disponible − vencimientos (puede ser negativo)
  perDay: number;           // lo que podés gastar por día (0 si no alcanza)
  spentToday: number;       // lo que ya salió hoy de billeteras o efectivo
  leftToday: number;        // perDay − spentToday (puede ser negativo)
  shortfall: number;        // cuánto falta para cubrir los vencimientos (0 si alcanza)
  dues: { label: string; amount: number; daysLeft: number }[];
}

/** Gasto de hoy que sale de billeteras o efectivo (la tarjeta se paga al vencimiento y ya cuenta como vencimiento). */
export function spentTodayCash(txs: Tx[], profile: Profile, usdRate: number, today: Date): number {
  const day = ymd(today);
  let total = 0;
  for (const t of txs) {
    if (t.date !== day || t.credit_card_id || txProfile(t) !== profile || isTransferTx(t)) continue;
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) total -= amt;
    else if (t.type === 'expense') total += amt;
  }
  return Math.max(0, Math.round(total));
}

export function safeToSpend(opts: {
  available: number; events: DueEvent[]; today: Date; income?: ExpectedIncome | null; spentToday?: number;
}): SafeToSpend {
  const today = startOfDay(opts.today);

  // Hasta cuándo hay que estirar la plata: el próximo ingreso esperado, o el fin de mes.
  let end: Date; let kind: SafeToSpend['horizonKind'];
  if (opts.income && opts.income.amount > 0 && opts.income.day >= 1 && opts.income.day <= 31) {
    let next = nextOccurrence(opts.income.day, today);
    if (next.getTime() <= today.getTime()) next = nextOccurrence(opts.income.day, new Date(today.getTime() + DAY)); // cobrás hoy: el siguiente
    if (next.getTime() <= today.getTime()) next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    end = next; kind = 'income';
  } else {
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1); kind = 'month';
  }
  const horizonDays = Math.max(1, Math.round((end.getTime() - today.getTime()) / DAY));

  // Vencimientos que caen antes de que llegue la plata nueva (el día del ingreso ya cuenta con ella).
  const dues = opts.events
    .filter(e => e.kind !== 'card_close' && typeof e.amount === 'number' && (e.amount as number) > 0 && e.daysLeft >= 0 && e.daysLeft < horizonDays)
    .map(e => ({ label: e.label, amount: Math.round(e.amount as number), daysLeft: e.daysLeft }));
  const duesTotal = dues.reduce((a, d) => a + d.amount, 0);

  const available = Math.round(opts.available);
  const free = available - duesTotal;
  const perDay = free > 0 ? Math.floor(free / horizonDays) : 0;
  const spentToday = Math.round(opts.spentToday || 0);
  return {
    available, duesTotal, horizonDays, horizonEnd: ymd(end), horizonKind: kind,
    free, perDay, spentToday, leftToday: perDay - spentToday, shortfall: free < 0 ? -free : 0, dues,
  };
}
