// Modo demo: datos de ejemplo + un cliente de base de datos "de mentira" de solo lectura.
// Sirve para que alguien vea todos los gráficos sin registrarse. No toca la base real.
import { previousClose } from './cards';

export const DEMO_MESSAGE = 'Estás en el modo demo: creá tu cuenta gratis para guardar tus propios datos.';
export const DEMO_USER = { id: 'demo-user', email: 'demo@drm-ia.com', created_at: '2026-01-01T00:00:00.000Z' };

type Row = Record<string, any>;
export type DemoData = Record<string, Row[]>;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const ymdOf = (d: Date) => iso(d.getFullYear(), d.getMonth(), d.getDate());

// Generador pseudoaleatorio con semilla: los datos son siempre los mismos para el mismo día.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDemoData(today: Date = new Date()): DemoData {
  const rand = rng(today.getFullYear() * 400 + today.getMonth() * 31 + today.getDate());
  const between = (lo: number, hi: number, step = 500) => Math.round((lo + rand() * (hi - lo)) / step) * step;
  const todayStr = ymdOf(today);
  const U = DEMO_USER.id;

  const visa = 'demo-card-visa', master = 'demo-card-master';
  const wSueldo = 'demo-w-sueldo', wMp = 'demo-w-mp', wCash = 'demo-w-cash', loanId = 'demo-loan';

  const txs: Row[] = [];
  let n = 0;
  const add = (date: string, desc: string, amount: number, over: Row = {}) => {
    if (date > todayStr) return;
    txs.push({
      id: `demo-tx-${++n}`, user_id: U, amount, currency: 'ARS', operation_type: 'purchase', description: desc,
      type: 'expense', category: 'Otros', income_source: null, credit_card_id: null, loan_id: null,
      transfer_account: null, date, created_at: `${date}T12:00:00.000Z`, ...over,
    });
  };

  for (let back = 5; back >= 0; back--) {
    const base = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const d = (day: number) => iso(y, m, Math.min(day, last));
    const salary = 1380000 + (5 - back) * 28000;

    add(d(5), 'Sueldo', salary, { type: 'income', category: 'Ingreso', income_source: 'salary', loan_id: wSueldo });
    add(d(10), 'Alquiler', 420000 + (back <= 2 ? 40000 : 0), { category: 'Hogar', loan_id: wSueldo });
    add(d(8), 'Luz', between(34000, 46000), { category: 'Servicios', loan_id: wSueldo });
    add(d(12), 'Gas', between(18000, 30000), { category: 'Servicios', loan_id: wSueldo });
    add(d(14), 'Internet', 24500, { category: 'Servicios', loan_id: wSueldo });
    add(d(3), 'Netflix', back <= 1 ? 10800 : 9800, { category: 'Entretenimiento', credit_card_id: visa });
    add(d(17), 'Spotify', 5500, { category: 'Entretenimiento', credit_card_id: visa });
    add(d(20), 'Cuota préstamo personal', 65000, { category: 'Préstamos', loan_id: wSueldo, total_installments: 12 });

    for (const day of [2, 7, 13, 19, 24, 28]) {
      const onCard = rand() > 0.5;
      add(d(day), rand() > 0.5 ? 'Supermercado Día' : 'Coto', between(22000, 62000), onCard ? { category: 'Supermercado', credit_card_id: visa } : { category: 'Supermercado', loan_id: wMp });
    }
    const eats = ['Parrilla El Gaucho', 'Pizzería Don Luis', 'Café Martínez', 'Sushi Kaori', 'Heladería Freddo', 'Rotisería La Esquina', 'Hamburguesería Smash', 'Cervecería Patagonia'];
    [4, 9, 15, 22, 27].forEach((day, i) => add(d(day), eats[(back * 3 + i * 2 + 1) % eats.length], between(8000, 24000), { category: 'Alimentos', loan_id: wMp }));
    for (const day of [6, 16, 26]) add(d(day), day === 16 ? 'Nafta YPF' : 'SUBE', day === 16 ? between(18000, 32000) : between(4000, 9000), { category: 'Transporte', loan_id: wMp });
    add(d(11), 'Farmacia', between(7000, 19000), { category: 'Salud', loan_id: wMp });
    add(d(21), 'Cine', between(9000, 15000), { category: 'Entretenimiento', credit_card_id: master });
    if (back === 3 || back === 0) add(d(23), 'Zapatillas', between(55000, 95000), { category: 'Indumentaria', credit_card_id: master });

    // Pago del resumen de la Visa desde la cuenta sueldo (aparece de los dos lados)
    const pay = between(260000, 330000, 1000);
    add(d(18), 'Pago de resumen Visa Galicia', pay, { operation_type: 'payment', category: 'Tarjeta de Crédito', loan_id: wSueldo, transfer_account: `card:${visa}` });
    add(d(18), 'Pago de resumen Visa Galicia', pay, { type: 'income', operation_type: 'payment', category: 'Tarjeta de Crédito', credit_card_id: visa, transfer_account: `loan:${wSueldo}` });
  }

  // Movimientos chiquitos de los últimos días: sirven para mostrar la racha de carga.
  for (let back = 0; back < 12; back++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    add(ymdOf(dt), back % 3 === 0 ? 'Kiosco' : back % 3 === 1 ? 'Café' : 'Panadería', between(2500, 7500, 100), { category: 'Alimentos', loan_id: back % 2 === 0 ? wCash : wMp });
  }
  txs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const closeVisa = previousClose(25, todayStr), closeMaster = previousClose(20, todayStr);
  const cards: Row[] = [
    { id: visa, user_id: U, name: 'Visa Galicia', closing_day: 25, due_day: 5, balance_ars: 312400, credit_limit: 312400, balance_usd: 0, last_statement_close: closeVisa, balance_date: closeVisa },
    { id: master, user_id: U, name: 'Mastercard Santander', closing_day: 20, due_day: 2, balance_ars: 148900, credit_limit: 148900, balance_usd: 0, last_statement_close: closeMaster, balance_date: closeMaster },
  ];
  const wallet = (id: string, entity: string, kind: string, ars: number, usd = 0): Row => ({
    id, user_id: U, entity, kind, balance_ars: ars, balance_usd: usd, total_amount: 0, installment_amount: 0, balance_date: todayStr,
  });
  const loans: Row[] = [
    wallet(wSueldo, 'Cuenta Sueldo', 'wallet', 685000, 220),
    wallet(wMp, 'Mercado Pago', 'wallet', 142300),
    wallet(wCash, 'Efectivo', 'cash', 38000),
    { id: loanId, user_id: U, entity: 'Préstamo personal', kind: 'loan', total_amount: 455000, installment_amount: 65000, total_installments: 12, paid_installments: 5, due_day: 20, balance_ars: null, balance_usd: null },
  ];

  const month = todayStr.slice(0, 7);
  const monthsAgo = (k: number) => { const b = new Date(today.getFullYear(), today.getMonth() - k, 1); return `${b.getFullYear()}-${pad(b.getMonth() + 1)}`; };
  const goalDate = ymdOf(new Date(today.getFullYear(), today.getMonth() + 5, 1));

  return {
    transactions: txs,
    credit_cards: cards,
    loans,
    card_plans: [],
    recurring_items: [
      { id: 'demo-rec-1', user_id: U, description: 'Alquiler', amount: 460000, currency: 'ARS', type: 'expense', category: 'Hogar', profile: 'personal', day_of_month: 10, active: true, last_generated_month: month, created_at: '2026-01-01T00:00:00Z' },
      { id: 'demo-rec-2', user_id: U, description: 'Internet', amount: 24500, currency: 'ARS', type: 'expense', category: 'Servicios', profile: 'personal', day_of_month: 14, active: true, last_generated_month: month, created_at: '2026-01-01T00:00:00Z' },
    ],
    savings_goals: [{ id: 'demo-goal-1', user_id: U, name: 'Vacaciones de verano', target_amount: 900000, saved_amount: 360000, currency: 'ARS', target_date: goalDate, created_at: '2026-01-01T00:00:00Z' }],
    budgets: [
      { id: 'demo-bud-1', user_id: U, category: 'Supermercado', profile: 'personal', monthly_limit: 280000, alert_pct: 80 },
      { id: 'demo-bud-2', user_id: U, category: 'Alimentos', profile: 'personal', monthly_limit: 90000, alert_pct: 80 },
      { id: 'demo-bud-3', user_id: U, category: 'Entretenimiento', profile: 'personal', monthly_limit: 45000, alert_pct: 80 },
    ],
    category_rules: [{ id: 'demo-rule-1', user_id: U, keyword: 'netflix', category: 'Entretenimiento' }],
    user_categories: [],
    net_worth_snapshots: [5, 4, 3, 2, 1, 0].map((k, i) => ({ id: `demo-nw-${k}`, user_id: U, month: monthsAgo(k), assets_ars: 620000 + i * 70000, liabilities_ars: 780000 - i * 38000, usd_rate: 1350 })),
    shares: [], payment_receipts: [], user_support_chats: [], reminder_prefs: [],
  };
}

