'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  Sparkles, 
  CreditCard, 
  CheckCircle2, 
  X, 
  Landmark, 
  Plus, 
  Loader2, 
  LogIn, 
  Calendar, 
  Clock, 
  Pencil, 
  Trash2, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  UploadCloud, 
  ArrowRight, 
  ShieldCheck, 
  BarChart3, 
  Zap, 
  Check, 
  MessageSquare
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4f', '#13c2c2', '#faad14'];

export default function FinanzasDRMIA() {
  // Estado para alternar entre Landing Page de Venta y el Dashboard Operativo
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  // Filtro de Mes
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Estados de inicio de sesión
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Formulario manual
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [incomeSource, setIncomeSource] = useState('salary');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Modales
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);

  // Estados de Importación IA
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [migrationData, setMigrationData] = useState<any>(null);

  // Formulario tarjeta nueva
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('20');
  const [newCardDue, setNewCardDue] = useState('5');
  const [newCardLimit, setNewCardLimit] = useState('');

  // Formulario edición de tarjeta
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardClosing, setEditCardClosing] = useState('20');
  const [editCardDue, setEditCardDue] = useState('5');
  const [editCardLimit, setEditCardLimit] = useState('');

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await refreshAll(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkInitialSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await refreshAll(session.user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setAuthError(error.message);
    } else if (data?.user) {
      setUser(data.user);
      await refreshAll(data.user.id);
      setViewMode('app');
    }
    setAuthLoading(false);
  }

  async function refreshAll(userId: string) {
    const { data: tx } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
    if (tx) {
      setTransactions(tx);
      if (tx.length > 0 && selectedMonth === 'all') {
        const latestDate = tx[0].date ? tx[0].date.substring(0, 7) : 'all';
        setSelectedMonth(latestDate);
      }
    }

    const { data: cards } = await supabase.from('credit_cards').select('*').eq('user_id', userId);
    if (cards) setCreditCards(cards);

    const { data: ln } = await supabase.from('loans').select('*').eq('user_id', userId);
    if (ln) setLoans(ln);
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description || !user) return;

    const payload = {
      user_id: user.id,
      amount: parseFloat(amount),
      description,
      type: transType,
      category: transType === 'expense' ? category : 'Ingreso',
      income_source: transType === 'income' ? incomeSource : null,
      credit_card_id: transType === 'expense' && selectedCardId ? selectedCardId : null,
      loan_id: transType === 'expense' && selectedLoanId ? selectedLoanId : null,
      date: customDate || new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase.from('transactions').insert([payload]);
    if (!error) {
      setAmount('');
      setDescription('');
      setSelectedCardId('');
      setSelectedLoanId('');
      refreshAll(user.id);
    } else {
      alert('Error guardando transacción: ' + error.message);
    }
  }

  async function handleCreateCard(e: React.FormEvent) {
    e.preventDefault();
    if (!newCardName || !user) return;

    const { error } = await supabase.from('credit_cards').insert([{
      user_id: user.id,
      name: newCardName,
      closing_day: parseInt(newCardClosing),
      due_day: parseInt(newCardDue),
      credit_limit: parseFloat(newCardLimit || '0')
    }]);

    if (!error) {
      setNewCardName('');
      setNewCardLimit('');
      setIsCardModalOpen(false);
      refreshAll(user.id);
    } else {
      alert('Error creando tarjeta: ' + error.message);
    }
  }

  function openEditCard(card: any) {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardClosing(String(card.closing_day || '20'));
    setEditCardDue(String(card.due_day || '5'));
    setEditCardLimit(String(card.credit_limit || '0'));
    setIsEditCardModalOpen(true);
  }

  async function handleUpdateCard(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCardId || !user) return;

    const { error } = await supabase
      .from('credit_cards')
      .update({
        name: editCardName,
        closing_day: parseInt(editCardClosing),
        due_day: parseInt(editCardDue),
        credit_limit: parseFloat(editCardLimit || '0')
      })
      .eq('id', editingCardId);

    if (!error) {
      setIsEditCardModalOpen(false);
      setEditingCardId(null);
      refreshAll(user.id);
      alert('¡Tarjeta actualizada correctamente!');
    } else {
      alert('Error al actualizar tarjeta: ' + error.message);
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!confirm('¿Deseas eliminar esta tarjeta?')) return;
    const { error } = await supabase.from('credit_cards').delete().eq('id', cardId);
    if (!error && user) refreshAll(user.id);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error && user) refreshAll(user.id);
  }

  async function handleExecuteAIImport() {
    if (!importText.trim() && !importFile) return;
    setUploading(true);

    try {
      let res;
      if (importFile) {
        const formData = new FormData();
        formData.append('file', importFile);
        res = await fetch('/api/parse-statement', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: importText }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando datos con IA');
      setMigrationData(data);
    } catch (err: any) {
      alert('Error al interpretar datos: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmMigration() {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSessionUser = sessionData?.session?.user || user;

    if (!currentSessionUser) {
      alert('Tu sesión caducó o no estás conectado.');
      return;
    }

    if (!migrationData || !migrationData.items || migrationData.items.length === 0) {
      alert('No se detectaron transacciones para guardar.');
      return;
    }

    setIsSavingBatch(true);

    try {
      if (migrationData.detected_cards && migrationData.detected_cards.length > 0) {
        const cardsToInsert = migrationData.detected_cards.map((c: any) => ({
          user_id: currentSessionUser.id,
          name: String(c.name || 'Tarjeta'),
          closing_day: 20,
          due_day: 5,
          credit_limit: parseFloat(String(c.balance || '0').replace(/[^0-9.-]+/g, '')) || 0
        }));
        await supabase.from('credit_cards').insert(cardsToInsert);
      }

      if (migrationData.detected_loans && migrationData.detected_loans.length > 0) {
        const loansToInsert = migrationData.detected_loans.map((l: any) => ({
          user_id: currentSessionUser.id,
          entity: String(l.entity || 'Préstamo'),
          total_amount: parseFloat(String(l.total_amount || '0').replace(/[^0-9.-]+/g, '')) || 0,
          installment_amount: parseFloat(String(l.installment_amount || '0').replace(/[^0-9.-]+/g, '')) || 0,
          total_installments: 12,
          paid_installments: 1,
          due_day: 10
        }));
        await supabase.from('loans').insert(loansToInsert);
      }

      const today = new Date().toISOString().split('T')[0];
      const rows = migrationData.items.map((item: any) => {
        let cleanAmount = 0;
        if (typeof item.amount === 'number') {
          cleanAmount = item.amount;
        } else {
          const strVal = String(item.amount || '0')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^0-9.-]+/g, '');
          cleanAmount = parseFloat(strVal) || 0;
        }

        return {
          user_id: currentSessionUser.id,
          description: String(item.description || 'Movimiento importado'),
          amount: Math.abs(cleanAmount),
          category: item.category || 'Otros',
          type: item.type === 'income' ? 'income' : 'expense',
          income_source: item.type === 'income' ? 'salary' : null,
          date: (item.date && item.date.length === 10) ? item.date : today,
          installment_number: Number(item.installment_number) || 1,
          total_installments: Number(item.total_installments) || 1
        };
      });

      const { error: txError } = await supabase.from('transactions').insert(rows);
      if (txError) throw new Error('Supabase no aceptó los registros: ' + txError.message);

      setIsImportModalOpen(false);
      setMigrationData(null);
      setImportText('');
      setImportFile(null);
      await refreshAll(currentSessionUser.id);
      alert(`¡Éxito! Se importaron ${rows.length} registros financieros.`);
    } catch (err: any) {
      console.error(err);
      alert('Aviso al guardar: ' + (err.message || 'Error de conexión'));
    } finally {
      setIsSavingBatch(false);
    }
  }

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 7) {
        monthsSet.add(t.date.substring(0, 7));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === 'all') return transactions;
    return transactions.filter(t => t.date && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const totalIncome = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  const totalDebt = useMemo(() => {
    return creditCards.reduce((acc, c) => acc + Number(c.credit_limit || 0), 0);
  }, [creditCards]);

  const expenseDataByCategory = useMemo(() => {
    return filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc: any[], item) => {
        const catName = item.category || 'Otros';
        const existing = acc.find(c => c.name === catName);
        if (existing) {
          existing.value += Number(item.amount || 0);
        } else {
          acc.push({ name: catName, value: Number(item.amount || 0) });
        }
        return acc;
      }, []);
  }, [filteredTransactions]);

  // ==========================================
  // RENDER: LANDING PAGE DE VENTA (ESTÉTICA DRMIA)
  // ==========================================
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-[#08121f] text-slate-100 font-sans selection:bg-[#00D7FF] selection:text-[#0B192C]">
        
        {/* Barra de Navegación DRMIA */}
        <nav className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00D7FF]/10 border border-[#00D7FF]/30 flex items-center justify-center text-[#00D7FF] font-bold text-xl shadow-[0_0_15px_rgba(0,215,255,0.2)]">
              ▲
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DRMIA <span className="text-xs bg-[#00D7FF]/10 text-[#00D7FF] px-2.5 py-0.5 rounded-full border border-[#00D7FF]/30">Finanzas SaaS</span>
              </span>
              <p className="text-[10px] text-slate-400">Soluciones Integrales para tu Negocio</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode('app')}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 transition-colors cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button 
              onClick={() => setViewMode('app')}
              className="text-xs font-semibold bg-[#00D7FF] text-[#0B192C] px-4 py-2.5 rounded-xl hover:bg-[#00B4D8] transition-all shadow-lg shadow-[#00D7FF]/10 flex items-center gap-1.5 cursor-pointer font-bold"
            >
              Probar Demo Gratis <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="max-w-4xl mx-auto px-6 pt-16 pb-14 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0B192C] border border-[#00D7FF]/30 text-[#00D7FF] text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#00D7FF]" />
            Potenciado con Google Gemini 3.8 Flash
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Controlá tus finanzas, tarjetas y deudas con <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D7FF] to-cyan-400">Inteligencia Artificial</span>
          </h1>

          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Olvidate de cargar gastos uno por uno en Excel. Subí tu resumen bancario o planilla y nuestra IA organiza tus consumos, detecta tus tarjetas y calcula tu balance real en 5 segundos.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setViewMode('app')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#00D7FF] to-cyan-500 text-[#0B192C] font-bold text-sm hover:opacity-95 transition-all shadow-xl shadow-[#00D7FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              Empezar Ahora sin Costo <ArrowRight className="w-4 h-4" />
            </button>
            <a 
              href="https://wa.me/5492966000000?text=Hola%20DRMIA,%20quiero%20conocer%20mas%20sobre%20el%20sistema%20de%20finanzas" 
              target="_blank" 
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#0B192C] border border-slate-700 text-slate-200 font-semibold text-sm hover:bg-[#132238] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#00D7FF]" /> Hablar con Asesor
            </a>
          </div>
        </header>

        {/* Vista previa / Mockup del Panel */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <div className="p-3 bg-[#0B192C]/80 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md">
            <div className="bg-[#08121f] rounded-2xl p-6 border border-slate-800/80 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-xs text-slate-400 font-mono ml-2">finanzas.drm-ia.com/dashboard</span>
                </div>
                <span className="text-xs bg-[#00D7FF]/10 text-[#00D7FF] px-2.5 py-0.5 rounded-md border border-[#00D7FF]/20">
                  Panel en Vivo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#132238] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Ingresos Mensuales</p>
                  <p className="text-xl font-bold text-emerald-400">$ 2.376.869,90</p>
                </div>
                <div className="bg-[#132238] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Gastos Desglosados</p>
                  <p className="text-xl font-bold text-rose-400">$ 1.480.200,00</p>
                </div>
                <div className="bg-[#132238] p-4 rounded-xl border border-slate-800">
                  <p className="text-xs text-slate-400">Deuda Tarjetas Activa</p>
                  <p className="text-xl font-bold text-[#00D7FF]">$ 896.669,90</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pilares del Servicio */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800/80">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Diseñado para la realidad económica real</h2>
            <p className="text-sm text-slate-400">Todo lo que necesitas para tener previsibilidad financiera sin perder horas con números.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0B192C] p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-[#00D7FF]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#00D7FF]/10 text-[#00D7FF] flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Importador Inteligente IA</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Copiá filas de Excel o subí extractos bancarios en PDF. Gemini 3.8 Flash interpreta rubros, cuotas y entidades automáticamente.
              </p>
            </div>

            <div className="bg-[#0B192C] p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-[#00D7FF]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#00D7FF]/10 text-[#00D7FF] flex items-center justify-center font-bold">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Ciclos Reales de Tarjetas</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ajustá las fechas de cierre y vencimiento específicas de cada banco (BNA, Naranja X, Mercado Pago) para anticipar tus resúmenes.
              </p>
            </div>

            <div className="bg-[#0B192C] p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-[#00D7FF]/50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#00D7FF]/10 text-[#00D7FF] flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Filtro Mensual & Desendeudamiento</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Supervisá tu flujo mes a mes sin mezclar períodos ni duplicar pagos de resúmenes con consumos cotidianos.
              </p>
            </div>
          </div>
        </section>

        {/* Planes Comerciales */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-slate-800/80">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Planes transparentes para tu tranquilidad</h2>
            <p className="text-sm text-slate-400">Elegí la opción que mejor se adapte a tu nivel de movimientos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plan Inicial */}
            <div className="bg-[#0B192C] p-8 rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Plan Esencial</h3>
                <p className="text-xs text-slate-400">Ideal para ordenar gastos diarios y seguimiento personal.</p>
                <div className="text-3xl font-extrabold text-white">$ 12.000 <span className="text-xs text-slate-400 font-normal">/ mes</span></div>
                
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Carga manual ilimitada de gastos e ingresos</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Hasta 3 tarjetas de crédito con alertas</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Gráficos de desglose por categoría</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Filtro mensual dinámico</li>
                </ul>
              </div>

              <button 
                onClick={() => setViewMode('app')}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Comenzar con Plan Esencial
              </button>
            </div>

            {/* Plan Pro con IA */}
            <div className="bg-[#132238] p-8 rounded-3xl border-2 border-[#00D7FF] space-y-6 flex flex-col justify-between relative shadow-2xl shadow-[#00D7FF]/10">
              <div className="absolute -top-3.5 right-6 bg-[#00D7FF] text-[#0B192C] text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">
                Recomendado
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Plan Pro IA <Sparkles className="w-4 h-4 text-[#00D7FF]" />
                </h3>
                <p className="text-xs text-slate-400">Para emprendedores, comercios y quienes buscan automatización total.</p>
                <div className="text-3xl font-extrabold text-white">$ 24.500 <span className="text-xs text-slate-400 font-normal">/ mes</span></div>
                
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Todo lo del Plan Esencial</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Importador ilimitado con Gemini 3.8 Flash</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Carga masiva de PDFs y Google Sheets</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Tarjetas y préstamos ilimitados</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Soporte prioritario por WhatsApp</li>
                </ul>
              </div>

              <button 
                onClick={() => setViewMode('app')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D7FF] to-cyan-500 text-[#0B192C] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-[#00D7FF]/20"
              >
                Acceder a Pro con IA
              </button>
            </div>
          </div>
        </section>

        {/* Footer Corporativo DRMIA */}
        <footer className="border-t border-slate-800/80 py-10 text-center text-xs text-slate-500 space-y-2">
          <p>© 2026 DRMIA • Soluciones Integrales e Inteligencia Artificial</p>
          <p className="text-[11px] text-slate-600">Río Gallegos, Santa Cruz, Argentina • finanzas.drm-ia.com</p>
        </footer>

      </div>
    );
  }

  // ==========================================
  // RENDER: PANTALLA DE ACCESO / LOGIN (SI NO HAY SESIÓN)
  // ==========================================
  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-[#08121f] text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-[#0B192C] max-w-md w-full p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => setViewMode('landing')}
              className="text-xs text-[#00D7FF] hover:underline flex items-center gap-1 cursor-pointer"
            >
              ← Volver a la portada
            </button>
            <span className="text-[10px] text-slate-500 font-mono">DRMIA AUTH</span>
          </div>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#00D7FF]/10 text-[#00D7FF] mx-auto flex items-center justify-center font-bold text-2xl border border-[#00D7FF]/30">
              ▲
            </div>
            <h1 className="text-xl font-bold text-white">Ingresar a tu Cuenta</h1>
            <p className="text-xs text-slate-400">Accedé a tu panel de finanzas y deudas</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400">Correo Electrónico</label>
              <input 
                type="email" 
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                placeholder="tu@correo.com" 
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none text-white focus:border-[#00D7FF]"
                required 
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Contraseña</label>
              <input 
                type="password" 
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none text-white focus:border-[#00D7FF]"
                required 
              />
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800">{authError}</p>
            )}

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full bg-[#00D7FF] hover:bg-[#00B4D8] disabled:opacity-50 text-[#0B192C] font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {authLoading ? 'Iniciando sesión...' : 'Ingresar al Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PANEL OPERATIVO (DASHBOARD)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header con Botón de Retorno a la Landing */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode('landing')}
              title="Ver portada comercial"
              className="w-10 h-10 rounded-xl bg-slate-900 text-[#00D7FF] flex items-center justify-center font-bold text-lg hover:opacity-90 transition-opacity cursor-pointer"
            >
              ▲
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Panel de Finanzas SaaS</h1>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Ver Histórico Completo</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {m} ({new Date(m + '-02').toLocaleString('es-AR', { month: 'long', year: 'numeric' })})
                  </option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              Migrar o Importar con IA
            </button>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-xs text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Métricas Principales del Mes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Ingresos ({selectedMonth === 'all' ? 'Histórico' : selectedMonth})</p>
              <h3 className="text-xl font-bold text-emerald-600">
                ${totalIncome.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <ArrowUpCircle className="w-8 h-8 text-emerald-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Gastos ({selectedMonth === 'all' ? 'Histórico' : selectedMonth})</p>
              <h3 className="text-xl font-bold text-rose-600">
                ${totalExpense.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <ArrowDownCircle className="w-8 h-8 text-rose-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Superávit del Período</p>
              <h3 className={`text-xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                ${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <Wallet className="w-8 h-8 text-blue-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Deuda Tarjetas Activa</p>
              <h3 className="text-xl font-bold text-rose-700">
                ${totalDebt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <CreditCard className="w-8 h-8 text-rose-600 opacity-20" />
          </div>
        </div>

        {/* Bloque: Tarjetas de Crédito */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Mis Tarjetas de Crédito</h3>
              </div>
              <button 
                onClick={() => setIsCardModalOpen(true)}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Tarjeta
              </button>
            </div>
            {creditCards.length === 0 ? (
              <p className="text-xs text-slate-400">No tienes tarjetas registradas aún.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {creditCards.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 relative group">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-bold text-slate-800 pr-12">{c.name}</p>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openEditCard(c)}
                          title="Modificar fecha de cierre y vencimiento"
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCard(c.id)}
                          title="Eliminar tarjeta"
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-white rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cierre: <strong className="text-slate-700">Día {c.closing_day}</strong> • Vence: <strong className="text-slate-700">Día {c.due_day}</strong>
                    </p>
                    {c.credit_limit > 0 && (
                      <p className="text-[10px] text-rose-600 font-semibold">Saldo Deuda: ${Number(c.credit_limit).toLocaleString('es-AR')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Préstamos & Billeteras Digitales</h3>
            </div>
            {loans.length === 0 ? (
              <p className="text-xs text-slate-400">No registras préstamos activos.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {loans.map(l => (
                  <div key={l.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-slate-800">{l.entity}</p>
                    {l.installment_amount > 0 && (
                      <p className="text-[10px] text-slate-500">Cuota: ${Number(l.installment_amount).toLocaleString('es-AR')}</p>
                    )}
                    <p className="text-[10px] text-amber-600 font-semibold">Total: ${Number(l.total_amount).toLocaleString('es-AR')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Formulario y Gráfico */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setTransType('expense')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${transType === 'expense' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
              >
                Cargar Gasto
              </button>
              <button 
                type="button"
                onClick={() => setTransType('income')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${transType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
              >
                Cargar Ingreso
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Descripción</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={transType === 'income' ? 'Ej: Sueldo mensual' : 'Ej: Compra supermercado'} 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500"
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Monto ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500"
                    required 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Fecha del Movimiento</label>
                  <input 
                    type="date" 
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500 bg-white"
                    required 
                  />
                </div>
              </div>

              {transType === 'expense' ? (
                <>
                  <div>
                    <label className="text-xs text-slate-500">Rubro / Categoría</label>
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                    >
                      <option value="Supermercado">Supermercado</option>
                      <option value="Servicios">Servicios / Facturas</option>
                      <option value="Alimentos">Alimentos / Restaurantes</option>
                      <option value="Transporte">Transporte / Combustible</option>
                      <option value="Tarjeta de Crédito">Pago Tarjeta</option>
                      <option value="Préstamos">Cuota Préstamo</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  {creditCards.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-500">Asignar a Tarjeta (Opcional)</label>
                      <select 
                        value={selectedCardId}
                        onChange={e => setSelectedCardId(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                      >
                        <option value="">Ninguna / Gasto en Efectivo-Débito</option>
                        {creditCards.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {loans.length > 0 && (
                    <div>
                      <label className="text-xs text-slate-500">Vincular a Préstamo (Opcional)</label>
                      <select 
                        value={selectedLoanId}
                        onChange={e => setSelectedLoanId(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                      >
                        <option value="">Ninguno</option>
                        {loans.map(l => (
                          <option key={l.id} value={l.id}>{l.entity}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="text-xs text-slate-500">Tipo de Ingreso</label>
                  <select 
                    value={incomeSource}
                    onChange={e => setIncomeSource(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                  >
                    <option value="salary">Sueldo Fijo</option>
                    <option value="freelance">Honorarios / Extras</option>
                    <option value="business">Ventas Comercio</option>
                    <option value="investments">Rendimientos / Inversiones</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                className={`w-full text-xs font-semibold py-2.5 rounded-xl text-white transition-colors cursor-pointer ${transType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {transType === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Gastos Desglosados por Rubro ({selectedMonth === 'all' ? 'Histórico' : selectedMonth})
              </h2>
            </div>
            
            <div className="w-full h-64">
              {expenseDataByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expenseDataByCategory} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={55} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value"
                    >
                      {expenseDataByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `$${Number(value).toLocaleString('es-AR')}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  No hay gastos en este mes seleccionado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Historial de Movimientos ({filteredTransactions.length} registros)
            </h3>
            <span className="text-[11px] text-slate-400">Mostrando: {selectedMonth}</span>
          </div>

          <div className="space-y-2">
            {filteredTransactions.map(t => {
              const loadedDate = t.created_at ? new Date(t.created_at).toLocaleDateString('es-AR') : 'Fecha s/d';
              return (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{t.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">
                        📅 Fecha movimiento: {t.date}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-300" /> Cargado el: {loadedDate}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        • {t.type === 'income' ? `Ingreso` : `Rubro: ${t.category}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                    <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal: Editar Tarjeta */}
      {isEditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Editar Tarjeta de Crédito</h3>
              <button onClick={() => setIsEditCardModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCard} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Nombre de la Tarjeta</label>
                <input 
                  type="text" 
                  value={editCardName}
                  onChange={e => setEditCardName(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Día de Cierre</label>
                  <input 
                    type="number" 
                    min="1"
                    max="31"
                    value={editCardClosing}
                    onChange={e => setEditCardClosing(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Día de Vencimiento</label>
                  <input 
                    type="number" 
                    min="1"
                    max="31"
                    value={editCardDue}
                    onChange={e => setEditCardDue(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-slate-800"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Deuda / Límite ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editCardLimit}
                  onChange={e => setEditCardLimit(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Guardar Modificaciones
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Tarjeta Manual */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Nueva Tarjeta de Crédito</h3>
              <button onClick={() => setIsCardModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCard} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Nombre de la Tarjeta</label>
                <input 
                  type="text" 
                  value={newCardName}
                  onChange={e => setNewCardName(e.target.value)}
                  placeholder="Ej: Visa Banco Nación / Master MP" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Día de Cierre</label>
                  <input 
                    type="number" 
                    min="1"
                    max="31"
                    value={newCardClosing}
                    onChange={e => setNewCardClosing(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Día de Vencimiento</label>
                  <input 
                    type="number" 
                    min="1"
                    max="31"
                    value={newCardDue}
                    onChange={e => setNewCardDue(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo o Límite ($)</label>
                <input 
                  type="number" 
                  value={newCardLimit}
                  onChange={e => setNewCardLimit(e.target.value)}
                  placeholder="0.00" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Guardar Tarjeta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Migrar Datos con IA */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Migrar Datos con Gemini IA</h3>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setMigrationData(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!migrationData ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:border-indigo-500 transition-colors">
                  <input 
                    type="file" 
                    id="file-upload-input"
                    accept="application/pdf,image/*" 
                    className="hidden" 
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-1.5">
                    <UploadCloud className="w-8 h-8 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-700">
                      {importFile ? `Archivo: ${importFile.name}` : 'Subir resumen o planilla en PDF / Imagen'}
                    </span>
                    <span className="text-[10px] text-slate-400">La IA extraerá tarjetas, deudas y consumos</span>
                  </label>
                </div>

                <div className="text-center text-[11px] text-slate-400 font-semibold">— O PEGA EL TEXTO DE TU PLANILLA —</div>

                <textarea 
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Pega aquí filas copiadas de Google Sheets o Excel, o texto libre..."
                  className="w-full h-28 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:border-indigo-500 font-mono"
                />

                <button 
                  onClick={handleExecuteAIImport}
                  disabled={uploading || (!importFile && !importText.trim())}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  {uploading ? 'Gemini está analizando y organizando...' : 'Analizar y Extraer Estructura Completa'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2 text-xs">
                  <span className="font-bold text-indigo-900">Entidades detectadas:</span>
                  <div className="flex flex-wrap gap-2">
                    {migrationData.detected_cards?.map((c: any, i: number) => (
                      <span key={i} className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-800 font-semibold text-[11px] flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-indigo-500" /> {c.name}
                      </span>
                    ))}
                    {migrationData.detected_loans?.map((l: any, i: number) => (
                      <span key={i} className="bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                        <Landmark className="w-3 h-3 text-amber-500" /> {l.entity}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700">Movimientos identificados ({migrationData.items?.length}):</span>
                  {migrationData.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="font-semibold text-slate-800">{item.description}</p>
                        <span className="text-[10px] text-slate-400">
                          {item.type === 'income' ? 'Ingreso' : 'Gasto'} • {item.category} • Fecha: {item.date}
                        </span>
                      </div>
                      <span className={`font-bold ${item.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        ${Number(item.amount).toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleConfirmMigration}
                  disabled={isSavingBatch}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                >
                  {isSavingBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Guardando datos en Supabase... por favor espere</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar y Crear Todo en mi SaaS</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}