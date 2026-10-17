'use client';

import React, { useMemo, useState } from 'react';
import { computeNetWorth, formatArs, upcomingEvents } from '@/lib/planning';
import { safeToSpend, spentTodayCash } from '@/lib/safespend';
import { financialHealth } from '@/lib/health';
import type { ExpectedIncome } from '@/lib/forecast';
import type { AlertTarget } from './AlertsStrip';
import { Bar, HubProps, useTable } from './ui';

const INCOME_KEY = 'drm-expected-income';
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');

function readIncome(): ExpectedIncome | null {
  try {
    const v = JSON.parse(localStorage.getItem(INCOME_KEY) || 'null');
    return v && v.amount > 0 && v.day >= 1 && v.day <= 31 ? v : null;
  } catch { return null; }
}

const barStatus = (s: number): 'ok' | 'warn' | 'over' => (s >= 70 ? 'ok' : s >= 40 ? 'warn' : 'over');

export default function HomeCards(p: HubProps & { onGo: (target: AlertTarget) => void }) {
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const income = useMemo(readIncome, []);

  const nw = useMemo(() => computeNetWorth(p.creditCards, p.loans, p.usdRate), [p.creditCards, p.loans, p.usdRate]);
  const liquid = nw.digital + nw.cash;
  const events = useMemo(() => upcomingEvents(p.creditCards, p.loans, recurring, today, 45, p.usdRate), [p.creditCards, p.loans, recurring, today, p.usdRate]);
  const spent = useMemo(() => spentTodayCash(p.transactions, p.profile, p.usdRate, today), [p.transactions, p.profile, p.usdRate, today]);
  const s = useMemo(() => safeToSpend({ available: liquid, events, today, income, spentToday: spent }), [liquid, events, today, income, spent]);

  const loanMonthly = useMemo(() => p.loans.filter(l => l.kind === 'loan').reduce((a, l) => a + Number(l.installment_amount || 0), 0), [p.loans]);
  const h = useMemo(
    () => financialHealth({ txs: p.transactions, profile: p.profile, usdRate: p.usdRate, today, liquid, cardsDebt: nw.cardsDebt, loanMonthly }),
    [p.transactions, p.profile, p.usdRate, today, liquid, nw.cardsDebt, loanMonthly]
  );

  const noData = p.creditCards.length === 0 && p.loans.length === 0;
  const until = s.horizonKind === 'income' ? `hasta tu próximo cobro (${dm(s.horizonEnd)})` : 'hasta fin de mes';

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-2" aria-label="Cuánto podés gastar hoy">
        <h2 className="text-sm font-bold text-slate-900">💸 Cuánto podés gastar hoy</h2>
        {noData ? (
          <p className="text-xs text-slate-500">Cargá tus billeteras o efectivo y tus tarjetas para calcular cuánto podés gastar por día sin quedarte corto.</p>
        ) : s.shortfall > 0 ? (
          <>
            <p className="text-2xl font-black text-rose-600">$ 0 <span className="text-xs font-semibold text-rose-500">por día</span></p>
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-2.5">
              Con lo que tenés ({formatArs(s.available)}) no alcanza para cubrir los vencimientos {until}: faltan <strong>{formatArs(s.shortfall)}</strong>.
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-black text-emerald-700">{formatArs(s.perDay)} <span className="text-xs font-semibold text-slate-500">por día</span></p>
            <p className="text-xs text-slate-600">
              {s.leftToday >= 0
                ? <>Hoy te quedan <strong>{formatArs(s.leftToday)}</strong>{s.spentToday > 0 ? ` (ya gastaste ${formatArs(s.spentToday)})` : ''}.</>
                : <>Hoy ya te pasaste <strong>{formatArs(-s.leftToday)}</strong> del ritmo sano; mañana conviene gastar menos.</>}
            </p>
          </>
        )}
        {!noData && (
          <p className="text-[11px] text-slate-500">
            Tenés {formatArs(s.available)} en billeteras y efectivo, menos {formatArs(s.duesTotal)} de vencimientos {until}, repartido en {s.horizonDays} día{s.horizonDays === 1 ? '' : 's'}.
          </p>
        )}
        {!noData && s.dues.length > 0 && (
          <button onClick={() => p.onGo('dues')} className="text-[11px] text-indigo-600 font-semibold underline cursor-pointer">
            Ver los {s.dues.length} vencimiento{s.dues.length === 1 ? '' : 's'}
          </button>
        )}
        {!noData && !income && (
          <p className="text-[10px] text-slate-400">Para un cálculo más justo, cargá tu ingreso esperado en Planificación → Evolución → Proyección.</p>
        )}
      </section>

      <section className="bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-2" aria-label="Salud financiera">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">❤️ Tu salud financiera</h2>
          {h.dayStreak > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap" title={`Tu mejor racha: ${h.bestStreak} días`}>
              🔥 {h.dayStreak} día{h.dayStreak === 1 ? '' : 's'} cargando
            </span>
          )}
        </div>
        {h.score === null ? (
          <p className="text-xs text-slate-500">{h.tip}</p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-slate-900">{h.score}<span className="text-sm font-semibold text-slate-400">/100</span></p>
              <p className="text-xs font-bold text-slate-600 pb-1">{h.level}</p>
            </div>
            <Bar pct={h.score} status={barStatus(h.score)} />
            <p className="text-[11px] text-slate-600">💡 {h.tip}</p>
            <button onClick={() => setOpen(o => !o)} className="text-[11px] text-indigo-600 font-semibold underline cursor-pointer">
              {open ? 'Ocultar el detalle' : 'Cómo se calcula'}
            </button>
            {open && (
              <div className="space-y-2 pt-1">
                {h.parts.map(part => (
                  <div key={part.key} className="text-[11px]">
                    <div className="flex justify-between"><span className="font-semibold text-slate-700">{part.label}</span><span className="text-slate-500">{Math.round(part.score)}/100</span></div>
                    <Bar pct={part.score} status={barStatus(part.score)} />
                    <p className="text-slate-500 mt-0.5">{part.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {h.positiveMonths >= 2 && (
          <p className="text-[11px] text-emerald-700">🏅 {h.positiveMonths} meses seguidos cerrando en positivo.</p>
        )}
      </section>
    </div>
  );
}
