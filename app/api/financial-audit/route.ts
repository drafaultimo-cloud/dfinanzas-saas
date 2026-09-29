import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { income, expense, debt, transactions, profileType } = await req.json();

    const prompt = `
Actúa como el consultor y asesor financiero senior de DRM-IA Finanzas.
Analiza la siguiente situación financiera mensual para un perfil de tipo "${profileType || 'Personal'}":
- Total Ingresos del mes: $${income}
- Total Gastos del mes: $${expense}
- Deuda activa en tarjetas y préstamos: $${debt}
- Muestra de transacciones recientes: ${JSON.stringify(transactions ? transactions.slice(0, 25) : [])}

Genera un diagnóstico ejecutivo claro, estructurado exactamente en los siguientes 3 puntos:
1. "Alerta de Gastos Hormiga o Desvíos": Detecta rubros desproporcionados, servicios recurrentes o consumos evitables.
2. "Prioridad de Pagos y Tarjetas": Recomendación sobre qué tarjeta o pasivo cancelar primero para no devengar intereses.
3. "Plan de Acción Inmediato": Una sugerencia concreta y accionable para maximizar la tasa de ahorro o asegurar el flujo de caja.

Sé conciso, empático y habla en segunda persona.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [prompt],
      config: { temperature: 0.2 },
    });

    return NextResponse.json({ diagnosis: response.text || 'Sin observaciones este mes.' });
  } catch (error: any) {
    console.error('Error generando auditoría financiera:', error);
    return NextResponse.json({ error: error.message || 'Error en auditoría' }, { status: 500 });
  }
}