import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { PLAN_PROMO_PRICE, PlanId, todayLocal } from '@/lib/config';
import {
  GEMINI_MODEL,
  IMAGE_OR_PDF,
  getAI,
  handleError,
  parseModelJson,
  readUpload,
  requireAdminClient,
  requireUser,
} from '@/lib/server/guard';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_DAYS_OLD = 7; // antigüedad máxima aceptada del comprobante

const normalizeAlias = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function POST(req: NextRequest) {
  try {
    // Usuarios con prueba vencida deben poder pagar, por eso needAccess = false.
    const { user } = await requireUser(req, {
      needAccess: false,
      rateKey: 'pay',
      rateMax: 6,
      rateWindowMs: 60 * 60 * 1000,
    });
    const admin = requireAdminClient();

    const formData = await req.formData();
    const planRaw = String(formData.get('plan') || 'pro');
    const plan: PlanId = planRaw === 'base' ? 'base' : 'pro';
    const expected = PLAN_PROMO_PRICE[plan];

    const { buffer, mimeType } = await readUpload(formData.get('file') as File | null, IMAGE_OR_PDF);
    const hash = createHash('sha256').update(buffer).digest('hex');

    // 1) Mismo archivo ya usado en otro pago válido
    const { data: dupHash } = await admin
      .from('payment_receipts')
      .select('id')
      .eq('receipt_hash', hash)
      .neq('admin_status', 'rejected')
      .eq('ai_status', 'approved_by_ai')
      .limit(1);
    if (dupHash && dupHash.length > 0) {
      throw new Error('DUP_FILE');
    }

    const today = todayLocal();
    const prompt = `
Sos el auditor de cobros automatizado de DRM-IA Finanzas.
Fecha de hoy: ${today} (zona horaria Argentina).
Analizá este comprobante de transferencia bancaria / billetera virtual (Mercado Pago, Banco Nación, etc.).

Extraé con precisión (solo lo que se ve en la imagen, sin inventar):
- amount: monto transferido (número positivo, sin símbolos; punto decimal).
- transfer_date: fecha de la operación (YYYY-MM-DD).
- operation_number: número de operación / comprobante / referencia (string; vacío si no figura).
- sender_name: nombre o CUIT de quien transfiere.
- destination: alias, CBU o titular de destino tal como figura.
- is_valid_transfer: true SOLO si es un comprobante legible, de aspecto auténtico y el destino es el alias "drm-ia" o el titular Dionicio Rafael Martin. false si es ilegible, sospechoso, editado o de otro destinatario.
- reason: explicación breve (una línea).

Respondé únicamente un JSON con estas claves exactas.`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, prompt],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number' },
            transfer_date: { type: 'string' },
            operation_number: { type: 'string' },
            sender_name: { type: 'string' },
            destination: { type: 'string' },
            is_valid_transfer: { type: 'boolean' },
            reason: { type: 'string' },
          },
          required: ['amount', 'transfer_date', 'destination', 'is_valid_transfer', 'reason'],
        } as any,
      },
    });

    const a = parseModelJson<any>(response.text);
    const amount = Number(a.amount) || 0;
    const opNumber = String(a.operation_number || '').trim();
    const destination = String(a.destination || '');

    // 2) Controles determinísticos (la IA solo extrae, no decide sola)
    const reasons: string[] = [];
    if (a.is_valid_transfer !== true) reasons.push(`La IA no lo validó: ${a.reason || 'sin detalle'}`);

    const destNorm = normalizeAlias(destination);
    if (!(destNorm.includes('drmia') || destNorm.includes('dionicio'))) {
      reasons.push(`El destino "${destination || 'no detectado'}" no coincide con el alias drm-ia.`);
    }
    if (amount < expected) {
      reasons.push(`Monto $${amount.toLocaleString('es-AR')} menor al del plan ($${expected.toLocaleString('es-AR')}).`);
    }

    const tDate = /^\d{4}-\d{2}-\d{2}$/.test(String(a.transfer_date)) ? String(a.transfer_date) : '';
    if (!tDate) {
      reasons.push('No se pudo leer la fecha de la transferencia.');
    } else {
      const diffDays = (new Date(today).getTime() - new Date(tDate).getTime()) / 86400000;
      if (diffDays > MAX_DAYS_OLD) reasons.push(`El comprobante tiene más de ${MAX_DAYS_OLD} días de antigüedad.`);
      if (diffDays < -1) reasons.push('La fecha del comprobante es futura.');
    }

    if (opNumber) {
      const { data: dupOp } = await admin
        .from('payment_receipts')
        .select('id')
        .eq('operation_number', opNumber)
        .neq('admin_status', 'rejected')
        .eq('ai_status', 'approved_by_ai')
        .limit(1);
      if (dupOp && dupOp.length > 0) reasons.push('Ese número de operación ya fue utilizado.');
    }

    const approved = reasons.length === 0;

    const { data: inserted, error: insertError } = await admin
      .from('payment_receipts')
      .insert([
        {
          user_id: user.id,
          user_email: user.email,
          amount,
          transfer_date: tDate || today,
          sender_name: String(a.sender_name || 'No determinado'),
          alias_destination: destination || 'No determinado',
          operation_number: opNumber || null,
          receipt_hash: hash,
          plan,
          ai_status: approved ? 'approved_by_ai' : 'rejected_by_ai',
          ai_notes: `Plan: ${plan.toUpperCase()} (Promo 40% OFF). ${
            approved ? 'Aprobado: ' + (a.reason || 'controles OK') : 'Rechazado: ' + reasons.join(' | ')
          }`,
          admin_status: 'pending',
        },
      ])
      .select()
      .single();
    if (insertError) throw new Error('No se pudo registrar el comprobante: ' + insertError.message);

    return NextResponse.json({ approved, reasons, receipt: inserted });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUP_FILE') {
      return NextResponse.json({ error: 'Ese comprobante ya fue utilizado en otro pago.' }, { status: 409 });
    }
    return handleError(error, 'Error verificando comprobante:');
  }
}
