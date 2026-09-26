import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64Data = Buffer.from(bytes).toString('base64')

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data
          }
        },
        'Extrae el comercio o concepto principal, el monto total pagado y clasifícalo en una de estas categorías: Alimentos, Transporte, Servicios, Entretenimiento, Salud, Otros.'
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: 'Nombre del comercio o concepto del ticket' },
            amount: { type: Type.NUMBER, description: 'Monto total pagado' },
            category: { 
              type: Type.STRING, 
              enum: ['Alimentos', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Otros']
            }
          },
          required: ['description', 'amount', 'category']
        }
      }
    })

    const parsedData = JSON.parse(response.text || '{}')
    return NextResponse.json(parsedData)
  } catch (error: any) {
    console.error('Error analizando ticket:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar el comprobante' }, { status: 500 })
  }
}
