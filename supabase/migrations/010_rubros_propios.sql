-- DRM-IA Finanzas · Migración 010 · Rubros propios
-- Rubros (categorías de gasto) creados por el usuario, además de los que ya trae la app.
-- Es idempotente: se puede volver a ejecutar.
create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
alter table public.user_categories enable row level security;
drop policy if exists user_categories_own on public.user_categories;
create policy user_categories_own on public.user_categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
