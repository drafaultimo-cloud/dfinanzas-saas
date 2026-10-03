'use client';

import React, { useMemo, useState } from 'react';
import { Trash2, Sparkles } from 'lucide-react';
import { currentMonthOf, detectSubscriptions, formatArs } from '@/lib/planning';
import { generateDueRecurring } from '@/lib/planning-client';
import { btnGhost, btnPrimary, Card, EmptyHint, EXPENSE_CATEGORIES, HubProps, inputCls, MigrationNotice, useTable } from './ui';

export default function Recurring(p: HubProps) {
  const { rows, missing, reload } = useTable<any>(p.supabase, 'recurring_items', p.userId, 'created_at');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Servicios');
  const [day, setDay] = useState('1');
  const [accountKey, setAccountKey] = useState('');
  const [msg, setMsg] = useState('');

  const suggestions = useMemo(
    () => detectSubscriptions(p.transactions, rows, currentMonthOf(new Date())).filter(s => s.profile === p.profile),
    [p.transactions, rows, p.profile]
  );

  async function insert(rec: any) {
    const { error } = await p.supabase.from('recurring_items').insert([{ user_id: p.ownUserId, ...rec }]);
    if (error) { alert('No se pudo guardar: ' + error.message); return false; }
    const n = await generateDueRecurring(p.supabase, p.ownUserId);
    if (n > 0) { setMsg(`Se cargó ${n} movimiento de este mes.`); p.onChanged(); }
    reload();
    return true;
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(amount);
    if (!desc.trim() || !(v > 0)) return;
    const ok = await insert({
      description: desc.trim(), amount: v, currency, type, category: type === 'income' ? 'Ingreso' : category,
      profile: p.profile, day_of_month: Math.min(31, Math.max(1, parseInt(day, 10) || 1)),
      credit_card_id: accountKey.startsWith('card:') ? accountKey.slice(5) : null,
      loan_id: accountKey.startsWith('loan:') ? accountKey.slice(5) : null,
    });
    if (ok) { setDesc(''); setAmount(''); }
  }
  async function toggle(r: any) {
    await p.supabase.from('recurring_items').update({ active: !r.active }).eq('id', r.id).eq('user_id', p.ownUserId);
    reload();
  }
  async function remove(r: any) {
    if (!confirm(`¿Quitar "${r.description}"? Los movimientos ya cargados se conservan.`)) return;
    await p.supabase.from('recurring_items').delete().eq('id', r.id).eq('user_id', p.ownUserId);
    reload();
  }

  const mine = rows.filter((r: any) => (r.profile || 'personal') === p.profile);

  return (
    <div className="space-y-4">
      <Card
        title={`Gastos e ingresos recurrentes (${p.profile === 'business' ? 'Negocio' : 'Personal'})`}
        subtitle="Alquiler, internet, suscripciones, sueldo: se cargan solos el día elegido de cada mes, sin que tengas que hacer nada."
      >
        {missing && <MigrationNotice table="recurring_items" />}
        {msg && <p className="text-xs text-emerald-700">{msg}</p>}
        {mine.length === 0 ? <EmptyHint>Todavía no cargaste recurrentes.</EmptyHint> : (
          <div className="divide-y divide-slate-100">
            {mine.map((r: any) => (
              <div key={r.id} className={`flex items-center justify-between py-2 text-xs ${r.active ? '' : 'opacity-50'}`}>
                <span>
                  <span className="font-semibold text-slate-800">{r.description}</span>
                  <span className="text-slate-400"> · día {r.day_of_month} · {r.category}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className={`font-bold ${r.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {r.type === 'income' ? '+' : '-'}{r.currency === 'USD' ? `u$s ${Number(r.amount)}` : formatArs(Number(r.amount))}
                  </span>
                  {!p.readOnly && <>
                    <button onClick={() => toggle(r)} className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer">{r.active ? 'Pausar' : 'Activar'}</button>
                    <button onClick={() => remove(r)} className="text-slate-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>}
                </span>
              </div>
            ))}
          </div>
        )}
        {!p.readOnly && (
          <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (ej: Alquiler)" className={inputCls + ' col-span-2'} required />
            <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Importe" className={inputCls} required />
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}><option>ARS</option><option>USD</option></select>
            <select value={type} onChange={e => setType(e.target.value)} className={inputCls}><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
            {type === 'expense' && (
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            )}
            <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} title="Día del mes" className={inputCls} />
            <select value={accountKey} onChange={e => setAccountKey(e.target.value)} className={inputCls}>
              <option value="">Sin cuenta asignada</option>
              {p.creditCards.map(c => <option key={c.id} value={`card:${c.id}`}>Tarjeta: {c.name}</option>)}
              {p.loans.map(l => <option key={l.id} value={`loan:${l.id}`}>{l.entity}</option>)}
            </select>
            <button className={btnPrimary}>Agregar</button>
          </form>
        )}
      </Card>

      {!p.readOnly && suggestions.length > 0 && (
        <Card title="Suscripciones detectadas" subtitle="Gastos que se repiten todos los meses con un importe parecido. Si los convertís en recurrentes, se cargan solos.">
          <div className="divide-y divide-slate-100">
            {suggestions.slice(0, 8).map(s => (
              <div key={s.key} className="flex items-center justify-between py-2 text-xs">
                <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-semibold text-slate-800">{s.description}</span>
                  <span className="text-slate-400">· {s.months} meses seguidos · día {s.day}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-bold text-slate-700">{s.currency === 'USD' ? `u$s ${s.amount}` : formatArs(s.amount)}</span>
                  <button className={btnGhost} onClick={() => insert({ description: s.description, amount: s.amount, currency: s.currency, type: 'expense', category: s.category, profile: s.profile, day_of_month: s.day, last_generated_month: currentMonthOf(new Date()) })}>
                    Hacer recurrente
                  </button>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Al convertirlos, el mes en curso no se vuelve a cargar (ya figura en tus movimientos).</p>
        </Card>
      )}
    </div>
  );
}
