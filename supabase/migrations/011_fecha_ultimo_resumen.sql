-- DRM-IA Finanzas · Migración 011 · Fecha del último resumen importado
-- Sirve para que un resumen más viejo no pise el saldo de uno más nuevo.
-- Es idempotente: se puede volver a ejecutar.
alter table public.credit_cards add column if not exists last_statement_close date;
alter table public.credit_cards add column if not exists last_statement_due date;
alter table public.loans add column if not exists last_statement_close date;
