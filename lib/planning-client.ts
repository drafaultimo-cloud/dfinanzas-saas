// Operaciones de planificación que hablan con Supabase desde el navegador.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUSINESS_TAG, currentMonthOf, daysInMonth, netWorthSnapshotRow, Tx, ymd } from './planning';

/**
 * Carga los recurrentes que ya vencieron este mes y todavía no se cargaron.
 * Antes de insertar "reclama" el mes con un UPDATE condicional, así dos pestañas abiertas no duplican.
 * Devuelve cuántos movimientos creó.
 */
export async function generateDueRecurring(supabase: SupabaseClient, userId: string, today = new Date()): Promise<number> {
  const month = currentMonthOf(today);
  const { data, error } = await supabase.from('recurring_items').select('*').eq('user_id', userId).eq('active', true);
  if (error || !data) return 0; // tabla sin crear: se ignora
  let created = 0;
  for (const r of data as Tx[]) {
    if (r.last_generated_month === month) continue;
    const day = Math.min(Number(r.day_of_month || 1), daysInMonth(today.getFullYear(), today.getMonth() + 1));
    if (today.getDate() < day) continue; // todavía no llegó el día
    const { data: claimed } = await supabase
      .from('recurring_items')
      .update({ last_generated_month: month })
      .eq('id', r.id)
      .or(`last_generated_month.is.null,last_generated_month.neq.${month}`)
      .select('id');
    if (!claimed || claimed.length === 0) continue; // otra pestaña ya lo cargó
    const date = ymd(new Date(today.getFullYear(), today.getMonth(), day));
    const isIncome = r.type === 'income';
    const desc = (r.profile === 'business' ? `${BUSINESS_TAG} ` : '') + r.description;
    const { error: insErr } = await supabase.from('transactions').insert([{
      user_id: userId,
      amount: Number(r.amount),
      currency: r.currency || 'ARS',
      operation_type: 'purchase',
      description: desc,
      type: isIncome ? 'income' : 'expense',
      category: isIncome ? 'Ingreso' : (r.category || 'Servicios'),
      income_source: isIncome ? 'other' : null,
      credit_card_id: r.credit_card_id || null,
      loan_id: r.loan_id || null,
      date,
      recurring_id: r.id,
    }]);
    if (insErr) {
      // si falló el alta, se libera el mes para reintentar
      await supabase.from('recurring_items').update({ last_generated_month: r.last_generated_month ?? null }).eq('id', r.id);
    } else created++;
  }
  return created;
}

/** Guarda (o actualiza) la foto del patrimonio del mes actual. Falla en silencio si la tabla no existe. */
export async function saveNetWorthSnapshot(supabase: SupabaseClient, userId: string, cards: Tx[], loans: Tx[], usdRate: number) {
  const row = netWorthSnapshotRow(userId, cards, loans, usdRate, new Date());
  await supabase.from('net_worth_snapshots').upsert([row], { onConflict: 'user_id,month' });
}
