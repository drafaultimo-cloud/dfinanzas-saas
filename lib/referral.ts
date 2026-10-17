// Referidos: código de invitación, link y reglas del premio. Lógica pura (cliente y servidor).
import { randomBytes } from 'crypto';

/** Estado del comprobante que se crea como premio: suma 30 días como cualquier pago verificado. */
export const REFERRAL_BONUS = 'referral_bonus';
/** Un usuario puede ganar hasta 12 meses por año de referidos. */
export const MAX_REWARDS = 12;
/** El invitado tiene que ser una cuenta nueva (no vale invitar a alguien que ya usaba la app). */
export const MAX_ACCOUNT_AGE_DAYS = 14;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para no confundir al dictarlo
export function generateCode(length = 7): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
export const normalizeCode = (raw: unknown): string => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
export const isValidCode = (code: string) => code.length >= 6 && code.length <= 12;

export const referralLink = (site: string, code: string) => `${site.replace(/\/$/, '')}/?ref=${code}`;

export function canBeReferred(createdAt: string | undefined | null, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const age = (now.getTime() - new Date(createdAt).getTime()) / 86400000;
  return age >= 0 && age <= MAX_ACCOUNT_AGE_DAYS;
}

export function whatsappShareUrl(link: string): string {
  const text = `Estoy usando DRM-IA Finanzas para controlar mis tarjetas en pesos y dólares. Probala gratis 10 días con mi link: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
