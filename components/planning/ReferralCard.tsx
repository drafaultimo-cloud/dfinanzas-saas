'use client';

import React, { useEffect, useState } from 'react';
import { whatsappShareUrl } from '@/lib/referral';

type Info = { code: string; link: string; invited: number; rewarded: number };

/** "Invitá y ganá un mes": link personal + contador. El mes se acredita cuando el invitado hace su primer pago verificado. */
export default function ReferralCard({ authFetch }: { authFetch: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authFetch('/api/referral');
        const j = await res.json().catch(() => null);
        if (!alive) return;
        if (res.ok && j?.code) setInfo(j); else setFailed(true);
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return null; // sin migración 016 o sin clave de servicio: no se muestra
  async function copy() {
    if (!info) return;
    try { await navigator.clipboard.writeText(info.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copiá tu link:', info.link); }
  }

  return (
    <section className="bg-gradient-to-r from-indigo-50 to-cyan-50 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
      <div>
        <h2 className="text-sm font-bold text-slate-900">🎁 Invitá y ganá un mes gratis</h2>
        <p className="text-[11px] text-slate-600 mt-0.5">Por cada amigo que se suscribe con tu link, te regalamos 30 días del Plan Pro. Tu amigo también arranca con 10 días gratis.</p>
      </div>
      {!info ? <p className="text-xs text-slate-400">Cargando tu link…</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={info.link} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-[200px] text-xs border border-slate-200 rounded-xl p-2.5 bg-white" />
            <button onClick={copy} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer">{copied ? '¡Copiado!' : 'Copiar'}</button>
            <a href={whatsappShareUrl(info.link)} target="_blank" rel="noopener" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl">WhatsApp</a>
          </div>
          <p className="text-[11px] text-slate-600">Invitaste a <strong>{info.invited}</strong> · meses ganados: <strong>{info.rewarded}</strong></p>
        </>
      )}
    </section>
  );
}
