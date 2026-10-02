import { DEFAULT_ADMIN_EMAILS, PAID_DAYS, PlanId, TRIAL_DAYS } from './config';

export type ReceiptRow = {
  created_at?: string | null;
  ai_status?: string | null;
  admin_status?: string | null;
  plan?: string | null;
  ai_notes?: string | null;
};

export type AccessState = {
  status: 'admin' | 'paid' | 'trial' | 'expired';
  plan: PlanId | null; // null = sin acceso
  trialDaysLeft: number;
  paidUntil: string | null; // ISO
};

const DAY_MS = 24 * 60 * 60 * 1000;

function receiptPlan(r: ReceiptRow): PlanId {
  if (r.plan === 'base' || r.plan === 'pro') return r.plan;
  // compatibilidad con filas viejas que solo guardaban el plan en ai_notes
  return /Plan:\s*(ESENCIAL|BASE)/i.test(r.ai_notes || '') ? 'base' : 'pro';
}

/** Un comprobante cuenta solo si no fue rechazado por el admin (el rechazo manual
 *  SIEMPRE gana sobre la IA) y fue aprobado por la IA o verificado por el admin. */
export function isReceiptValid(r: ReceiptRow): boolean {
  if (r.admin_status === 'rejected') return false;
  return r.admin_status === 'verified' || r.ai_status === 'approved_by_ai';
}

export function isAdminEmail(email?: string | null, extra: string[] = []): boolean {
  if (!email) return false;
  const list = [...DEFAULT_ADMIN_EMAILS, ...extra].map(e => e.toLowerCase());
  return list.includes(email.toLowerCase());
}

/** Única fuente de verdad del acceso. La usan el cliente (UI) y el servidor (APIs). */
export function computeAccess(params: {
  email?: string | null;
  createdAt?: string | null;
  receipts: ReceiptRow[];
  now?: Date;
  extraAdmins?: string[];
}): AccessState {
  const now = params.now ?? new Date();

  if (isAdminEmail(params.email, params.extraAdmins)) {
    return { status: 'admin', plan: 'pro', trialDaysLeft: TRIAL_DAYS, paidUntil: null };
  }

  // Pagos: se acumulan. Cada comprobante válido suma PAID_DAYS desde el mayor entre
  // su fecha de carga y el vencimiento anterior (pagar antes no pierde días).
  const valid = params.receipts
    .filter(isReceiptValid)
    .filter(r => r.created_at)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());

  let paidUntilMs = 0;
  let currentPlan: PlanId | null = null;
  for (const r of valid) {
    const start = Math.max(new Date(r.created_at!).getTime(), paidUntilMs);
    const end = start + PAID_DAYS * DAY_MS;
    if (new Date(r.created_at!).getTime() <= now.getTime()) {
      paidUntilMs = end;
      currentPlan = receiptPlan(r);
    }
  }
  if (paidUntilMs > now.getTime() && currentPlan) {
    return {
      status: 'paid',
      plan: currentPlan,
      trialDaysLeft: 0,
      paidUntil: new Date(paidUntilMs).toISOString(),
    };
  }

  const created = params.createdAt ? new Date(params.createdAt) : now;
  const daysSince = Math.floor(Math.max(0, now.getTime() - created.getTime()) / DAY_MS);
  const left = Math.max(0, TRIAL_DAYS - daysSince);
  if (left > 0) {
    return { status: 'trial', plan: 'pro', trialDaysLeft: left, paidUntil: null };
  }
  return {
    status: 'expired',
    plan: null,
    trialDaysLeft: 0,
    paidUntil: paidUntilMs ? new Date(paidUntilMs).toISOString() : null,
  };
}
