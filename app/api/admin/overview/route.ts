import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/access';
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
