import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { GEMINI_MODEL, IMAGE_OR_PDF, getAI, generateWithRetry, handleError, readUpload, requireUser } from '@/lib/server/guard';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let release: () => Promise<void> = async () => {};
  try {
    ({ release } = await requireUser(req, { needPro: true, rateKey: 'scan', rateMax: 20, quota: 'scan' }));

    const formData = await req.formData();
    const { buffer, mimeType } = await readUpload(formData.get('file') as File | null, IMAGE_OR_PDF);

    const ai = getAI();
    const response = await generateWithRetry(ai, {
      model: GEMINI_MODEL,
      contents: [
        { inlineData: { mimeType, data: buffer.toString('base64') } },
        'Extrae el comercio o concepto principal, el monto total pagado y clasifícalo en una de estas categorías: Alimentos, Transporte, Servicios, Entretenimiento, Salud, Otros.',
      ],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Nombre del comercio o concepto del ticket' },
            amount: { type: Type.NUMBER, description: 'Monto total pagado' },
            category: {
              type: Type.STRING,
              enum: ['Alimentos', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Otros'],
            },
          },
          required: ['description', 'amount', 'category'],
        },
      },
    });

    return NextResponse.json(JSON.parse(response.text || '{}'));
  } catch (error) {
    await release().catch(() => {}); // si falló, no se descuenta el uso del mes
    return handleError(error, 'Error analizando ticket:');
  }
}
