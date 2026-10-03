'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Tx } from '@/lib/planning';
import { buildCategories, DEFAULT_CATEGORIES } from '@/lib/categories';

export interface HubProps {
  supabase: SupabaseClient;
  userId: string;            // dueño de los datos que se ven
  ownUserId: string;         // usuario logueado
  readOnly: boolean;         // viendo datos compartidos
  transactions: Tx[];
  creditCards: Tx[];
  loans: Tx[];
  profile: Profile;
  usdRate: number;
  onChanged: () => void;     // recarga transacciones/tarjetas/billeteras
}

export const EXPENSE_CATEGORIES = DEFAULT_CATEGORIES;

export function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Bar({ pct, status }: { pct: number; status: 'ok' | 'warn' | 'over' | 'neutral' }) {
  const color = status === 'over' ? 'bg-rose-500' : status === 'warn' ? 'bg-amber-500' : status === 'ok' ? 'bg-emerald-500' : 'bg-indigo-500';
  return (
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export const inputCls = 'w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-400 bg-white';
export const btnPrimary = 'px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer';
export const btnGhost = 'px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer border border-slate-200';

export function MigrationNotice({ table, file = '008_planificacion.sql' }: { table: string; file?: string }) {
  return (
    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
      Falta crear la tabla <strong>{table}</strong>. Ejecutá la migración <strong>{file}</strong> en el SQL Editor de Supabase y recargá.
    </p>
  );
}

/** Carga una tabla del usuario y avisa si la migración no se corrió. */
export function useTable<T = any>(supabase: SupabaseClient, table: string, userId: string, order?: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const reload = useCallback(async () => {
    if (!userId) return;
    let q = supabase.from(table).select('*').eq('user_id', userId);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) {
      setMissing(/does not exist|schema cache|42P01|PGRST205/i.test(`${error.code} ${error.message}`));
      setRows([]);
    } else {
      setMissing(false);
      setRows((data || []) as T[]);
    }
    setLoading(false);
  }, [supabase, table, userId, order]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, missing, reload };
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400 py-2">{children}</p>;
}

/** Lista de rubros del usuario: los base + los que creó + los que ya usa en sus movimientos. */
export function useCategoryList(p: HubProps) {
  const t = useTable<any>(p.supabase, 'user_categories', p.userId, 'created_at');
  const cats = useMemo(() => buildCategories(t.rows.map((r: any) => r.name), p.transactions), [t.rows, p.transactions]);
  return { cats, rows: t.rows, missing: t.missing, reload: t.reload };
}
