// Referidos en el servidor: código propio, alta del invitado y entrega del premio (usa la clave de servicio).
import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_GRANT } from '@/lib/access';
import { canBeReferred, generateCode, MAX_REWARDS, REFERRAL_BONUS, isValidCode, normalizeCode } from '@/lib/referral';

export async function ensureCode(admin: SupabaseClient, userId: string): Promise<string> {
  const { data } = await admin.from('referral_codes').select('code').eq('user_id', userId).maybeSingle();
  if (data?.code) return data.code as string;
  for (let i = 0; i < 6; i++) {
    const code = generateCode();
    const { error } = await admin.from('referral_codes').insert([{ user_id: userId, code }]);
    if (!error) return code;
    // Puede ser un código repetido o que otra pestaña lo haya creado justo antes.
    const again = await admin.from('referral_codes').select('code').eq('user_id', userId).maybeSingle();
    if (again.data?.code) return again.data.code as string;
  }
  throw new Error('No se pudo generar tu código de invitación.');
}

export async function referralStats(admin: SupabaseClient, userId: string) {
  const { data } = await admin.from('referrals').select('referred_id, rewarded_at').eq('referrer_id', userId);
  const rows = data || [];
  return { invited: rows.length, rewarded: rows.filter(r => r.rewarded_at).length };
}

/** Registra que `referredId` llegó con el código de otra persona. Devuelve un motivo si no se pudo. */
export async function registerReferral(admin: SupabaseClient, referredId: string, referredCreatedAt: string | undefined, rawCode: unknown):
  Promise<{ ok: true } | { ok: false; reason: string }> {
  const code = normalizeCode(rawCode);
  if (!isValidCode(code)) return { ok: false, reason: 'invalid' };
  if (!canBeReferred(referredCreatedAt)) return { ok: false, reason: 'old_account' };
  const { data: owner } = await admin.from('referral_codes').select('user_id').eq('code', code).maybeSingle();
  if (!owner?.user_id) return { ok: false, reason: 'unknown_code' };
  if (owner.user_id === referredId) return { ok: false, reason: 'self' };
  const { error } = await admin.from('referrals').insert([{ referrer_id: owner.user_id, referred_id: referredId }]);
  if (error) return { ok: false, reason: 'already' };
  return { ok: true };
}

/**
 * Entrega el premio (un mes Pro) a quien invitó a `referredId`, una sola vez, cuando el admin verifica su primer pago real.
 * No cuenta: acceso gratis, bonos ni comprobantes sin importe.
 */
export async function rewardReferrer(admin: SupabaseClient, receipt: { user_id: string; amount?: number | string | null; ai_status?: string | null }) {
  if (!receipt || !(Number(receipt.amount) > 0) || receipt.ai_status === FREE_GRANT || receipt.ai_status === REFERRAL_BONUS) return { rewarded: false };
  const { data: ref } = await admin.from('referrals').select('id, referrer_id, rewarded_at').eq('referred_id', receipt.user_id).maybeSingle();
  if (!ref || ref.rewarded_at) return { rewarded: false };

  const { count } = await admin.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', ref.referrer_id).not('rewarded_at', 'is', null);
  if ((count || 0) >= MAX_REWARDS) return { rewarded: false };

  // "Reclama" el premio con un UPDATE condicional: si dos verificaciones llegan juntas, solo una lo entrega.
  const { data: claimed } = await admin.from('referrals').update({ rewarded_at: new Date().toISOString() }).eq('id', ref.id).is('rewarded_at', null).select('id');
  if (!claimed || claimed.length === 0) return { rewarded: false };

  const { data: au } = await admin.auth.admin.getUserById(ref.referrer_id);
  const { error } = await admin.from('payment_receipts').insert([{
    user_id: ref.referrer_id,
    user_email: au?.user?.email || null,
    amount: 0,
    transfer_date: new Date().toISOString().slice(0, 10),
    sender_name: 'Bono por referido',
    alias_destination: 'Un amigo que invitaste se suscribió',
    operation_number: null,
    receipt_hash: null,
    plan: 'pro',
    ai_status: REFERRAL_BONUS,
    ai_notes: 'Plan: PRO. Un mes de regalo por invitar a un amigo que se suscribió.',
    admin_status: 'verified',
  }]);
  if (error) {
    await admin.from('referrals').update({ rewarded_at: null }).eq('id', ref.id); // se devuelve el reclamo
    console.error('No se pudo entregar el premio de referido:', error.message);
    return { rewarded: false };
  }
  return { rewarded: true, referrerId: ref.referrer_id };
}
