'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Ajusta la ruta a tu cliente si difiere
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CreditCard, 
  Wallet, 
  DollarSign, 
  Trash2, 
  Sparkles,
  PieChart as PieIcon
} from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff4d4f', '#13c2c2'];

export default function DashboardFinanzas() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  // Estados del Formulario
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [incomeSource, setIncomeSource] = useState('salary');

  useEffect(() => {
    fetchSessionAndData();
  }, []);

  async function fetchSessionAndData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      loadTransactions(session.user.id);
    }
    setLoading(false);
  }

  async function loadTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!error && data) {
      setTransactions(data);
    }
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
      date: new Date().toISOString().split('T')[0]
    };

    const { error } = await supabase.from('transactions').insert([payload]);
    if (!error) {
      setAmount('');
      setDescription('');
      loadTransactions(user.id);
    } else {
      alert('Error guardando transacción: ' + error.message);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error && user) {
      loadTransactions(user.id);
    }
  }

  // Cálculos de Métricas
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const netBalance = totalIncome - totalExpense;

  // Agrupación para el Gráfico de Gastos por Rubro
  const expenseDataByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], item) => {
      const existing = acc.find(c => c.name === item.category);
      if (existing) {
        existing.value += Number(item.amount);
      } else {
        acc.push({ name: item.category, value: Number(item.amount) });
      }
      return acc;
    }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando panel...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Panel de Finanzas SaaS</h1>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            Cerrar sesión
          </button>
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

        {/* Formulario de Carga y Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulario */}
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
                  placeholder={transType === 'income' ? 'Ej: Sueldo mensual / Trabajo extra' : 'Ej: Compra supermercado'} 
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
                <div>
                  <label className="text-xs text-slate-500">Rubro / Categoría</label>
                  <select 
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
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
              ) : (
                <div>
                  <label className="text-xs text-slate-500">Tipo de Ingreso</label>
                  <select 
                    value={incomeSource}
                    onChange={e => setIncomeSource(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none"
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

          {/* Gráfico Analítico de Rubros */}
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
                      innerRadius={60} 
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

        {/* Tabla de Movimientos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Historial de Movimientos</h3>
          <div className="space-y-2">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{t.description}</p>
                  <span className="text-[10px] text-slate-400">
                    {t.type === 'income' ? `Ingreso: ${t.income_source}` : `Gasto: ${t.category}`} • {t.date}
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
    </div>
  );
}