'use client';

import React from 'react';
import {
  ArrowRight, BellRing, Check, CreditCard, Gift, HeartPulse, PiggyBank, Repeat, ScanLine,
  ShieldCheck, Smartphone, Sparkles, Target, Users, Wallet,
} from 'lucide-react';
import {
  PLAN_ESENCIAL_PROMO, PLAN_ESENCIAL_REGULAR, PLAN_PRO_PROMO, PLAN_PRO_REGULAR,
} from '@/lib/config';

type Props = {
  onRegister: () => void;
  onLogin: () => void;
  onDemo: () => void;
  onInstall: () => void;
};

const ars = (n: number) => `$ ${n.toLocaleString('es-AR')}`;
const heading = { fontFamily: 'var(--font-display), system-ui, sans-serif' } as const;

const BENEFITS = [
  { icon: Wallet, title: 'Sabé cuánto podés gastar hoy', text: 'Te mostramos el monto libre del día después de reservar lo que vence. Se acabó el «¿me alcanza?».', tag: 'Disponible diario' },
  { icon: ScanLine, title: 'Cargá un resumen en un minuto', text: 'Subí el PDF o una foto del resumen de la tarjeta. La IA lee las compras, las ordena por rubro y separa pesos de dólares.', tag: 'Importador con IA' },
  { icon: BellRing, title: 'Ningún vencimiento te sorprende', text: 'Te avisamos en la app y por correo antes de que venza una tarjeta, un préstamo o un pago fijo.', tag: 'Avisos por correo' },
  { icon: CreditCard, title: 'Pesos y dólares, cada uno en su lugar', text: 'Tarjetas, billeteras y deudas en las dos monedas, sin cuentas a mano ni mezclar cotizaciones.', tag: 'Bimonetario' },
  { icon: HeartPulse, title: 'Mirá si vas por buen camino', text: 'Un puntaje de salud financiera, rachas de días cargando y consejos concretos para mejorar mes a mes.', tag: 'Puntaje y rachas' },
  { icon: Repeat, title: 'Descubrí suscripciones olvidadas', text: 'Detectamos los gastos que se repiten, te mostramos cuánto suman al año y cuáles subieron de precio.', tag: 'Suscripciones' },
];

const MORE = ['Presupuestos por rubro', 'Metas de ahorro', 'Evolución y reportes', 'Bola de nieve para deudas', 'Patrimonio neto', 'Compartir en modo lectura', 'Perfil Personal y Negocio', 'Instalable en el celular'];

const STEPS = [
  { n: '1', title: 'Traé tus datos', text: 'Importá el resumen de tu tarjeta o cargá un gasto en segundos. No pedimos tus claves del banco.' },
  { n: '2', title: 'La app lo ordena', text: 'Clasifica por rubro, separa monedas, empareja transferencias propias y detecta pagos repetidos.' },
  { n: '3', title: 'Decidí tranquilo', text: 'Ves cuánto te queda, qué vence primero y dónde se te va la plata.' },
];

