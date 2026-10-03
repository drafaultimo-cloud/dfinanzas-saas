'use client';

import React, { useState } from 'react';
import Budgets from './Budgets';
import Dues from './Dues';
import Recurring from './Recurring';
import Commitments from './Commitments';
import NetWorthPanel from './NetWorthPanel';
import Goals from './Goals';
import Rules from './Rules';
import Reports from './Reports';
import Sharing, { SharingProps } from './Sharing';

export type Tab = 'presupuestos' | 'vencimientos' | 'recurrentes' | 'cuotas' | 'patrimonio' | 'metas' | 'reglas' | 'reportes' | 'compartir';

const TABS: { id: Tab; label: string; readOnlyOk: boolean }[] = [
  { id: 'presupuestos', label: 'Presupuestos', readOnlyOk: false },
  { id: 'vencimientos', label: 'Vencimientos', readOnlyOk: true },
  { id: 'recurrentes', label: 'Recurrentes', readOnlyOk: false },
  { id: 'cuotas', label: 'Cuotas futuras', readOnlyOk: true },
  { id: 'patrimonio', label: 'Patrimonio', readOnlyOk: true },
  { id: 'metas', label: 'Metas', readOnlyOk: false },
  { id: 'reglas', label: 'Reglas', readOnlyOk: false },
  { id: 'reportes', label: 'Reportes', readOnlyOk: true },
  { id: 'compartir', label: 'Compartir', readOnlyOk: true },
];

export default function PlanningHub(props: SharingProps & { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(props.initialTab || 'presupuestos');
  const visible = TABS.filter(t => !props.readOnly || t.readOnlyOk);
  const active = visible.some(t => t.id === tab) ? tab : visible[0].id;

  return (
    <div className="space-y-4">
      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        {visible.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${active === t.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {active === 'presupuestos' && <Budgets {...props} />}
      {active === 'vencimientos' && <Dues {...props} />}
      {active === 'recurrentes' && <Recurring {...props} />}
      {active === 'cuotas' && <Commitments {...props} />}
      {active === 'patrimonio' && <NetWorthPanel {...props} />}
      {active === 'metas' && <Goals {...props} />}
      {active === 'reglas' && <Rules {...props} />}
      {active === 'reportes' && <Reports {...props} />}
      {active === 'compartir' && <Sharing {...props} />}
    </div>
  );
}
