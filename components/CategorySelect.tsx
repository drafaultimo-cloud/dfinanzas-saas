'use client';

import React, { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { categoryLabel, validateNewCategory } from '@/lib/categories';

/** Guarda un rubro propio del usuario. Si la tabla todavía no existe (migración 010) no rompe: el rubro igual
 *  funciona porque queda guardado en los movimientos que lo usan. Devuelve true si se pudo guardar en la tabla. */
export async function saveUserCategory(supabase: SupabaseClient, userId: string, name: string): Promise<boolean> {
  const { error } = await supabase.from('user_categories').insert([{ user_id: userId, name }]);
  return !error || error.code === '23505';
}

interface Props {
  value: string;
  categories: string[];
  onChange: (name: string) => void;
  /** Se llama solo cuando el rubro es nuevo (para guardarlo). Después se llama onChange con el nombre. */
  onCreate?: (name: string) => void | Promise<void>;
  className?: string;
  allowPending?: boolean;       // ofrece "Por Clasificar" (importador)
  disabled?: boolean;
  title?: string;
}

const NEW = '__new__';

/** Selector de rubro con la opción "➕ Crear rubro nuevo…" (se escribe el nombre ahí mismo). */
export default function CategorySelect({ value, categories, onChange, onCreate, className = '', allowPending = false, disabled, title }: Props) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');

  function cancel() { setCreating(false); setDraft(''); setErr(''); }
  async function confirm() {
    const r = validateNewCategory(draft, categories);
    if ('error' in r) { setErr(r.error); return; }
    if (!r.existed && onCreate) await onCreate(r.name);
    onChange(r.name);
    cancel();
  }

  if (creating) {
    return (
      <span className="flex flex-wrap items-center gap-1.5 w-full">
        <input
          autoFocus
          value={draft}
          maxLength={40}
          onChange={e => { setDraft(e.target.value); setErr(''); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
          placeholder="Nombre del rubro nuevo"
          className="flex-1 min-w-[9rem] text-xs border border-indigo-300 rounded-lg px-2 py-1.5 outline-none bg-white text-slate-800"
        />
        <button type="button" onClick={() => void confirm()} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white cursor-pointer">Crear</button>
        <button type="button" onClick={cancel} className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-500 bg-white cursor-pointer" aria-label="Cancelar">✕</button>
        {err && <span className="basis-full text-[10px] text-rose-600">{err}</span>}
      </span>
    );
  }

  const isPending = value === 'Por Clasificar';
  const needsExtra = !!value && !categories.includes(value) && !(allowPending && isPending);
  return (
    <select
      value={value}
      disabled={disabled}
      title={title}
      onChange={e => (e.target.value === NEW ? setCreating(true) : onChange(e.target.value))}
      className={className}
    >
      {allowPending && <option value="Por Clasificar">⚠️ Por Clasificar</option>}
      {needsExtra && <option value={value}>{isPending ? '⚠️ Por Clasificar' : categoryLabel(value)}</option>}
      {categories.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
      <option value={NEW}>➕ Crear rubro nuevo…</option>
    </select>
  );
}