const FAQ = [
  ['¿Necesito cargar una tarjeta para probarla?', 'No. Probás 10 días con todas las funciones sin dejar ningún dato de pago. Si te gusta, activás tu plan pagando por transferencia.'],
  ['¿Se conecta a mi banco o me pide mis claves?', 'No. Nunca te pedimos claves ni conectamos con tu home banking. Vos subís el resumen (PDF o foto) o cargás los gastos a mano.'],
  ['¿Mis datos están seguros?', 'Cada cuenta ve solamente sus propios datos. Podés descargar una copia de todo o eliminar tu cuenta cuando quieras, desde «Mi cuenta». Tus archivos no se guardan: se analizan y queda solo el resultado.'],
  ['¿Funciona en el celular?', 'Sí. Se instala como una app en Android y en iPhone, sin pasar por ninguna tienda, y se adapta a la pantalla.'],
  ['¿Qué pasa cuando terminan los 10 días?', 'Elegís el plan que te convenga. Si no lo activás, tus datos quedan guardados mientras no elimines tu cuenta.'],
  ['¿Sirve para mi negocio o consultorio?', 'Sí. Tenés un perfil Personal y uno Negocio, con los datos separados, y podés compartir una vista de solo lectura con tu contador o tu pareja.'],
  ['¿Quién está detrás?', 'DRM-IA, una consultora de Río Gallegos que automatiza procesos de comercios, consultorios y pymes. Si tenés una duda, podés escribirle directo a Dionicio desde la app.'],
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-cyan-400/25 via-indigo-500/20 to-transparent blur-2xl" />
      <div className="relative rounded-[2.4rem] border border-white/15 bg-[#0B192C] p-3 shadow-2xl">
        <div className="rounded-[1.9rem] bg-[#F4F7FB] p-4 space-y-3 text-slate-900">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
            <span>Hoy · jueves</span><span className="rounded-full bg-slate-200 px-2 py-0.5">Datos de ejemplo</span>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#0B192C] to-[#16365f] p-4 text-white">
            <p className="text-[11px] text-cyan-200">Hoy podés gastar</p>
            <p className="text-3xl font-extrabold tracking-tight" style={heading}>$ 18.400</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full w-[62%] rounded-full bg-cyan-300" /></div>
            <p className="mt-1.5 text-[10px] text-slate-300">Ya reservamos $ 410.000 que vencen antes de cobrar</p>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm space-y-2">
            <p className="text-[11px] font-bold text-slate-700">Próximos vencimientos</p>
            <div className="flex items-center justify-between text-[11px]"><span className="text-slate-700">💳 Visa</span><span className="font-bold text-rose-600">en 2 días · $ 245.000</span></div>
            <div className="flex items-center justify-between text-[11px]"><span className="text-slate-700">🔁 Alquiler</span><span className="font-bold text-amber-600">en 5 días · $ 300.000</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[10px] text-slate-500">Salud financiera</p>
              <p className="text-xl font-extrabold text-emerald-600" style={heading}>78<span className="text-xs text-slate-400">/100</span></p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-[10px] text-slate-500">Racha</p>
              <p className="text-xl font-extrabold text-indigo-600" style={heading}>12 <span className="text-xs text-slate-400">días</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onRegister, onLogin, onDemo, onInstall }: Props) {
  return (
    <div className="min-h-screen bg-[#08121f] text-slate-100 selection:bg-cyan-300 selection:text-[#0B192C]" style={{ scrollBehavior: 'smooth' }}>
      <div className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-indigo-400 py-2 px-4 text-center text-[11px] sm:text-xs font-bold text-[#0B192C] flex items-center justify-center gap-2">
        <Gift className="h-4 w-4 shrink-0" />
        <span>Lanzamiento: 40% menos durante 6 meses · 10 días gratis con todo incluido</span>
      </div>

      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-lg font-bold text-cyan-300">▲</div>
          <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-white" style={heading}>DRM-IA <span className="ml-1 hidden rounded-full sm:inline-block border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Finanzas</span></span>
        </div>
        <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <a href="#beneficios" className="hover:text-white">Beneficios</a>
          <a href="#como-funciona" className="hover:text-white">Cómo funciona</a>
          <a href="#planes" className="hover:text-white">Planes</a>
          <a href="#preguntas" className="hover:text-white">Preguntas</a>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="cursor-pointer whitespace-nowrap px-2 py-2 text-sm font-semibold text-slate-200 hover:text-white sm:px-3">Iniciar sesión</button>
          <button onClick={onRegister} className="cursor-pointer rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-[#0B192C] shadow-lg shadow-cyan-300/20 hover:bg-cyan-200">
            <span className="hidden sm:inline">Probar gratis</span><span className="sm:hidden">Probar</span>
          </button>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_10%,rgba(99,102,241,0.22),transparent),radial-gradient(50%_40%_at_10%_20%,rgba(34,211,238,0.14),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 md:grid-cols-[1.15fr_0.85fr] md:pb-24 md:pt-16">
          <div className="space-y-6 text-center md:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Tus finanzas en pesos y dólares, con ayuda de IA
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl" style={heading}>
              Sabé cuánto podés gastar hoy, <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">sin planillas ni sorpresas</span> a fin de mes.
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-300 md:mx-0 md:text-lg">
              Subí el resumen de tu tarjeta y DRM-IA ordena tus gastos, te avisa antes de cada vencimiento y te dice cuánto te queda libre. Hecha en Argentina, pensada para cómo manejamos la plata acá.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row md:justify-start sm:justify-center">
              <button onClick={onRegister} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-cyan-400 px-7 py-3.5 text-sm font-bold text-[#0B192C] shadow-xl shadow-cyan-300/20 transition hover:brightness-105 sm:w-auto">
                Empezar mis 10 días gratis <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={onDemo} className="w-full cursor-pointer rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                Ver la demo sin registrarme
              </button>
            </div>
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-slate-400 md:justify-start">
              <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Sin tarjeta para probar</li>
              <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> No pedimos tus claves del banco</li>
              <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-400" /> Cancelás cuando quieras</li>
            </ul>
          </div>
          <PhoneMock />
        </div>
      </header>

      {/* PROBLEMA */}
      <section className="border-y border-white/10 bg-[#0B192C]">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-10 text-center sm:grid-cols-3">
          {[
            ['¿En qué se me fue la plata?', 'Llegás a fin de mes sin saber qué pasó con el sueldo.'],
            ['Y el resumen… ¿cuánto era?', 'Los vencimientos aparecen de golpe y no sabés si te alcanza.'],
            ['Pesos por un lado, dólares por el otro', 'Hacés cuentas a mano y nunca cierran del todo.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-bold text-white" style={heading}>{t}</p>
              <p className="mt-1.5 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Lo que vas a notar</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" style={heading}>Menos cuentas, más tranquilidad</h2>
            <p className="mt-3 text-slate-600">Cada herramienta está pensada para responder una pregunta que te hacés todos los meses.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(b => (
              <article key={b.title} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><b.icon className="h-5 w-5" /></div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-cyan-700">{b.tag}</p>
                <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900" style={heading}>{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-sm font-semibold text-slate-700">Y además:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {MORE.map(m => <span key={m} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700">{m}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="bg-white py-20 text-slate-900">
        <div className="mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Cómo funciona</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" style={heading}>Tres pasos y listo</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-3xl bg-slate-50 p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0B192C] text-sm font-bold text-cyan-300" style={heading}>{s.n}</span>
                <h3 className="mt-4 text-lg font-bold" style={heading}>{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={onRegister} className="w-full cursor-pointer rounded-2xl bg-[#0B192C] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#132a47] sm:w-auto">Empezar gratis</button>
            <button onClick={onDemo} className="w-full cursor-pointer rounded-2xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">Mirarla con datos de ejemplo</button>
          </div>
        </div>
      </section>

      {/* PARA QUIEN */}
      <section className="bg-[#0B192C] py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={heading}>Para tu bolsillo y para tu negocio</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: PiggyBank, t: 'Personas', d: 'Ordená tarjetas, gastos del hogar y ahorros. Ideal si cobrás en pesos y ahorrás en dólares.' },
              { icon: Target, t: 'Profesionales y comercios', d: 'Separá lo del negocio de lo personal con un perfil propio, sus presupuestos y sus reportes.' },
              { icon: Users, t: 'En pareja o con tu contador', d: 'Compartí una vista de solo lectura para que vean tus números sin poder cambiarlos.' },
            ].map(c => (
              <div key={c.t} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <c.icon className="h-6 w-6 text-cyan-300" />
                <h3 className="mt-3 text-lg font-bold text-white" style={heading}>{c.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section id="planes" className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-xl text-center">
            <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-rose-700">Oferta de lanzamiento</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" style={heading}>40% menos durante 6 meses</h2>
            <p className="mt-2 text-sm text-slate-600">Probás todo gratis 10 días. Recién el día 11 empieza tu tarifa con descuento.</p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="space-y-4">
                <h3 className="text-xl font-bold" style={heading}>Plan Esencial</h3>
                <p className="text-sm text-slate-600">Para ordenar tu plata personal y seguir tus tarjetas.</p>
                <p><span className="mr-2 text-sm text-slate-400 line-through">{ars(PLAN_ESENCIAL_REGULAR)}</span><span className="text-4xl font-extrabold" style={heading}>{ars(PLAN_ESENCIAL_PROMO)}</span><span className="text-sm text-slate-500"> / mes</span></p>
                <ul className="space-y-2.5 pt-2 text-sm text-slate-700">
                  {['Cuánto podés gastar hoy', 'Carga ilimitada de gastos e ingresos', 'Pesos y dólares por separado', 'Vencimientos y avisos por correo', 'Presupuestos, metas y reportes', 'Suscripciones detectadas, puntaje y rachas', 'App instalable en Android y iPhone'].map(f => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={onRegister} className="mt-8 w-full cursor-pointer rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800">Probar 10 días gratis</button>
            </div>
            <div className="relative flex flex-col justify-between rounded-3xl border-2 border-indigo-500 bg-[#0B192C] p-8 text-white shadow-2xl">
              <span className="absolute -top-3.5 right-6 rounded-full bg-cyan-300 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0B192C]">Más elegido</span>
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 text-xl font-bold" style={heading}>Plan Pro IA <Sparkles className="h-4 w-4 text-cyan-300" /></h3>
                <p className="text-sm text-slate-300">Para que la IA haga el trabajo pesado: profesionales, comercios y billeteras.</p>
                <p><span className="mr-2 text-sm text-slate-500 line-through">{ars(PLAN_PRO_REGULAR)}</span><span className="text-4xl font-extrabold" style={heading}>{ars(PLAN_PRO_PROMO)}</span><span className="text-sm text-slate-400"> / mes</span></p>
                <ul className="space-y-2.5 pt-2 text-sm text-slate-200">
                  {['Todo lo del Plan Esencial', 'Importador con IA de resúmenes y tickets', 'Detecta compras, pagos y reintegros', 'Auditor financiero IA («Diagnóstico mensual»)', 'Simulador bola de nieve para deudas', 'Chat directo con Dionicio'].map(f => (
                    <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />{f}</li>
                  ))}
                </ul>
              </div>
              <button onClick={onRegister} className="mt-8 w-full cursor-pointer rounded-xl bg-gradient-to-r from-cyan-300 to-cyan-400 py-3.5 text-sm font-bold text-[#0B192C] hover:brightness-105">Activar con 40% menos (10 días gratis)</button>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">Pagás por transferencia, sin débito automático. Si no activás tu plan, tus datos siguen guardados mientras no elimines tu cuenta.</p>
        </div>
      </section>

      {/* REFERIDOS */}
      <section className="bg-white py-14">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-3xl bg-gradient-to-r from-indigo-50 to-cyan-50 px-6 py-10 text-center text-slate-900">
          <Gift className="h-7 w-7 text-indigo-600" />
          <h2 className="text-2xl font-extrabold tracking-tight" style={heading}>Invitá a un amigo y ganá un mes gratis</h2>
          <p className="max-w-xl text-sm text-slate-600">Cada persona que se suscribe con tu link te regala 30 días del Plan Pro. Tu link personal lo encontrás dentro de la app.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="preguntas" className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl" style={heading}>Preguntas frecuentes</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-slate-200 bg-white p-5 open:shadow-md">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                  {q}<span className="text-xl text-indigo-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-[#0B192C] py-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(99,102,241,0.25),transparent)]" />
        <div className="relative mx-auto max-w-2xl space-y-5 px-5">
          <ShieldCheck className="mx-auto h-8 w-8 text-cyan-300" />
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={heading}>Empezá hoy y mirá tus números con claridad</h2>
          <p className="text-slate-300">Son 10 días con todo incluido, sin tarjeta y sin compromiso.</p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={onRegister} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-cyan-400 px-8 py-3.5 text-sm font-bold text-[#0B192C] shadow-xl shadow-cyan-300/20 hover:brightness-105 sm:w-auto">Crear mi cuenta gratis <ArrowRight className="h-4 w-4" /></button>
            <button onClick={onInstall} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"><Smartphone className="h-4 w-4 text-cyan-300" /> Instalar en el celular</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#08121f] py-8 text-center text-xs text-slate-400">
        <p>© 2026 DRM-IA · Soluciones integrales e inteligencia artificial · Río Gallegos, Santa Cruz</p>
        <div className="mt-2 flex justify-center gap-4">
          <a href="/terminos" className="underline hover:text-slate-200">Términos y Condiciones</a>
          <a href="/privacidad" className="underline hover:text-slate-200">Política de Privacidad</a>
        </div>
      </footer>
    </div>
  );
}
