'use client';

import React, { useEffect, useState } from 'react';

type Prefs = { digest: boolean; alerts: boolean; daysBefore: number };

/** Preferencias de correo: avisos de vencimientos/presupuestos y resumen semanal (lunes). */
export default function EmailPrefs({ authFetch }: { authFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [p, setP] = useState<Prefs | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch('/api/email-prefs');
        const j = await r.json().catch(() => null);
        if (r.ok && j) setP(j); else setFailed(true);
      } catch { setFailed(true); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(patch: Partial<Prefs>) {
    if (!p) return;
    const next = { ...p, ...patch };
    setP(next);
    setSaving(true);
    try {
      await authFetch('/api/email-prefs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    } catch { /* se reintenta al volver a tocar */ }
    setSaving(false);
  }

  if (failed) return null;
  return (
    <div className="border-t border-slate-100 pt-3 space-y-2">
      <p className="font-bold text-slate-800">Correos de la app</p>
      {!p ? <p className="text-slate-400">Cargando…</p> : (
        <>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={p.alerts} onChange={e => save({ alerts: e.target.checked })} className="mt-0.5" />
            <span>Avisarme por correo cuando se acerca un vencimiento o me paso de un presupuesto.</span>
          </label>
          {p.alerts && (
            <label className="flex items-center gap-2 pl-6">
              Con
              <select value={p.daysBefore} onChange={e => save({ daysBefore: Number(e.target.value) })} className="border border-slate-200 rounded-lg px-2 py-1 bg-white">
                {[1, 2, 3, 5, 7, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              días de anticipación
            </label>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={p.digest} onChange={e => save({ digest: e.target.checked })} className="mt-0.5" />
            <span>Mandarme un resumen de la semana los lunes.</span>
          </label>
          {saving && <p className="text-[10px] text-slate-400">Guardando…</p>}
        </>
      )}
    </div>
  );
}
