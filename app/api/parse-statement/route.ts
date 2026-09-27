import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let contentsPayload: any[] = [];

    const promptInstructions = `
Extrae la información financiera de este texto, planilla o documento.
Devuelve un JSON con:
1. detected_cards: tarjetas de crédito (name, balance numérico).
2. detected_loans: préstamos o deudas (entity, total_amount, installment_amount).
3. items: cada transacción o consumo individual (description, amount numérico positivo, type ['income' o 'expense'], category, date en YYYY-MM-DD).
Sé conciso y extrae montos limpios.
`;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.raw_text) {
        return NextResponse.json({ error: 'No se envió texto para analizar' }, { status: 400 });
      }
      contentsPayload = [body.raw_text, promptInstructions];
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const base64Data = Buffer.from(bytes).toString('base64');

      contentsPayload = [
        {
          inlineData: {
            mimeType: file.type || 'application/pdf',
            data: base64Data,
          },
        },
        promptInstructions,
      ];
    }

    const schemaConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detected_cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                balance: { type: Type.NUMBER },
              },
              required: ['name'],
            },
          },
          detected_loans: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                entity: { type: Type.STRING },
                total_amount: { type: Type.NUMBER },
                installment_amount: { type: Type.NUMBER },
              },
              required: ['entity'],
            },
          },
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
              required: ['description', 'amount', 'type'],
            },
          },
        },
        required: ['items'],
      },
    };

    let response;
    try {
      // Modelo principal: 2.5 flash (alta disponibilidad en tier gratuito)
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contentsPayload,
        config: schemaConfig,
      });
    } catch (primaryErr: any) {
      console.warn('Fallback a modelo alternativo flash:', primaryErr.message);
      // Fallback seguro: 2.0 flash (también con cuota gratuita activa)
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contentsPayload,
        config: schemaConfig,
      });
    }

    return NextResponse.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Error final en endpoint:', error);
    return NextResponse.json({ error: error.message || 'Error procesando datos' }, { status: 500 });
  }
}