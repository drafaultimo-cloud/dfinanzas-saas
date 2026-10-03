-- Separa billeteras/efectivo de préstamos en la tabla loans.
-- kind: 'wallet' (billetera o caja de ahorro), 'cash' (efectivo), 'loan' (préstamo / hipotecario)
alter table public.loans add column if not exists kind text;
update public.loans set kind = 'wallet' where kind is null and balance_ars is not null;
update public.loans set kind = 'loan' where kind is null;
