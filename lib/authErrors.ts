// Mensajes de acceso en castellano y detección de "correo sin confirmar".
export type AuthMsg = { text: string; unconfirmed: boolean };

export function translateAuthError(raw: unknown): AuthMsg {
  const m = String((raw as any)?.message ?? raw ?? '').toLowerCase();
  if (/email not confirmed|not confirmed/.test(m)) return { text: 'Todavía no confirmaste tu correo. Revisá tu bandeja (y el spam) y tocá el link, o pedí que te lo reenviemos.', unconfirmed: true };
  if (/invalid login credentials/.test(m)) return { text: 'Correo o contraseña incorrectos. Si no te acordás, usá «¿Olvidaste tu contraseña?».', unconfirmed: false };
  if (/rate limit|too many|security purposes|seconds/.test(m)) return { text: 'Pediste demasiados correos seguidos. Esperá un par de minutos y volvé a intentar.', unconfirmed: false };
  if (/already registered|already been registered/.test(m)) return { text: 'Ese correo ya tiene una cuenta. Iniciá sesión o usá «¿Olvidaste tu contraseña?».', unconfirmed: false };
  if (/password should be at least|weak password/.test(m)) return { text: 'La contraseña es muy corta: usá al menos 6 caracteres.', unconfirmed: false };
  if (/same password|different from the old/.test(m)) return { text: 'La contraseña nueva tiene que ser distinta de la anterior.', unconfirmed: false };
  if (/auth session missing|expired|invalid.*token|otp/.test(m)) return { text: 'El link venció o ya se usó. Pedí uno nuevo desde «¿Olvidaste tu contraseña?».', unconfirmed: false };
  return { text: String((raw as any)?.message ?? raw ?? '') || 'Error de autenticación', unconfirmed: false };
}

/** Valida la contraseña nueva; devuelve el error o null si está bien. */
export function checkNewPassword(a: string, b: string): string | null {
  if (a.length < 6) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (a !== b) return 'Las dos contraseñas no coinciden.';
  return null;
}
