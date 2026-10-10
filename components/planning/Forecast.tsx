'use client';

import React, { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeNetWorth, formatArs, upcomingEvents } from '@/lib/planning';
import { cashDailySpend, forecastBalance, type ExpectedIncome } from '@/lib/forecast';
import { Card, HubProps, useTable } from './ui';

const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');
const KEY = 'drm-expected-income';

export default function Forecast(p: HubProps) {
  const { rows: recurring } = useTable(p.supabase, 'recurring_items', p.userId);
  const [horizon, setHorizon] = useState(30);
  const [income, setIncome] = useState<ExpectedIncome | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && v.amount > 0 && v.day >= 1 && v.day <= 31 ? v : null;
    } catch { return null; }
  });
  const [incAmount, setIncAmount] = useState(income ? String(income.amount) : '');
  const [incDay, setIncDay] = useState(income ? String(income.day) : '');

  const today = useMemo(() => new Date(), []);
  const available = useMemo(() => { const n = computeNetWorth(p.creditCards, p.loans, p.usdRate); return n.digital + n.cash; }, [p.creditCards, p.loans, p.usdRate]);
  const daily = useMemo(() => cashDailySpend(p.transactions, p.profile, p.usdRate, today, 30), [p.transactions, p.profile, p.usdRate, today]);
  const events = useMemo(() => upcomingEvents(p.creditCards, p.loans, recurring, today, horizon, p.usdRate), [p.creditCards, p.loans, recurring, today, horizon, p.usdRate]);
  const f = useMemo(() => forecastBalance({ start: available, today, horizonDays: horizon, events, dailySpend: daily, income }), [available, today, horizon, events, daily, income]);
  const marked = f.points.filter(pt => pt.events.length > 0);

  function saveIncome(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(incAmount), day = parseInt(incDay);
    const next = amount > 0 && day >= 1 && day <= 31 ? { amount, day } : null;
    setIncome(next);
    try { if (next) localStorage.setItem(KEY, JSON.stringify(next)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
  }

  return (
    <Card
      title="Proyección de tu plata disponible"
      subtitle="Lo que tenés hoy en billeteras y efectivo, menos los vencimientos que vienen y lo que solés gastar por día. Es una estimación, no una promesa."
      right={
        <select value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" aria-label="Horizonte">
          <option value={15}>15 días</option>
          <option value={30}>30 días</option>
          <option value={60}>60 días</option>
        </select>
      }
    >
      <div className={`text-xs rounded-xl p-3 ${f.firstNegative ? 'bg-rose-50 text-rose-900 border border-rose-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'}`}>
        {f.firstNegative
          ? <>⚠️ El <strong>{dm(f.firstNegative)}</strong> quedarías sin plata disponible (el punto más bajo sería <strong>{formatArs(f.min.balance)}</strong> el {dm(f.min.date)}). Conviene cubrir ese vencimiento o ajustar gastos antes.</>
          : <>✅ En los próximos {horizon} días no te quedarías en negativo. El punto más bajo sería <strong>{formatArs(f.min.balance)}</strong> el {dm(f.min.date)}, y terminarías con <strong>{formatArs(f.end)}</strong>.</>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Hoy tenés</p><p className="font-black text-slate-900">{formatArs(available)}</p></div>
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Vencimientos</p><p className="font-black text-rose-700">−{formatArs(f.totalDues)}</p></div>
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Gasto diario de bolsillo</p><p className="font-black text-slate-900">{formatArs(daily)}/día</p><p className="text-[10px] text-slate-400">promedio de 30 días</p></div>
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Ingreso esperado</p><p className="font-black text-emerald-700">{f.totalIncome > 0 ? `+${formatArs(f.totalIncome)}` : '—'}</p></div>
      </div>

      <div className="h-56" role="img" aria-label="Plata disponible proyectada día por día">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={f.points.map(pt => ({ ...pt, name: dm(pt.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(horizon / 8) - 1)} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={short} />
            <Tooltip formatter={(v) => formatArs(Number(v))} labelFormatter={(l) => `Día ${l}`} />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 3" />
            <Line type="stepAfter" dataKey="balance" name="Plata disponible" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {marked.length > 0 && (
        <div className="divide-y divide-slate-100 text-xs">
          {marked.map(pt => pt.events.map((e, i) => (
            <div key={`${pt.date}-${i}`} className="flex items-center justify-between py-1.5">
              <span><span className="font-mono text-slate-400 mr-2">{dm(pt.date)}</span><span className="font-semibold text-slate-800">{e.label}</span></span>
              <span className="flex items-center gap-3">
                <span className={`font-bold ${e.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{e.amount < 0 ? '−' : '+'}{formatArs(Math.abs(e.amount))}</span>
                <span className="text-slate-400 w-28 text-right">quedan {formatArs(pt.balance)}</span>
              </span>
            </div>
          )))}
        </div>
      )}

      <form onSubmit={saveIncome} className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100 text-xs">
        <label className="text-slate-600">Ingreso que esperás cobrar ($)
          <input type="number" min="0" value={incAmount} onChange={e => setIncAmount(e.target.value)} placeholder="Ej: sueldo" className="block mt-1 w-36 border border-slate-200 rounded-lg px-2 py-1.5" />
        </label>
        <label className="text-slate-600">Día del mes
          <input type="number" min="1" max="31" value={incDay} onChange={e => setIncDay(e.target.value)} className="block mt-1 w-20 border border-slate-200 rounded-lg px-2 py-1.5" />
        </label>
        <button type="submit" className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer">Guardar</button>
        {income && <button type="button" onClick={() => { setIncAmount(''); setIncDay(''); setIncome(null); try { localStorage.removeItem(KEY); } catch { /* */ } }} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 cursor-pointer">Quitar</button>}
      </form>
      <p className="text-[10px] text-slate-400">No incluye ingresos futuros salvo el que cargues acá, ni las cuotas de Plan Z, y supone que mantenés tu ritmo de gasto de los últimos 30 días. Las compras con tarjeta no se descuentan día a día: se pagan en el vencimiento, y de cada tarjeta solo cuenta el próximo.</p>
    </Card>
  );
}
