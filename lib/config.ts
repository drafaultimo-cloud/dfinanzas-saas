// Configuración compartida cliente + servidor (sin secretos).

// Solo para decidir qué UI mostrar. La autorización real de admin se hace en el
// servidor (lib/server/guard.ts → requireAdmin), nunca confiando en el cliente.
export const DEFAULT_ADMIN_EMAILS = ['drafaultimo@gmail.com', 'd_rafael_m@hotmail.com'];

export const TRIAL_DAYS = 10;
export const PAID_DAYS = 30; // vigencia de cada pago mensual

export type PlanId = 'base' | 'pro';

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
