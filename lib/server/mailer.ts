// Envío de correos con Resend (API HTTP, sin dependencias). Sin RESEND_API_KEY no se envía nada.
import { createHmac, timingSafeEqual } from 'crypto';

export const mailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string, text: string, unsubscribeUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'Falta RESEND_API_KEY.' };
  const from = process.env.DIGEST_FROM || 'DRM-IA Finanzas <avisos@drm-ia.com>';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject, html, text,
        ...(unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'No se pudo enviar.' };
  }
}

// Link de baja firmado: no hace falta iniciar sesión para darse de baja.
const secret = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const unsubToken = (userId: string) => createHmac('sha256', secret()).update(`unsub:${userId}`).digest('hex').slice(0, 32);
export function checkUnsubToken(userId: string, token: string): boolean {
  if (!secret() || !token) return false;
  const a = Buffer.from(unsubToken(userId)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
