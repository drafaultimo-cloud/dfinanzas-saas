import { NextRequest, NextResponse } from 'next/server';
import { handleError, requireAdminClient, requireUser } from '@/lib/server/guard';
import { checkUnsubToken } from '@/lib/server/mailer';

export const dynamic = 'force-dynamic';

const page = (msg: string) => new NextResponse(
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;max-width:420px;margin:15vh auto;padding:0 20px;text-align:center"><h2>${msg}</h2><p style="color:#64748b">Podés volver a activarlos cuando quieras desde Mi cuenta, dentro de la app.</p><p><a href="/">Ir a DRM-IA Finanzas</a></p></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

async function savePrefs(userId: string, patch: Record<string, any>) {
  const admin = requireAdminClient();
  const { data: cur } = await admin.from('reminder_prefs').select('*').eq('user_id', userId).maybeSingle();
  const { error } = await admin.from('reminder_prefs').upsert([{
    user_id: userId, email_enabled: cur?.email_enabled ?? false, days_before: cur?.days_before ?? 3,
    digest_enabled: cur?.digest_enabled ?? true, alerts_enabled: cur?.alerts_enabled ?? true,
    last_alert_on: cur?.last_alert_on ?? null, last_digest_on: cur?.last_digest_on ?? null, ...patch,
  }]);
  if (error) throw new Error(error.message);
}

/** Con ?u&t (link del correo): da de baja sin iniciar sesión. Con sesión: devuelve mis preferencias. */
export async function GET(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get('u') || '', t = req.nextUrl.searchParams.get('t') || '';
    if (u || t) {
      if (!checkUnsubToken(u, t)) return page('El link no es válido.');
      await savePrefs(u, { digest_enabled: false, alerts_enabled: false });
      return page('Listo, no te enviaremos más correos.');
    }
    const { user } = await requireUser(req, { needAccess: false, rateKey: 'prefs', rateMax: 30 });
    const { data } = await requireAdminClient().from('reminder_prefs').select('*').eq('user_id', user.id).maybeSingle();
    return NextResponse.json({ digest: data?.digest_enabled ?? true, alerts: data?.alerts_enabled ?? true, daysBefore: data?.days_before ?? 3 });
  } catch (error) {
    return handleError(error, 'Error de preferencias de correo:');
  }
}

/** One-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(req: NextRequest) {
  try {
    const u = req.nextUrl.searchParams.get('u') || '', t = req.nextUrl.searchParams.get('t') || '';
    if (u && t) {
      if (!checkUnsubToken(u, t)) return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
      await savePrefs(u, { digest_enabled: false, alerts_enabled: false });
      return NextResponse.json({ ok: true });
    }
    const { user } = await requireUser(req, { needAccess: false, rateKey: 'prefs', rateMax: 30 });
    const b = await req.json().catch(() => ({}));
    const patch: Record<string, any> = {};
    if (typeof b.digest === 'boolean') patch.digest_enabled = b.digest;
    if (typeof b.alerts === 'boolean') patch.alerts_enabled = b.alerts;
    if (Number.isInteger(b.daysBefore) && b.daysBefore >= 0 && b.daysBefore <= 15) patch.days_before = b.daysBefore;
    await savePrefs(user.id, patch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error, 'Error de preferencias de correo:');
  }
}
