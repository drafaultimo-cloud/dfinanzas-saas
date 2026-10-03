-- DRM-IA Finanzas · Migración 013 · Eliminar la tabla vieja payment_submissions
-- Era de una versión anterior, la app actual no la usa (los pagos van a payment_receipts)
-- y tenía una política que dejaba insertar a cualquier usuario. Se verificó que está vacía (0 filas).
-- Idempotente.

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payment_submissions') then
    if (select count(*) from public.payment_submissions) = 0 then
      drop table public.payment_submissions;
    else
      raise exception 'payment_submissions tiene datos: no se borra. Revisarla a mano.';
    end if;
  end if;
end $$;

-- Verificación: no debe devolver filas
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'payment_submissions';
