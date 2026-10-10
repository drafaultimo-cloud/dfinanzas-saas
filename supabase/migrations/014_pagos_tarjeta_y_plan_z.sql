-- DRM-IA Finanzas · Migración 014 · Pagos a tarjeta y Plan Z / cuotas sin interés
-- 1) balance_date: desde qué fecha se descuentan los pagos del saldo de la tarjeta.
-- 2) card_plans: lo que pasaste a Plan Z (1, 2 o 3 pagos sin interés).
-- Es idempotente: se puede volver a ejecutar.
alter table public.credit_cards add column if not exists balance_date date;

create table if not exists public.card_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  label text not null default 'Plan Z',
  total_amount numeric not null check (total_amount > 0),
  payments int not null check (payments between 1 and 12),
  first_due date not null,
  created_at timestamptz not null default now()
);
alter table public.card_plans enable row level security;
drop policy if exists card_plans_own on public.card_plans;
create policy card_plans_own on public.card_plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists card_plans_shared_read on public.card_plans;
create policy card_plans_shared_read on public.card_plans for select using (
  exists (select 1 from public.shares s where s.owner_id = card_plans.user_id and lower(s.member_email) = lower(auth.jwt() ->> 'email'))
);