// ---------- Cliente de base de datos de mentira ----------
type Filter = (r: Row) => boolean;

class DemoQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private max = Infinity;
  private one = false;
  private head = false;
  constructor(private rows: Row[], private write: boolean) {}
  select(_cols?: string, opts?: { head?: boolean }) { if (opts?.head) this.head = true; return this; }
  eq(col: string, val: any) { this.filters.push(r => r[col] === val); return this; }
  neq(col: string, val: any) { this.filters.push(r => r[col] !== val); return this; }
  ilike(col: string, val: string) { const v = String(val).replace(/%/g, '').toLowerCase(); this.filters.push(r => String(r[col] ?? '').toLowerCase() === v); return this; }
  in(col: string, vals: any[]) { this.filters.push(r => vals.includes(r[col])); return this; }
  or(_expr: string) { return this; }
  is(col: string, val: any) { this.filters.push(r => (r[col] ?? null) === val); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<R1 = any, R2 = never>(res?: ((v: any) => R1 | PromiseLike<R1>) | null, rej?: ((e: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return Promise.resolve(this.run()).then(res, rej);
  }
  private run() {
    if (this.write) return { data: null, error: { message: DEMO_MESSAGE, code: 'DEMO' }, count: null };
    let list = this.rows.filter(r => this.filters.every(f => f(r)));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      list = [...list].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
    }
    list = list.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: list.length };
    return { data: this.one ? (list[0] ?? null) : list, error: null, count: list.length };
  }
}

export function createDemoClient(data: DemoData, onSignOut: () => void): any {
  const table = (name: string) => {
    const rows = data[name] || [];
    const writer = () => new DemoQuery(rows, true);
    return {
      select: (cols?: string, opts?: { head?: boolean }) => new DemoQuery(rows, false).select(cols, opts),
      insert: writer, update: writer, upsert: writer, delete: writer,
    };
  };
  return {
    from: table,
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => { onSignOut(); return { error: null }; },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}

// ---------- Interruptor global ----------
let active: any = null;
export const isDemoActive = () => active !== null;
export function startDemo(client: any) { active = client; }
export function stopDemo() { active = null; }

/** Envuelve el cliente real: mientras el modo demo está activo, "from" y "auth" responden con los datos de ejemplo. */
export function withDemo<T extends object>(real: T): T {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (active && (prop === 'from' || prop === 'auth')) return active[prop];
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
