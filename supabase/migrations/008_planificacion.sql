-- DRM-IA Finanzas · Migración 008 · Planificación
-- Presupuestos, recurrentes, metas, reglas, patrimonio, recordatorios y uso compartido (solo lectura).
-- Es idempotente: se puede volver a ejecutar.

-- 1) Presupuestos por categoría (tope mensual)
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  profile text not null default 'personal' check (profile in ('personal','business')),
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  alert_pct integer not null default 80 check (alert_pct between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, profile, category)
);

-- 2) Gastos / ingresos recurrentes (se cargan solos cada mes)
create table if not exists public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS' check (currency in ('ARS','USD')),
  type text not null default 'expense' check (type in ('expense','income')),
  category text not null default 'Servicios',
  profile text not null default 'personal' check (profile in ('personal','business')),
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  loan_id uuid references public.loans(id) on delete set null,
  active boolean not null default true,
  last_generated_month text,           -- 'YYYY-MM' del último mes en que se cargó
  created_at timestamptz not null default now()
);

-- 3) Metas de ahorro
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0,
  currency text not null default 'ARS' check (currency in ('ARS','USD')),
  target_date date,
  created_at timestamptz not null default now()
);

-- 4) Reglas de categorización: "si la descripción contiene X, la categoría es Y"
create table if not exists public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, keyword)
);

-- 5) Patrimonio neto: una foto por mes
create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,                  -- 'YYYY-MM'
  assets_ars numeric(16,2) not null default 0,
  liabilities_ars numeric(16,2) not null default 0,
  usd_rate numeric(12,2),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

-- 6) Preferencias de recordatorios por email
create table if not exists public.reminder_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  days_before integer not null default 3 check (days_before between 0 and 15),
  last_sent_on date
);

-- 7) Uso compartido (solo lectura): el dueño invita a un email
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  member_email text not null,
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default now(),
  unique (owner_id, member_email)
);

-- RLS: cada usuario solo ve y modifica lo suyo
do $$
declare t text;
begin
  foreach t in array array['budgets','recurring_items','savings_goals','category_rules','net_worth_snapshots','reminder_prefs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;

alter table public.shares enable row level security;
drop policy if exists shares_owner on public.shares;
create policy shares_owner on public.shares for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id and owner_email = lower(auth.jwt() ->> 'email'));
drop policy if exists shares_member_read on public.shares;
create policy shares_member_read on public.shares for select
  using (lower(member_email) = lower(auth.jwt() ->> 'email'));

-- Lectura compartida: quien fue invitado puede LEER (no escribir) los datos del dueño.
-- Son políticas adicionales: las existentes "auth.uid() = user_id" no se tocan.
drop policy if exists transactions_shared_read on public.transactions;
create policy transactions_shared_read on public.transactions for select using (
  exists (select 1 from public.shares s where s.owner_id = transactions.user_id and lower(s.member_email) = lower(auth.jwt() ->> 'email'))
);
drop policy if exists credit_cards_shared_read on public.credit_cards;
create policy credit_cards_shared_read on public.credit_cards for select using (
  exists (select 1 from public.shares s where s.owner_id = credit_cards.user_id and lower(s.member_email) = lower(auth.jwt() ->> 'email'))
);
drop policy if exists loans_shared_read on public.loans;
create policy loans_shared_read on public.loans for select using (
  exists (select 1 from public.shares s where s.owner_id = loans.user_id and lower(s.member_email) = lower(auth.jwt() ->> 'email'))
);

-- Columnas de apoyo en tablas existentes
alter table public.transactions add column if not exists recurring_id uuid;
