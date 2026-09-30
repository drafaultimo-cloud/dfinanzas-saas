import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Permitir hasta 60 segundos de ejecución en Vercel para procesar PDFs de varias páginas
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
Analiza este resumen bancario o de tarjeta de crédito (como Naranja X, Banco Nación, etc.).
Enfócate en la sección "Detalle de Consumos" y "Cancelación Anticipada / Cuotas".

REGLAS CRÍTICAS:
1. DETECCIÓN DE REINTEGROS / NOTAS DE CRÉDITO:
   - Si un movimiento tiene monto negativo ("-"), dice "NOTA DE CREDITO", "REINTEGRO" o "DEVOLUCION" (por ejemplo "NOTA DE CREDITO GOOGLE Google One -39,31 USS"), márcalo con type: "income", is_refund: true, y en description escribe "[REINTEGRO] nombre del comercio".
2. MONEDA:
   - Si el consumo o reintegro está en dólares (USS / USD), indica currency: "USD", de lo contrario "ARS".
3. CLASIFICACIÓN DE RUBRO:
   - Categorías posibles: "Supermercado", "Servicios", "Alimentos", "Transporte", "Tarjeta de Crédito", "Préstamos", "Otros".
   - Si no estás 100% seguro del rubro por ser un nombre comercial ambiguo (ej: comercios con códigos o transferencias genéricas), asigna EXACTAMENTE: "Por Clasificar".
4. FORMATO:
   - Devuelve ÚNICAMENTE un objeto JSON válido con este formato:
{
  "entity_name": "Nombre entidad (ej: Naranja X)",
  "period": "YYYY-MM",
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "Texto del consumo",
      "amount": 1234.56,
      "type": "expense",
      "is_refund": false,
      "currency": "ARS",
      "category": "Alimentos",
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
      const parsedData = JSON.parse(cleanJson);

      return NextResponse.json(parsedData);
    } else {
      const body = await req.json();
      const rawText = body.raw_text || '';

      const prompt = `
Extrae consumos y reintegros en formato JSON estricto a partir de este texto:
${rawText}
`;

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
    return NextResponse.json(
      { error: error.message || 'Error interno al procesar el resumen' }, 
      { status: 500 }
    );
  }
}