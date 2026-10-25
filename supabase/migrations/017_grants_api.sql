-- Permisos de la API de datos (GRANT) para tablas del esquema public.
-- Desde el 30/10/2026 Supabase ya no los otorga solos en tablas nuevas.
-- Es idempotente y seguro de re-ejecutar. NO reemplaza a RLS: las politicas
-- siguen decidiendo que filas ve cada rol. 'anon' no recibe acceso a nada.
do $$
declare t text;
begin
  -- Tablas que la app usa con sesion de usuario (authenticated) + backend (service_role)
  foreach t in array array['budgets','card_plans','category_rules','credit_cards','loans','net_worth_snapshots','payment_receipts','recurring_items','referral_codes','referrals','reminder_prefs','savings_goals','shares','transactions','user_categories','user_support_chats']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
  -- Tablas solo para el backend (sin acceso desde el navegador)
  foreach t in array array['ai_usage','app_settings']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;
end $$;
