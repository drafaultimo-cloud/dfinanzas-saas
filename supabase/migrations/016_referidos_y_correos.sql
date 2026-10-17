-- DRM-IA Finanzas · Migración 016 · Referidos ("invitá y ganá un mes") y correos de resumen/avisos
-- Es idempotente: se puede volver a ejecutar.

-- 1) Código de invitación de cada usuario. Solo lo escribe el servidor (clave de servicio).
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists referral_codes_own_read on public.referral_codes;
create policy referral_codes_own_read on public.referral_codes for select using (auth.uid() = user_id);

-- 2) Quién invitó a quién. El premio (un mes) se entrega cuando el invitado hace su primer pago verificado.
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
alter table public.referrals enable row level security;
drop policy if exists referrals_referrer_read on public.referrals;
create policy referrals_referrer_read on public.referrals for select using (auth.uid() = referrer_id);

-- 3) Preferencias de correo (la tabla ya existía desde la 008). Sin fila = todo activado.
alter table public.reminder_prefs add column if not exists digest_enabled boolean not null default true;
alter table public.reminder_prefs add column if not exists alerts_enabled boolean not null default true;
alter table public.reminder_prefs add column if not exists last_digest_on date;
alter table public.reminder_prefs add column if not exists last_alert_on date;
