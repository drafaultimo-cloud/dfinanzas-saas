'use client';

import React, { useMemo } from 'react';
import { formatArs, upcomingEvents } from '@/lib/planning';
import { Card, EmptyHint, HubProps, useTable } from './ui';

const ICON: Record<string, string> = { card_due: '💳', card_close: '✂️', loan: '🏦', recurring: '🔁' };

export default function Dues(p: HubProps) {
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const events = useMemo(
    () => upcomingEvents(p.creditCards, p.loans, recurring, new Date(), 30, p.usdRate),
    [p.creditCards, p.loans, recurring, p.usdRate]
  );

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

      <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">Estos avisos también aparecen al entrar a la app, en “Hoy en tu app”, cuando falten 7 días o menos.</p>
    </Card>
  );
}
