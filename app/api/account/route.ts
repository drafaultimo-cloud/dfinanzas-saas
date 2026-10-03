import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/access';
import { ApiError, handleError, requireAdminClient, requireUser } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

// Tablas con datos del usuario y la columna que lo identifica.
// payment_receipts NO se borra: puede ser necesario conservar los pagos por normas contables.
const OWN_TABLES: [string, string][] = [
  ['transactions', 'user_id'],
  ['credit_cards', 'user_id'],
  ['loans', 'user_id'],
  ['budgets', 'user_id'],
  ['recurring_items', 'user_id'],
  ['savings_goals', 'user_id'],
  ['category_rules', 'user_id'],
  ['net_worth_snapshots', 'user_id'],
  ['reminder_prefs', 'user_id'],
  ['user_categories', 'user_id'],
  ['ai_usage', 'user_id'],
  ['shares', 'owner_id'],
  ['user_support_chats', 'sender_id'],
  ['user_support_chats', 'receiver_id'],
];

/** Elimina la cuenta y todos los datos del usuario que hace el pedido. Irreversible. */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireUser(req, { needAccess: false, rateKey: 'acct', rateMax: 3, rateWindowMs: 60 * 60 * 1000 });
    if (isAdminEmail(user.email, (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean))) {
      throw new ApiError(403, 'Las cuentas de administración no se pueden eliminar desde acá.');
    }
    const body = await req.json().catch(() => ({}));
    if (String(body?.confirm || '').trim().toUpperCase() !== 'ELIMINAR') {
      throw new ApiError(400, 'Falta la confirmación. Escribí ELIMINAR para continuar.');
    }

    const admin = requireAdminClient();
    const failures: string[] = [];
    const run = async (label: string, p: PromiseLike<{ error: { code?: string; message: string } | null }>) => {
      const { error } = await p;
      // Si la tabla no existe en este proyecto, no es un fallo.
      if (error && !['42P01', 'PGRST205', 'PGRST204', '42703'].includes(error.code || '')) failures.push(`${label}: ${error.message}`);
    };

    for (const [table, col] of OWN_TABLES) await run(table, admin.from(table).delete().eq(col, user.id));
    // Accesos compartidos donde el usuario era el invitado
    if (user.email) await run('shares(member)', admin.from('shares').delete().ilike('member_email', user.email));
    // Tabla vieja de versiones anteriores (si existe)
    await run('payment_submissions', admin.from('payment_submissions').delete().eq('user_id', user.id));

    if (failures.length > 0) {
      console.error('Borrado de cuenta incompleto:', user.id, failures);
      throw new ApiError(500, 'No se pudieron borrar todos tus datos, por eso no eliminamos tu cuenta. Probá de nuevo o escribinos por el chat.');
    }

    // Baja "suave": la cuenta deja de existir para vos (ya no puede ingresar ni queda tu correo),
    // pero la fila se conserva internamente para no romper registros de pagos.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id, true);
    if (delErr) throw new ApiError(500, 'Se borraron tus datos pero no se pudo cerrar la cuenta: ' + delErr.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, 'Error eliminando cuenta:');
  }
}
