import { NextRequest, NextResponse } from 'next/server';
import { LEGAL } from '@/lib/legal';
import { referralLink } from '@/lib/referral';
import { handleError, requireAdminClient, requireUser } from '@/lib/server/guard';
import { ensureCode, referralStats, registerReferral } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';

/** Mi código, mi link y cuántos invité. */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(req, { needAccess: false, rateKey: 'ref', rateMax: 30 });
    const admin = requireAdminClient();
    const code = await ensureCode(admin, user.id);
    const stats = await referralStats(admin, user.id);
    return NextResponse.json({ code, link: referralLink(LEGAL.site, code), ...stats });
  } catch (error) {
    return handleError(error, 'Error de referidos:');
  }
}

/** El usuario nuevo avisa con qué código llegó. Siempre responde ok para no revelar qué códigos existen. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(req, { needAccess: false, rateKey: 'refpost', rateMax: 10 });
    const admin = requireAdminClient();
    const { code } = await req.json().catch(() => ({}));
    const r = await registerReferral(admin, user.id, user.created_at, code);
    return NextResponse.json({ ok: true, applied: r.ok });
  } catch (error) {
    return handleError(error, 'Error de referidos:');
  }
}
