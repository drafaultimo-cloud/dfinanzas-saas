-- DRM-IA Finanzas · Migración 001 · Seguridad (RLS) y columnas nuevas
-- Ejecutar en Supabase → SQL Editor. REVISAR antes de correr: reemplaza TODAS las
-- políticas existentes de estas 5 tablas por las de este archivo.
-- Es idempotente: se puede volver a ejecutar.

-- 1) Columnas nuevas para validar pagos en el servidor
alter table if exists public.payment_receipts add column if not exists plan text;
alter table if exists public.payment_receipts add column if not exists receipt_hash text;
alter table if exists public.payment_receipts add column if not exists operation_number text;

-- Un mismo comprobante / número de operación no puede aprobarse dos veces
create unique index if not exists payment_receipts_hash_approved_uq
  on public.payment_receipts (receipt_hash)
  where receipt_hash is not null and ai_status = 'approved_by_ai' and coalesce(admin_status, '') <> 'rejected';
create unique index if not exists payment_receipts_op_approved_uq
  on public.payment_receipts (operation_number)
  where operation_number is not null and ai_status = 'approved_by_ai' and coalesce(admin_status, '') <> 'rejected';

-- El chat: el cliente no conoce el id del admin, el destinatario se identifica por email
alter table if exists public.user_support_chats alter column receiver_id drop not null;

-- 2) Solo se reemplazan las políticas de las dos tablas que cambian de dueño (pagos y chat).
--    transactions, credit_cards y loans YA tienen su política "auth.uid() = user_id": no se tocan.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('payment_receipts','user_support_chats')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Activar RLS (idempotente)
alter table public.transactions        enable row level security;
alter table public.credit_cards        enable row level security;
alter table public.loans               enable row level security;
alter table public.payment_receipts    enable row level security;
alter table public.user_support_chats  enable row level security;

-- 5) Comprobantes: el usuario SOLO puede leer los suyos. Las altas y los cambios de estado
--    los hace el servidor (clave service_role, que ignora RLS) tras validar el pago.
create policy pr_select on public.payment_receipts for select using (auth.uid() = user_id);

-- 6) Chat: solo participantes; el remitente no puede falsificarse
create policy chat_select on public.user_support_chats for select using (
  lower(sender_email)   = lower(auth.jwt() ->> 'email') or
  lower(receiver_email) = lower(auth.jwt() ->> 'email')
);
create policy chat_insert on public.user_support_chats for insert with check (
  sender_id = auth.uid() and lower(sender_email) = lower(auth.jwt() ->> 'email')
);
create policy chat_mark_read on public.user_support_chats for update
  using (lower(receiver_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(receiver_email) = lower(auth.jwt() ->> 'email'));
