import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se adjuntó ningún comprobante' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    const prompt = `
Eres el auditor de cobros automatizado de DRMIA Finanzas.
Analiza este comprobante de transferencia bancaria / billetera virtual (Mercado Pago, BNA, etc.).

Tu objetivo es verificar si la transferencia fue enviada correctamente a DRMIA:
- Alias de destino esperado: "drm-ia" (o variaciones razonables vinculadas a Rafael / Dionicio).
- Extrae con precisión:
  1. amount: Monto transferido (número positivo limpio, sin símbolos).
  2. transfer_date: Fecha de la operación (YYYY-MM-DD).
  3. sender_name: Nombre o CUIT de quien transfiere.
  4. destination: Alias, CBU o titular de destino detectado.
  5. is_valid_transfer: true si parece un comprobante auténtico y reciente con destino a drm-ia, false si es sospechoso, ilegible o de otro destinatario.
  6. reason: Breve explicación del veredicto para el panel de auditoría.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "amount": 0.0,
  "transfer_date": "YYYY-MM-DD",
  "sender_name": "Nombre",
  "destination": "drm-ia",
  "is_valid_transfer": true,
  "reason": "Explicación breve"
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data,
          },
        },
        prompt,
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error('Error verificando comprobante:', error);
    return NextResponse.json({ error: error.message || 'Error al validar comprobante' }, { status: 500 });
  }
}