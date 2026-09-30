import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    let rawText = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      const mimeType = file.type || 'application/pdf';

      const prompt = `
Analiza este resumen bancario, de tarjeta de crédito o extracto de billetera digital (como Naranja X, Mercado Pago, BNA, etc.).
Extrae TODOS los movimientos y transacciones en formato JSON estricto con las siguientes reglas:
1. DETECCIÓN DE REINTEGROS / NOTAS DE CRÉDITO:
   - Si un movimiento tiene signo negativo ("-"), dice "NOTA DE CREDITO", "REINTEGRO" o "DEVOLUCION", márcalo con type: "income", is_refund: true, y coloca la descripción indicando "[REINTEGRO]". Ejemplo: "NOTA DE CREDITO GOOGLE Google One".
2. DETECCIÓN DE MONEDA:
   - Si está en dólares (U$S / USD), indica currency: "USD", de lo contrario "ARS".
3. CLASIFICACIÓN DE RUBRO INTELIGENTE:
   - Asigna uno de: "Supermercado", "Servicios", "Alimentos", "Transporte", "Tarjeta de Crédito", "Préstamos", "Otros".
   - Si el concepto es ambiguo o desconocido (ej: transferencias a particulares, códigos extraños o comercios no identificables), asigna EXACTAMENTE: "Por Clasificar".
4. ESTRUCTURA DE RESPUESTA:
Devuelve un JSON con:
{
  "entity_name": "Nombre de la tarjeta o billetera (ej: Naranja X, Banco Nación)",
  "period": "Mes y año (ej: 2026-09)",
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "Texto del consumo o reintegro",
      "amount": 1234.56,
      "type": "expense" | "income",
      "is_refund": false | true,
      "currency": "ARS" | "USD",
      "category": "Rubro detectado o Por Clasificar",
      "installment_number": 1,
      "total_installments": 1
    }
  ]
}
No agregues formato markdown extra, solo el bloque JSON.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: { temperature: 0.1 }
      });

      const cleanJson = (response.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
      return NextResponse.json(JSON.parse(cleanJson));
    } else {
      const { raw_text } = await req.json();
      rawText = raw_text || '';

      const prompt = `
Analiza el siguiente texto de un extracto o planilla financiera y extrae los movimientos con las reglas de reintegros y rubro "Por Clasificar" cuando sea dudoso. Devuelve solo JSON.
Texto:
${rawText}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [prompt],
        config: { temperature: 0.1 }
      });

      const cleanJson = (response.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
      return NextResponse.json(JSON.parse(cleanJson));
    }
  } catch (error: any) {
    console.error('Error procesando extracto:', error);
    return NextResponse.json({ error: error.message || 'Error en IA' }, { status: 500 });
  }
}