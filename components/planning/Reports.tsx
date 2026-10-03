'use client';

import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer } from 'lucide-react';
import {
  addMonths, categoryComparison, cleanDesc, currentMonthOf, formatArs, isRefundTx, isTransferTx, monthlyComparison,
  monthOf, toArs, toCsv, transactionsCsv, txProfile,
} from '@/lib/planning';
import { btnGhost, Card, HubProps } from './ui';

const MONTHS_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const label = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const longLabel = (ym: string) => `${MONTHS_L[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;

function download(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export default function Reports(p: HubProps) {
  const months = useMemo(() => {
    const s = new Set<string>([currentMonthOf(new Date())]);
    p.transactions.forEach(t => { if (t.date) s.add(monthOf(t.date)); });
    return [...s].sort().reverse();
  }, [p.transactions]);
  const [month, setMonth] = useState(months[0]);
  const profileName = p.profile === 'business' ? 'Negocio' : 'Personal';

  const trend = useMemo(() => monthlyComparison(p.transactions, p.profile, p.usdRate, month, 6), [p.transactions, p.profile, p.usdRate, month]);
  const cats = useMemo(() => categoryComparison(p.transactions, p.profile, month, p.usdRate), [p.transactions, p.profile, p.usdRate, month]);
  const cur = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const chart = trend.map(r => ({ name: label(r.month), Ingresos: r.income, Gastos: r.expense }));

  function exportMonthCsv() {
    const rows: (string | number)[][] = [[`Informe ${profileName} - ${longLabel(month)}`], [], ['Ingresos', cur.income], ['Gastos netos', cur.expense], ['Resultado', cur.net], [], ['Categoría', 'Este mes', 'Mes anterior', 'Diferencia', '% del gasto']];
    cats.forEach(c => rows.push([c.category, c.current, c.previous, c.delta, Math.round(c.share * 10) / 10]));
    download(`informe-${p.profile}-${month}.csv`, toCsv(rows));
  }
  function exportAllCsv() {
    const list = p.transactions.filter(t => txProfile(t) === p.profile);
    download(`movimientos-${p.profile}.csv`, transactionsCsv(list, p.creditCards, p.loans));
  }
  function printReport() {
    const list = p.transactions
      .filter(t => t.date && monthOf(t.date) === month && txProfile(t) === p.profile && !isTransferTx(t))
      .sort((a, b) => a.date.localeCompare(b.date));
    const rowsHtml = list.map(t => {
      const amt = toArs(Number(t.amount || 0), t.currency, p.usdRate);
      const sign = t.type === 'income' && !isRefundTx(t) ? 1 : -1;
      return `<tr><td>${t.date}</td><td>${esc(cleanDesc(t.description))}</td><td>${esc(t.category || '')}</td><td class="r">${esc(formatArs(sign * amt))}${t.currency === 'USD' ? ' (u$s)' : ''}</td></tr>`;
    }).join('');
    const catHtml = cats.filter(c => c.current > 0).map(c => `<tr><td>${esc(c.category)}</td><td class="r">${esc(formatArs(c.current))}</td><td class="r">${c.share.toFixed(1)}%</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) { alert('El navegador bloqueó la ventana. Permití ventanas emergentes para imprimir el informe.'); return; }
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${profileName} ${month}</title>
<style>body{font-family:Arial,sans-serif;color:#0f172a;margin:32px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 6px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:left}th{background:#f1f5f9}.r{text-align:right}
.k{display:flex;gap:24px;margin-top:12px}.k div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 14px}.k b{display:block;font-size:16px}
small{color:#64748b}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()">Imprimir / Guardar como PDF</button>
<h1>Informe de ${profileName === 'Negocio' ? 'Negocio' : 'finanzas personales'} - ${esc(longLabel(month))}</h1>
<small>Generado por DRM-IA Finanzas · cotización u$s 1 = ${formatArs(p.usdRate)} · importes en pesos · no incluye pagos de tarjeta ni transferencias entre cuentas propias</small>
<div class="k"><div>Ingresos<b>${esc(formatArs(cur.income))}</b></div><div>Gastos netos<b>${esc(formatArs(cur.expense))}</b></div><div>Resultado<b>${esc(formatArs(cur.net))}</b></div></div>
<h2>Gastos por categoría</h2><table><tr><th>Categoría</th><th class="r">Importe</th><th class="r">%</th></tr>${catHtml}</table>
<h2>Detalle de movimientos</h2><table><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th class="r">Importe</th></tr>${rowsHtml}</table>
</body></html>`);
    w.document.close();
  }

  const delta = prev && prev.expense > 0 ? ((cur.expense - prev.expense) / prev.expense) * 100 : null;

  return (
    <div className="space-y-4">
      <Card
        title={`Reporte ${profileName}`}
        subtitle="Comparativo de los últimos 6 meses y gastos por categoría. No cuenta pagos de tarjeta ni transferencias propias."
        right={
          <select value={month} onChange={e => setMonth(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
            {months.map(m => <option key={m} value={m}>{longLabel(m)}</option>)}
          </select>
        }
      >
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-emerald-50 rounded-xl p-3"><p className="text-emerald-700">Ingresos</p><p className="text-base font-black text-emerald-800">{formatArs(cur.income)}</p></div>
          <div className="bg-rose-50 rounded-xl p-3"><p className="text-rose-700">Gastos netos</p><p className="text-base font-black text-rose-800">{formatArs(cur.expense)}</p>
            {delta !== null && <p className="text-[10px] text-rose-700/70">{delta >= 0 ? '+' : ''}{delta.toFixed(0)}% vs. mes anterior</p>}</div>
          <div className="bg-slate-50 rounded-xl p-3"><p className="text-slate-500">Resultado</p><p className={`text-base font-black ${cur.net < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{formatArs(cur.net)}</p></div>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
              <Tooltip formatter={(v) => formatArs(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-slate-500 border-b border-slate-100"><th className="py-1.5">Categoría</th><th className="text-right">Este mes</th><th className="text-right">{label(addMonths(month, -1))}</th><th className="text-right">Diferencia</th><th className="text-right">%</th></tr></thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={5} className="py-3 text-slate-400">Sin gastos en este mes.</td></tr>}
              {cats.map(c => (
                <tr key={c.category} className="border-b border-slate-50">
                  <td className="py-1.5 font-semibold text-slate-800">{c.category}</td>
                  <td className="text-right">{formatArs(c.current)}</td>
                  <td className="text-right text-slate-500">{formatArs(c.previous)}</td>
                  <td className={`text-right font-semibold ${c.delta > 0 ? 'text-rose-600' : c.delta < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{c.delta > 0 ? '+' : ''}{formatArs(c.delta)}</td>
                  <td className="text-right text-slate-500">{c.share.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button className={btnGhost} onClick={printReport}><Printer className="w-3.5 h-3.5 inline mr-1" />Informe para imprimir / PDF{p.profile === 'business' ? ' (contador)' : ''}</button>
          <button className={btnGhost} onClick={exportMonthCsv}><Download className="w-3.5 h-3.5 inline mr-1" />Resumen del mes (Excel)</button>
          <button className={btnGhost} onClick={exportAllCsv}><Download className="w-3.5 h-3.5 inline mr-1" />Todos los movimientos (Excel)</button>
        </div>
      </Card>
    </div>
  );
}
