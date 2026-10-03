import { NextRequest, NextResponse } from 'next/server';
import { computeAccess, FREE_GRANT, isAdminEmail, isFreeGrant } from '@/lib/access';
import { ApiError, handleError, requireAdmin, requireAdminClient } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

/** Panel de superusuario: comprobantes + lista real de usuarios registrados.
 *  La autorización se valida acá (token + email admin), no en el navegador. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const admin = requireAdminClient();

    const { data: receipts, error } = await admin
      .from('payment_receipts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, 'No se pudieron leer los comprobantes.');

    const users: { user_id: string; user_email: string; created_at: string }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error: uErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (uErr) throw new ApiError(500, 'No se pudo leer la lista de usuarios.');
      for (const u of data.users) {
        if (u.email && !isAdminEmail(u.email)) {
          users.push({ user_id: u.id, user_email: u.email, created_at: u.created_at });
        }
      }
      if (data.users.length < 1000) break;
    }

    return NextResponse.json({ receipts: receipts || [], users });
  } catch (error) {
    return handleError(error, 'Error en panel admin:');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const admin = requireAdminClient();
    const { id, status } = await req.json().catch(() => ({}));
    if (!id || !['verified', 'rejected', 'pending'].includes(status)) {
      throw new ApiError(400, 'Datos inválidos.');
    }
    const { error } = await admin.from('payment_receipts').update({ admin_status: status }).eq('id', id);
    if (error) throw new ApiError(500, 'No se pudo actualizar el comprobante.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, 'Error actualizando comprobante:');
  }
}

/** Cancelar la suscripción de un usuario (falta de pago / comprobante falso):
 *  rechaza sus comprobantes vigentes, del más nuevo al más viejo, hasta que deje de figurar como pago.
 *  Sus próximos comprobantes quedarán en revisión manual (ver verify-payment). */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const admin = requireAdminClient();
    const { user_id, action } = await req.json().catch(() => ({}));
    if (!user_id || !['cancel', 'grant_free', 'revoke_free'].includes(action)) throw new ApiError(400, 'Datos inválidos.');

    const { data: au, error: uErr } = await admin.auth.admin.getUserById(String(user_id));
    if (uErr || !au?.user) throw new ApiError(404, 'Usuario no encontrado.');
    if (isAdminEmail(au.user.email)) throw new ApiError(400, 'No se puede cancelar una cuenta administradora.');

    const { data: receipts, error } = await admin
      .from('payment_receipts')
      .select('*')
      .eq('user_id', au.user.id)
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, 'No se pudieron leer los comprobantes.');

    if (action === 'grant_free') {
      if ((receipts || []).some(isFreeGrant)) return NextResponse.json({ ok: true, already: true });
      const { error: insErr } = await admin.from('payment_receipts').insert([{
        user_id: au.user.id,
        user_email: au.user.email,
        amount: 0,
        transfer_date: new Date().toISOString().slice(0, 10),
        sender_name: 'Cortesía DRM-IA',
        alias_destination: 'Acceso gratuito otorgado por el administrador',
        operation_number: null,
        receipt_hash: null,
        plan: 'pro',
        ai_status: FREE_GRANT,
        ai_notes: 'Plan: PRO. Acceso gratuito (cortesía) otorgado manualmente.',
        admin_status: 'verified',
      }]);
      if (insErr) throw new ApiError(500, 'No se pudo otorgar el acceso gratuito: ' + insErr.message);
      return NextResponse.json({ ok: true });
    }
    if (action === 'revoke_free') {
      // Se borra la fila (no se "rechaza") para no marcar al usuario como pagador conflictivo.
      const ids = (receipts || []).filter(isFreeGrant).map(x => x.id);
      if (ids.length) {
        const { error: delErr } = await admin.from('payment_receipts').delete().in('id', ids);
        if (delErr) throw new ApiError(500, 'No se pudo quitar el acceso gratuito.');
      }
      return NextResponse.json({ ok: true });
    }

    let rows = receipts || [];
    const stateOf = () =>
      computeAccess({ email: au.user.email, createdAt: au.user.created_at, receipts: rows }).status;
    if (rows.some(isFreeGrant)) throw new ApiError(400, 'Tiene acceso gratuito: usá "Quitar gratis".');
    if (stateOf() !== 'paid') throw new ApiError(400, 'El usuario no tiene una suscripción paga vigente.');

    const cancelled: string[] = [];
    for (const r of [...rows]) {
      if (stateOf() !== 'paid') break;
      if (r.admin_status === 'rejected') continue;
      const valid = r.admin_status === 'verified' || r.ai_status === 'approved_by_ai';
      if (!valid) continue;
      const { error: upErr } = await admin.from('payment_receipts').update({ admin_status: 'rejected' }).eq('id', r.id);
      if (upErr) throw new ApiError(500, 'No se pudo cancelar el comprobante.');
      rows = rows.map(x => (x.id === r.id ? { ...x, admin_status: 'rejected' } : x));
      cancelled.push(r.id);
    }
    return NextResponse.json({ ok: true, cancelled: cancelled.length, status: stateOf() });
  } catch (error) {
    return handleError(error, 'Error cancelando suscripción:');
  }
}
