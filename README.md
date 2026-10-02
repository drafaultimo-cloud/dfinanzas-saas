# DRM-IA Finanzas

SaaS de control de finanzas personales y de comercios (pesos y dólares) con IA: importación de extractos, auditor financiero y suscripción por transferencia. Next.js 16 · Supabase · Google Gemini.

## Puesta en marcha

1. `npm install`
2. Copiar `.env.example` a `.env.local` y completar las variables (en Vercel, las mismas en *Settings → Environment Variables*). `SUPABASE_SERVICE_ROLE_KEY` es secreta: sin ella los pagos y el panel admin no funcionan, y en producción las APIs de IA se bloquean.
3. **Una sola vez:** ejecutar `supabase/migrations/001_seguridad_rls.sql` en Supabase → SQL Editor (activa RLS y agrega columnas). Leerlo antes: reemplaza las políticas existentes de las 5 tablas.
4. `npm run dev`

## Cómo está protegido

- Todas las APIs (`/api/*`) exigen sesión de Supabase (`Authorization: Bearer`) y validan en el servidor la prueba/plan (`lib/access.ts`, la misma lógica que usa la interfaz).
- Los pagos los registra el servidor (`/api/verify-payment`): comprueba monto ≥ plan, fecha reciente, destino y que el comprobante/número de operación no se haya usado. El rechazo manual del admin siempre anula la aprobación de la IA.
- El panel de administrador usa `/api/admin/overview` (valida el email admin en el servidor).
- Datos financieros: aislados por usuario con RLS (`auth.uid() = user_id`).

## Planes

Prueba de 10 días con acceso Pro; cada pago aprobado suma 30 días. Esencial no incluye importador IA, auditor ni bola de nieve (también se bloquea en el servidor).
