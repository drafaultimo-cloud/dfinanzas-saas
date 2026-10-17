// Armado del correo de avisos (diario, solo si hay algo) y resumen semanal (lunes). Lógica pura: sin red ni base de datos.
import { budgetStatus, currentMonthOf, dailyDigest, formatArs, upcomingEvents } from './planning';
import type { Tx } from './planning';

export interface DigestInput {
  today: Date;
  txs: Tx[];
  cards: Tx[];          // ya con saldo efectivo
  loans: Tx[];          // ya con saldo efectivo
  recurring: Tx[];
  budgets: any[];
  usdRate: number;
  daysBefore: number;   // con cuántos días de aviso se avisa un vencimiento (0-15)
  weekly: boolean;      // true = además va el resumen semanal
  appUrl: string;
  unsubscribeUrl: string;
  alertsEnabled: boolean;
  digestEnabled: boolean;
  profile?: 'personal' | 'business';
}

export interface DigestEmail { subject: string; html: string; text: string; hasContent: boolean; kinds: { alert: boolean; weekly: boolean } }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const when = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`);
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

export function buildDigest(i: DigestInput): DigestEmail {
  const profile = i.profile || 'personal';
  const month = currentMonthOf(i.today);
  const lines: { icon: string; text: string }[] = [];
  const weeklyLines: { icon: string; text: string }[] = [];

  // Avisos: vencimientos dentro de la ventana elegida y presupuestos pasados.
  if (i.alertsEnabled) {
    const horizon = Math.max(0, Math.min(15, i.daysBefore));
    const dues = upcomingEvents(i.cards, i.loans, i.recurring, i.today, horizon, i.usdRate).filter(e => e.kind !== 'card_close');
    for (const e of dues.slice(0, 6)) {
      lines.push({ icon: e.kind === 'card_due' ? '💳' : e.kind === 'loan' ? '🏦' : '🔁', text: `${e.label} vence ${when(e.daysLeft)} (${dm(e.date)})${e.amount !== undefined ? ` · ${formatArs(e.amount)}` : ''}` });
    }
    for (const b of budgetStatus(i.budgets, i.txs, month, profile, i.usdRate).filter(s => s.status === 'over').slice(0, 3)) {
      lines.push({ icon: '🚨', text: `${b.category}: te pasaste ${formatArs(b.spent - b.limit)} del tope del mes` });
    }
  }

  // Resumen semanal (lunes).
  if (i.weekly && i.digestEnabled) {
    const d = dailyDigest(i.txs, profile, i.usdRate, i.today);
    if (d.weekTotal > 0 || d.prevWeekTotal > 0) {
      const delta = d.prevWeekTotal > 0 ? Math.round((d.weekTotal / d.prevWeekTotal - 1) * 100) : null;
      weeklyLines.push({ icon: '📊', text: `Esta semana gastaste ${formatArs(d.weekTotal)}${delta === null ? '' : delta === 0 ? ' (igual que la anterior)' : ` (${delta > 0 ? '+' : ''}${delta}% vs la anterior: ${formatArs(d.prevWeekTotal)})`}` });
    }
    const next = upcomingEvents(i.cards, i.loans, i.recurring, i.today, 7, i.usdRate).filter(e => e.kind !== 'card_close');
    if (next.length > 0) {
      const total = next.reduce((a, e) => a + (e.amount || 0), 0);
      weeklyLines.push({ icon: '🗓️', text: `Esta semana vencen ${next.length} pago${next.length === 1 ? '' : 's'}${total > 0 ? ` por ${formatArs(total)}` : ''}: ${next.slice(0, 4).map(e => e.label).join(', ')}` });
    }
    const warn = budgetStatus(i.budgets, i.txs, month, profile, i.usdRate).filter(s => s.status === 'warn');
    if (warn.length > 0) weeklyLines.push({ icon: '⚠️', text: `Presupuestos cerca del tope: ${warn.slice(0, 3).map(b => `${b.category} (${Math.round(b.pct)}%)`).join(', ')}` });
    if (d.daysSinceLast !== null && d.daysSinceLast >= 4) weeklyLines.push({ icon: '📝', text: `Hace ${d.daysSinceLast} días que no cargás movimientos. Un minuto hoy y tus números vuelven a ser reales.` });
  }

  const hasAlert = lines.length > 0;
  const hasWeekly = weeklyLines.length > 0;
  const hasContent = hasAlert || hasWeekly;
  const subject = hasWeekly
    ? `Tu resumen semanal${hasAlert ? ' y avisos' : ''} · DRM-IA Finanzas`
    : `Aviso: ${lines[0]?.text.split(' vence')[0] || 'tenés pendientes'}${lines.length > 1 ? ` y ${lines.length - 1} más` : ''}`;

  const block = (title: string, rows: { icon: string; text: string }[]) => rows.length === 0 ? '' :
    `<h2 style="font-size:15px;margin:20px 0 8px;color:#0B192C">${title}</h2>` +
    rows.map(r => `<p style="margin:0 0 8px;padding:10px 12px;background:#F1F5F9;border-radius:10px;font-size:14px;color:#1e293b">${r.icon} ${esc(r.text)}</p>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#fff;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:20px">
<p style="font-size:13px;color:#64748b;margin:0 0 4px">DRM-IA Finanzas</p>
${block('Avisos', lines)}${block('Tu semana', weeklyLines)}
<p style="margin:22px 0"><a href="${esc(i.appUrl)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-size:14px;font-weight:600">Abrir la app</a></p>
<p style="font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px">Recibís este correo porque tenés cuenta en DRM-IA Finanzas. <a href="${esc(i.unsubscribeUrl)}" style="color:#94a3b8">Dejar de recibir estos correos</a>.</p>
</div></body></html>`;
  const text = [...lines.map(l => `${l.icon} ${l.text}`), ...weeklyLines.map(l => `${l.icon} ${l.text}`), '', `Abrir la app: ${i.appUrl}`, `Dejar de recibir: ${i.unsubscribeUrl}`].join('\n');

  return { subject, html, text, hasContent, kinds: { alert: hasAlert, weekly: hasWeekly } };
}

/** Lunes (hora Argentina) = día del resumen semanal. */
export function isWeeklyDay(now: Date): boolean {
  const ar = new Date(now.getTime() - 3 * 3600 * 1000);
  return ar.getUTCDay() === 1;
}
/** Fecha YYYY-MM-DD en hora Argentina (UTC-3). */
export function arDate(now: Date): string {
  return new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
