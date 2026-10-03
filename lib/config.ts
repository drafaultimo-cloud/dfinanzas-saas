// Configuración compartida cliente + servidor (sin secretos).

// Solo para decidir qué UI mostrar. La autorización real de admin se hace en el
// servidor (lib/server/guard.ts → requireAdmin), nunca confiando en el cliente.
export const DEFAULT_ADMIN_EMAILS = ['drafaultimo@gmail.com', 'd_rafael_m@hotmail.com'];

export const TRIAL_DAYS = 10;
export const PAID_DAYS = 30; // vigencia de cada pago mensual

export type PlanId = 'base' | 'pro';

// Tope mensual de usos de IA por usuario (cada uso le cuesta plata al servicio). Se controla en el servidor.
// 'trial' = prueba gratis; 'paid' = plan Pro pago. El admin no tiene tope.
export type QuotaKind = 'parse' | 'scan' | 'audit' | 'pay';
export const AI_MONTHLY_LIMITS: Record<'trial' | 'paid', Record<QuotaKind, number>> = {
  trial: { parse: 8, scan: 10, audit: 3, pay: 12 },
  paid: { parse: 40, scan: 60, audit: 15, pay: 12 },
};
export const QUOTA_LABEL: Record<QuotaKind, string> = {
  parse: 'importaciones de extractos con IA',
  scan: 'escaneos de tickets',
  audit: 'diagnósticos con IA',
  pay: 'envíos de comprobantes de pago',
};

export const PLAN_ESENCIAL_REGULAR = 12000;
export const PLAN_ESENCIAL_PROMO = 7200;
export const PLAN_PRO_REGULAR = 24500;
export const PLAN_PRO_PROMO = 14700;

export const PLAN_PROMO_PRICE: Record<PlanId, number> = {
  base: PLAN_ESENCIAL_PROMO,
  pro: PLAN_PRO_PROMO,
};

export const STATEMENT_CATEGORIES = [
  'Supermercado',
  'Servicios',
  'Alimentos',
  'Transporte',
  'Tarjeta de Crédito',
  'Préstamos',
  'Otros',
] as const;

export const DEFAULT_USD_RATE = 1350;

/** Fecha local (YYYY-MM-DD) del dispositivo. toISOString() usa UTC y en Argentina
 *  devuelve el día siguiente a partir de las 21:00. */
export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Se muestra al pie de la app: sirve para comprobar qué versión está corriendo en el celular.
export const APP_VERSION = '2026.10.03-o';
