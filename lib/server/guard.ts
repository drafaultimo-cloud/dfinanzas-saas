import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { AccessState, computeAccess } from '../access';
import { isAdminEmail } from '../access';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel limita el body a ~4,5 MB

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function handleError(error: unknown, logLabel: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(logLabel, error);
  const msg = error instanceof Error ? error.message : 'Error interno';
  return NextResponse.json({ error: msg }, { status: 500 });
}

function env(name: string): string {
  return process.env[name] || '';
}

function extraAdmins(): string[] {
  return env('ADMIN_EMAILS').split(',').map(s => s.trim()).filter(Boolean);
}

/** Cliente con clave de servicio (omite RLS). SOLO en el servidor. */
export function getAdminClient(): SupabaseClient | null {
  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function requireAdminClient(): SupabaseClient {
  const c = getAdminClient();
  if (!c) {
    throw new ApiError(500, 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  }
  return c;
}

export function getAI(): GoogleGenAI {
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) throw new ApiError(500, 'Falta configurar GEMINI_API_KEY en el servidor.');
  return new GoogleGenAI({ apiKey });
}

// ---- Rate limit en memoria (mejor esfuerzo: por instancia serverless) ----
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) {
    throw new ApiError(429, 'Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.');
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some(t => now - t < windowMs)) buckets.delete(k);
  }
}

async function getUserFromRequest(req: NextRequest): Promise<{ user: User; token: string }> {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiError(401, 'Iniciá sesión para usar esta función.');

  const url = env('NEXT_PUBLIC_SUPABASE_URL');
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) throw new ApiError(500, 'Falta configurar Supabase en el servidor.');

  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, 'Sesión inválida o vencida. Volvé a iniciar sesión.');
  return { user: data.user, token };
}

export async function loadAccess(user: User): Promise<AccessState | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from('payment_receipts')
    .select('created_at, ai_status, admin_status, plan, ai_notes')
    .eq('user_id', user.id);
  if (error) throw new ApiError(500, 'No se pudo verificar tu suscripción.');
  return computeAccess({
    email: user.email,
    createdAt: user.created_at,
    receipts: data || [],
    extraAdmins: extraAdmins(),
  });
}

type GuardOpts = {
  /** exige prueba/plan activo (default true) */
  needAccess?: boolean;
  /** exige plan Pro o prueba (funciones con IA) */
  needPro?: boolean;
  rateKey?: string;
  rateMax?: number;
  rateWindowMs?: number;
};

/** Autentica la request y valida suscripción + límite de uso. */
export async function requireUser(req: NextRequest, opts: GuardOpts = {}) {
  const { needAccess = true, needPro = false } = opts;
  const { user } = await getUserFromRequest(req);

  rateLimit(
    `${opts.rateKey || 'ai'}:${user.id}`,
    opts.rateMax ?? 20,
    opts.rateWindowMs ?? 10 * 60 * 1000
  );

  let access: AccessState | null = null;
  if (needAccess || needPro) {
    access = await loadAccess(user);
    if (!access) {
      // Sin clave de servicio no se puede verificar el plan: en producción se bloquea.
      if (process.env.NODE_ENV === 'production') {
        throw new ApiError(500, 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.');
      }
    } else {
      if (access.status === 'expired') {
        throw new ApiError(402, 'Tu prueba gratis terminó. Activá un plan para continuar.');
      }
      if (needPro && access.plan !== 'pro') {
        throw new ApiError(403, 'Esta función es parte del Plan Pro IA.');
      }
    }
  }
  return { user, access };
}

export async function requireAdmin(req: NextRequest) {
  const { user } = await getUserFromRequest(req);
  if (!isAdminEmail(user.email, extraAdmins())) {
    throw new ApiError(403, 'No autorizado.');
  }
  return { user };
}

// ---- Validación de archivos y respuestas de IA ----
export async function readUpload(
  file: File | null,
  allowed: RegExp,
  maxBytes = MAX_UPLOAD_BYTES
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!file) throw new ApiError(400, 'No se envió ningún archivo.');
  if (file.size > maxBytes) {
    throw new ApiError(
      413,
      `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${(maxBytes / 1024 / 1024).toFixed(0)} MB. Comprimilo o subí solo las páginas necesarias.`
    );
  }
  const mimeType = file.type || '';
  if (!allowed.test(mimeType)) {
    throw new ApiError(415, 'Tipo de archivo no permitido. Usá una imagen (JPG/PNG/WebP) o un PDF.');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, mimeType };
}

