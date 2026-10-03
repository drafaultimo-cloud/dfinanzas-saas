import { NextRequest, NextResponse } from 'next/server';
import { requireAdminClient } from '@/lib/server/guard';
import { formatArs, upcomingEvents, ymd } from '@/lib/planning';
import { DEFAULT_USD_RATE } from '@/lib/config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Vercel Cron llama a esta ruta una vez por día con "Authorization: Bearer <CRON_SECRET>".
// Envía un email (Resend) a quienes activaron recordatorios y tienen algo por vencer ese día.
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const resendKey = process.env.RESEND_API_KEY || '';
  const from = process.env.REMINDER_FROM || 'DRM-IA Finanzas <onboarding@resend.dev>';
  const admin = requireAdminClient();

  // "Hoy" en Argentina (el servidor corre en UTC)
  const nowAr = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const todayStr = ymd(nowAr);

  const { data: prefs, error } = await admin.from('reminder_prefs').select('*').eq('email_enabled', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { checked: prefs?.length || 0, sent: 0, skipped: 0, dryRun: !resendKey, errors: [] as string[] };
  for (const pref of prefs || []) {
    try {
      if (pref.last_sent_on === todayStr) { result.skipped++; continue; }
      const [cards, loans, recurring] = await Promise.all([
        admin.from('credit_cards').select('*').eq('user_id', pref.user_id),
        admin.from('loans').select('*').eq('user_id', pref.user_id),
        admin.from('recurring_items').select('*').eq('user_id', pref.user_id),
      ]);
      const daysBefore = Number(pref.days_before ?? 3);
      // Se avisa el día de la anticipación elegida y el mismo día del vencimiento (no todos los días).
      const events = upcomingEvents(cards.data || [], loans.data || [], recurring.data || [], nowAr, Math.max(daysBefore, 0), DEFAULT_USD_RATE)
        .filter(e => e.daysLeft === daysBefore || e.daysLeft === 0);
      if (events.length === 0) { result.skipped++; continue; }

      const { data: u } = await admin.auth.admin.getUserById(pref.user_id);
      const to = u?.user?.email;
      if (!to) { result.skipped++; continue; }

      const rows = events.map(e => `<tr><td style="padding:6px 10px">${escapeHtml(e.label)}</td><td style="padding:6px 10px">${e.date.split('-').reverse().join('/')}</td><td style="padding:6px 10px;text-align:right">${e.amount ? formatArs(e.amount) : ''}</td><td style="padding:6px 10px">${e.daysLeft === 0 ? '<b>HOY</b>' : `en ${e.daysLeft} días`}</td></tr>`).join('');
      const html = `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2 style="margin:0 0 8px">Vencimientos próximos</h2>
<p style="margin:0 0 12px;color:#475569">Esto vence en los próximos días según lo que cargaste en DRM-IA Finanzas:</p>
<table style="border-collapse:collapse;border:1px solid #e2e8f0;font-size:14px">${rows}</table>
<p style="margin-top:16px;font-size:12px;color:#64748b">Podés cambiar o desactivar estos avisos en Planificación → Vencimientos.</p></div>`;

      if (!resendKey) { result.sent++; continue; } // modo prueba: no hay clave de envío
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: `Vencimientos: ${events[0].label}${events.length > 1 ? ` y ${events.length - 1} más` : ''}`, html }),
      });
      if (!r.ok) { result.errors.push(`${pref.user_id}: ${r.status} ${(await r.text()).slice(0, 120)}`); continue; }
      await admin.from('reminder_prefs').update({ last_sent_on: todayStr }).eq('user_id', pref.user_id);
      result.sent++;
    } catch (e) {
      result.errors.push(`${pref.user_id}: ${e instanceof Error ? e.message : 'error'}`);
    }
  }
  return NextResponse.json(result);
}
