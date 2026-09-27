import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let contentsPayload: any[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.raw_text) {
        return NextResponse.json({ error: 'No se envió texto para analizar' }, { status: 400 });
      }

      const prompt = `
Analiza el siguiente texto o planilla desordenada de finanzas personales.
Extrae todas las transacciones individuales (ingresos y gastos).
Texto a analizar:
"${body.raw_text}"

Para cada registro determina:
- description: Detalle o comercio.
- amount: Monto numérico en positivo (flotante).
- type: 'income' si es sueldo o cobranza, 'expense' si es gasto.
- category: Supermercado, Servicios, Alimentos, Transporte, Tarjeta de Crédito, Préstamos, u Otros.
- date: Fecha en YYYY-MM-DD (si no indica fecha, usa la fecha actual).
`;
      contentsPayload = [prompt];
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 });

      const bytes = await file.arrayBuffer();
      const base64Data = Buffer.from(bytes).toString('base64');
      const prompt = `Analiza este resumen bancario y extrae todos los consumos con fecha, descripción, monto, cuota y categoría.`;

      contentsPayload = [
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data,
          },
        },
        prompt
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentsPayload,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bank_or_card: { type: Type.STRING },
            total_amount: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING },
                  category: { type: Type.STRING },
                  installment_number: { type: Type.INTEGER },
                  total_installments: { type: Type.INTEGER },
                },
                required: ['description', 'amount'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    return NextResponse.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error en Gemini' }, { status: 500 });
  }
}