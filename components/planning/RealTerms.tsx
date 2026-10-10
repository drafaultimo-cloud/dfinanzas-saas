'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatArs } from '@/lib/planning';
import { buildRealSeries, summarizeReal, type DollarKind, type MacroData } from '@/lib/realterms';
import { Card, HubProps } from './ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const short = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`);
const pctText = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
const usd = (n: number) => `u$s ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function RealTerms(p: HubProps & { endMonth: string; span: 6 | 12 }) {
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [dollar, setDollar] = useState<DollarKind>('oficial');

  useEffect(() => {
    let alive = true;
    fetch('/api/macro')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: MacroData) => { if (alive) { setMacro(d); setState('ok'); } })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(
    () => buildRealSeries({ txs: p.transactions, profile: p.profile, kind, endMonth: p.endMonth, months: p.span, macro, dollar, fallbackRate: p.usdRate }),
    [p.transactions, p.profile, kind, p.endMonth, p.span, macro, dollar, p.usdRate]
  );
  const first = rows.findIndex(r => r.nominal > 0);
  const shown = first < 0 ? [] : rows.slice(first);
  const s = summarizeReal(rows);
  const hasReal = shown.some(r => r.real !== null);
  const hasUsd = shown.some(r => r.usd !== null);
  const anyEstimated = shown.some(r => r.estimated);
  const what = kind === 'expense' ? 'gastos' : 'ingresos';

  const lines = shown.map(r => ({ name: label(r.month), 'Pesos de cada mes': r.nominal, 'Pesos de hoy (sin inflación)': r.real }));
  const bars = shown.map(r => ({ name: label(r.month), Dólares: r.usd }));

  return (
    <>
      <Card
        title="En pesos reales y en dólares"
        subtitle="Los pesos de hace meses valían más. Acá ves tus números sin el efecto de la inflación y convertidos a dólares, para saber si realmente gastás (o ganás) más."
        right={
          <div className="flex gap-2">
            <select value={kind} onChange={e => setKind(e.target.value as 'expense' | 'income')} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" aria-label="Qué medir">
              <option value="expense">Gastos</option>
              <option value="income">Ingresos</option>
            </select>
            <select value={dollar} onChange={e => setDollar(e.target.value as DollarKind)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white" aria-label="Dólar">
              <option value="oficial">Dólar oficial</option>
              <option value="blue">Dólar blue</option>
            </select>
          </div>
        }
      >
        {state === 'loading' && <p className="text-xs text-slate-400 py-6 text-center">Cargando inflación y cotizaciones…</p>}
        {state === 'error' && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">No pudimos traer los datos de inflación y dólar en este momento. Probá de nuevo en un rato.</p>}
        {state === 'ok' && shown.length < 2 && <p className="text-xs text-slate-400 py-6 text-center">Hacen falta al menos dos meses con movimientos para comparar.</p>}

        {state === 'ok' && shown.length >= 2 && (
          <>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">En pesos</p><p className="text-base font-black text-slate-900">{pctText(s.nominalPct)}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Sin inflación</p><p className="text-base font-black text-slate-900">{pctText(s.realPct)}</p></div>
              <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">En dólares</p><p className="text-base font-black text-slate-900">{pctText(s.usdPct)}</p></div>
            </div>
            <p className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3">
              Entre {label(shown[0].month)} y {label(shown[shown.length - 1].month)}, tus {what} {s.nominalPct === null ? '' : `${s.nominalPct >= 0 ? 'subieron' : 'bajaron'} ${pctText(s.nominalPct)} en pesos`}
              {s.realPct !== null && <>, y descontando la inflación {s.realPct >= 0 ? 'subieron' : 'bajaron'} <strong>{pctText(s.realPct)}</strong> en términos reales</>}
              {s.usdPct !== null && <> y medidos en dólares {s.usdPct >= 0 ? 'subieron' : 'bajaron'} <strong>{pctText(s.usdPct)}</strong></>}.
            </p>

            {hasReal && (
              <div className="h-56" role="img" aria-label={`${what} en pesos de cada mes y en pesos de hoy`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lines} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={short} />
                    <Tooltip formatter={(v) => formatArs(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Pesos de cada mes" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="Pesos de hoy (sin inflación)" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {hasUsd && (
              <div className="h-48" role="img" aria-label={`${what} en dólares por mes`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v)}`} />
                    <Tooltip formatter={(v) => usd(Number(v))} />
                    <Bar dataKey="Dólares" fill="#2a78d6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold">Ver como tabla</summary>
              <div className="overflow-x-auto mt-2">
                <table className="w-full">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-1">Mes</th><th className="text-right">Pesos</th><th className="text-right">Pesos de hoy</th><th className="text-right">Dólar</th><th className="text-right">En dólares</th></tr></thead>
                  <tbody>
                    {shown.map(r => (
                      <tr key={r.month} className="border-b border-slate-50">
                        <td className="py-1">{label(r.month)}</td>
                        <td className="text-right">{formatArs(r.nominal)}</td>
                        <td className="text-right">{r.real === null ? '—' : formatArs(r.real)}{r.estimated ? '*' : ''}</td>
                        <td className="text-right">{r.rate === null ? '—' : formatArs(r.rate)}</td>
                        <td className="text-right">{r.usd === null ? '—' : usd(r.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="text-[10px] text-slate-400">
              Inflación: IPC mensual del INDEC. Dólar: promedio mensual de venta ({dollar === 'oficial' ? 'oficial' : 'blue'}).
              {anyEstimated && ' (*) El INDEC todavía no publicó los últimos meses: se estimó con la última inflación conocida.'}
              {' '}Los gastos cargados en dólares se pasan a pesos con la cotización de su mes.
            </p>
          </>
        )}
      </Card>
    </>
  );
}
