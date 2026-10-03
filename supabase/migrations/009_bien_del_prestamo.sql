-- DRM-IA Finanzas · Migración 009 · Bien que respalda un préstamo (casa, auto…)
-- Permite que el patrimonio neto sume el valor del bien junto a la deuda del crédito.
-- Es idempotente: se puede volver a ejecutar.
alter table public.loans add column if not exists asset_name text;
alter table public.loans add column if not exists asset_value numeric(16,2);
alter table public.loans add column if not exists asset_currency text default 'ARS';
