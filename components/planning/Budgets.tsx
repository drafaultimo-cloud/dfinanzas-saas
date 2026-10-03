'use client';

import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { budgetStatus, currentMonthOf, formatArs } from '@/lib/planning';
import CategorySelect, { saveUserCategory } from '../CategorySelect';
import { Bar, btnPrimary, Card, EmptyHint, HubProps, inputCls, MigrationNotice, useCategoryList, useTable } from './ui';

export default function Budgets(p: HubProps) {
  const { rows: budgets, missing, reload } = useTable(p.supabase, 'budgets', p.userId);
  const [category, setCategory] = useState('Supermercado');
  const [limit, setLimit] = useState('');
  const [alertPct, setAlertPct] = useState('80');
  const [busy, setBusy] = useState(false);
  const month = currentMonthOf(new Date());

  const status = useMemo(
    () => budgetStatus(budgets, p.transactions, month, p.profile, p.usdRate),
    [budgets, p.transactions, month, p.profile, p.usdRate]
  );
  const { cats, reload: reloadCats } = useCategoryList(p);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(limit);
    if (!(v > 0)) return;
    setBusy(true);
    const { error } = await p.supabase.from('budgets').upsert(
      [{ user_id: p.ownUserId, category, profile: p.profile, monthly_limit: v, alert_pct: Math.min(100, Math.max(1, parseInt(alertPct, 10) || 80)) }],
      { onConflict: 'user_id,profile,category' }
    );
    setBusy(false);
    if (error) { alert('No se pudo guardar: ' + error.message); return; }
    setLimit('');
    reload();
  }
  async function remove(id?: string) {
    if (!id) return;
    await p.supabase.from('budgets').delete().eq('id', id).eq('user_id', p.ownUserId);
    reload();
  }

  const over = status.filter(s => s.status === 'over').length;
  const warn = status.filter(s => s.status === 'warn').length;

  return (
    <Card
      title={`Presupuesto del mes (${p.profile === 'business' ? 'Negocio' : 'Personal'})`}
      subtitle="Poné un tope por categoría y la app te avisa cuando te acercás. Cuenta compras menos reintegros; no cuenta pagos de tarjeta ni transferencias propias."
    >
      {missing && <MigrationNotice table="budgets" />}
      {(over > 0 || warn > 0) && (
        <p className={`text-xs font-semibold rounded-xl p-2.5 ${over ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
          {over > 0 && `${over} categoría${over > 1 ? 's' : ''} superó el tope. `}
          {warn > 0 && `${warn} está${warn > 1 ? 'n' : ''} cerca del límite.`}
        </p>
      )}
      {status.length === 0 ? (
        <EmptyHint>Todavía no definiste topes. Empezá por la categoría donde más gastás.</EmptyHint>
      ) : (
        <div className="space-y-3">
          {status.map(s => (
            <div key={s.id || s.category} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800">{s.category}</span>
                <span className="flex items-center gap-2">
                  <span className={`font-bold ${s.status === 'over' ? 'text-rose-600' : s.status === 'warn' ? 'text-amber-600' : 'text-slate-700'}`}>
                    {formatArs(s.spent)} de {formatArs(s.limit)} · {Math.round(s.pct)}%
                  </span>
                  {!p.readOnly && (
                    <button onClick={() => remove(s.id)} className="text-slate-300 hover:text-red-500 cursor-pointer" title="Quitar tope"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </span>
              </div>
              <Bar pct={s.pct} status={s.status} />
              {s.status !== 'ok' && (
                <p className="text-[10px] text-slate-500">
                  {s.status === 'over' ? `Te pasaste ${formatArs(s.spent - s.limit)}.` : `Te quedan ${formatArs(s.limit - s.spent)} hasta el tope.`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!p.readOnly && (
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100 items-end">
          <label className="block">
            <span className="block text-[10px] text-slate-500 mb-0.5">Rubro</span>
            <CategorySelect
              value={category}
              categories={cats}
              onChange={setCategory}
              onCreate={async n => { await saveUserCategory(p.supabase, p.ownUserId, n); reloadCats(); }}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-[10px] text-slate-500 mb-0.5">Tope mensual</span>
            <span className="relative block">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">$</span>
              <input type="number" min="1" step="1" value={limit} onChange={e => setLimit(e.target.value)} placeholder="0" className={inputCls + ' !pl-6'} required />
            </span>
          </label>
          <label className="block">
            <span className="block text-[10px] text-slate-500 mb-0.5">Avisar al llegar al</span>
            <span className="relative block">
              <input type="number" min="1" max="100" value={alertPct} onChange={e => setAlertPct(e.target.value)} title="Avisar al llegar a este porcentaje del tope" className={inputCls + ' !pr-7'} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
            </span>
          </label>
          <button className={btnPrimary} disabled={busy}>Guardar tope</button>
        </form>
      )}
    </Card>
  );
}
