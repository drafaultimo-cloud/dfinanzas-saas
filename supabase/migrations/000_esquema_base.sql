-- DRM-IA Finanzas · Migración 000 · Esquema base (5 tablas)
-- Ejecutar ANTES de 001_seguridad_rls.sql. Es idempotente: si una tabla o columna ya existe, la respeta.

create extension if not exists pgcrypto;

-- Tarjetas de crédito
create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  closing_day int,
  due_day int,
  balance_ars numeric(14,2) default 0,
  balance_usd numeric(14,2) default 0,
  credit_limit numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- Préstamos / billeteras
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity text not null,
  total_amount numeric(14,2) default 0,
  installment_amount numeric(14,2) default 0,
  total_installments int default 12,
  paid_installments int default 0,
  due_day int,
  created_at timestamptz default now()
);

-- Movimientos
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null,
  currency text default 'ARS',
  operation_type text default 'purchase',
  description text,
  type text,
  category text,
  income_source text,
  credit_card_id uuid references public.credit_cards(id) on delete set null,
  loan_id uuid references public.loans(id) on delete set null,
  date date default current_date,
  installment_number int default 1,
  total_installments int default 1,
  created_at timestamptz default now()
);

-- Comprobantes de pago (los escribe solo el servidor)
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  amount numeric(14,2) default 0,
  transfer_date date,
  sender_name text,
  alias_destination text,
  ai_status text,
  ai_notes text,
  admin_status text default 'pending',
  plan text,
  receipt_hash text,
  operation_number text,
  created_at timestamptz default now()
);

-- Chat de soporte
create table if not exists public.user_support_chats (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid,
  sender_email text,
  receiver_id uuid,
  receiver_email text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Si alguna tabla ya existía con menos columnas, se agregan las que falten
alter table public.credit_cards add column if not exists closing_day int;
alter table public.credit_cards add column if not exists due_day int;
alter table public.credit_cards add column if not exists balance_ars numeric(14,2) default 0;
alter table public.credit_cards add column if not exists balance_usd numeric(14,2) default 0;
alter table public.credit_cards add column if not exists credit_limit numeric(14,2) default 0;

alter table public.loans add column if not exists total_amount numeric(14,2) default 0;
alter table public.loans add column if not exists installment_amount numeric(14,2) default 0;
alter table public.loans add column if not exists total_installments int default 12;
alter table public.loans add column if not exists paid_installments int default 0;
alter table public.loans add column if not exists due_day int;

alter table public.transactions add column if not exists currency text default 'ARS';
alter table public.transactions add column if not exists operation_type text default 'purchase';
alter table public.transactions add column if not exists income_source text;
alter table public.transactions add column if not exists credit_card_id uuid references public.credit_cards(id) on delete set null;
alter table public.transactions add column if not exists loan_id uuid references public.loans(id) on delete set null;
alter table public.transactions add column if not exists installment_number int default 1;
alter table public.transactions add column if not exists total_installments int default 1;

-- Índices de consulta
create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists credit_cards_user_idx on public.credit_cards (user_id);
create index if not exists loans_user_idx on public.loans (user_id);
create index if not exists payment_receipts_user_idx on public.payment_receipts (user_id, created_at desc);
create index if not exists chats_receiver_idx on public.user_support_chats (receiver_email, is_read);
