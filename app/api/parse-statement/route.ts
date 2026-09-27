import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Helper para reintentar con backoff exponencial
async function callGeminiWithRetry(contents: any[], retries = 3, delay = 2000): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const isOverloaded =
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE');

      if (isOverloaded && attempt < retries - 1) {
        console.warn(`[Gemini 503] Reintento ${attempt + 2}/${retries} en ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let contentsPayload: any[] = [];

    const promptInstructions = `
Extrae la información financiera esencial de este documento o texto.
Responde ÚNICAMENTE un objeto JSON válido con esta estructura exacta, sin texto adicional:
{
  "detected_cards": [
    { "name": "Nombre de la tarjeta", "balance": 0.0 }
  ],
  "detected_loans": [
    { "entity": "Nombre del préstamo o banco", "total_amount": 0.0, "installment_amount": 0.0 }
  ],
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "Detalle del consumo o ingreso",
      "amount": 0.0,
      "type": "income o expense",
      "category": "Supermercado, Servicios, Alimentos, Transporte, Tarjeta de Crédito, Préstamos u Otros",
      "installment_number": 1,
      "total_installments": 1
    }
  ]
}
Reglas:
- Los montos deben ser números flotantes limpios (positivos, sin signos ni comas de miles).
- Si no figura fecha exacta, utiliza la fecha actual.
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

    const response = await callGeminiWithRetry(contentsPayload);
    const textOutput = response.text || '{}';

    // Limpieza de posibles bloques markdown que devuelva el modelo
    const cleanedJson = textOutput
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const parsedData = JSON.parse(cleanedJson);
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error procesando en parse-statement:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al procesar el archivo con IA' },
      { status: 500 }
    );
  }
}