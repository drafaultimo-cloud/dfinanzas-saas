import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let contentsPayload: any[] = [];

    const promptInstructions = `
Eres un contador y arquitecto financiero experto de DRMIA.
Analiza la información provista (puede ser un texto copiado de Excel, un PDF o imagen de un resumen bancario, planilla de deudas o extracto).

Debes identificar y estructurar dos grupos de datos:
1. ENTIDADES FINANCIERAS IDENTIFICADAS:
   - credit_cards: Lista de tarjetas de crédito mencionadas (ej: 'Mastercard Banco Nación', 'Tarjeta Naranja X', 'Mastercard Mercado Pago'). Incluye su saldo o límite si figura.
   - wallets: Billeteras virtuales o cuentas bancarias (ej: 'Mercado Pago', 'Banco Nación BNA', 'Efectivo').
   - loans: Préstamos, descubiertos o acuerdos de pago (ej: 'Préstamo Personal', 'Descubierto').
2. TRANSACCIONES Y MOVIMIENTOS:
   - Extrae cada ingreso (sueldo fijo, aguinaldo, freelance) y cada gasto individual o cuota mensual.
   - Para cada movimiento define:
     * description: Detalle claro (ej: 'Sueldo mensual', 'Alquiler', 'Pago mínimo tarjeta').
     * amount: Monto numérico en positivo (flotante, sin signos $ ni puntos de miles).
     * type: 'income' si es sueldo/ingreso, o 'expense' si es gasto/pago.
     * category: 'Sueldo', 'Alquiler', 'Supermercado', 'Servicios', 'Transporte', 'Tarjeta de Crédito', 'Préstamos', u 'Otros'.
     * date: En formato YYYY-MM-DD (si no indica fecha exacta, usa la fecha de hoy).
     * entity_name: Nombre de la tarjeta, banco o billetera a la que corresponde (si se puede determinar).
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentsPayload,
      config: {
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
            detected_wallets: {
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
                  entity_name: { type: Type.STRING },
                  installment_number: { type: Type.INTEGER },
                  total_installments: { type: Type.INTEGER },
                },
                required: ['description', 'amount', 'type'],
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