'use client';

import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatArs } from '@/lib/planning';
import { cardPaymentsByMonth, topPayees, weekdayProfile } from '@/lib/spending';
import { Card, EmptyHint, HubProps } from './ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);
const C_BLUE = '#2a78d6', C_ORANGE = '#eb6834', C_GRAY = '#94a3b8';

export default function Habits(p: HubProps & { endMonth: string; span: 6 | 12 }) {
  const months = p.span === 12 ? 6 : 3;
  const week = useMemo(() => weekdayProfile(p.transactions, p.profile, p.usdRate, p.endMonth, months, new Date()), [p.transactions, p.profile, p.usdRate, p.endMonth, months]);
  const payees = useMemo(() => topPayees(p.transactions, p.profile, p.usdRate, p.endMonth, months, 8), [p.transactions, p.profile, p.usdRate, p.endMonth, months]);
  const cardPaid = useMemo(() => cardPaymentsByMonth(p.transactions, p.endMonth, p.span).filter((r, i, a) => r.paid > 0 || a.slice(i).some(x => x.paid > 0)), [p.transactions, p.endMonth, p.span]);

  const hasWeek = week.some(d => d.total > 0);
  const max = Math.max(...week.map(d => d.perDay));
  const top = week.reduce((a, b) => (b.perDay > a.perDay ? b : a), week[0]);
  const maxPayee = Math.max(1, ...payees.map(x => x.total));

  return (
    <>
      <Card title="¿Qué día gastás más?" subtitle={`Promedio gastado por cada día de la semana, últimos ${months} meses. Sin pagos de tarjeta ni transferencias.`}>
        {!hasWeek ? <EmptyHint>Todavía no hay gastos para armar este mapa.</EmptyHint> : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={week.map(d => ({ name: d.day.slice(0, 3), Promedio: d.perDay, full: d.day, total: d.total, count: d.count }))}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={44} />
                  <Tooltip formatter={(v: any, _n: any, e: any) => [`${formatArs(Number(v))} por ${e.payload.full.toLowerCase()} (${e.payload.count} gastos, ${formatArs(e.payload.total)} en total)`, 'Promedio']} />
                  <Bar dataKey="Promedio" radius={[4, 4, 0, 0]}>
                    {week.map(d => <Cell key={d.day} fill={d.perDay === max ? C_ORANGE : C_BLUE} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-600">El día más caro es el <b>{top.day.toLowerCase()}</b>: en promedio {formatArs(top.perDay)}, el {top.share.toFixed(0)}% de tu gasto.</p>
          </>
        )}
      </Card>

      <Card title="¿Dónde dejás más plata?" subtitle={`Comercios y personas con más gasto, últimos ${months} meses.`}>
        {payees.length === 0 ? <EmptyHint>Todavía no hay gastos para armar el ranking.</EmptyHint> : (
          <div className="space-y-2">
            {payees.map((x, i) => (
              <div key={x.name + i} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-slate-800 truncate">{i + 1}. {x.name}</span>
                  <span className="text-slate-600 whitespace-nowrap">{formatArs(x.total)} · {x.count} {x.count === 1 ? 'vez' : 'veces'}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 mt-1"><div className="h-2 rounded-full" style={{ width: `${(x.total / maxPayee) * 100}%`, background: C_BLUE }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Pagos a tarjetas por mes" subtitle="Cuánto pagaste de tus resúmenes cada mes (en pesos). Cada pago se cuenta una sola vez.">
        {cardPaid.length === 0 || cardPaid.every(r => r.paid === 0) ? <EmptyHint>Todavía no registraste pagos de tarjetas.</EmptyHint> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cardPaid.map(r => ({ name: label(r.month), Pagado: r.paid }))}>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={short} tick={{ fontSize: 11 }} width={44} />
                <Tooltip formatter={(v: any) => [formatArs(Number(v)), 'Pagado a tarjetas']} />
                <Bar dataKey="Pagado" fill={C_BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
