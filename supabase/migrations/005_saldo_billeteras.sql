-- DRM-IA Finanzas · Migración 005 · Saldo de billeteras y cuentas
-- Las billeteras guardan el dinero disponible al cierre del extracto (no es una deuda).
-- Es seguro correrlo más de una vez.

alter table public.loans add column if not exists balance_ars numeric(14,2);
alter table public.loans add column if not exists balance_usd numeric(14,2);
