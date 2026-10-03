'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatArs, upcomingEvents } from '@/lib/planning';
import { btnPrimary, Card, EmptyHint, HubProps, inputCls, MigrationNotice, useTable } from './ui';

const ICON: Record<string, string> = { card_due: '💳', card_close: '✂️', loan: '🏦', recurring: '🔁' };

export default function Dues(p: HubProps) {
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const { rows: prefs, missing, reload } = useTable(p.supabase, 'reminder_prefs', p.userId);
  const pref = prefs[0] as any;
  const [enabled, setEnabled] = useState(false);
  const [days, setDays] = useState('3');
  const [saved, setSaved] = useState('');
  useEffect(() => { if (pref) { setEnabled(!!pref.email_enabled); setDays(String(pref.days_before ?? 3)); } }, [pref]);

  const events = useMemo(
    () => upcomingEvents(p.creditCards, p.loans, recurring, new Date(), 30, p.usdRate),
    [p.creditCards, p.loans, recurring, p.usdRate]
  );

  async function savePrefs() {
    const { error } = await p.supabase.from('reminder_prefs').upsert(
      [{ user_id: p.ownUserId, email_enabled: enabled, days_before: Math.min(15, Math.max(0, parseInt(days, 10) || 3)) }],
      { onConflict: 'user_id' }
    );
    setSaved(error ? 'No se pudo guardar: ' + error.message : 'Listo, guardado.');
    reload();
  }

  return (
    <Card title="Próximos vencimientos (30 días)" subtitle="Cierres y vencimientos de tarjetas, cuotas de préstamos y gastos recurrentes, calculados con los días que ya cargaste.">
      {events.length === 0 ? (
        <EmptyHint>No hay vencimientos en los próximos 30 días. Cargá el día de cierre y vencimiento en tus tarjetas.</EmptyHint>
      ) : (
        <div className="divide-y divide-slate-100">
          {events.map((e, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-xs">
              <span className="flex items-center gap-2">
                <span>{ICON[e.kind]}</span>
                <span className="font-semibold text-slate-800">{e.label}</span>
              </span>
              <span className="flex items-center gap-3">
                {e.amount !== undefined && <span className="font-bold text-slate-700">{formatArs(e.amount)}</span>}
                <span className="font-mono text-slate-400">{e.date.split('-').reverse().slice(0, 2).join('/')}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${e.daysLeft <= 3 ? 'bg-rose-100 text-rose-700' : e.daysLeft <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  {e.daysLeft === 0 ? 'hoy' : e.daysLeft === 1 ? 'mañana' : `en ${e.daysLeft} días`}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {!p.readOnly && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-indigo-600" /> Recordatorios por email</p>
          {missing && <MigrationNotice table="reminder_prefs" />}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
              Avisarme por email
            </label>
            <label className="flex items-center gap-2">
              con
              <input type="number" min="0" max="15" value={days} onChange={e => setDays(e.target.value)} className={inputCls + ' !w-16'} />
              días de anticipación
            </label>
            <button onClick={savePrefs} className={btnPrimary}>Guardar</button>
            {saved && <span className="text-[11px] text-slate-500">{saved}</span>}
          </div>
          <p className="text-[10px] text-slate-400">El aviso se envía una vez por día, a las 8 de la mañana (hora Argentina), solo si hay algo por vencer. WhatsApp todavía no está disponible.</p>
        </div>
      )}
    </Card>
  );
}
