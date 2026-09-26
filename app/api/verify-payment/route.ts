import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@supabase/supabase-js'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })

// Supabase con rol de servicio o cliente directo para actualizar perfil
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string

    if (!file || !userId) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString('base64')

    // 1. Guardar la imagen en Supabase Storage
    const fileName = `${userId}-${Date.now()}-${file.name}`
    await supabase.storage.from('receipts').upload(fileName, buffer, {
      contentType: file.type
    })
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)

    // 2. Inspección con Gemini
    const prompt = `Analiza este comprobante de transferencia bancaria o Mercado Pago.
    Determina si es una transferencia legítima y extrae:
    1. Si parece una transferencia exitosa (is_valid: true/false).
    2. Monto transferido.
    3. Titular de origen o referencia.
    4. Explica brevemente qué datos detectaste.`

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: file.type || 'image/jpeg',
            data: base64Data
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_valid: { type: Type.BOOLEAN, description: 'True si es un comprobante de transferencia válido y exitoso' },
            amount: { type: Type.NUMBER, description: 'Monto transferido' },
            sender: { type: Type.STRING, description: 'Nombre del emisor o concepto' },
            notes: { type: Type.STRING, description: 'Resumen de validación' }
          },
          required: ['is_valid', 'amount', 'notes']
        }
      }
    })

    const result = JSON.parse(response.text || '{}')

    // 3. Registrar en payment_submissions para auditoría
    const isApproved = result.is_valid === true
    await supabase.from('payment_submissions').insert([
      {
        user_id: userId,
        receipt_url: publicUrl,
        amount: result.amount || 0,
        sender_name: result.sender || 'Desconocido',
        status: isApproved ? 'approved' : 'rejected',
        gemini_verdict: result.notes || ''
      }
    ])

    // 4. Si Gemini valida el comprobante, actualizar a Premium
    if (isApproved) {
      await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', userId)

      return NextResponse.json({ 
        success: true, 
        message: '¡Comprobante validado! Tu cuenta ahora es Pro.',
        details: result 
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'El comprobante no pudo ser validado automáticamente. Quedó registrado para revisión manual.',
        details: result 
      }, { status: 422 })
    }

  } catch (error: any) {
    console.error('Error procesando pago:', error)
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 })
  }
}
