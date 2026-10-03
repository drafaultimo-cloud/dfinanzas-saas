'use client';

import React, { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { categoryLabel, isBaseCategory, validateNewCategory } from '@/lib/categories';
import { saveUserCategory } from '../CategorySelect';
import { btnGhost, btnPrimary, Card, HubProps, inputCls, MigrationNotice, useCategoryList } from './ui';

/** Administrar rubros: crear los propios, renombrarlos (se actualizan los movimientos, presupuestos y reglas) o eliminarlos. */
export default function Rubros(p: HubProps) {
  const { cats, rows, missing, reload } = useCategoryList(p);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of p.transactions) if (t.type === 'expense' && t.category) m.set(t.category, (m.get(t.category) || 0) + 1);
    return m;
  }, [p.transactions]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = validateNewCategory(draft, cats);
    if ('error' in r) { setMsg(r.error); return; }
    if (r.existed) { setMsg(`Ya existe el rubro “${r.name}”.`); return; }
    setBusy(true);
    const ok = await saveUserCategory(p.supabase, p.ownUserId, r.name);
    setBusy(false);
    setDraft('');
    setMsg(ok ? `Listo: creaste el rubro “${r.name}”. Ya lo podés elegir al cargar o corregir un gasto.` : 'No se pudo guardar el rubro (falta la migración 010).');
    reload();
  }

  async function rename(old: string) {
    const r = validateNewCategory(editDraft, cats.filter(c => c !== old));
    if ('error' in r) { setMsg(r.error); return; }
    if (r.existed) { setMsg(`Ya existe un rubro llamado “${r.name}”.`); return; }
    if (r.name === old) { setEditing(null); return; }
    setBusy(true);
    const uid = p.ownUserId;
    const res = await Promise.all([
      p.supabase.from('transactions').update({ category: r.name }).eq('user_id', uid).eq('category', old),
      p.supabase.from('budgets').update({ category: r.name }).eq('user_id', uid).eq('category', old),
      p.supabase.from('category_rules').update({ category: r.name }).eq('user_id', uid).eq('category', old),
      p.supabase.from('recurring_items').update({ category: r.name }).eq('user_id', uid).eq('category', old),
    ]);
    const failed = res.find(x => x.error && !/does not exist|schema cache|42P01|PGRST205/i.test(`${x.error.code} ${x.error.message}`));
    // El nombre en la tabla de rubros propios: se actualiza si estaba, y si no, se crea.
    const upd = await p.supabase.from('user_categories').update({ name: r.name }).eq('user_id', uid).eq('name', old).select('id');
    if (!upd.error && (upd.data || []).length === 0) await saveUserCategory(p.supabase, uid, r.name);
    setBusy(false);
    setEditing(null);
    setMsg(failed ? 'No se pudo renombrar del todo: ' + failed.error!.message : `Listo: “${old}” ahora se llama “${r.name}” en todos tus movimientos.`);
    p.onChanged();
    reload();
  }

  async function remove(name: string) {
    const n = counts.get(name) || 0;
    if (!confirm(`¿Eliminar el rubro “${name}”?\n\n${n > 0 ? `Sus ${n} movimientos pasan a “Otros”. ` : ''}Se quitan también sus presupuestos y reglas.`)) return;
    setBusy(true);
    const uid = p.ownUserId;
    await Promise.all([
      p.supabase.from('transactions').update({ category: 'Otros' }).eq('user_id', uid).eq('category', name),
      p.supabase.from('recurring_items').update({ category: 'Otros' }).eq('user_id', uid).eq('category', name),
      p.supabase.from('budgets').delete().eq('user_id', uid).eq('category', name),
      p.supabase.from('category_rules').delete().eq('user_id', uid).eq('category', name),
      p.supabase.from('user_categories').delete().eq('user_id', uid).eq('name', name),
    ]);
    setBusy(false);
    setMsg(`Listo: eliminaste “${name}”.`);
    p.onChanged();
    reload();
  }


  return (
    <Card title="Rubros" subtitle="Creá tus propios rubros (por ejemplo Mascotas, Gimnasio o Regalos) y usalos al cargar un gasto, en presupuestos y en reglas. Para cambiar el rubro de un gasto puntual, tocá su rubro en el Historial.">
      {missing && <MigrationNotice table="user_categories" file="010_rubros_propios.sql" />}

      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={draft} onChange={e => { setDraft(e.target.value); setMsg(''); }} maxLength={40} placeholder="Nombre del rubro nuevo" className={inputCls + ' flex-1 min-w-[12rem]'} />
        <button className={btnPrimary} disabled={busy}>Crear rubro</button>
      </form>
      {msg && <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-2.5 break-words">{msg}</p>}

      <div className="divide-y divide-slate-100">
        {cats.map(c => {
          const core = isBaseCategory(c);
          const n = counts.get(c) || 0;
          return (
            <div key={c} className="py-2 text-xs">
              {editing === c ? (
                <form onSubmit={e => { e.preventDefault(); void rename(c); }} className="flex flex-wrap gap-2 items-center">
                  <input autoFocus value={editDraft} maxLength={40} onChange={e => setEditDraft(e.target.value)} className={inputCls + ' flex-1 min-w-[10rem]'} />
                  <button className={btnPrimary} disabled={busy}>Guardar</button>
                  <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 break-words">{categoryLabel(c)}</p>
                    <p className="text-[10px] text-slate-400">{n} movimiento{n === 1 ? '' : 's'}{core ? ' · rubro base de la app' : ''}</p>
                  </div>
                  {!core && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setEditing(c); setEditDraft(c); setMsg(''); }} title="Renombrar" className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg border border-slate-200 bg-white cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => void remove(c)} title="Eliminar" className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 bg-white cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
