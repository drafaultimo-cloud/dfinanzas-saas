-- DRM-IA Finanzas · Migración 012 · Tope mensual de IA por usuario + chat más seguro
-- Ejecutar en Supabase → SQL Editor. Es idempotente (se puede volver a correr).

-- 1) Contador de usos de IA por usuario, tipo y mes. Solo el servidor (service_role) lo toca.
create table if not exists public.ai_usage (
  user_id uuid not null,
  kind    text not null,
  month   text not null,           -- 'YYYY-MM'
  used    integer not null default 0,
  primary key (user_id, kind, month)
);
alter table public.ai_usage enable row level security;   -- sin políticas: ningún usuario puede leerla ni escribirla
revoke all on public.ai_usage from anon, authenticated;

-- 2) Suma un uso de forma atómica y avisa si ya se llegó al tope.
create or replace function public.consume_ai_quota(p_user uuid, p_kind text, p_month text, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql security definer set search_path = public as $$
declare v_used integer;
begin
  insert into public.ai_usage as u (user_id, kind, month, used)
  values (p_user, p_kind, p_month, 1)
  on conflict (user_id, kind, month)
  do update set used = u.used + 1 where u.used < p_limit
  returning u.used into v_used;

  if v_used is null then
    select u.used into v_used from public.ai_usage u where u.user_id = p_user and u.kind = p_kind and u.month = p_month;
    return query select false, coalesce(v_used, p_limit);
  else
    return query select true, v_used;
  end if;
end $$;

-- 3) Devuelve un uso cuando la IA falló (para no cobrarle al usuario un intento que no funcionó).
create or replace function public.release_ai_quota(p_user uuid, p_kind text, p_month text)
returns void language sql security definer set search_path = public as $$
  update public.ai_usage set used = greatest(used - 1, 0)
  where user_id = p_user and kind = p_kind and month = p_month;
$$;

revoke execute on function public.consume_ai_quota(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_ai_quota(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.consume_ai_quota(uuid, text, text, integer) to service_role;
grant  execute on function public.release_ai_quota(uuid, text, text) to service_role;

-- 4) Chat: un cliente solo puede escribirle al equipo de DRM-IA (antes podía mandarle mensajes a cualquier email).
drop policy if exists chat_insert on public.user_support_chats;
create policy chat_insert on public.user_support_chats for insert with check (
  sender_id = auth.uid()
  and lower(sender_email) = lower(auth.jwt() ->> 'email')
  and (
    lower(receiver_email) in ('drafaultimo@gmail.com', 'd_rafael_m@hotmail.com')
    or lower(sender_email) in ('drafaultimo@gmail.com', 'd_rafael_m@hotmail.com')
  )
);

-- Verificación: debe devolver la fila de ai_usage con rls = true
select c.relname as tabla, c.relrowsecurity as rls from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'ai_usage';
