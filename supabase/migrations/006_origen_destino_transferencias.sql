-- Origen/destino de transferencias y pagos entre cuentas propias.
-- Guarda 'card:<id>' o 'loan:<id>' de la OTRA cuenta involucrada.
alter table public.transactions add column if not exists transfer_account text;
