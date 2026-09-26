'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabaseClient'

export default function Home() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Auth states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')

  // Expense states
  const [expenses, setExpenses] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Alimentos')
  const [savingExpense, setSavingExpense] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Paywall & Settings states
  const [showPaywall, setShowPaywall] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  
  // Settings editables desde la web
  const [settings, setSettings] = useState({
    alias: 'cargando...',
    account_holder: 'cargando...',
    pro_price: 4999
  })
  const [editingSettings, setEditingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  const categories = ['Alimentos', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 'Otros']
  const FREE_SCAN_LIMIT = 3

  useEffect(() => {
    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        await loadUserData(user.id)
      }
      setLoading(false)
    }
    initUser()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadUserData(session.user.id)
      } else {
        setExpenses([])
        setProfile(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const loadUserData = async (userId: string) => {
    fetchExpenses()
    fetchProfile(userId)
    fetchAuditLogs(userId)
    fetchSettings()
  }

  const fetchSettings = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 'payment_info').single()
    if (data) {
      setSettings({
        alias: data.alias,
        account_holder: data.account_holder,
        pro_price: Number(data.pro_price)
      })
    }
  }

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    const { error } = await supabase
      .from('app_settings')
      .update({
        alias: settings.alias,
        account_holder: settings.account_holder,
        pro_price: settings.pro_price,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'payment_info')

    if (!error) {
      setEditingSettings(false)
      alert('Datos de cobro actualizados con éxito.')
    } else {
      alert(`Error al actualizar: ${error.message}`)
    }
    setSavingSettings(false)
  }

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const fetchAuditLogs = async (userId: string) => {
    const { data } = await supabase.from('payment_submissions').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setAuditLogs(data)
  }

  const fetchExpenses = async () => {
    const { data } = await supabase.from('expenses').select('*').order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(`Error: ${error.message}`)
      else setMessage('Registro exitoso. Inicia sesión.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(`Error: ${error.message}`)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setExpenses([])
    setProfile(null)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !description) return

    setSavingExpense(true)
    const { data, error } = await supabase.from('expenses').insert([
      { description, amount: parseFloat(amount), category, user_id: user.id }
    ]).select()

    if (!error && data) {
      setExpenses([data[0], ...expenses])
      setDescription('')
      setAmount('')
    }
    setSavingExpense(false)
  }

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) {
      setExpenses(expenses.filter((item) => item.id !== id))
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const scansUsed = profile?.scans_count || 0
    const isPremium = profile?.is_premium || false

    if (!isPremium && scansUsed >= FREE_SCAN_LIMIT) {
      setShowPaywall(true)
      e.target.value = ''
      return
    }

    setScanning(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/scan', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        if (data.description) setDescription(data.description)
        if (data.amount) setAmount(data.amount.toString())
        if (data.category && categories.includes(data.category)) setCategory(data.category)

        const newCount = scansUsed + 1
        await supabase.from('profiles').update({ scans_count: newCount }).eq('id', user.id)
        setProfile({ ...profile, scans_count: newCount })
      } else {
        alert(data.error || 'Error al procesar el ticket')
      }
    } catch (err) {
      alert('Error conectando a la API')
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  const handleTransferReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingReceipt(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', user.id)

    try {
      const res = await fetch('/api/verify-payment', { method: 'POST', body: formData })
      const data = await res.json()
      alert(data.message)
      if (res.ok && data.success) {
        setShowPaywall(false)
        fetchProfile(user.id)
      }
      fetchAuditLogs(user.id)
    } catch (err) {
      alert('Error al enviar el comprobante')
    } finally {
      setUploadingReceipt(false)
      e.target.value = ''
    }
  }

  const totalSpent = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
  const averageSpent = expenses.length > 0 ? totalSpent / expenses.length : 0
  const categoryTotals: Record<string, number> = expenses.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount || 0)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Cargando...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      {!user ? (
        <div className="flex min-h-[80vh] items-center justify-center">
          <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 border border-slate-100">
            <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
              {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesion'}
            </h2>
            <p className="text-xs text-center text-slate-500 mb-6">Módulo 1: Control de usuarios y aislamiento</p>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  placeholder="ejemplo@correo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contrasena</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
                  placeholder="••••••••"
                />
              </div>

              {message && (
                <div className="text-xs text-center text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
              >
                {isSignUp ? 'Registrarse' : 'Entrar'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
                className="text-xs text-blue-600 hover:underline"
              >
                {isSignUp ? 'Ya tienes cuenta? Inicia sesion' : 'No tienes cuenta? Registrate'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Panel de Finanzas</h1>
                {profile?.is_premium ? (
                  <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                    PLAN PRO 👑
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
                    Plan Free ({profile?.scans_count || 0}/{FREE_SCAN_LIMIT} escaneos)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Usuario: {user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingSettings(!editingSettings)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg transition"
              >
                ⚙️ Ajustes CVU
              </button>
              {!profile?.is_premium && (
                <button
                  onClick={() => setShowPaywall(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
                >
                  Obtener Pro
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium px-3 py-2 rounded-lg transition"
              >
                Cerrar sesion
              </button>
            </div>
          </header>

          {/* Formulario para editar Datos de Cobro desde la Web */}
          {editingSettings && (
            <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-blue-100 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-md font-bold text-slate-800">Modificar Datos de Transferencia (CVU / Alias)</h2>
                <button onClick={() => setEditingSettings(false)} className="text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
              </div>
              <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Alias o CVU</label>
                  <input
                    type="text"
                    required
                    value={settings.alias}
                    onChange={(e) => setSettings({ ...settings, alias: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Titular</label>
                  <input
                    type="text"
                    required
                    value={settings.account_holder}
                    onChange={(e) => setSettings({ ...settings, account_holder: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Precio Plan Pro ($)</label>
                  <input
                    type="number"
                    required
                    value={settings.pro_price}
                    onChange={(e) => setSettings({ ...settings, pro_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-6 rounded-lg transition"
                  >
                    {savingSettings ? 'Guardando...' : 'Guardar Nuevos Datos'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-semibold uppercase text-slate-400">Total Gastado</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">${totalSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-semibold uppercase text-slate-400">Promedio por Gasto</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">${averageSpent.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <p className="text-xs font-semibold uppercase text-slate-400">Cantidad de Registros</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{expenses.length}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              {/* Boton Escaneo IA con Bloqueo */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-xl text-center">
                <h3 className="text-sm font-bold text-blue-900 mb-1">Escanear Ticket con Gemini</h3>
                <p className="text-xs text-blue-700 mb-3">
                  {profile?.is_premium
                    ? 'Escaneos ilimitados habilitados.'
                    : `Te quedan ${Math.max(0, FREE_SCAN_LIMIT - (profile?.scans_count || 0))} de ${FREE_SCAN_LIMIT} escaneos gratuitos.`}
                </p>

                {!profile?.is_premium && (profile?.scans_count || 0) >= FREE_SCAN_LIMIT ? (
                  <button
                    onClick={() => setShowPaywall(true)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow-sm"
                  >
                    Desbloquear Escaneos Ilimitados (Pro)
                  </button>
                ) : (
                  <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg cursor-pointer transition shadow-sm">
                    {scanning ? 'Analizando con Gemini...' : 'Subir Comprobante (Foto/PDF)'}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      disabled={scanning}
                      onChange={handleFileUpload}
                    />
                  </label>
                )}
              </div>

              {/* Formulario */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Cargar Gasto</h2>
                <form onSubmit={handleAddExpense} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Descripcion</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Almuerzo de trabajo"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Monto ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Categoria</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition"
                  >
                    {savingExpense ? 'Guardando...' : 'Agregar Gasto'}
                  </button>
                </form>
              </div>
            </div>

            {/* Listado y Desglose */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Distribucion por Categoria</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.keys(categoryTotals).length === 0 ? (
                    <p className="text-xs text-slate-400 col-span-3">No hay datos suficientes.</p>
                  ) : (
                    Object.entries(categoryTotals).map(([cat, total]) => (
                      <div key={cat} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-xs text-slate-500 block">{cat}</span>
                        <span className="text-sm font-semibold text-slate-900">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Ultimos Registros</h3>
                {expenses.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Todavia no has registrado gastos.</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {expenses.map((item) => (
                      <div key={item.id} className="py-3 flex justify-between items-center text-sm">
                        <div>
                          <p className="font-semibold text-slate-800">{item.description}</p>
                          <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mt-0.5">
                            {item.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-slate-900">
                            ${Number(item.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(item.id)}
                            className="text-xs text-red-500 hover:text-red-700 transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Panel Auditoria */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-2">Auditoría: Comprobantes de Suscripción</h3>
                <p className="text-xs text-slate-500 mb-4">Historial de transferencias procesadas por IA para verificación.</p>
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">No hay transferencias enviadas aún.</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 border rounded-lg text-xs flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded font-bold ${log.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {log.status.toUpperCase()}
                            </span>
                            <span className="font-semibold">${Number(log.amount).toLocaleString('es-AR')}</span>
                            <span className="text-slate-400">| Emisor: {log.sender_name}</span>
                          </div>
                          <p className="text-slate-600 italic">IA: {log.gemini_verdict}</p>
                        </div>
                        {log.receipt_url && (
                          <a
                            href={log.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline font-medium"
                          >
                            Ver comprobante
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modal Paywall con datos dinámicos */}
          {showPaywall && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Actualizar a Plan Pro 👑</h2>
                    <p className="text-xs text-slate-500">Escaneos ilimitados de tickets por IA</p>
                  </div>
                  <button onClick={() => setShowPaywall(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs space-y-2">
                  <p className="font-bold text-blue-900">Datos para transferencia Mercado Pago:</p>
                  <p className="text-slate-700"><strong>Alias / CVU:</strong> <code className="bg-white px-1.5 py-0.5 rounded border border-blue-200 font-bold">{settings.alias}</code></p>
                  <p className="text-slate-700"><strong>Titular:</strong> {settings.account_holder}</p>
                  <p className="text-slate-700"><strong>Monto Plan Mensual:</strong> ${Number(settings.pro_price).toLocaleString('es-AR')} ARS</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Sube el comprobante de tu transferencia:
                  </label>
                  <p className="text-[11px] text-slate-500">Gemini analizará el ticket y activará tu cuenta de inmediato si el pago es válido.</p>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploadingReceipt}
                    onChange={handleTransferReceiptUpload}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {uploadingReceipt && (
                    <p className="text-xs text-blue-600 font-medium animate-pulse text-center pt-2">
                      Validando transferencia con Gemini...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
