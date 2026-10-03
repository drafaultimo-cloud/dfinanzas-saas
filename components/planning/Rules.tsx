'use client';

import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { applyRules, cleanDesc } from '@/lib/planning';
import { btnPrimary, Card, EmptyHint, EXPENSE_CATEGORIES, HubProps, inputCls, MigrationNotice, useTable } from './ui';

export default function Rules(p: HubProps) {
  const { rows, missing, reload } = useTable<any>(p.supabase, 'category_rules', p.userId, 'created_at');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('Envíos');
  const [applied, setApplied] = useState('');
  const cats = useMemo(() => {
    const s = new Set<string>(EXPENSE_CATEGORIES);
    p.transactions.forEach(t => { if (t.category && t.type === 'expense') s.add(t.category); });
    return [...s].filter(c => c !== 'Por Clasificar');
  }, [p.transactions]);
  const pending = useMemo(
    () => p.transactions.filter(t => t.type === 'expense' && (t.category === 'Por Clasificar' || t.category === 'Otros') && applyRules(t.description, rows) && applyRules(t.description, rows) !== t.category),
    [p.transactions, rows]
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const k = keyword.trim().toLowerCase();
    if (k.length < 3) { alert('Escribí al menos 3 letras.'); return; }
    const { error } = await p.supabase.from('category_rules').upsert([{ user_id: p.ownUserId, keyword: k, category }], { onConflict: 'user_id,keyword' });
    if (error) { alert('No se pudo guardar: ' + error.message); return; }
    setKeyword(''); reload();
  }
  async function remove(id: string) {
    await p.supabase.from('category_rules').delete().eq('id', id).eq('user_id', p.ownUserId);
    reload();
  }
  async function applyToExisting() {
    let n = 0;
    for (const t of pending) {
      const cat = applyRules(t.description, rows);
      if (!cat) continue;
      const { error } = await p.supabase.from('transactions').update({ category: cat }).eq('id', t.id).eq('user_id', p.ownUserId);
      if (!error) n++;
    }
    setApplied(`Se recategorizaron ${n} movimientos.`);
    p.onChanged();
  }

  return (
    <Card title="Reglas de categorización" subtitle='Cuando una descripción contiene la palabra, la categoría se completa sola al importar. Ej: "correo argentino" → Envíos.'>
      {missing && <MigrationNotice table="category_rules" />}
      {rows.length === 0 ? <EmptyHint>Todavía no hay reglas.</EmptyHint> : (
        <div className="divide-y divide-slate-100">
          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-xs">
              <span>Si dice <strong className="text-slate-900">"{r.keyword}"</strong> → <span className="font-semibold text-indigo-700">{r.category}</span></span>
              {!p.readOnly && <button onClick={() => remove(r.id)} className="text-slate-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
        </div>
      )}
      {!p.readOnly && (
        <>
          <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Palabra (ej: correo argentino)" className={inputCls} required />
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>{cats.map(c => <option key={c}>{c}</option>)}</select>
            <button className={btnPrimary}>Agregar regla</button>
          </form>
          {pending.length > 0 && (
            <div className="text-xs bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center justify-between gap-2">
              <span>{pending.length} movimiento{pending.length > 1 ? 's' : ''} sin clasificar coincide{pending.length > 1 ? 'n' : ''} con tus reglas (ej: {cleanDesc(pending[0].description).slice(0, 30)}).</span>
              <button onClick={applyToExisting} className={btnPrimary}>Aplicar ahora</button>
            </div>
          )}
          {applied && <p className="text-xs text-emerald-700">{applied}</p>}
        </>
      )}
    </Card>
  );
}
