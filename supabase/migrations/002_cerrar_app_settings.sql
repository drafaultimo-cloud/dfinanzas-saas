-- DRM-IA Finanzas · Migración 002 · Cerrar escritura de app_settings
-- Antes, cualquier usuario logueado podía modificar el alias de cobro y el precio.
-- Después: solo se puede leer. Los cambios se hacen desde el panel de Supabase
-- (Table Editor) o con la clave service_role, que ignora RLS.

drop policy if exists "Usuarios autenticados modifican settings" on public.app_settings;
alter table public.app_settings enable row level security;

-- Verificación: debe quedar solo la política de lectura (SELECT)
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'app_settings';
