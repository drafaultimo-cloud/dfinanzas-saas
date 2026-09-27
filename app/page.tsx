'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Trash2, 
  PieChart as PieIcon,
  Sparkles,
  CreditCard,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  X,
  Landmark,
  Plus
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4f', '#13c2c2'];

export default function DashboardFinanzas() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  // Estados del Formulario Manual
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [incomeSource, setIncomeSource] = useState('salary');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Modales
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  // Estados de IA / Importación
  const [importText, setImportText] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [statementSummary, setStatementSummary] = useState<any>(null);

  // Formulario nueva tarjeta
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('20');
  const [newCardDue, setNewCardDue] = useState('5');
  const [newCardLimit, setNewCardLimit] = useState('');

  useEffect(() => {
    fetchSessionAndData();
  }, []);

  async function fetchSessionAndData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        loadTransactions(session.user.id);
        loadCards(session.user.id);
        loadLoans(session.user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(userId: string) {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (data) setTransactions(data);
  }

  async function loadCards(userId: string) {
    const { data } = await supabase.from('credit_cards').select('*').eq('user_id', userId);
    if (data) setCreditCards(data);
  }

  async function loadLoans(userId: string) {
    const { data } = await supabase.from('loans').select('*').eq('user_id', userId);
    if (data) setLoans(data);
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
      date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase.from('transactions').insert([payload]);
    if (!error) {
      setAmount('');
      setDescription('');
      setSelectedCardId('');
      setSelectedLoanId('');
      loadTransactions(user.id);
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
      loadCards(user.id);
    } else {
      alert('Error creando tarjeta: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error && user) loadTransactions(user.id);
  }

  // Parsear texto o planilla pegada por un usuario nuevo
  async function handleImportWithAI() {
    if (!importText.trim()) return;
    setUploadingFile(true);

    try {
      const res = await fetch('/api/parse-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: importText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando texto');
      setParsedItems(data.items || []);
    } catch (err: any) {
      alert('Error al interpretar datos: ' + err.message);
    } finally {
      setUploadingFile(false);
    }
  }

  // Confirmar inserción en bloque
  async function handleConfirmBatch() {
    if (!user || parsedItems.length === 0) return;

    const rows = parsedItems.map(item => ({
      user_id: user.id,
      description: item.description,
      amount: Number(item.amount),
      category: item.category || 'Otros',
      type: item.type || 'expense',
      date: item.date || new Date().toISOString().split('T')[0],
      installment_number: item.installment_number || 1,
      total_installments: item.total_installments || 1,
      credit_card_id: selectedCardId || null
    }));

    const { error } = await supabase.from('transactions').insert(rows);
    if (!error) {
      setIsStatementModalOpen(false);
      setIsImportModalOpen(false);
      setParsedItems([]);
      setImportText('');
      loadTransactions(user.id);
      alert(`¡Se importaron ${rows.length} registros con éxito!`);
    } else {
      alert('Error al guardar datos: ' + error.message);
    }
  }

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const netBalance = totalIncome - totalExpense;

  const expenseDataByCategory = transactions
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

  if (loading) return <div className="p-8 text-center text-slate-500 font-sans">Cargando panel...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Panel de Finanzas SaaS</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Importar Planilla / Datos
            </button>
            <button 
              onClick={() => setIsStatementModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" />
              Escanear Resumen Tarjeta
            </button>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-xs text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total Ingresos</p>
              <h3 className="text-2xl font-bold text-emerald-600">
                ${totalIncome.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <ArrowUpCircle className="w-10 h-10 text-emerald-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total Gastado</p>
              <h3 className="text-2xl font-bold text-rose-600">
                ${totalExpense.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <ArrowDownCircle className="w-10 h-10 text-rose-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Balance Neto Disponible</p>
              <h3 className={`text-2xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                ${netBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <Wallet className="w-10 h-10 text-blue-500 opacity-20" />
          </div>
        </div>

        {/* Bloque: Tarjetas de Crédito y Préstamos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tarjetas */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Mis Tarjetas de Crédito</h3>
              </div>
              <button 
                onClick={() => setIsCardModalOpen(true)}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Tarjeta
              </button>
            </div>
            {creditCards.length === 0 ? (
              <p className="text-xs text-slate-400">No tienes tarjetas registradas aún.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {creditCards.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-slate-800">{c.name}</p>
                    <p className="text-[10px] text-slate-500">Cierre: Día {c.closing_day} • Vence: Día {c.due_day}</p>
                    {c.credit_limit > 0 && (
                      <p className="text-[10px] text-slate-400">Límite: ${Number(c.credit_limit).toLocaleString('es-AR')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Préstamos y Deudas */}
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
                    <p className="text-[10px] text-slate-500">Cuota: ${Number(l.installment_amount).toLocaleString('es-AR')}</p>
                    <p className="text-[10px] text-amber-600 font-semibold">Progreso: {l.paid_installments} de {l.total_installments} cuotas</p>
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
                  placeholder={transType === 'income' ? 'Ej: Sueldo mensual / Honorarios' : 'Ej: Compra supermercado'} 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500"
                  required 
                />
              </div>

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
                className={`w-full text-xs font-semibold py-2.5 rounded-xl text-white transition-colors ${transType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {transType === 'income' ? 'Registrar Ingreso' : 'Registrar Gasto'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <PieIcon className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Gastos Desglosados por Rubro</h2>
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
                  Aún no hay gastos registrados para graficar
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Historial */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Historial de Movimientos</h3>
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{t.description}</p>
                  <span className="text-[10px] text-slate-400">
                    {t.type === 'income' ? `Ingreso: ${t.income_source}` : `Gasto: ${t.category}`}
                    {t.credit_card_id && ` • Tarjeta vinculada`}
                    {t.loan_id && ` • Préstamo vinculado`}
                    {` • ${t.date}`}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '-'}${Number(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                  <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal: Importar Planilla / Historial de Usuario Nuevo con IA */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Importar Planilla o Datos Anteriores</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Copia y pega las filas de tu Excel, un listado de WhatsApp o un borrador. La IA detectará montos, fechas, ingresos y categorías de manera automática.
            </p>

            <textarea 
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="Ejemplo:
2026-09-01 Sueldo 950000
2026-09-03 Coto compras 45000
2026-09-05 Nafta YPF 18000
Honorarios freelance 120000"
              className="w-full h-36 border border-slate-200 rounded-2xl p-3 text-xs outline-none focus:border-emerald-500 font-mono"
            />

            <button 
              onClick={handleImportWithAI}
              disabled={uploadingFile || !importText.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              {uploadingFile ? 'Interpretando con Gemini IA...' : 'Interpretar y Clasificar con IA'}
            </button>

            {parsedItems.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-slate-700">Registros identificados ({parsedItems.length}):</span>
                {parsedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                    <div>
                      <span className="font-semibold text-slate-800">{item.description}</span>
                      <span className="text-[10px] text-slate-400 ml-2">({item.category || item.income_source})</span>
                    </div>
                    <span className="font-bold text-slate-900">${Number(item.amount).toLocaleString('es-AR')}</span>
                  </div>
                ))}

                <button 
                  onClick={handleConfirmBatch}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" /> Guardar todo en mi Panel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Agregar Tarjeta de Crédito */}
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
                  placeholder="Ej: Visa Santander / Master MP" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Día de Cierre</label>
                  <input 
                    type="number" 
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
                    value={newCardDue}
                    onChange={e => setNewCardDue(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Límite Disponible ($)</label>
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors"
              >
                Guardar Tarjeta
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}