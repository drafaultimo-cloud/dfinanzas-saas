import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún comprobante o resumen' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    const prompt = `
Eres un auditor y contador experto. Analiza este resumen de tarjeta de crédito (o extracto bancario).
Extrae todos los consumos o transacciones individuales que figuren en el detalle.
Para cada ítem, extrae:
- date: Fecha de la transacción en formato YYYY-MM-DD. Si solo figura día y mes, asume el año en curso.
- description: Nombre del comercio o concepto claro (ej: 'Coto', 'Shell', 'Netflix').
- amount: Monto numérico en positivo (flotante, sin signos de moneda).
- installment_number: Cuota actual (ej: si dice 03/06, es 3. Si no hay cuotas, es 1).
- total_installments: Total de cuotas (ej: si dice 03/06, es 6. Si no hay cuotas, es 1).
- category: Clasifícalo estrictamente en uno de estos rubros:
  ['Supermercado', 'Servicios', 'Alimentos', 'Transporte', 'Tarjeta de Crédito', 'Otros'].
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bank_or_card: { type: Type.STRING, description: 'Nombre de la entidad o tarjeta (ej: Visa Galicia, Master MP)' },
            statement_period: { type: Type.STRING, description: 'Mes o período del resumen' },
            total_amount: { type: Type.NUMBER, description: 'Monto total a pagar del resumen' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  installment_number: { type: Type.INTEGER },
                  total_installments: { type: Type.INTEGER },
                  category: { type: Type.STRING },
                },
                required: ['description', 'amount', 'category'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return NextResponse.json(parsedJson);
  } catch (error: any) {
    console.error('Error parseando resumen con Gemini:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el archivo con IA' }, { status: 500 });
  }
}