// Hábitos de gasto (día de la semana, comercios) y pagos a tarjetas por mes. Lógica pura.
import { addMonths, cleanDesc, isRefundTx, isTransferTx, monthOf, payeeTokens, toArs, txProfile, type Profile, type Tx } from './planning';

const DAY = 86400000;
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const wd = (d: Date) => (d.getDay() + 6) % 7; // lunes = 0

const parse = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export interface WeekdayStat { day: string; total: number; count: number; perDay: number; share: number; }

/** Gasto por día de la semana en los `months` meses que terminan en `endMonth` (sin pagos de tarjeta ni transferencias). */
export function weekdayProfile(txs: Tx[], profile: Profile, usdRate: number, endMonth: string, months: number, today: Date): WeekdayStat[] {
  const startMonth = addMonths(endMonth, -(months - 1));
  const from = parse(`${startMonth}-01`);
  const monthEnd = new Date(Number(endMonth.slice(0, 4)), Number(endMonth.slice(5, 7)), 0);
  const to = new Date(Math.min(monthEnd.getTime(), new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()));
  const occurrences = Array(7).fill(0);
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) occurrences[wd(new Date(t))]++;

  const total = Array(7).fill(0), count = Array(7).fill(0);
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile || isTransferTx(t)) continue;
    const m = monthOf(t.date);
    if (m < startMonth || m > endMonth) continue;
    const i = wd(parse(t.date));
    const amt = toArs(Number(t.amount || 0), t.currency, usdRate);
    if (isRefundTx(t)) total[i] -= amt;
    else if (t.type === 'expense') { total[i] += amt; count[i]++; }
  }
  const sum = total.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return WEEKDAYS.map((day, i) => ({
    day, total: Math.round(Math.max(0, total[i])), count: count[i],
    perDay: occurrences[i] > 0 ? Math.round(Math.max(0, total[i]) / occurrences[i]) : 0,
    share: Math.round((Math.max(0, total[i]) / sum) * 1000) / 10,
  }));
}

export interface PayeeStat { name: string; total: number; count: number; }

/** Comercios/personas donde más plata dejaste. Agrupa por las palabras que identifican al comercio. */
export function topPayees(txs: Tx[], profile: Profile, usdRate: number, endMonth: string, months: number, top = 10): PayeeStat[] {
  const startMonth = addMonths(endMonth, -(months - 1));
  const map = new Map<string, PayeeStat & { names: Map<string, number> }>();
  for (const t of txs) {
    if (!t.date || txProfile(t) !== profile || isTransferTx(t) || t.type !== 'expense' || isRefundTx(t)) continue;
    const m = monthOf(t.date);
    if (m < startMonth || m > endMonth) continue;
    const desc = cleanDesc(t.description);
    if (!desc) continue;
    const key = payeeTokens(desc).slice(0, 2).join(' ') || desc.toLowerCase().slice(0, 18);
    const e = map.get(key) || { name: desc, total: 0, count: 0, names: new Map<string, number>() };
    e.total += toArs(Number(t.amount || 0), t.currency, usdRate);
    e.count++;
    e.names.set(desc, (e.names.get(desc) || 0) + 1);
    map.set(key, e);
  }
  return [...map.values()]
    .map(e => ({ name: [...e.names.entries()].sort((a, b) => b[1] - a[1])[0][0], total: Math.round(e.total), count: e.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, top);
}

/**
 * Plata pagada a tarjetas por mes (en pesos). Cuenta cada pago una sola vez:
 * la salida de la billetera hacia una tarjeta, o el "pago recibido" de la tarjeta si no está emparejado con una salida.
 */
export function cardPaymentsByMonth(txs: Tx[], endMonth: string, months: number): { month: string; paid: number }[] {
  const list = Array.from({ length: months }, (_, i) => addMonths(endMonth, i - (months - 1)));
  const acc: Record<string, number> = Object.fromEntries(list.map(m => [m, 0]));
  for (const t of txs) {
    if (!t.date || (t.currency || 'ARS') !== 'ARS' || !(t.operation_type === 'payment' || t.operation_type === 'transfer')) continue;
    const m = monthOf(t.date);
    if (!(m in acc)) continue;
    const walletToCard = t.type === 'expense' && !t.credit_card_id && typeof t.transfer_account === 'string' && t.transfer_account.startsWith('card:');
    const cardSideUnpaired = t.type === 'income' && !!t.credit_card_id && t.operation_type === 'payment' && !t.transfer_account;
    if (walletToCard || cardSideUnpaired) acc[m] += Number(t.amount || 0);
  }
  return list.map(month => ({ month, paid: Math.round(acc[month]) }));
}
