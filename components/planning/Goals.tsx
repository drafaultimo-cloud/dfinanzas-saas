'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatArs, goalProgress } from '@/lib/planning';
import { Bar, btnGhost, btnPrimary, Card, EmptyHint, HubProps, inputCls, MigrationNotice, useTable } from './ui';

export default function Goals(p: HubProps) {
  const { rows, missing, reload } = useTable<any>(p.supabase, 'savings_goals', p.userId, 'created_at');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [date, setDate] = useState('');
  const money = (n: number, c: string) => (c === 'USD' ? `u$s ${Math.round(n).toLocaleString('es-AR')}` : formatArs(n));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(target);
    if (!name.trim() || !(v > 0)) return;
    const { error } = await p.supabase.from('savings_goals').insert([{ user_id: p.ownUserId, name: name.trim(), target_amount: v, currency, target_date: date || null }]);
    if (error) { alert('No se pudo guardar: ' + error.message); return; }
    setName(''); setTarget(''); setDate(''); reload();
  }
  async function contribute(g: any) {
    const raw = window.prompt(`¿Cuánto sumás a "${g.name}"? (usá un número negativo para retirar)`, '');
    if (raw === null) return;
    const v = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(v) || v === 0) return;
    await p.supabase.from('savings_goals').update({ saved_amount: Math.max(0, Number(g.saved_amount) + v) }).eq('id', g.id).eq('user_id', p.ownUserId);
    reload();
  }
  async function remove(g: any) {
    if (!confirm(`¿Borrar la meta "${g.name}"?`)) return;
    await p.supabase.from('savings_goals').delete().eq('id', g.id).eq('user_id', p.ownUserId);
    reload();
  }

  return (
    <Card title="Metas de ahorro" subtitle="Un objetivo con monto y fecha: la app calcula cuánto tenés que guardar por mes.">
      {missing && <MigrationNotice table="savings_goals" />}
      {rows.length === 0 ? <EmptyHint>Todavía no tenés metas. Probá con "Vacaciones" o "Fondo de emergencia".</EmptyHint> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((g: any) => {
            const pr = goalProgress(g, new Date());
            return (
              <div key={g.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-slate-800">{g.name}</p>
                  {!p.readOnly && <button onClick={() => remove(g)} className="text-slate-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
                <Bar pct={pr.pct} status={pr.pct >= 100 ? 'ok' : 'neutral'} />
                <p className="text-[11px] text-slate-600">{money(pr.saved, g.currency)} de {money(pr.target, g.currency)} · {Math.round(pr.pct)}%</p>
                {pr.monthlyNeeded !== null && pr.pct < 100 && (
                  <p className="text-[11px] font-semibold text-indigo-700">
                    {pr.monthsLeft === 0 ? 'La fecha ya llegó' : `Guardá ${money(pr.monthlyNeeded, g.currency)} por mes durante ${pr.monthsLeft} ${pr.monthsLeft === 1 ? 'mes' : 'meses'}`}
                  </p>
                )}
                {pr.pct >= 100 && <p className="text-[11px] font-bold text-emerald-700">¡Meta cumplida!</p>}
                {!p.readOnly && <button className={btnGhost} onClick={() => contribute(g)}>Sumar o retirar ahorro</button>}
              </div>
            );
          })}
        </div>
      )}
      {!p.readOnly && (
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la meta" className={inputCls + ' col-span-2'} required />
          <input type="number" min="1" value={target} onChange={e => setTarget(e.target.value)} placeholder="Monto objetivo" className={inputCls} required />
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}><option>ARS</option><option>USD</option></select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} title="Fecha objetivo (opcional)" />
          <button className={btnPrimary + ' col-span-2 md:col-span-5'}>Crear meta</button>
        </form>
      )}
    </Card>
  );
}
