-- DRM-IA Finanzas · Migración 015 · El saldo de billeteras y efectivo se actualiza solo con los movimientos nuevos.
-- balance_date: fecha desde la que valen los movimientos (los posteriores suman o restan al saldo cargado).
-- Es idempotente: se puede volver a ejecutar.
alter table public.loans add column if not exists balance_date date;

-- Billeteras y efectivo sin ninguna fecha de referencia: se toma hoy (el saldo cargado hasta hoy se respeta tal cual).
update public.loans
   set balance_date = current_date
 where balance_date is null
   and last_statement_close is null
   and coalesce(kind, 'wallet') in ('wallet', 'cash');
