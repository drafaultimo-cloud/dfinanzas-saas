'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatArs, projectCommitments } from '@/lib/planning';
import { Card, HubProps } from './ui';
import { useTable } from './ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

export default function Commitments(p: HubProps) {
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const [horizon, setHorizon] = useState(12);
  const data = useMemo(
    () => projectCommitments(p.transactions, p.loans, recurring, new Date(), horizon, p.usdRate, p.profile),
    [p.transactions, p.loans, recurring, horizon, p.usdRate, p.profile]
  );
  const next3 = data.slice(0, 3).reduce((a, r) => a + r.total, 0);
  const peak = data.reduce((m, r) => (r.total > m.total ? r : m), data[0]);
  const chart = data.map(r => ({ ...r, name: label(r.month) }));

  return (
    <Card
      title="Compromisos de los próximos meses"
      subtitle="Cuotas de tarjeta que todavía faltan pagar, cuotas de préstamos y gastos recurrentes. Se calcula con la última cuota registrada de cada compra."
      right={
        <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
          <option value={6}>6 meses</option><option value={12}>12 meses</option><option value={24}>24 meses</option>
        </select>
      }
    >
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Ya comprometido (3 meses)</p><p className="text-base font-black text-slate-900">{formatArs(next3)}</p></div>
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Mes más pesado</p><p className="text-base font-black text-slate-900">{peak ? `${label(peak.month)} · ${formatArs(peak.total)}` : '-'}</p></div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
            <Tooltip formatter={(v) => formatArs(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="cards" name="Cuotas de tarjeta" stackId="a" fill="#6366f1" />
            <Bar dataKey="loans" name="Préstamos" stackId="a" fill="#f43f5e" />
            <Bar dataKey="recurring" name="Recurrentes" stackId="a" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-slate-400">
        Para que sea fiel, importá los resúmenes de tus tarjetas: cada compra en cuotas se reconoce por su descripción y el total de cuotas.
        Los saldos de resúmenes ya emitidos no se suman acá.
      </p>
    </Card>
  );
}