export function parseModelJson<T = any>(text: string | undefined): T {
  const clean = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!clean) throw new ApiError(502, 'La IA no devolvió datos. Reintentá.');
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new ApiError(
      502,
      'La IA devolvió una respuesta incompleta (el extracto puede ser demasiado largo). Probá con menos páginas.'
    );
  }
}

export const IMAGE_OR_PDF = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i;


// ---- Llamadas a IA con reintentos y respaldo ----
// Orden: Gemini (2 intentos) -> Claude (si hay ANTHROPIC_API_KEY) -> Gemini de respaldo -> error amable.
const CLAUDE_MODEL = process.env.CLAUDE_FALLBACK_MODEL || 'claude-sonnet-5-5';

const isTransient = (e: any) => {
  const text = `${e?.status ?? ''} ${e?.code ?? ''} ${e?.message ?? ''}`.toLowerCase();
  return /\b(429|500|502|503|504)\b|unavailable|overloaded|high demand|resource_exhausted|deadline/.test(text);
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Traduce el formato de Gemini (texto + inlineData) al de la API de mensajes de Claude. */
async function callClaude(params: any): Promise<{ text: string }> {
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

  const parts: any[] = Array.isArray(params.contents) ? params.contents : [params.contents];
  const content: any[] = [];
  for (const p of parts) {
    if (typeof p === 'string') content.push({ type: 'text', text: p });
    else if (p?.text) content.push({ type: 'text', text: String(p.text) });
    else if (p?.inlineData) {
      const { mimeType, data } = p.inlineData;
      content.push(
        mimeType === 'application/pdf'
          ? { type: 'document', source: { type: 'base64', media_type: mimeType, data } }
          : { type: 'image', source: { type: 'base64', media_type: mimeType, data } }
      );
    }
  }

  const cfg = params.config || {};
  if (cfg.responseSchema) {
    content.push({
      type: 'text',
      text: 'Respondé ÚNICAMENTE con un JSON válido (sin texto extra ni bloques de código) que cumpla este esquema:\n' +
        JSON.stringify(cfg.responseSchema),
    });
  } else if (cfg.responseMimeType === 'application/json') {
    content.push({ type: 'text', text: 'Respondé ÚNICAMENTE con el JSON pedido, sin texto extra ni bloques de código.' });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: Math.min(Number(cfg.maxOutputTokens) || 8192, 16000),
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0,
      messages: [{ role: 'user', content }],
    }),
    signal: AbortSignal.timeout(50000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude ${res.status}: ${json?.error?.message || 'error'}`);
  const text = (json.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  if (!text) throw new Error('Claude devolvió una respuesta vacía');
  return { text };
}

export async function generateWithRetry(ai: GoogleGenAI, params: any): Promise<{ text?: string }> {
  const primary = params.model || GEMINI_MODEL;
  let lastError: unknown;

  // 1) Gemini principal
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await ai.models.generateContent({ ...params, model: primary });
    } catch (e) {
      lastError = e;
      if (!isTransient(e)) throw e;
      if (attempt === 0) await sleep(800);
    }
  }

  // 2) Claude como respaldo (solo si hay clave configurada)
  if (env('ANTHROPIC_API_KEY')) {
    try {
      console.warn('Gemini saturado: usando Claude como respaldo.');
      return await callClaude(params);
    } catch (e) {
      lastError = e;
      console.error('Falló el respaldo con Claude:', e);
    }
  }

  // 3) Otro modelo de Gemini, último intento
  if (GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== primary) {
    try {
      return await ai.models.generateContent({ ...params, model: GEMINI_FALLBACK_MODEL });
    } catch (e) {
      lastError = e;
    }
  }

  console.error('IA no disponible tras reintentos:', lastError);
  throw new ApiError(503, 'El servicio de IA está saturado en este momento. Esperá un minuto y volvé a intentar.');
}
