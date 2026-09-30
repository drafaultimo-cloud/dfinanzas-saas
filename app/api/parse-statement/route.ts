import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = file.type || 'application/pdf';

      const prompt = `
Analiza este extracto bancario o resumen de tarjeta de crédito (ej: Naranja X, Visa, Mastercard, Banco Nación).
Extrae TODOS los movimientos distinguiendo con total precisión:
1. OPERACIÓN:
   - "purchase": Compras, cuotas, intereses, comisiones o impuestos.
   - "payment": Pagos del resumen anterior ("PAGO EN PESOS", "PAGO VENCIMIENTO EN DOLARES", "CANCELACION ANTICIPADA").
   - "refund": Reintegros, devoluciones, bonificaciones y notas de crédito ("NOTA DE CREDITO", importes negativos).
2. MONEDA:
   - "USD": Si figura en la columna U$S / USS, o indica dólares.
   - "ARS": Si figura en pesos argentinos ($).
3. TOTALES DEL RESUMEN:
   - Extrae el saldo total adeudado en pesos (total_ars) y el saldo adeudado/a favor en dólares (total_usd).
4. RUBROS:
   - Asigna uno de: "Supermercado", "Servicios", "Alimentos", "Transporte", "Tarjeta de Crédito", "Préstamos", "Otros".
   - Si no puedes determinar el comercio, escribe EXACTAMENTE: "Por Clasificar".

Devuelve ÚNICAMENTE un JSON válido con este formato:
{
  "entity_name": "Nombre tarjeta o banco (ej: Naranja X)",
  "period": "YYYY-MM",
  "total_ars": 427471.89,
  "total_usd": -39.31,
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "Texto del movimiento",
      "amount": 1234.56,
      "currency": "ARS" | "USD",
      "operation_type": "purchase" | "payment" | "refund",
      "category": "Rubro detectado o Por Clasificar",
      "installment_number": 1,
      "total_installments": 1
    }
  ]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: { 
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      const rawResponse = response.text || '{}';
      const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return NextResponse.json(JSON.parse(cleanJson));
    } else {
      const { raw_text } = await req.json();
      const prompt = `Extrae movimientos de este texto en JSON clasificando purchase, payment y refund en ARS o USD:\n${raw_text}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [prompt],
        config: { 
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      const cleanJson = (response.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
      return NextResponse.json(JSON.parse(cleanJson));
    }
  } catch (error: any) {
    console.error('Error procesando extracto:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}