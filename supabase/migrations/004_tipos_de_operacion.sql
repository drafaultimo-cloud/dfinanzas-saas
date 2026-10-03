-- DRM-IA Finanzas · Migración 004 · Nuevos tipos de operación
-- La tabla transactions solo aceptaba purchase / payment / refund.
-- Se agregan "income" (ingreso real: rendimientos, cobros, transferencias de terceros)
-- y "transfer" (transferencia entre cuentas propias: no es ingreso ni gasto).
-- Es seguro correrlo más de una vez.

alter table public.transactions drop constraint if exists transactions_operation_type_check;

alter table public.transactions
  add constraint transactions_operation_type_check
  check (operation_type is null or operation_type in ('purchase', 'payment', 'refund', 'income', 'transfer'));
