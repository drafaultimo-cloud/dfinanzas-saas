'use client';

import React, { useMemo, useState } from 'react';
import { budgetStatus, currentMonthOf, dailyDigest, formatArs, goalProgress, upcomingEvents } from '@/lib/planning';
import { needsFxFix } from '@/lib/fx';
import { HubProps, useTable } from './ui';

export type AlertTarget = 'budgets' | 'dues' | 'goals' | 'add' | 'history' | 'fx';

interface AlertItem {
  key: string;
  level: 'high' | 'mid' | 'low';
  icon: string;
  text: React.ReactNode;
  target: AlertTarget;
  action: string;
}

const LEVEL_CLS: Record<AlertItem['level'], string> = {
  high: 'bg-rose-50 border-rose-200 text-rose-900',
  mid: 'bg-amber-50 border-amber-200 text-amber-900',
  low: 'bg-indigo-50 border-indigo-100 text-indigo-900',
};
const ORDER = { high: 0, mid: 1, low: 2 } as const;
const hideKey = (day: string) => `drm-alerts-hidden:${day}`;
const when = (d: number) => (d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`);

/**
 * "Hoy en tu app": avisos que se ven al entrar (reemplaza a los recordatorios por email).
 * Vencimientos, presupuestos, ritmo de carga, gasto de ayer, metas y pendientes por completar.
 */
export default function AlertsStrip(p: HubProps & { onGo: (t: AlertTarget) => void }) {
  const { rows: budgets } = useTable(p.supabase, 'budgets', p.userId);
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const { rows: goals } = useTable(p.supabase, 'savings_goals', p.userId);
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => currentMonthOf(today) + '-' + String(today.getDate()).padStart(2, '0'), [today]);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(hideKey(todayStr)) === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);

  const items = useMemo(() => {
    const out: AlertItem[] = [];

    // 1) Vencimientos de los próximos 7 días
    const soon = upcomingEvents(p.creditCards, p.loans, recurring, today, 7, p.usdRate).filter(e => e.kind !== 'card_close');
    for (const e of soon.slice(0, 4)) {
      out.push({
        key: `due-${e.kind}-${e.label}-${e.date}`,
        level: e.daysLeft <= 2 ? 'high' : 'mid',
        icon: e.kind === 'card_due' ? '💳' : e.kind === 'loan' ? '🏦' : '🔁',
        text: <><strong>{e.label}</strong> vence {when(e.daysLeft)}{e.amount !== undefined ? ` · ${formatArs(e.amount)}` : ''}</>,
        target: 'dues', action: 'Ver vencimientos',
      });
    }

    // 2) Presupuestos cerca del tope o pasados
    const status = budgetStatus(budgets, p.transactions, currentMonthOf(today), p.profile, p.usdRate);
    for (const b of status.filter(s => s.status !== 'ok').slice(0, 3)) {
      out.push({
        key: `bud-${b.category}`,
        level: b.status === 'over' ? 'high' : 'mid',
        icon: b.status === 'over' ? '🚨' : '⚠️',
        text: <><strong>{b.category}</strong>: {b.status === 'over' ? `te pasaste ${formatArs(b.spent - b.limit)} del tope` : `ya usaste el ${Math.round(b.pct)}% del tope`}</>,
        target: 'budgets', action: 'Ver presupuestos',
      });
    }

    // 3) Ritmo de carga + gasto de ayer + semana
    const d = dailyDigest(p.transactions, p.profile, p.usdRate, today);
    if (!p.readOnly) {
      if (d.daysSinceLast === null) {
        out.push({ key: 'empty', level: 'mid', icon: '📝', text: <>Todavía no cargaste movimientos. Importá un resumen o cargá tu primer gasto.</>, target: 'add', action: 'Cargar ahora' });
      } else if (d.daysSinceLast >= 2) {
        out.push({ key: 'stale', level: d.daysSinceLast >= 4 ? 'high' : 'mid', icon: '📝', text: <>Hace <strong>{d.daysSinceLast} días</strong> que no cargás movimientos. ¿Qué gastaste?</>, target: 'add', action: 'Cargar ahora' });
      }
    }
    if (d.yesterdayCount > 0) {
      out.push({ key: 'yday', level: 'low', icon: '📅', text: <>Ayer gastaste <strong>{formatArs(d.yesterdayTotal)}</strong> en {d.yesterdayCount} movimiento{d.yesterdayCount === 1 ? '' : 's'}.</>, target: 'history', action: 'Ver historial' });
    }
    if (d.prevWeekTotal > 0 && d.weekTotal > d.prevWeekTotal * 1.2) {
      const pct = Math.round((d.weekTotal / d.prevWeekTotal - 1) * 100);
      out.push({ key: 'week', level: 'mid', icon: '📈', text: <>Esta semana gastás <strong>{pct}% más</strong> que la anterior ({formatArs(d.weekTotal)} vs {formatArs(d.prevWeekTotal)}).</>, target: 'history', action: 'Ver historial' });
    }

    // 4) Metas de ahorro
    for (const g of goals.slice(0, 2) as any[]) {
      const gp = goalProgress(g, today);
      if (gp.pct >= 100) continue;
      out.push({
        key: `goal-${g.id}`, level: 'low', icon: '🎯',
        text: <><strong>{g.name}</strong>: llevás el {Math.round(gp.pct)}%{gp.monthlyNeeded ? ` · ahorrá ${formatArs(gp.monthlyNeeded)} este mes para llegar` : ''}</>,
        target: 'goals', action: 'Ver metas',
      });
    }

    // 5) Pendientes por completar
    const fxPending = p.readOnly ? [] : p.transactions.filter(needsFxFix);
    if (fxPending.length > 0) {
      out.push({ key: 'fx', level: 'mid', icon: '💱', text: <><strong>{fxPending.length}</strong> movimiento{fxPending.length === 1 ? '' : 's'} parece{fxPending.length === 1 ? '' : 'n'} compra o venta de dólares y figura{fxPending.length === 1 ? '' : 'n'} como gasto o ingreso.</>, target: 'fx', action: 'Corregir' });
    }
    if (!p.readOnly && d.unassignedTransfers > 0) {
      out.push({ key: 'unassigned', level: 'low', icon: '🔀', text: <><strong>{d.unassignedTransfers}</strong> transferencia{d.unassignedTransfers === 1 ? '' : 's'} sin asignar a qué cuenta fue o vino.</>, target: 'history', action: 'Asignar' });
    }

    return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  }, [p.creditCards, p.loans, p.transactions, p.profile, p.usdRate, p.readOnly, recurring, budgets, goals, today]);

  function hideToday() {
    setHidden(true);
    try { localStorage.setItem(hideKey(todayStr), '1'); } catch { /* sin almacenamiento: solo se oculta ahora */ }
  }

  if (hidden) {
    return (
      <button onClick={() => setHidden(false)} className="text-[11px] text-slate-400 hover:text-indigo-600 underline cursor-pointer">
        Mostrar alertas de hoy ({items.length})
      </button>
    );
  }

  const high = items.filter(i => i.level === 'high').length;
  const shown = expanded ? items : items.slice(0, 4);
  return (
    <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          🔔 Hoy en tu app
          {items.length > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${high > 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>{items.length}</span>
          )}
        </h2>
        <button onClick={hideToday} className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer whitespace-nowrap">Ocultar por hoy</button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-3">✅ Todo al día: sin vencimientos cercanos ni presupuestos excedidos. Volvé mañana para registrar tus gastos.</p>
      ) : (
        <div className="space-y-1.5">
          {shown.map(i => (
            <button key={i.key} onClick={() => p.onGo(i.target)} className={`w-full text-left border rounded-xl p-2.5 text-xs flex items-start gap-2 cursor-pointer ${LEVEL_CLS[i.level]}`}>
              <span className="shrink-0">{i.icon}</span>
              <span className="min-w-0 flex-1 break-words">{i.text}</span>
              <span className="shrink-0 text-[10px] font-bold underline whitespace-nowrap">{i.action}</span>
            </button>
          ))}
          {items.length > 4 && (
            <button onClick={() => setExpanded(e => !e)} className="text-[11px] text-indigo-600 font-semibold cursor-pointer">
              {expanded ? 'Ver menos' : `Ver ${items.length - 4} más`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
