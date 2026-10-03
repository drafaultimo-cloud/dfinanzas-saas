'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { budgetStatus, currentMonthOf, upcomingEvents } from '@/lib/planning';
import { HubProps, useTable } from './ui';

/** Avisos cortos en el Resumen: presupuestos que se pasan y vencimientos de los próximos 3 días. */
export default function AlertsStrip(p: HubProps & { onOpen: () => void }) {
  const { rows: budgets } = useTable(p.supabase, 'budgets', p.userId);
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const status = useMemo(() => budgetStatus(budgets, p.transactions, currentMonthOf(new Date()), p.profile, p.usdRate), [budgets, p.transactions, p.profile, p.usdRate]);
  const bad = status.filter(s => s.status !== 'ok');
  const soon = useMemo(
    () => upcomingEvents(p.creditCards, p.loans, recurring, new Date(), 3, p.usdRate).filter(e => e.kind !== 'card_close'),
    [p.creditCards, p.loans, recurring, p.usdRate]
  );
  if (bad.length === 0 && soon.length === 0) return null;
  return (
    <div className="space-y-2">
      {bad.length > 0 && (
        <button onClick={p.onOpen} className="w-full text-left bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl p-3 flex items-center gap-2 cursor-pointer">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Presupuesto:</strong>{' '}
            {bad.slice(0, 3).map(b => `${b.category} ${Math.round(b.pct)}%`).join(' · ')}
            {bad.length > 3 ? ` y ${bad.length - 3} más` : ''}
          </span>
        </button>
      )}
      {soon.length > 0 && (
        <button onClick={p.onOpen} className="w-full text-left bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl p-3 flex items-center gap-2 cursor-pointer">
          <CalendarClock className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Vence pronto:</strong>{' '}
            {soon.slice(0, 3).map(e => `${e.label} (${e.daysLeft === 0 ? 'hoy' : e.daysLeft === 1 ? 'mañana' : `en ${e.daysLeft} días`})`).join(' · ')}
          </span>
        </button>
      )}
    </div>
  );
}
