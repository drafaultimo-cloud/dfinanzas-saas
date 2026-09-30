import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function generateWithRetry(contents: any[], attempts = 2) {
  const models = ['gemini-3.8-flash', 'gemini-2.5-flash'];
  for (let i = 0; i < attempts; i++) {
    try {
      const modelToUse = models[i % models.length];
      return await ai.models.generateContent({
        model: modelToUse,
        contents,
        config: { temperature: 0.1 }
      });
    } catch (err: any) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}