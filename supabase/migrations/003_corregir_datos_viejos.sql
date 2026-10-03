-- DRM-IA Finanzas · 003 · Corrección de datos viejos (ejecutar por bloques, en este orden)

-- BLOQUE 1: devolver la deuda de las tarjetas (estaba guardada en credit_limit)
update public.credit_cards
set balance_ars = credit_limit
where coalesce(balance_ars, 0) = 0 and coalesce(credit_limit, 0) <> 0;
-- Para deshacer: update public.credit_cards set balance_ars = 0;

-- BLOQUE 2: VISTA PREVIA de los movimientos viejos que se van a corregir (no modifica nada)
select id, date, description, amount, currency, operation_type, income_source
from public.transactions
where (description like '[USD]%' and coalesce(currency, 'ARS') <> 'USD')
   or (type = 'income'
       and coalesce(operation_type, 'purchase') not in ('refund', 'payment')
       and (income_source in ('reintegro', 'pago_tarjeta')
            or description ilike '%reintegro%'
            or description ilike 'su pago%'))
order by date desc;

-- BLOQUE 3: aplicar la corrección (ejecutar solo después de revisar el bloque 2)
update public.transactions
set currency = 'USD'
where description like '[USD]%' and coalesce(currency, 'ARS') <> 'USD';

update public.transactions
set operation_type = case
      when income_source = 'pago_tarjeta' or description ilike 'su pago%' then 'payment'
      else 'refund'
    end
where type = 'income'
  and coalesce(operation_type, 'purchase') not in ('refund', 'payment')
  and (income_source in ('reintegro', 'pago_tarjeta')
       or description ilike '%reintegro%'
       or description ilike 'su pago%');
