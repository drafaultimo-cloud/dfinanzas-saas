import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL } from '@/lib/legal';

export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="text-lg font-bold text-white mt-8 mb-2">{children}</h2>
);
export const P = ({ children }: { children: ReactNode }) => (
  <p className="text-sm leading-relaxed text-slate-300 mb-3">{children}</p>
);
export const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc pl-5 space-y-1.5 mb-3 text-sm leading-relaxed text-slate-300">
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </ul>
);

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#08121f] text-slate-200">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <Link href="/" className="text-xs text-[#00D7FF] hover:underline">← Volver a {LEGAL.brand}</Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white mt-4">{title}</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">Última actualización: {LEGAL.updated}</p>
        {children}
        <div className="mt-10 pt-5 border-t border-slate-800 text-xs text-slate-500 flex flex-wrap gap-4">
          <Link href="/terminos" className="hover:text-slate-300">Términos y Condiciones</Link>
          <Link href="/privacidad" className="hover:text-slate-300">Política de Privacidad</Link>
          <span>{LEGAL.trade} · {LEGAL.address}</span>
        </div>
      </div>
    </main>
  );
}
