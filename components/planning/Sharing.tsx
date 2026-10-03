'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { btnGhost, btnPrimary, Card, EmptyHint, HubProps, inputCls, MigrationNotice } from './ui';

export interface SharingProps extends HubProps {
  ownEmail: string;
  viewingOwnerId: string | null;
  onViewOwner: (owner: { id: string; email: string } | null) => void;
}

export default function Sharing(p: SharingProps) {
  const [given, setGiven] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [missing, setMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [g, r] = await Promise.all([
      p.supabase.from('shares').select('*').eq('owner_id', p.ownUserId),
      p.supabase.from('shares').select('*').ilike('member_email', p.ownEmail),
    ]);
    if (g.error && /does not exist|schema cache|PGRST205|42P01/i.test(`${g.error.code} ${g.error.message}`)) { setMissing(true); return; }
    setGiven(g.data || []);
    setReceived(r.data || []);
  }, [p.supabase, p.ownUserId, p.ownEmail]);
  useEffect(() => { load(); }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const m = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(m)) { setMsg('Escribí un email válido.'); return; }
    if (m === p.ownEmail.toLowerCase()) { setMsg('Ese es tu propio email.'); return; }
    const { error } = await p.supabase.from('shares').insert([{ owner_id: p.ownUserId, owner_email: p.ownEmail.toLowerCase(), member_email: m, role: 'viewer' }]);
    setMsg(error ? (error.code === '23505' ? 'Ya compartiste con ese email.' : 'No se pudo: ' + error.message) : `Listo: ${m} ya puede ver tus datos cuando entre con ese email.`);
    if (!error) setEmail('');
    load();
  }
  async function revoke(id: string) {
    if (!confirm('¿Dejar de compartir con esta persona?')) return;
    await p.supabase.from('shares').delete().eq('id', id).eq('owner_id', p.ownUserId);
    load();
  }

  return (
    <div className="space-y-4">
      <Card title="Compartir mis datos (solo lectura)" subtitle="Invitá a tu pareja, a tu contador o a un socio. Van a poder VER tus movimientos, tarjetas y billeteras con su propio usuario, pero no modificar nada. Pueden pedirte el acceso y vos lo cortás cuando quieras.">
        {missing && <MigrationNotice table="shares" />}
        {!p.readOnly && (
          <form onSubmit={invite} className="flex flex-wrap gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@ejemplo.com (el que usa para entrar a la app)" className={inputCls + ' flex-1 min-w-[220px]'} required />
            <button className={btnPrimary}>Invitar</button>
          </form>
        )}
        {msg && <p className="text-xs text-slate-600">{msg}</p>}
        {given.length === 0 ? <EmptyHint>No compartiste tus datos con nadie.</EmptyHint> : (
          <div className="divide-y divide-slate-100">
            {given.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                <span className="font-semibold text-slate-800">{s.member_email} <span className="text-slate-400 font-normal">· solo lectura</span></span>
                {!p.readOnly && <button onClick={() => revoke(s.id)} className="text-slate-300 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Compartidos conmigo" subtitle="Cuentas de otras personas que te dieron acceso.">
        {received.length === 0 ? <EmptyHint>Nadie compartió datos con vos.</EmptyHint> : (
          <div className="divide-y divide-slate-100">
            {received.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                <span className="font-semibold text-slate-800">{s.owner_email}</span>
                {p.viewingOwnerId === s.owner_id
                  ? <button className={btnGhost} onClick={() => p.onViewOwner(null)}>Volver a mis datos</button>
                  : <button className={btnPrimary} onClick={() => p.onViewOwner({ id: s.owner_id, email: s.owner_email })}>Ver sus datos</button>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
