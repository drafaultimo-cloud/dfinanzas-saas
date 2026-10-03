// Sugerencia de regla de rubro a partir de la descripción de un movimiento:
// "Transferencia enviada PEREYRA, MARIO ADOLFO" → palabra clave "pereyra, mario adolfo".
// Lógica pura, sin React ni Supabase.

const fold = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Frases genéricas del banco que no identifican a quién se pagó.
const GENERIC_PREFIX = [
  /^(db|cr|deb|cre)[.\s]+/,
  /^transferencia\s+(enviada|recibida)\s*(a|de)?\s*/,
  /^tranf?\.?\s*(inmediata|int)?\.?\s*/,
  /^pago\s+con\s+qr\s*/,
  /^pago\s+(de\s+)?(factura|servicios?|s\s*s)?\s*/,
  /^compra\s+(con\s+)?(tarjeta\s+de\s+)?(debito|credito)?\s*/,
];

/** Palabra clave estable para reconocer al mismo comercio o persona la próxima vez. Vacía si no hay nada útil. */
export function suggestRuleKeyword(description?: string | null): string {
  let d = fold(description || '').replace(/^\[(usd|negocio)\]\s*/g, '').replace(/\s+/g, ' ').trim();
  if (!d) return '';
  // Un CUIT/CUIL (11 dígitos) identifica a la contraparte mejor que cualquier texto.
  const cuit = d.match(/\b(2[0-9]|3[0-9])\d{9}\b/);
  if (cuit) return cuit[0];
  // Códigos de Mercado Pago: "merpago*omarpereda"
  const mp = d.match(/merpago\*\s*([a-z0-9]+)/);
  if (mp) return `merpago*${mp[1]}`;
  let prev = '';
  while (prev !== d) { prev = d; for (const re of GENERIC_PREFIX) d = d.replace(re, '').trim(); }
  d = d.replace(/[-–:]+\s*$/, '').replace(/\b\d{1,5}\b\s*$/, '').replace(/[\s,.*-]+$/, '').trim(); // número de sucursal al final
  if (d.length < 4) return '';
  return d.slice(0, 32).trim();
}

/** ¿Alguna regla existente ya cubre esta palabra clave? */
export function ruleCovers(rules: { keyword?: string | null }[], keyword: string): boolean {
  const k = fold(keyword).trim();
  return !!k && rules.some(r => { const rk = fold(r.keyword || '').trim(); return rk && (k.includes(rk) || rk.includes(k)); });
}
