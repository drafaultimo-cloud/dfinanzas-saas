'use client';

import React, { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeNetWorth, formatArs } from '@/lib/planning';
import { Card, EmptyHint, HubProps, MigrationNotice, useTable } from './ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

export default function NetWorthPanel(p: HubProps) {
  const { rows, missing } = useTable<any>(p.supabase, 'net_worth_snapshots', p.userId, 'month');
  const nw = useMemo(() => computeNetWorth(p.creditCards, p.loans, p.usdRate), [p.creditCards, p.loans, p.usdRate]);
  const history = rows.map((r: any) => ({
    name: label(r.month),
    Activos: Number(r.assets_ars),
    Deudas: Number(r.liabilities_ars),
    Patrimonio: Number(r.assets_ars) - Number(r.liabilities_ars),
  }));
  const first = history[0]?.Patrimonio;
  const change = history.length > 1 ? nw.net - first : null;

  return (
    <Card title="Patrimonio neto" subtitle="Lo que tenés (billeteras, cajas de ahorro, efectivo, saldo a favor) menos lo que debés (tarjetas y préstamos). Los dólares se convierten con la cotización elegida.">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-emerald-50 rounded-xl p-3"><p className="text-emerald-700">Activos</p><p className="text-base font-black text-emerald-800">{formatArs(nw.assets)}</p><p className="text-[10px] text-emerald-700/70">Digital {formatArs(nw.digital)} · Efectivo {formatArs(nw.cash)}</p></div>
        <div className="bg-rose-50 rounded-xl p-3"><p className="text-rose-700">Deudas</p><p className="text-base font-black text-rose-800">{formatArs(nw.liabilities)}</p><p className="text-[10px] text-rose-700/70">Tarjetas {formatArs(nw.cardsDebt)} · Préstamos {formatArs(nw.loansDebt)}</p></div>
        <div className="bg-slate-50 rounded-xl p-3 md:col-span-2"><p className="text-slate-500">Patrimonio neto hoy</p><p className={`text-xl font-black ${nw.net < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatArs(nw.net)}</p>
          {change !== null && <p className="text-[10px] text-slate-500">{change >= 0 ? 'Mejoró' : 'Empeoró'} {formatArs(Math.abs(change))} desde {history[0].name}</p>}
        </div>
      </div>
      {missing && <MigrationNotice table="net_worth_snapshots" />}
      {history.length < 2 ? (
        <EmptyHint>La evolución se arma sola: la app guarda una foto de tu patrimonio cada mes que la abrís. Desde el próximo mes vas a ver la línea.</EmptyHint>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
              <Tooltip formatter={(v) => formatArs(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Activos" stroke="#10b981" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Deudas" stroke="#f43f5e" strokeWidth={2} dot />
              <Line type="monotone" dataKey="Patrimonio" stroke="#4f46e5" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
