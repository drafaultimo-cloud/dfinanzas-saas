'use client';

import React, { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart } from 'recharts';
import { currentMonthOf, formatArs, monthOf, monthlyComparison } from '@/lib/planning';
import { averageRate, categoryTrend, paceByDay, REST_LABEL, savingsSeries, trimLeadingEmpty } from '@/lib/evolution';
import { Card, HubProps } from './ui';
import Forecast from './Forecast';
import RealTerms from './RealTerms';
import Habits from './Habits';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const longLabel = (ym: string) => `${MONTHS_L[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);

// Colores: ingresos/gastos como en el resto de la app; rubros en orden fijo (paleta validada), "Otros" en gris.
const C_INCOME = '#10b981', C_EXPENSE = '#f43f5e', C_NET = '#4f46e5', C_PREV = '#94a3b8';
const CAT_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const C_OTHERS = '#94a3b8';
const GOAL_KEY = 'drm-savings-goal';

export default function Evolution(p: HubProps) {
  const months = useMemo(() => {
    const s = new Set<string>([currentMonthOf(new Date())]);
    p.transactions.forEach(t => { if (t.date) s.add(monthOf(t.date)); });
    return [...s].sort().reverse();
  }, [p.transactions]);
  const [month, setMonth] = useState(months[0]);
  const [span, setSpan] = useState<6 | 12>(12);
  const [goal, setGoal] = useState<number>(() => {
    try { const v = Number(localStorage.getItem(GOAL_KEY)); return v > 0 && v < 100 ? v : 20; } catch { return 20; }
  });
  const profileName = p.profile === 'business' ? 'Negocio' : 'Personal';

  const trend = useMemo(() => trimLeadingEmpty(monthlyComparison(p.transactions, p.profile, p.usdRate, month, span)), [p.transactions, p.profile, p.usdRate, month, span]);
  const savings = useMemo(() => trimLeadingEmpty(savingsSeries(p.transactions, p.profile, p.usdRate, month, span)), [p.transactions, p.profile, p.usdRate, month, span]);
  const avgRate = averageRate(savings);
  const pace = useMemo(() => paceByDay(p.transactions, p.profile, p.usdRate, month, new Date()), [p.transactions, p.profile, p.usdRate, month]);
  const cats = useMemo(() => categoryTrend(p.transactions, p.profile, p.usdRate, month, 6, 5), [p.transactions, p.profile, p.usdRate, month]);
  const colorOf = (c: string) => (c === REST_LABEL ? C_OTHERS : CAT_COLORS[cats.categories.indexOf(c)] || C_OTHERS);

  const flow = trend.map(r => ({ name: label(r.month), Ingresos: r.income, Gastos: r.expense, Resultado: r.net }));
  const rate = savings.map(r => ({ name: label(r.month), Tasa: r.rate }));
  const hasData = trend.some(r => r.income > 0 || r.expense > 0);

  const setGoalSafe = (v: number) => {
    const g = Math.min(99, Math.max(1, Math.round(v) || 20));
    setGoal(g);
    try { localStorage.setItem(GOAL_KEY, String(g)); } catch { /* sin almacenamiento */ }
  };

  const paceText = pace.deltaPct === null
    ? 'Todavía no hay datos del mes anterior para comparar.'
    : `${pace.isCurrentMonth ? 'Hasta hoy llevás' : 'En el mes gastaste'} ${formatArs(pace.currentToDate)}, ${Math.abs(pace.deltaPct).toFixed(0)}% ${pace.deltaPct >= 0 ? 'más' : 'menos'} que el mes anterior a esta misma altura (${formatArs(pace.previousSameDay)}).`;

  return (
    <div className="space-y-4">
      <Card
        title={`Evolución ${profileName}`}
        subtitle="Cómo vienen tus ingresos, gastos y ahorro. No cuenta pagos de tarjeta ni transferencias propias."
        right={
          <div className="flex gap-2">
            <select value={span} onChange={e => setSpan(Number(e.target.value) as 6 | 12)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" aria-label="Período">
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" aria-label="Hasta el mes">
              {months.map(m => <option key={m} value={m}>{longLabel(m)}</option>)}
            </select>
          </div>
        }
      >
        {!hasData && <p className="text-xs text-slate-400 py-6 text-center">Todavía no hay movimientos en este período. Cargá o importá tus gastos para ver la evolución.</p>}
      </Card>

      {hasData && (
        <>
          <Card title="Ingresos vs. gastos" subtitle="Barras: lo que entró y lo que salió cada mes. Línea: lo que te quedó (si baja de cero, gastaste más de lo que ingresó).">
            <div className="h-64" role="img" aria-label="Gráfico de ingresos, gastos y resultado por mes">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={short} />
                  <Tooltip formatter={(v) => formatArs(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Bar dataKey="Ingresos" fill={C_INCOME} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Gastos" fill={C_EXPENSE} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Resultado" stroke={C_NET} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">Ver como tabla</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-1">Mes</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Resultado</th><th className="text-right">Ahorro</th></tr></thead>
                  <tbody>
                    {savings.map(r => (
                      <tr key={r.month} className="border-b border-slate-50">
                        <td className="py-1">{label(r.month)}</td>
                        <td className="text-right">{formatArs(r.income)}</td>
                        <td className="text-right">{formatArs(r.expense)}</td>
                        <td className={`text-right font-semibold ${r.net < 0 ? 'text-rose-600' : ''}`}>{formatArs(r.net)}</td>
                        <td className="text-right">{r.rate === null ? '—' : `${r.rate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Card>

          <Card
            title="Tasa de ahorro"
            subtitle="Qué porcentaje de lo que ingresó te quedó cada mes. Los meses sin ingresos no tienen tasa."
            right={
              <label className="text-[11px] text-slate-600 flex items-center gap-1.5">
                Meta
                <input type="number" min={1} max={99} value={goal} onChange={e => setGoalSafe(Number(e.target.value))} className="w-14 text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" />%
              </label>
            }
          >
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Promedio del período</p><p className={`text-base font-black ${avgRate !== null && avgRate < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{avgRate === null ? '—' : `${avgRate}%`}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Meta</p><p className="text-base font-black text-slate-900">{goal}%</p>
                {avgRate !== null && <p className={`text-[10px] ${avgRate >= goal ? 'text-emerald-700' : 'text-amber-700'}`}>{avgRate >= goal ? 'La estás cumpliendo en promedio' : `Te faltan ${(goal - avgRate).toFixed(1)} puntos`}</p>}
              </div>
            </div>
            <div className="h-52" role="img" aria-label="Gráfico de la tasa de ahorro mensual">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rate} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v) => (v === null || v === undefined ? 'Sin ingresos' : `${v}%`)} />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <ReferenceLine y={goal} stroke={C_INCOME} strokeDasharray="5 4" label={{ value: `Meta ${goal}%`, fontSize: 10, fill: '#475569', position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="Tasa" name="Tasa de ahorro" stroke={C_NET} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <Card title={`Ritmo del mes · ${longLabel(month)}`} subtitle="Gasto acumulado día por día contra el mes anterior. Si tu línea va por encima de la gris, estás gastando más rápido.">
        <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
          {paceText}
          {pace.projected !== null && <> A este ritmo cerrarías el mes en <strong>{formatArs(pace.projected)}</strong> (el mes anterior cerró en {formatArs(pace.previousTotal)}).</>}
        </p>
        <div className="h-56" role="img" aria-label="Gasto acumulado por día, este mes contra el anterior">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pace.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={short} />
              <Tooltip formatter={(v) => (v === null || v === undefined ? '' : formatArs(Number(v)))} labelFormatter={(d) => `Día ${d}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="previous" name="Mes anterior" stroke={C_PREV} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="current" name={label(month)} stroke={C_EXPENSE} strokeWidth={2.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Forecast {...p} />

      <RealTerms {...p} endMonth={month} span={span} />
      <Habits {...p} endMonth={month} span={span} />

      <Card title="Evolución por rubro" subtitle="Los 5 rubros donde más gastás en los últimos 6 meses; el resto se junta en “Otros rubros”. La tabla compara este mes con el promedio de los meses anteriores.">
        {cats.categories.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Sin gastos para mostrar.</p>
        ) : (
          <>
            <div className="h-60" role="img" aria-label="Gasto mensual por rubro, barras apiladas">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cats.rows.map(r => ({ ...r, name: label(String(r.month)) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={short} />
                  <Tooltip formatter={(v) => formatArs(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {cats.categories.map(c => (
                    <Bar key={c} dataKey={c} stackId="g" fill={colorOf(c)} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-1.5">Rubro</th><th className="text-right">Este mes</th><th className="text-right">Promedio previo</th><th className="text-right">Variación</th></tr></thead>
                <tbody>
                  {cats.changes.map(c => (
                    <tr key={c.category} className="border-b border-slate-50">
                      <td className="py-1.5 font-semibold text-slate-800"><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: colorOf(c.category) }} />{c.category}</td>
                      <td className="text-right">{formatArs(c.current)}</td>
                      <td className="text-right text-slate-500">{formatArs(c.average)}</td>
                      <td className={`text-right font-semibold ${c.deltaPct === null ? 'text-slate-400' : c.deltaPct > 10 ? 'text-rose-600' : c.deltaPct < -10 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {c.deltaPct === null ? '—' : `${c.deltaPct > 0 ? '+' : ''}${c.deltaPct.toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
