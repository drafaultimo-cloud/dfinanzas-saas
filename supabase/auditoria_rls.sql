-- DRM-IA Finanzas · AUDITORÍA de seguridad (solo lectura, no modifica nada).
-- Ejecutar en Supabase → SQL Editor y revisar los 3 resultados.

-- 1) Tablas de la app SIN seguridad por filas (RLS). Debe devolver 0 filas.
select c.relname as tabla_sin_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
order by 1;

-- 2) Todas las políticas. Revisar que en transactions, credit_cards y loans:
--    - exista una política de dueño (auth.uid() = user_id) para insert/update/delete
--    - la única otra sea *_shared_read, solo de lectura (cmd = SELECT)
--    - NINGUNA tenga qual = 'true' (eso dejaría los datos abiertos a cualquiera)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- 3) Políticas peligrosas: abiertas a todos o sin condición. Debe devolver 0 filas.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and (qual is null or lower(replace(qual, ' ', '')) in ('true', '(true)'))
  and tablename <> 'app_settings';   -- app_settings es de lectura pública a propósito

-- 4) Funciones que otros roles pueden ejecutar (deben ser solo las esperadas).
select p.proname as funcion, p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;
