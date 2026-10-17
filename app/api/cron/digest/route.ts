import { NextRequest, NextResponse } from 'next/server';
import { computeAccess } from '@/lib/access';
import { outstandingArs } from '@/lib/cards';
import { walletBalance } from '@/lib/wallets';
import { arDate, buildDigest, isWeeklyDay } from '@/lib/digest';
import { LEGAL } from '@/lib/legal';
import { handleError, requireAdminClient } from '@/lib/server/guard';
import { mailConfigured, sendEmail, unsubToken } from '@/lib/server/mailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const loanKind = (l: any) => l.kind || (l.balance_ars !== null && l.balance_ars !== undefined ? 'wallet' : 'loan');

async function usdRate(origin: string): Promise<number> {
  try {
    const r = await fetch(`${origin}/api/dolar`, { signal: AbortSignal.timeout(7000), cache: 'no-store' });
    const j = await r.json();
    return Number(j?.rates?.mep || j?.rates?.oficial || j?.rates?.blue || 1) || 1;
  } catch { return 1; }
}

/**
 * Lo corre Vercel Cron todos los días (ver vercel.json) con "Authorization: Bearer CRON_SECRET".
 * ?dry=1 arma los correos y cuenta cuántos enviaría, sin enviar nada. ?weekly=1 fuerza el resumen semanal.
 */
export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    const dry = req.nextUrl.searchParams.get('dry') === '1';
    if (!dry && !mailConfigured()) return NextResponse.json({ error: 'Falta RESEND_API_KEY.' }, { status: 500 });

    const admin = requireAdminClient();
    const now = new Date();
    const today = arDate(now);
    const weeklyDay = isWeeklyDay(now) || req.nextUrl.searchParams.get('weekly') === '1';
    const rate = await usdRate(req.nextUrl.origin);
    const started = Date.now();
    const out = { checked: 0, sent: 0, skipped: 0, failed: 0, dry };
    const appUrl = LEGAL.site;

    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const users = data?.users || [];
      for (const u of users) {
        if (Date.now() - started > 50_000) return NextResponse.json({ ...out, partial: true });
        if (!u.email || !u.email_confirmed_at) { out.skipped++; continue; }
        out.checked++;
        try {
          const { data: prefRow } = await admin.from('reminder_prefs').select('*').eq('user_id', u.id).maybeSingle();
          const prefs = { digest: prefRow?.digest_enabled ?? true, alerts: prefRow?.alerts_enabled ?? true, daysBefore: prefRow?.days_before ?? 3, lastAlert: prefRow?.last_alert_on, lastDigest: prefRow?.last_digest_on };
          if (!prefs.digest && !prefs.alerts) { out.skipped++; continue; }
          const wantWeekly = weeklyDay && prefs.digest && prefs.lastDigest !== today;
          const wantAlert = prefs.alerts && prefs.lastAlert !== today;
          if (!wantWeekly && !wantAlert) { out.skipped++; continue; }

          const { data: receipts } = await admin.from('payment_receipts').select('*').eq('user_id', u.id);
          const access = computeAccess({ email: u.email, createdAt: u.created_at, receipts: receipts || [] });
          if (access.status === 'expired') { out.skipped++; continue; }

          const [tx, cc, ln, rec, bud] = await Promise.all([
            admin.from('transactions').select('*').eq('user_id', u.id).order('date', { ascending: false }).limit(5000),
            admin.from('credit_cards').select('*').eq('user_id', u.id),
            admin.from('loans').select('*').eq('user_id', u.id),
            admin.from('recurring_items').select('*').eq('user_id', u.id).eq('active', true),
            admin.from('budgets').select('*').eq('user_id', u.id),
          ]);
          const txs = tx.data || [];
          if (txs.length === 0 && (cc.data || []).length === 0) { out.skipped++; continue; }
          const cards = (cc.data || []).map((c: any) => ({ ...c, balance_ars: outstandingArs(c, txs as any) }));
          const loans = (ln.data || []).map((l: any) => loanKind(l) === 'loan' ? l : { ...l, balance_ars: walletBalance(l, txs as any, 'ARS'), balance_usd: walletBalance(l, txs as any, 'USD') });

          const unsub = `${appUrl}/api/email-prefs?u=${u.id}&t=${unsubToken(u.id)}`;
          const mail = buildDigest({
            today: new Date(`${today}T12:00:00`), txs: txs as any, cards, loans, recurring: rec.data || [], budgets: bud.data || [],
            usdRate: rate, daysBefore: prefs.daysBefore, weekly: wantWeekly, appUrl,
            unsubscribeUrl: unsub, alertsEnabled: wantAlert, digestEnabled: wantWeekly,
          });
          if (!mail.hasContent) { out.skipped++; continue; }
          if (!dry) {
            const r = await sendEmail(u.email, mail.subject, mail.html, mail.text, unsub);
            if (!r.ok) { out.failed++; console.error('Correo no enviado:', r.error); continue; }
            await admin.from('reminder_prefs').upsert([{
              user_id: u.id, email_enabled: prefRow?.email_enabled ?? false, days_before: prefs.daysBefore,
              digest_enabled: prefs.digest, alerts_enabled: prefs.alerts,
              last_alert_on: wantAlert ? today : prefs.lastAlert ?? null, last_digest_on: wantWeekly ? today : prefs.lastDigest ?? null,
            }]);
          }
          out.sent++;
        } catch (e: any) { out.failed++; console.error('Resumen falló para un usuario:', e?.message); }
      }
      if (users.length < 200) break;
    }
    return NextResponse.json(out);
  } catch (error) {
    return handleError(error, 'Error en el resumen por correo:');
  }
}
