// Rubros (categorías de gasto): lista base + los que crea el usuario + los que ya están en sus movimientos.
// Lógica pura, sin React ni Supabase.

/** Rubros que la app usa en su lógica (importador, pagos de tarjeta, cuotas): no se renombran ni se borran. */
export const CORE_CATEGORIES = ['Supermercado', 'Servicios', 'Alimentos', 'Transporte', 'Tarjeta de Crédito', 'Préstamos', 'Otros'];

/** Rubros que se ofrecen desde el primer día. */
export const DEFAULT_CATEGORIES = [
  'Supermercado', 'Alimentos', 'Servicios', 'Transporte', 'Salud', 'Educación', 'Hogar', 'Entretenimiento',
  'Indumentaria', 'Impuestos', 'Envíos', 'Préstamos', 'Tarjeta de Crédito', 'Otros',
];

const RESERVED = new Set(['por clasificar', 'ingreso']);
const LABELS: Record<string, string> = {
  Servicios: 'Servicios / Facturas',
  Alimentos: 'Alimentos / Restaurantes',
  Transporte: 'Transporte / Combustible',
  'Tarjeta de Crédito': 'Pago Tarjeta',
  'Préstamos': 'Cuota Préstamo',
};
export const categoryLabel = (c: string) => LABELS[c] || c;
export const isCoreCategory = (c: string) => CORE_CATEGORIES.some(x => x.toLowerCase() === (c || '').toLowerCase());
/** Rubros que vienen con la app (siempre aparecen): no se renombran ni se eliminan. */
export const isBaseCategory = (c: string) => DEFAULT_CATEGORIES.some(x => x.toLowerCase() === (c || '').toLowerCase());

/** Limpia espacios, corta a 40 caracteres y pone la primera letra en mayúscula. */
export function normalizeCategoryName(raw: string): string {
  const s = (raw || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export type NewCategoryCheck = { name: string; existed: boolean } | { error: string };
/** Valida un rubro nuevo: si ya existe (sin importar mayúsculas) devuelve el existente en vez de duplicarlo. */
export function validateNewCategory(raw: string, existing: string[]): NewCategoryCheck {
  const name = normalizeCategoryName(raw);
  if (name.length < 2) return { error: 'Escribí un nombre de al menos 2 letras.' };
  if (RESERVED.has(name.toLowerCase())) return { error: `“${name}” es un nombre reservado de la app. Elegí otro.` };
  const found = existing.find(e => e.toLowerCase() === name.toLowerCase());
  return found ? { name: found, existed: true } : { name, existed: false };
}

/** Lista completa y ordenada de rubros: base, luego los del usuario y los usados en movimientos; "Otros" al final. */
export function buildCategories(userNames: string[], txs: any[]): string[] {
  const seen = new Map<string, string>();
  const add = (n?: string | null) => {
    const name = normalizeCategoryName(n || '');
    if (!name || RESERVED.has(name.toLowerCase())) return;
    if (!seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  };
  DEFAULT_CATEGORIES.forEach(add);
  const baseKeys = new Set(seen.keys());
  userNames.forEach(add);
  for (const t of txs) if (t?.type === 'expense') add(t.category);
  const base = DEFAULT_CATEGORIES.filter(c => c !== 'Otros');
  const extra = [...seen.entries()].filter(([k]) => !baseKeys.has(k)).map(([, v]) => v).sort((a, b) => a.localeCompare(b, 'es'));
  return [...base, ...extra, 'Otros'];
}
