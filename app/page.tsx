'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_ADMIN_EMAILS,
  DEFAULT_USD_RATE,
  PLAN_ESENCIAL_PROMO,
  PLAN_ESENCIAL_REGULAR,
  PLAN_PRO_PROMO,
  PLAN_PRO_REGULAR,
  TRIAL_DAYS,
  todayLocal,
} from '@/lib/config';
import { AccessState, computeAccess, isAdminEmail } from '@/lib/access';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Sparkles, 
  CreditCard, 
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
  BarChart3, 
  Zap, 
  Check, 
  MessageSquare, 
  UserPlus, 
  Send, 
  FileCheck, 
  AlertTriangle, 
  Lock, 
  Gift, 
  Smartphone, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Briefcase, 
  User as UserIcon, 
  Calculator,
  ListFilter,
  Eye,
  Save,
  FileUp
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS = ['#FF8042', '#00C49F', '#0088FE', '#faad14', '#8884d8', '#ff4d4f', '#13c2c2', '#a0d911'];

type Cur = 'ARS' | 'USD';

// Los pagos de tarjeta son transferencias (no ingresos) y los reintegros restan gasto.
// Pagos de tarjeta y transferencias entre cuentas propias no son ingreso ni gasto.
const isTransfer = (t: any) => t.operation_type === 'payment' || t.operation_type === 'transfer';
const isRefund = (t: any) => t.operation_type === 'refund';
// balance_ars pasó a ser el saldo; credit_limit solo es respaldo de datos viejos (?? y no ||, así un saldo 0 no muestra el límite)
const cardBalanceArs = (c: any) => Number(c.balance_ars ?? c.credit_limit ?? 0);
// Reconoce a qué tarjeta/billetera del usuario pertenece un resumen por el nombre que detectó la IA.
const GENERIC_WORDS = new Set(['tarjeta','credito','debito','de','del','la','el','banco','resumen','cuenta','extracto','x','sa','s','a']);
const nameTokens = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(t => t && !GENERIC_WORDS.has(t));
function guessEntity(name: string, kind: string, cards: any[], loans: any[]): string {
  const want = nameTokens(name);
  if (want.length === 0) return '';
  const pool = (kind === 'wallet'
    ? loans.map(l => ({ key: `loan:${l.id}`, name: l.entity }))
    : cards.map(c => ({ key: `card:${c.id}`, name: c.name })));
  const scored = pool
    .map(e => ({ key: e.key, score: nameTokens(e.name).filter(t => want.includes(t)).length }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);
  // Solo se autoasigna si hay un ganador claro; si hay empate, que elija el usuario.
  if (scored.length === 0) return '';
  if (scored.length > 1 && scored[0].score === scored[1].score) return '';
  return scored[0].key;
}
// ¿El dinero entra (+) o sale (-)? El pago de una tarjeta entra en la tarjeta pero sale de la billetera.
const isInflow = (item: any) =>
  item.operation_type === 'purchase' ? false
  : item.operation_type === 'refund' || item.operation_type === 'income' ? true
  : item.direction ? item.direction === 'in'
  : item.operation_type === 'payment';
// Un movimiento es del Negocio si su descripción empieza con "[NEGOCIO]".
const BUSINESS_TAG = '[NEGOCIO]';
const isBusinessDesc = (d?: string | null) => (d || '').startsWith(BUSINESS_TAG);
const withProfile = (d: string | null | undefined, business: boolean) => {
  const clean = (d || '').replace(/^\[NEGOCIO\]\s*/, '');
  return business ? `${BUSINESS_TAG} ${clean}` : clean;
};

export default function FinanzasDRMIA() {
  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');

  // Autenticación
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Suscripción (se calcula con lib/access.ts, la misma lógica que usa el servidor)
  const [access, setAccess] = useState<AccessState | null>(null);
  const [dataError, setDataError] = useState('');
  const bootstrappedFor = useRef<string | null>(null);
  const monthInitialized = useRef(false);
  const [selectedPlanToPay, setSelectedPlanToPay] = useState<'base' | 'pro'>('pro');

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Perfil Dual y Multimoneda
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [currencyMode, setCurrencyMode] = useState<'ARS' | 'USD'>('ARS');
  const [usdRate, setUsdRate] = useState<number>(DEFAULT_USD_RATE);

  // Datos financieros
  const [transactions, setTransactions] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Modales de Desglose
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // Edición Rápida de Transacciones
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  // Listado de movimientos de una tarjeta/billetera, para pasarlos de Personal a Negocio
  const [movementsEntity, setMovementsEntity] = useState<{ kind: 'card' | 'loan'; id: string; name: string } | null>(null);
  const [movMonth, setMovMonth] = useState('all');
  const [movSelected, setMovSelected] = useState<string[]>([]);
  const [movSaving, setMovSaving] = useState(false);
  // 'linked' = asignados a esta tarjeta; 'unassigned' = sin tarjeta ni billetera (importes viejos); 'all' = todos
  const [movScope, setMovScope] = useState<'linked' | 'unassigned' | 'all'>('linked');
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('income');
  const [editTxOpType, setEditTxOpType] = useState<'purchase' | 'payment' | 'refund' | 'income' | 'transfer'>('purchase');
  const [editTxCurrency, setEditTxCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [editTxCategory, setEditTxCategory] = useState('Alimentos');
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxDescription, setEditTxDescription] = useState('');

  // Auditor Financiero con IA
  const [aiDiagnosis, setAiDiagnosis] = useState<string>('');
  const [isLoadingDiagnosis, setIsLoadingDiagnosis] = useState<boolean>(false);
  const [isDiagnosisOpen, setIsDiagnosisOpen] = useState<boolean>(false);

  // Simulador Bola de Nieve
  const [isSnowballModalOpen, setIsSnowballModalOpen] = useState(false);

  // Chat interno y Superusuario
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalAppUsersCount, setTotalAppUsersCount] = useState(0);
  const [adminUsersList, setAdminUsersList] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<any>(null);

  // Modales
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isEditCardModalOpen, setIsEditCardModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Importador IA
  const [targetEntityForImport, setTargetEntityForImport] = useState<{ type: 'card' | 'loan', id: string, name: string } | null>(null);
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [migrationData, setMigrationData] = useState<any>(null);
  // A dónde se vinculan los movimientos importados: 'card:<id>' | 'loan:<id>' | 'new-card' | 'none'
  const [importLink, setImportLink] = useState('none');

  // Tarjetas manual
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('20');
  const [newCardDue, setNewCardDue] = useState('5');
  const [newCardLimitArs, setNewCardLimitArs] = useState('');
  const [newCardLimitUsd, setNewCardLimitUsd] = useState('');

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardClosing, setEditCardClosing] = useState('20');
  const [editCardDue, setEditCardDue] = useState('5');
  const [editCardLimitArs, setEditCardLimitArs] = useState('');
  const [editCardLimitUsd, setEditCardLimitUsd] = useState('');

  // Préstamos / Billeteras manual
  const [newLoanEntity, setNewLoanEntity] = useState('');
  const [newLoanTotal, setNewLoanTotal] = useState('');
  const [newLoanInstallment, setNewLoanInstallment] = useState('');

  // Comprobantes
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptFeedback, setReceiptFeedback] = useState<any>(null);
  const [adminReceipts, setAdminReceipts] = useState<any[]>([]);

  // Formulario manual transacciones
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [manualCurrency, setManualCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [customDate, setCustomDate] = useState(todayLocal());
  const [incomeSource, setIncomeSource] = useState('salary');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  const isSuperUser = !!user?.email && (access?.status === 'admin' || isAdminEmail(user.email));
  const hasPaidPlan = access?.status === 'paid' || access?.status === 'admin';
  const isTrialActive = access?.status === 'trial' || access?.status === 'admin';
  const trialDaysLeft = access?.trialDaysLeft ?? TRIAL_DAYS;
  const isPro = access?.plan === 'pro';

  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem('drmia_usd_rate') || '');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved > 0) setUsdRate(saved);
    } catch {}
  }, []);

  function updateUsdRate(v: string) {
    const n = parseFloat(v);
    if (n > 0) {
      setUsdRate(n);
      try { localStorage.setItem('drmia_usd_rate', String(n)); } catch {}
    }
  }

  useEffect(() => {
    const handlePrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  function handleInstallApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    } else {
      alert('En Android: toca los 3 puntos arriba a la derecha y presiona "Instalar y crear acceso directo". En iPhone: toca Compartir y selecciona "Agregar al inicio".');
    }
  }

  // fetch con el token de sesión: las APIs validan usuario y plan en el servidor
  async function authFetch(url: string, init: RequestInit = {}) {
    const { data } = await supabase.auth.getSession();
    const headers = new Headers(init.headers);
    if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
    return fetch(url, { ...init, headers });
  }

  async function readJson(res: Response): Promise<any> {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (res.status === 413) return { error: 'El archivo es demasiado grande (máximo 4 MB).' };
      return { error: `Error del servidor (${res.status}). Reintentá en unos minutos.` };
    }
  }

  async function bootstrapUser(u: any) {
    if (bootstrappedFor.current === u.id) return;
    bootstrappedFor.current = u.id;
    try {
      await evaluateAccessAndLoad(u);
      await checkUnreadMessages(u);
    } catch (err) {
      console.error(err);
      bootstrappedFor.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function evaluateAccessAndLoad(currentUser: any) {
    const { data: receipts, error } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Error leyendo comprobantes:', error);

    // Misma función que usa el servidor para autorizar las APIs de IA.
    setAccess(computeAccess({
      email: currentUser.email,
      createdAt: currentUser.created_at,
      receipts: receipts || [],
    }));

    if (receipts && receipts.length > 0) setReceiptFeedback(receipts[0]);
    if (isAdminEmail(currentUser.email)) await loadAdminMetrics();
    await refreshAll(currentUser.id);
  }

  async function loadAdminMetrics() {
    try {
      const res = await authFetch('/api/admin/overview');
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Error cargando panel');
      setAdminReceipts(data.receipts || []);
      setAdminUsersList(data.users || []);
      setTotalAppUsersCount((data.users || []).length);
    } catch (err) {
      console.error('Panel admin:', err);
    }
  }

  async function checkUnreadMessages(currentUser: any) {
    const { count } = await supabase
      .from('user_support_chats')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_email', currentUser.email)
      .eq('is_read', false);

    if (count !== null) setUnreadCount(count);
  }

  // Los valores van entre comillas dobles para que un email con , ( ) no altere el filtro.
  const q = (v: string) => `"${String(v).replace(/["\\]/g, '')}"`;

  async function loadChatMessages(targetUserEmail?: string) {
    if (!user) return;
    const adminMain = DEFAULT_ADMIN_EMAILS[0];
    const otherEmail = targetUserEmail || (isSuperUser ? selectedChatUser?.user_email : adminMain);
    if (!otherEmail) return;

    const { data } = await supabase
      .from('user_support_chats')
      .select('*')
      .or(`and(sender_email.eq.${q(user.email)},receiver_email.eq.${q(otherEmail)}),and(sender_email.eq.${q(otherEmail)},receiver_email.eq.${q(user.email)})`)
      .order('created_at', { ascending: true });

    if (data) {
      setChatMessages(data);
      await supabase
        .from('user_support_chats')
        .update({ is_read: true })
        .eq('receiver_email', user.email)
        .eq('sender_email', otherEmail);
      setUnreadCount(0);
    }
  }

  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatMessage.trim() || !user) return;

    const receiverEmail = isSuperUser ? selectedChatUser?.user_email : DEFAULT_ADMIN_EMAILS[0];
    if (!receiverEmail) return;

    const { error } = await supabase
      .from('user_support_chats')
      .insert([{
        sender_id: user.id,
        sender_email: user.email,
        // el cliente no conoce el id del admin: el destinatario se identifica por email
        receiver_id: isSuperUser ? selectedChatUser.user_id : null,
        receiver_email: receiverEmail,
        message: newChatMessage.trim().slice(0, 2000),
        is_read: false
      }]);

    if (error) {
      alert('No se pudo enviar el mensaje: ' + error.message);
      return;
    }
    setNewChatMessage('');
    await loadChatMessages(receiverEmail);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        // La carga de datos la dispara onAuthStateChange (SIGNED_IN).
        setViewMode('app');
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthSuccess('¡Cuenta creada con éxito! Revisá tu correo si te pedimos confirmar y luego iniciá sesión: tenés 10 días gratis con acceso completo.');
        setAuthMode('login');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error de autenticación');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleUploadReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receiptFile || !user) return;
    setIsUploadingReceipt(true);

    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('plan', selectedPlanToPay);

      // El servidor valida monto, fecha, destino y duplicados, y registra el pago.
      const res = await authFetch('/api/verify-payment', { method: 'POST', body: formData });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'Error al validar el comprobante');

      if (data.receipt) setReceiptFeedback(data.receipt);
      await evaluateAccessAndLoad(user);

      if (data.approved) {
        alert('¡Comprobante verificado con éxito! Tu suscripción quedó activa por 30 días.');
      } else {
        alert('No pudimos aprobar el comprobante automáticamente:\n- ' + (data.reasons || []).join('\n- ') + '\n\nPodés subir otro comprobante o escribirnos por el chat.');
      }
    } catch (err: any) {
      alert('Error al enviar comprobante: ' + err.message);
    } finally {
      setIsUploadingReceipt(false);
      setReceiptFile(null);
    }
  }

  async function handleVerifyByAdmin(receiptId: string, status: 'verified' | 'rejected') {
    const res = await authFetch('/api/admin/overview', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: receiptId, status }),
    });
    const data = await readJson(res);
    if (res.ok) {
      await loadAdminMetrics();
      alert(`Comprobante marcado como: ${status === 'verified' ? 'Verificado' : 'Rechazado'}`);
    } else {
      alert('No se pudo actualizar: ' + (data.error || res.status));
    }
  }

  function requirePro(): boolean {
    if (isPro) return true;
    alert('Esta función es parte del Plan Pro IA. Podés cambiar de plan desde tu próximo pago.');
    return false;
  }

  async function handleRunAIDiagnosis() {
    if (!requirePro()) return;
    setIsLoadingDiagnosis(true);
    setIsDiagnosisOpen(true);
    setAiDiagnosis('');

    try {
      const res = await authFetch('/api/financial-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: totalIncome,
          expense: totalExpense,
          debt: totalDebtMode,
          currency: currencyMode,
          transactions: filteredTransactions,
          profileType: profileType === 'business' ? 'Comercio / PyME' : 'Personal'
        })
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el diagnóstico');
      setAiDiagnosis(data.diagnosis || 'Auditoría completada sin observaciones.');
    } catch (e: any) {
      setAiDiagnosis('Error conectando con el auditor de IA: ' + e.message);
    } finally {
      setIsLoadingDiagnosis(false);
    }
  }

  async function refreshAll(userId: string) {
    const [txRes, cardsRes, loansRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('user_id', userId),
      supabase.from('loans').select('*').eq('user_id', userId),
    ]);

    if (txRes.error || cardsRes.error || loansRes.error) {
      console.error('Error cargando datos:', txRes.error || cardsRes.error || loansRes.error);
      setDataError('No pudimos cargar todos tus datos. Revisá tu conexión e intentá de nuevo.');
    } else {
      setDataError('');
    }

    if (txRes.data) {
      setTransactions(txRes.data);
      // Solo la primera vez se elige el último mes; después se respeta la elección del usuario.
      if (!monthInitialized.current && txRes.data.length > 0) {
        monthInitialized.current = true;
        setSelectedMonth(txRes.data[0].date ? txRes.data[0].date.substring(0, 7) : 'all');
      }
    }
    if (cardsRes.data) setCreditCards(cardsRes.data);
    if (loansRes.data) setLoans(loansRes.data);
  }

  useEffect(() => {
    // Importante: NO hacer await de consultas de Supabase dentro de este callback
    // (puede dejar la app colgada). Se difiere con setTimeout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (session?.user) {
        const u = session.user;
        setUser((prev: any) => (prev?.id === u.id ? prev : u));
        setViewMode('app');
        setTimeout(() => { bootstrapUser(u); }, 0);
      } else {
        bootstrappedFor.current = null;
        monthInitialized.current = false;
        setUser(null);
        setAccess(null);
        setTransactions([]);
        setCreditCards([]);
        setLoans([]);
        setSelectedMonth('all');
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description || !user) return;

    const payload = {
      user_id: user.id,
      amount: parseFloat(amount),
      currency: manualCurrency,
      operation_type: 'purchase',
      description: profileType === 'business' ? `[NEGOCIO] ${description}` : description,
      type: transType,
      category: transType === 'expense' ? category : 'Ingreso',
      income_source: transType === 'income' ? incomeSource : null,
      credit_card_id: transType === 'expense' && selectedCardId ? selectedCardId : null,
      loan_id: transType === 'expense' && selectedLoanId ? selectedLoanId : null,
      date: customDate || todayLocal()
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

  // Pasa movimientos a Negocio (business=true) o de vuelta a Personal (business=false).
  async function moveTransactionsToProfile(ids: string[], business: boolean) {
    if (!user || ids.length === 0) return;
    setMovSaving(true);
    try {
      const rows = transactions.filter(t => ids.includes(t.id));
      const results = await Promise.all(
        rows.map(t =>
          supabase
            .from('transactions')
            .update({ description: withProfile(t.description, business) })
            .eq('id', t.id)
            .eq('user_id', user.id)
        )
      );
      const failed = results.find(r => r.error);
      if (failed?.error) alert('No se pudo cambiar algún movimiento: ' + failed.error.message);
      setMovSelected([]);
      await refreshAll(user.id);
    } finally {
      setMovSaving(false);
    }
  }

  function openMovements(kind: 'card' | 'loan', id: string, name: string) {
    setMovSelected([]);
    setMovMonth(selectedMonth);
    // Si todavía no hay movimientos asignados a esta tarjeta/billetera, mostrar todos
    const hasLinked = transactions.some(t => (kind === 'card' ? t.credit_card_id : t.loan_id) === id);
    setMovScope(hasLinked ? 'linked' : 'all');
    setMovementsEntity({ kind, id, name });
  }

  // Asigna movimientos sueltos a la tarjeta/billetera abierta en el listado.
  async function assignTransactionsToEntity(ids: string[]) {
    if (!user || !movementsEntity || ids.length === 0) return;
    setMovSaving(true);
    try {
      const patch = movementsEntity.kind === 'card'
        ? { credit_card_id: movementsEntity.id, loan_id: null }
        : { loan_id: movementsEntity.id, credit_card_id: null };
      const { error } = await supabase
        .from('transactions')
        .update(patch)
        .in('id', ids)
        .eq('user_id', user.id);
      if (error) alert('No se pudo asignar: ' + error.message);
      setMovSelected([]);
      await refreshAll(user.id);
    } finally {
      setMovSaving(false);
    }
  }

  function openEditTransaction(tx: any) {
    setEditingTransaction(tx);
    setEditTxType(tx.type);
    setEditTxOpType(tx.operation_type || 'purchase');
    setEditTxCurrency(tx.currency || 'ARS');
    setEditTxCategory(tx.category || 'Otros');
    setEditTxAmount(String(tx.amount || '0'));
    setEditTxDescription(tx.description || '');
  }

  async function handleSaveTransactionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTransaction || !user) return;

    const payload = {
      description: editTxDescription,
      amount: parseFloat(editTxAmount) || 0,
      type: editTxType,
      operation_type: editTxOpType,
      currency: editTxCurrency,
      category: editTxType === 'expense' ? editTxCategory : 'Ingreso'
    };

    const { error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', editingTransaction.id)
      .eq('user_id', user.id);

    if (!error) {
      setEditingTransaction(null);
      await refreshAll(user.id);
      alert('¡Transacción modificada con éxito!');
    } else {
      alert('Error al modificar: ' + error.message);
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
      balance_ars: parseFloat(newCardLimitArs || '0'),
      balance_usd: parseFloat(newCardLimitUsd || '0'),
      credit_limit: parseFloat(newCardLimitArs || '0')
    }]);

    if (error) {
      alert('No se pudo guardar la tarjeta: ' + error.message);
      return;
    }
    setNewCardName('');
    setNewCardLimitArs('');
    setNewCardLimitUsd('');
    setIsCardModalOpen(false);
    refreshAll(user.id);
  }

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!newLoanEntity || !user) return;

    const { error } = await supabase.from('loans').insert([{
      user_id: user.id,
      entity: newLoanEntity,
      total_amount: parseFloat(newLoanTotal || '0'),
      installment_amount: parseFloat(newLoanInstallment || '0'),
      total_installments: 12,
      paid_installments: 1,
      due_day: 10
    }]);

    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return;
    }
    setNewLoanEntity('');
    setNewLoanTotal('');
    setNewLoanInstallment('');
    setIsLoanModalOpen(false);
    refreshAll(user.id);
    alert('¡Entidad/Billetera agregada correctamente!');
  }

  function openEditCard(card: any) {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardClosing(String(card.closing_day || '20'));
    setEditCardDue(String(card.due_day || '5'));
    setEditCardLimitArs(String(cardBalanceArs(card)));
    setEditCardLimitUsd(String(card.balance_usd || '0'));
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
        balance_ars: parseFloat(editCardLimitArs || '0'),
        balance_usd: parseFloat(editCardLimitUsd || '0'),
        credit_limit: parseFloat(editCardLimitArs || '0')
      })
      .eq('id', editingCardId)
      .eq('user_id', user.id);

    if (error) {
      alert('No se pudo actualizar la tarjeta: ' + error.message);
      return;
    }
    setIsEditCardModalOpen(false);
    setEditingCardId(null);
    refreshAll(user.id);
  }

  async function handleDeleteCard(cardId: string) {
    if (!user) return;
    if (!confirm('¿Deseas eliminar esta tarjeta? Sus movimientos se conservan, pero quedarán sin tarjeta asignada.')) return;
    // primero se desvinculan los movimientos para no dejar referencias rotas
    const { error: unlinkError } = await supabase
      .from('transactions').update({ credit_card_id: null }).eq('credit_card_id', cardId).eq('user_id', user.id);
    if (unlinkError) { alert('No se pudo desvincular los movimientos: ' + unlinkError.message); return; }
    const { error } = await supabase.from('credit_cards').delete().eq('id', cardId).eq('user_id', user.id);
    if (error) { alert('No se pudo eliminar la tarjeta: ' + error.message); return; }
    refreshAll(user.id);
  }

  async function handleDeleteLoan(loanId: string) {
    if (!user) return;
    if (!confirm('¿Deseas eliminar esta billetera o préstamo? Sus movimientos se conservan.')) return;
    const { error: unlinkError } = await supabase
      .from('transactions').update({ loan_id: null }).eq('loan_id', loanId).eq('user_id', user.id);
    if (unlinkError) { alert('No se pudo desvincular los movimientos: ' + unlinkError.message); return; }
    const { error } = await supabase.from('loans').delete().eq('id', loanId).eq('user_id', user.id);
    if (error) { alert('No se pudo eliminar: ' + error.message); return; }
    refreshAll(user.id);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (!confirm('¿Eliminar este movimiento?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
    if (error) { alert('No se pudo eliminar: ' + error.message); return; }
    refreshAll(user.id);
  }

  function openImportForEntity(type: 'card' | 'loan', id: string, name: string) {
    setTargetEntityForImport({ type, id, name });
    setMigrationData(null);
    setImportText('');
    setImportFile(null);
    setIsImportModalOpen(true);
  }

  async function handleExecuteAIImport() {
    if (!importText.trim() && !importFile) return;
    if (!requirePro()) return;
    setUploading(true);

    try {
      let res;
      if (importFile) {
        const formData = new FormData();
        formData.append('file', importFile);
        res = await authFetch('/api/parse-statement', { method: 'POST', body: formData });
      } else {
        res = await authFetch('/api/parse-statement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: importText }),
        });
      }

      const data = await readJson(res);
      if (!res.ok) {
        throw new Error(data.error || 'Error procesando datos con IA');
      }

      if (data.items && Array.isArray(data.items)) {
        // Detección de duplicados por multiconjunto: cada movimiento ya guardado "consume"
        // una sola coincidencia, así dos compras idénticas legítimas no se descartan,
        // pero re-importar el mismo período sí marca todo como duplicado.
        const normDesc = (d: string) =>
          (d || '').replace(/^(\[(USD|NEGOCIO)\]\s*)+/i, '').trim().toLowerCase().slice(0, 12);
        // Reintegros y pagos se comparan por fecha, monto y tipo: cada banco los nombra distinto
        // ("NOTA DE CREDITO GOOGLE" vs "[REINTEGRO] GOOGLE") y así no se duplican.
        const keyOf = (date: string, amount: number, cur: string, desc: string, op?: string) =>
          `${date}|${amount.toFixed(2)}|${cur}|${op === 'refund' || op === 'payment' ? `__${op}` : normDesc(desc)}`;

        const existing = new Map<string, number>();
        transactions
          .filter(tx => {
            // Se comparan los de esa tarjeta/billetera y los que quedaron sin asignar (importes viejos).
            const loose = !tx.credit_card_id && !tx.loan_id;
            if (targetEntityForImport?.type === 'card') return tx.credit_card_id === targetEntityForImport.id || loose;
            if (targetEntityForImport?.type === 'loan') return tx.loan_id === targetEntityForImport.id || loose;
            return true;
          })
          .forEach(tx => {
            const k = keyOf(tx.date || '', Math.abs(Number(tx.amount)), tx.currency || 'ARS', tx.description || '', tx.operation_type);
            existing.set(k, (existing.get(k) || 0) + 1);
          });

        data.items = data.items.map((item: any) => {
          const cleanAmount = Math.abs(Number(item.amount) || 0);
          const itemDate = item.date || todayLocal();
          const k = keyOf(itemDate, cleanAmount, item.currency || 'ARS', item.description || '', item.operation_type);
          const left = existing.get(k) || 0;
          const isDuplicate = left > 0;
          if (isDuplicate) existing.set(k, left - 1);

          return {
            ...item,
            date: itemDate,
            amount: cleanAmount,
            isDuplicate,
            direction: item.operation_type === 'payment' && (data.entity_kind === 'wallet' || targetEntityForImport?.type === 'loan') ? 'out' : item.direction,
            selectedCategory: item.category || (item.operation_type === 'refund' ? 'Otros' : 'Por Clasificar')
          };
        });
      }

      if (!targetEntityForImport) {
        const guess = guessEntity(data.entity_name, data.entity_kind, creditCards, loans);
        setImportLink(guess || (data.entity_kind === 'wallet' || !data.entity_name ? 'none' : 'new-card'));
      }
      setMigrationData(data);
    } catch (err: any) {
      alert('Error al interpretar extracto: ' + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleChangePreviewOp(index: number, op: string) {
    if (!migrationData?.items) return;
    const updated = [...migrationData.items];
    const it = updated[index];
    it.operation_type = op;
    const isWalletImport = migrationData.entity_kind === 'wallet' || targetEntityForImport?.type === 'loan';
    if (op === 'purchase') it.direction = 'out';
    else if (op === 'payment') it.direction = isWalletImport ? 'out' : 'in';
    else if (op !== 'transfer') it.direction = 'in';
    if (op === 'purchase' && (!it.selectedCategory || it.selectedCategory === 'Tarjeta de Crédito')) it.selectedCategory = 'Por Clasificar';
    setMigrationData({ ...migrationData, items: updated });
  }

  function handleUpdatePreviewCategory(index: number, newCategory: string) {
    if (!migrationData?.items) return;
    const updated = [...migrationData.items];
    updated[index].selectedCategory = newCategory;
    setMigrationData({ ...migrationData, items: updated });
  }

  async function handleConfirmMigration() {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSessionUser = sessionData?.session?.user || user;

    if (!currentSessionUser) {
      alert('Sesión expirada.');
      return;
    }

    if (!migrationData?.items?.length) {
      alert('No se detectaron movimientos.');
      return;
    }

    setIsSavingBatch(true);

    try {
      const today = todayLocal();
      const validItems = migrationData.items.filter((item: any) => !item.isDuplicate);

      let assignedCardId: string | null = targetEntityForImport?.type === 'card' ? targetEntityForImport.id : null;
      let assignedLoanId: string | null = targetEntityForImport?.type === 'loan' ? targetEntityForImport.id : null;
      if (!targetEntityForImport) {
        if (importLink.startsWith('card:')) assignedCardId = importLink.slice(5);
        else if (importLink.startsWith('loan:')) assignedLoanId = importLink.slice(5);
        else if (importLink === 'new-card') {
          const { data: created, error: createErr } = await supabase
            .from('credit_cards')
            .insert([{
              user_id: currentSessionUser.id,
              name: migrationData.entity_name || 'Tarjeta importada',
              closing_day: 20,
              due_day: 5,
              balance_ars: 0,
              balance_usd: 0,
            }])
            .select('id')
            .single();
          if (createErr) throw createErr;
          assignedCardId = created.id;
        }
      }

      // Movimientos ya guardados pero sin tarjeta (importes viejos): si el resumen los repite, se vinculan.
      let relinked = 0;
      if (assignedCardId || assignedLoanId) {
        const normD = (d: string) => (d || '').replace(/^(\[(USD|NEGOCIO)\]\s*)+/i, '').trim().toLowerCase().slice(0, 12);
        const kOf = (date: string, amt: number, cur: string, d: string, op?: string) => `${date}|${amt.toFixed(2)}|${cur}|${op === 'refund' || op === 'payment' ? `__${op}` : normD(d)}`;
        const loose = new Map<string, string[]>();
        transactions.filter(t => !t.credit_card_id && !t.loan_id).forEach(t => {
          const k = kOf(t.date || '', Math.abs(Number(t.amount)), t.currency || 'ARS', t.description || '', t.operation_type);
          loose.set(k, [...(loose.get(k) || []), t.id]);
        });
        const idsToLink: string[] = [];
        migrationData.items.filter((i: any) => i.isDuplicate).forEach((i: any) => {
          const k = kOf(i.date || '', Math.abs(Number(i.amount)), i.currency || 'ARS', i.description || '', i.operation_type);
          const list = loose.get(k);
          if (list && list.length) idsToLink.push(list.shift() as string);
        });
        if (idsToLink.length > 0) {
          const { error: linkErr } = await supabase
            .from('transactions')
            .update({ credit_card_id: assignedCardId, loan_id: assignedLoanId })
            .in('id', idsToLink)
            .eq('user_id', currentSessionUser.id);
          if (linkErr) throw linkErr;
          relinked = idsToLink.length;
        }
      }

      const rows = validItems.map((item: any) => {
        const op = item.operation_type || 'purchase';
        const isOpRefund = op === 'refund';
        const isOpPayment = op === 'payment';
        const isIncomeType = isInflow(item);

        const finalCategory = op === 'purchase'
          ? (item.selectedCategory === 'Por Clasificar' ? 'Otros' : item.selectedCategory)
          : op === 'income' ? 'Ingreso'
          : op === 'transfer' ? 'Transferencia propia'
          : 'Tarjeta de Crédito';

        return {
          user_id: currentSessionUser.id,
          description: item.currency === 'USD' 
            ? `[USD] ${item.description}` 
            : item.description,
          amount: item.amount,
          currency: item.currency || 'ARS',
          operation_type: op,
          category: finalCategory,
          type: isIncomeType ? 'income' : 'expense',
          income_source: isOpRefund ? 'reintegro' : isOpPayment ? 'pago_tarjeta' : op === 'income' ? 'other' : null,
          credit_card_id: assignedCardId,
          loan_id: assignedLoanId,
          date: (item.date && item.date.length === 10) ? item.date : today,
          installment_number: Number(item.installment_number) || 1,
          total_installments: Number(item.total_installments) || 1
        };
      });

      if (rows.length > 0) {
        const { error: txError } = await supabase.from('transactions').insert(rows);
        if (txError) throw txError;
      }

      // Los saldos se actualizan DESPUÉS de guardar los movimientos y solo si el resumen
      // trae el total (antes, un total faltante pisaba el saldo real con 0).
      let balanceWarning = '';
      if (assignedCardId) {
        const upd: Record<string, number> = {};
        if (migrationData.total_ars !== null && migrationData.total_ars !== undefined) {
          upd.balance_ars = Number(migrationData.total_ars);
          upd.credit_limit = Number(migrationData.total_ars);
        }
        if (migrationData.total_usd !== null && migrationData.total_usd !== undefined) {
          upd.balance_usd = Number(migrationData.total_usd);
        }
        if (Object.keys(upd).length > 0) {
          const { error: balError } = await supabase
            .from('credit_cards').update(upd).eq('id', assignedCardId).eq('user_id', currentSessionUser.id);
          if (balError) balanceWarning = '\n\nAtención: los movimientos se guardaron pero no se pudo actualizar el saldo de la tarjeta (' + balError.message + ').';
        }
      }

      // Billetera / cuenta: se guarda el dinero disponible al cierre del extracto.
      if (assignedLoanId) {
        const upd: Record<string, number> = {};
        if (migrationData.total_ars !== null && migrationData.total_ars !== undefined) upd.balance_ars = Number(migrationData.total_ars);
        if (migrationData.total_usd !== null && migrationData.total_usd !== undefined) upd.balance_usd = Number(migrationData.total_usd);
        if (Object.keys(upd).length > 0) {
          const { error: balError } = await supabase
            .from('loans').update(upd).eq('id', assignedLoanId).eq('user_id', currentSessionUser.id);
          if (balError) balanceWarning = '\n\nAtención: los movimientos se guardaron pero no se pudo actualizar el saldo de la billetera (' + balError.message + ').';
        }
      }

      setIsImportModalOpen(false);
      setMigrationData(null);
      setImportText('');
      setImportFile(null);
      setTargetEntityForImport(null);
      await refreshAll(currentSessionUser.id);
      const savedBalance = (assignedCardId || assignedLoanId) && (migrationData.total_ars != null || migrationData.total_usd != null);
      alert(
        rows.length === 0 && relinked === 0
          ? 'Todos los movimientos ya estaban registrados, no se duplicó nada.' + (savedBalance ? ' Se actualizó el saldo.' : '')
          : `¡Éxito! Se incorporaron ${rows.length} operaciones nuevas` + (relinked ? ` y se vincularon ${relinked} movimientos que ya tenías` : '') + (savedBalance ? '. Se actualizó el saldo.' : '.')
      );
      if (balanceWarning) alert(balanceWarning.trim());
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSavingBatch(false);
    }
  }

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach(t => {
      if (t.date && t.date.length >= 7) monthsSet.add(t.date.substring(0, 7));
    });
    return Array.from(monthsSet).sort().reverse();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchMonth = selectedMonth === 'all' || (t.date && t.date.startsWith(selectedMonth));
      const isBusinessTx = isBusinessDesc(t.description);
      const matchProfile = profileType === 'business' ? isBusinessTx : !isBusinessTx;
      return matchMonth && matchProfile;
    });
  }, [transactions, selectedMonth, profileType]);

  // Convierte un monto a la moneda elegida en el header (cotización editable).
  const toMode = useCallback((amountVal: number, cur?: string): number => {
    const c: Cur = cur === 'USD' ? 'USD' : 'ARS';
    if (c === currencyMode) return amountVal;
    return c === 'USD' ? amountVal * usdRate : amountVal / usdRate;
  }, [currencyMode, usdRate]);
  const sumMode = useCallback(
    (list: any[]) => list.reduce((acc, t) => acc + toMode(Number(t.amount || 0), t.currency), 0),
    [toMode]
  );

  // Ingresos reales: sin pagos de tarjeta (transferencias) ni reintegros.
  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'income' && !isTransfer(t) && !isRefund(t));
  }, [filteredTransactions]);

  const purchaseTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'expense' && !isTransfer(t) && !isRefund(t));
  }, [filteredTransactions]);

  const totalIncome = useMemo(() => sumMode(incomeTransactions), [incomeTransactions, sumMode]);

  // Gasto neto: compras menos reintegros/devoluciones.
  const totalExpense = useMemo(() => {
    const refunds = sumMode(filteredTransactions.filter(t => isRefund(t) && !isTransfer(t)));
    return Math.max(0, sumMode(purchaseTransactions) - refunds);
  }, [filteredTransactions, purchaseTransactions, sumMode]);

  const netBalance = totalIncome - totalExpense;

  // Deuda de tarjetas: ARS y USD por separado para mostrar, y consolidada para los KPIs.
  const totalDebtArs = useMemo(() => {
    return creditCards.reduce((acc, c) => acc + cardBalanceArs(c), 0);
  }, [creditCards]);

  const totalDebtUsd = useMemo(() => {
    return creditCards.reduce((acc, c) => acc + Number(c.balance_usd || 0), 0);
  }, [creditCards]);

  const totalDebtMode = useMemo(() => {
    return toMode(totalDebtArs, 'ARS') + toMode(totalDebtUsd, 'USD');
  }, [totalDebtArs, totalDebtUsd, toMode]);

  // Peso de la deuda: saldo de tarjetas ÷ ingresos del período.
  const debtRatio = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return (Math.max(totalDebtMode, 0) / totalIncome) * 100;
  }, [totalDebtMode, totalIncome]);

  const savingsRate = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return ((totalIncome - totalExpense) / totalIncome) * 100;
  }, [totalIncome, totalExpense]);

  // Días transcurridos y días del período según el mes elegido (no siempre el mes actual).
  const periodInfo = useMemo(() => {
    if (selectedMonth === 'all') {
      let first = '';
      let last = '';
      for (const t of filteredTransactions) {
        if (!t.date) continue;
        if (!first || t.date < first) first = t.date;
        if (!last || t.date > last) last = t.date;
      }
      if (!first || first === last) return { elapsed: 30, total: 30 };
      const span = Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000) + 1;
      return { elapsed: Math.max(span, 1), total: 30 };
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const total = new Date(y, m, 0).getDate();
    const isCurrent = todayLocal().startsWith(selectedMonth);
    return { elapsed: isCurrent ? Math.max(new Date().getDate(), 1) : total, total };
  }, [selectedMonth, filteredTransactions]);

  const dailyAverageExpense = useMemo(() => {
    return totalExpense / periodInfo.elapsed;
  }, [totalExpense, periodInfo]);

  // Cuántos días de gasto cubre el superávit del período (no es un saldo bancario).
  const survivalDays = useMemo(() => {
    if (dailyAverageExpense <= 0) return 999;
    const availableCash = Math.max(netBalance, 0);
    return Math.floor(availableCash / dailyAverageExpense);
  }, [netBalance, dailyAverageExpense]);

  const projectedMonthEndExpense = useMemo(() => {
    return dailyAverageExpense * periodInfo.total;
  }, [dailyAverageExpense, periodInfo]);

  function formatMoney(amountVal: number, curr: 'ARS' | 'USD' = 'ARS') {
    if (curr === 'USD') {
      return `u$s ${amountVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$ ${amountVal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const expenseDataByCategory = useMemo(() => {
    return purchaseTransactions
      .reduce((acc: any[], item) => {
        const catName = item.category || 'Otros';
        const val = toMode(Number(item.amount || 0), item.currency);
        const existing = acc.find(c => c.name === catName);
        if (existing) {
          existing.value += val;
        } else {
          acc.push({ name: catName, value: val });
        }
        return acc;
      }, []);
  }, [purchaseTransactions, toMode]);

  const transactionsOfSelectedCategory = useMemo(() => {
    if (!selectedCategoryDetail) return [];
    return purchaseTransactions.filter(t => (t.category || 'Otros') === selectedCategoryDetail);
  }, [purchaseTransactions, selectedCategoryDetail]);

  // ==========================================
  // RENDER: LANDING PAGE DE VENTA CON PROMO 40% OFF
  // ==========================================
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-[#08121f] text-slate-100 font-sans selection:bg-[#00D7FF] selection:text-[#0B192C]">
        <div className="bg-gradient-to-r from-[#00D7FF] via-cyan-500 to-blue-600 text-[#0B192C] py-2 px-4 text-center text-xs font-black tracking-wide flex items-center justify-center gap-2">
          <Gift className="w-4 h-4 animate-bounce" />
          <span>PROMO LANZAMIENTO: 40% DE BONIFICACIÓN POR 6 MESES • 10 DÍAS DE PRUEBA COMPLETA GRATIS</span>
        </div>

        <nav className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00D7FF]/10 border border-[#00D7FF]/30 flex items-center justify-center text-[#00D7FF] font-bold text-xl shadow-[0_0_15px_rgba(0,215,255,0.2)]">
              ▲
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                DRM-IA <span className="text-xs bg-[#00D7FF]/10 text-[#00D7FF] px-2.5 py-0.5 rounded-full border border-[#00D7FF]/30">Finanzas</span>
              </span>
              <p className="text-[10px] text-slate-400">Soluciones Integrales para tu Negocio</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              onClick={handleInstallApp}
              className="hidden sm:flex text-xs font-bold bg-slate-800 border border-slate-700 text-[#00D7FF] px-3 py-2 rounded-xl hover:bg-slate-700 transition-colors items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" /> Descargar App Celular
            </button>
            <button 
              onClick={() => { setAuthMode('login'); setViewMode('app'); }}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 transition-colors cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setViewMode('app'); }}
              className="text-xs font-bold bg-[#00D7FF] text-[#0B192C] px-4 py-2.5 rounded-xl hover:bg-[#00B4D8] transition-all shadow-lg shadow-[#00D7FF]/20 flex items-center gap-1.5 cursor-pointer"
            >
              Probar 10 Días Gratis <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>

        <header className="max-w-4xl mx-auto px-6 pt-14 pb-12 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0B192C] border border-[#00D7FF]/40 text-[#00D7FF] text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-[#00D7FF]" />
            Auditoría Bimonetaria Inteligente • Pesos y Dólares con Google Gemini 3.8 Flash
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Controlá tus tarjetas en <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D7FF] to-cyan-400">Pesos y Dólares</span> con Inteligencia Artificial
          </h1>

          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Importá extractos con compras, pagos y reintegros. Clasificación exacta en dos monedas y detección de saldos a favor sin duplicados.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button 
              onClick={() => { setAuthMode('register'); setViewMode('app'); }}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#00D7FF] to-cyan-500 text-[#0B192C] font-bold text-sm hover:opacity-95 transition-all shadow-xl shadow-[#00D7FF]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              Comenzar Prueba de 10 Días Gratis <ArrowRight className="w-4 h-4" />
            </button>
            <button 
              onClick={handleInstallApp}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#0B192C] border border-[#00D7FF]/40 text-white font-semibold text-sm hover:bg-[#132238] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-[#00D7FF]" /> Descargar App en el Celular
            </button>
          </div>
        </header>

        {/* Tabla de Planes */}
        <section className="max-w-5xl mx-auto px-6 py-16 border-t border-slate-800/80">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
            <div className="inline-block bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Oferta por Tiempo Limitado
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Planes con 40% de Descuento por 6 Meses</h2>
            <p className="text-xs text-slate-400">Probá todas las funciones gratis durante 10 días. El día 11 activás tu tarifa bonificada.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-[#0B192C] p-8 rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">Plan Esencial</h3>
                  <span className="text-[10px] bg-[#00D7FF]/10 text-[#00D7FF] font-bold px-2 py-0.5 rounded border border-[#00D7FF]/30">40% OFF x 6 MESES</span>
                </div>
                <p className="text-xs text-slate-400">Ideal para control presupuestario personal y seguimiento de tarjetas.</p>
                <div>
                  <span className="text-xs text-slate-500 line-through mr-2">$ {PLAN_ESENCIAL_REGULAR.toLocaleString('es-AR')}</span>
                  <span className="text-3xl font-extrabold text-white">$ {PLAN_ESENCIAL_PROMO.toLocaleString('es-AR')}</span>
                  <span className="text-xs text-slate-400 font-normal"> / mes</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Carga manual ilimitada de gastos e ingresos</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Control bimonetario (Pesos y Dólares)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Semáforo de endeudamiento y desglose de rubros</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> App instalable en Android e iOS</li>
                </ul>
              </div>
              <button 
                onClick={() => { setAuthMode('register'); setViewMode('app'); }}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Probar 10 Días Gratis
              </button>
            </div>

            <div className="bg-[#132238] p-8 rounded-3xl border-2 border-[#00D7FF] space-y-6 flex flex-col justify-between relative shadow-2xl">
              <div className="absolute -top-3.5 right-6 bg-[#00D7FF] text-[#0B192C] text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider">
                Recomendado • 40% OFF
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Plan Pro IA <Sparkles className="w-4 h-4 text-[#00D7FF]" />
                </h3>
                <p className="text-xs text-slate-400">Automatización total para profesionales, comercios y billeteras.</p>
                <div>
                  <span className="text-xs text-slate-500 line-through mr-2">$ {PLAN_PRO_REGULAR.toLocaleString('es-AR')}</span>
                  <span className="text-3xl font-extrabold text-white">$ {PLAN_PRO_PROMO.toLocaleString('es-AR')}</span>
                  <span className="text-xs text-slate-400 font-normal"> / mes</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Todo lo incluido en el Plan Esencial</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Importador IA con detección de compras, pagos y reintegros</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Manejo independiente de saldos en ARS y USD</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Auditor Financiero IA (&quot;Diagnóstico Mensual&quot;)</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Simulador Bola de Nieve para deudas</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Soporte y chat directo con Dionicio</li>
                </ul>
              </div>
              <button 
                onClick={() => { setAuthMode('register'); setViewMode('app'); }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00D7FF] to-cyan-500 text-[#0B192C] font-bold text-xs hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-[#00D7FF]/20"
              >
                Activar con 40% OFF (10 Días Gratis)
              </button>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
          © 2026 DRM-IA • Soluciones Integrales e Inteligencia Artificial • Río Gallegos
        </footer>
      </div>
    );
  }

  if (loading || (user && !access)) {
    return (
      <div className="min-h-screen bg-[#08121f] text-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00D7FF]" />
      </div>
    );
  }

  // ==========================================
  // RENDER: PANTALLA DE ACCESO / REGISTRO
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
            <span className="text-[10px] text-slate-500 font-mono">DRM-IA AUTH</span>
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-white">
              {authMode === 'login' ? 'Ingresar a tu Cuenta' : 'Empezá tus 10 Días Gratis'}
            </h1>
            <p className="text-xs text-slate-400">
              {authMode === 'login' ? 'Accedé a tu panel de finanzas' : 'Acceso completo con 40% OFF garantizado'}
            </p>
          </div>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${authMode === 'login' ? 'bg-[#00D7FF] text-[#0B192C]' : 'text-slate-400'}`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all ${authMode === 'register' ? 'bg-[#00D7FF] text-[#0B192C]' : 'text-slate-400'}`}
            >
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
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
                placeholder="Mínimo 6 caracteres" 
                className="w-full text-xs bg-slate-900 border border-slate-700 rounded-xl p-3 outline-none text-white focus:border-[#00D7FF]" 
                required 
              />
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800">{authError}</p>
            )}

            {authSuccess && (
              <p className="text-xs text-emerald-400 bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800">{authSuccess}</p>
            )}

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full bg-[#00D7FF] hover:bg-[#00B4D8] disabled:opacity-50 text-[#0B192C] font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {authLoading ? 'Procesando...' : authMode === 'login' ? 'Entrar al Panel' : 'Activar mis 10 Días Gratis'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PANTALLA DE PAGO
  // ==========================================
  if (user && access?.status === 'expired') {
    return (
      <div className="min-h-screen bg-[#08121f] text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-[#0B192C] max-w-xl w-full p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#00D7FF]" />
              <h2 className="text-base font-bold text-white">Completaste tus 10 días de prueba</h2>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-xs text-rose-400 hover:underline">
              Cerrar Sesión
            </button>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs text-rose-300 font-semibold flex items-center gap-2">
            <Gift className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ¡Tu beneficio de 40% OFF por 6 meses ya está aplicado en el precio a transferir!
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div 
              onClick={() => setSelectedPlanToPay('base')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedPlanToPay === 'base' ? 'bg-[#132238] border-[#00D7FF] shadow-lg shadow-[#00D7FF]/10' : 'bg-slate-900 border-slate-800 opacity-60'}`}
            >
              <p className="text-xs font-bold text-white">Plan Esencial (40% OFF)</p>
              <p className="text-xs text-slate-500 line-through mt-1">$ {PLAN_ESENCIAL_REGULAR.toLocaleString('es-AR')}</p>
              <p className="text-lg font-extrabold text-white">$ {PLAN_ESENCIAL_PROMO.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400">/ mes</span></p>
            </div>

            <div 
              onClick={() => setSelectedPlanToPay('pro')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedPlanToPay === 'pro' ? 'bg-[#132238] border-[#00D7FF] shadow-lg shadow-[#00D7FF]/10' : 'bg-slate-900 border-slate-800 opacity-60'}`}
            >
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-white">Plan Pro IA (40% OFF)</p>
                <Sparkles className="w-3.5 h-3.5 text-[#00D7FF]" />
              </div>
              <p className="text-xs text-slate-500 line-through mt-1">$ {PLAN_PRO_REGULAR.toLocaleString('es-AR')}</p>
              <p className="text-lg font-extrabold text-white">$ {PLAN_PRO_PROMO.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400">/ mes</span></p>
            </div>
          </div>

          <div className="p-4 bg-[#132238] rounded-2xl border border-slate-700/80 space-y-2 text-xs">
            <p className="text-slate-300">Alias de Transferencia: <strong className="text-[#00D7FF] font-mono text-sm">drm-ia</strong></p>
            <p className="text-slate-400">Titular: Dionicio Rafael Martin • DRM-IA</p>
            <p className="text-slate-300">
              Monto bonificado a transferir: <strong className="text-emerald-400 text-sm">${(selectedPlanToPay === 'pro' ? PLAN_PRO_PROMO : PLAN_ESENCIAL_PROMO).toLocaleString('es-AR')}</strong>
            </p>
          </div>

          {receiptFeedback?.ai_status === 'rejected_by_ai' && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] p-3 rounded-xl">
              Último comprobante no aprobado: {receiptFeedback.ai_notes}
            </div>
          )}

          <form onSubmit={handleUploadReceipt} className="space-y-3">
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-4 text-center hover:border-[#00D7FF] transition-colors">
              <input 
                type="file" 
                id="receipt-upload"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => setReceiptFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                <UploadCloud className="w-8 h-8 text-[#00D7FF]" />
                <span className="text-xs font-semibold text-slate-300">
                  {receiptFile ? `Archivo: ${receiptFile.name}` : 'Subir comprobante (imagen o PDF, máx. 4 MB) de la transferencia al alias drm-ia'}
                </span>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={!receiptFile || isUploadingReceipt}
              className="w-full bg-[#00D7FF] hover:bg-[#00B4D8] disabled:opacity-50 text-[#0B192C] font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isUploadingReceipt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isUploadingReceipt ? 'Gemini 3.8 Flash auditando pago...' : 'Validar con IA y Reactivar Cuenta'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setViewMode('landing')}
              title="Volver a la portada"
              className="w-10 h-10 rounded-xl bg-[#0B192C] text-[#00D7FF] flex items-center justify-center font-bold text-lg cursor-pointer"
            >
              ▲
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Panel de Finanzas DRM-IA</h1>
                {isSuperUser ? (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                    Acceso Libre Permanente (Superusuario)
                  </span>
                ) : (
                  <>
                    {isTrialActive && !hasPaidPlan && (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
                        <Gift className="w-3 h-3 text-amber-600" /> Prueba: {trialDaysLeft} días
                      </span>
                    )}
                    {hasPaidPlan && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                        {`Plan ${access?.plan === 'pro' ? 'Pro IA' : 'Esencial'} activo`}{access?.paidUntil ? ` · hasta ${new Date(access.paidUntil).toLocaleDateString('es-AR')}` : ''}
                      </span>
                    )}
                  </>
                )}
                {isSuperUser && (
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">
                    👑 SUPERUSUARIO • {totalAppUsersCount} Clientes en la App
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button 
                onClick={() => setProfileType('personal')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${profileType === 'personal' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
              >
                <UserIcon className="w-3.5 h-3.5" /> Personal
              </button>
              <button 
                onClick={() => setProfileType('business')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${profileType === 'business' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
              >
                <Briefcase className="w-3.5 h-3.5" /> Negocio
              </button>
            </div>

            <button 
              onClick={() => setCurrencyMode(prev => prev === 'ARS' ? 'USD' : 'ARS')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> {currencyMode}
            </button>
            <label className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-1.5 rounded-xl border border-slate-200" title="Cotización usada para convertir entre pesos y dólares">
              u$s 1 =
              <input
                type="number"
                min="1"
                step="1"
                defaultValue={usdRate}
                key={usdRate}
                onBlur={e => updateUsdRate(e.target.value)}
                className="w-16 bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </label>

            <button 
              onClick={() => { setIsChatModalOpen(true); loadChatMessages(); }}
              className={`relative px-3 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors ${unreadCount > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat {isSuperUser ? 'Clientes' : 'Dionicio'}</span>
              {unreadCount > 0 && (
                <span className="bg-white text-rose-600 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {isSuperUser && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" /> Pagos ({adminReceipts.filter(r => r.admin_status === 'pending').length})
              </button>
            )}

            <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Ver Histórico</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={() => { setTargetEntityForImport(null); setIsImportModalOpen(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" /> Importar Inicial con IA
            </button>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-xs text-red-500 border border-red-200 px-2.5 py-2 rounded-xl hover:bg-red-50 cursor-pointer"
            >
              Salir
            </button>
          </div>
        </header>

        {dataError && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {dataError}
            <button onClick={() => user && refreshAll(user.id)} className="ml-auto underline font-semibold cursor-pointer">Reintentar</button>
          </div>
        )}

        {/* Auditor IA */}
        <div className="bg-gradient-to-r from-[#0B192C] to-[#132238] p-4 rounded-2xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00D7FF]/10 text-[#00D7FF] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Auditor Financiero con Inteligencia Artificial</p>
              <p className="text-[11px] text-slate-400">Diagnóstico mensual de gastos hormiga, orden de liquidación y optimización de caja</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { if (requirePro()) setIsSnowballModalOpen(true); }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            >
              <Calculator className="w-3.5 h-3.5 text-[#00D7FF]" /> Plan Bola de Nieve
            </button>
            <button 
              onClick={handleRunAIDiagnosis}
              disabled={isLoadingDiagnosis}
              className="bg-[#00D7FF] hover:bg-[#00B4D8] text-[#0B192C] text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-[#00D7FF]/20"
            >
              {isLoadingDiagnosis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isLoadingDiagnosis ? 'Gemini analizando...' : 'Generar Diagnóstico Mensual'}
            </button>
          </div>
        </div>

        {/* Métricas Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => setIsIncomeModalOpen(true)}
            title="Toca para ver el desglose de ingresos"
            className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-400">Total Ingresos ({selectedMonth === 'all' ? 'histórico' : selectedMonth})</p>
                <Eye className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-xl font-bold text-emerald-600">{formatMoney(totalIncome, currencyMode)}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Toca para ver desglose ➔</p>
            </div>
            <ArrowUpCircle className="w-8 h-8 text-emerald-500 opacity-20 group-hover:opacity-80 transition-all" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Gastos netos ({selectedMonth === 'all' ? 'histórico' : selectedMonth})</p>
              <h3 className="text-xl font-bold text-rose-600">{formatMoney(totalExpense, currencyMode)}</h3>
            </div>
            <ArrowDownCircle className="w-8 h-8 text-rose-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Superávit del Período</p>
              <h3 className={`text-xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                {formatMoney(netBalance, currencyMode)}
              </h3>
            </div>
            <Wallet className="w-8 h-8 text-blue-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Deuda Tarjetas (ARS / USD)</p>
              <h3 className="text-lg font-bold text-rose-700">{formatMoney(totalDebtArs, 'ARS')}</h3>
              {totalDebtUsd !== 0 && (
                <p className={`text-xs font-bold ${totalDebtUsd < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatMoney(totalDebtUsd, 'USD')} {totalDebtUsd < 0 ? '(A favor)' : ''}
                </p>
              )}
            </div>
            <CreditCard className="w-8 h-8 text-rose-600 opacity-20" />
          </div>
        </div>

        {/* KPIs de Salud Patrimonial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Deuda / Ingresos del período</span>
              <span className={`w-3 h-3 rounded-full ${debtRatio < 50 ? 'bg-emerald-500' : debtRatio <= 100 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
            </div>
            <div className="text-2xl font-black text-slate-900">{debtRatio.toFixed(1)}%</div>
            <p className="text-[10px] text-slate-400">
              {debtRatio < 50 ? '🟢 Saludable (<50% del ingreso)' : debtRatio <= 100 ? '🟡 Alerta (50-100%)' : '🔴 Crítico (>100%)'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Tasa de Ahorro Real</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600">{savingsRate.toFixed(1)}%</div>
            <p className="text-[10px] text-slate-400">Excedente neto sobre el ingreso total</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Días de Cobertura</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600">{survivalDays} días</div>
            <p className="text-[10px] text-slate-400">Superávit del período ÷ gasto diario</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Gasto Diario / Proyección</span>
              <BarChart3 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{formatMoney(dailyAverageExpense, currencyMode)}/día</div>
            <p className="text-[10px] text-slate-400">Cierre estimado: {formatMoney(projectedMonthEndExpense, currencyMode)}</p>
          </div>
        </div>

        {/* Tarjetas de Crédito Bimonetarias y Billeteras Digitales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tarjetas: SIEMPRE muestra tanto el renglón ARS como el renglón USD */}
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
                {creditCards.map(c => {
                  const valUsd = Number(c.balance_usd || 0);
                  const isUsdNegative = valUsd < 0;

                  return (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 relative group flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-slate-800 pr-12">{c.name}</p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditCard(c)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteCard(c.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Cierre: <strong className="text-slate-700">Día {c.closing_day}</strong> • Vence: <strong className="text-slate-700">Día {c.due_day}</strong>
                        </p>
                        
                        {/* Saldos Bimonetarios: Ambos siempre visibles */}
                        <div className="mt-1 space-y-0.5 pt-1 border-t border-slate-100">
                          <p className="text-[11px] font-bold text-rose-600">
                            Deuda ARS: {formatMoney(cardBalanceArs(c), 'ARS')}
                          </p>
                          <p className={`text-[11px] font-bold ${isUsdNegative ? 'text-emerald-600' : valUsd > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            Saldo USD: {formatMoney(valUsd, 'USD')} {isUsdNegative ? '(A favor)' : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => openMovements('card', c.id, c.name)}
                        className="w-full mt-2 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <ListFilter className="w-3 h-3" />
                        Ver movimientos / pasar a Negocio
                      </button>
                      <button
                        onClick={() => openImportForEntity('card', c.id, c.name)}
                        className="w-full mt-2 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <FileUp className="w-3 h-3 text-indigo-600" />
                        Importar Resumen del Mes
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Billeteras Digitales y Préstamos */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Préstamos & Billeteras Digitales</h3>
              </div>
              <button 
                onClick={() => setIsLoanModalOpen(true)}
                className="text-[11px] text-amber-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Billetera / Préstamo
              </button>
            </div>

            {loans.length === 0 ? (
              <div className="p-4 bg-amber-50/50 border border-dashed border-amber-200 rounded-2xl text-center space-y-2">
                <p className="text-xs text-amber-800">No registras billeteras o préstamos activos.</p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    onClick={() => setIsLoanModalOpen(true)}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-semibold rounded-xl hover:bg-amber-100/50 transition-colors cursor-pointer"
                  >
                    + Cargar Billetera Manual
                  </button>
                  <button
                    onClick={() => { setTargetEntityForImport(null); setIsImportModalOpen(true); }}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Importar Extracto de Billetera con IA
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {loans.map(l => (
                    <div key={l.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-slate-800 pr-4">{l.entity}</p>
                          <button onClick={() => handleDeleteLoan(l.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {l.installment_amount > 0 && (
                          <p className="text-[10px] text-slate-500 mt-0.5">Cuota: {formatMoney(Number(l.installment_amount))}</p>
                        )}
                        {l.balance_ars !== null && l.balance_ars !== undefined ? (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="text-[11px] font-bold text-emerald-700">Saldo en cuenta: {formatMoney(Number(l.balance_ars), 'ARS')}</p>
                            {l.balance_usd !== null && l.balance_usd !== undefined && Number(l.balance_usd) !== 0 && (
                              <p className="text-[11px] font-bold text-emerald-700">Saldo USD: {formatMoney(Number(l.balance_usd), 'USD')}</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Total: {formatMoney(Number(l.total_amount))}</p>
                        )}
                      </div>

                      <button
                        onClick={() => openMovements('loan', l.id, l.entity)}
                        className="w-full mt-2 py-1.5 px-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <ListFilter className="w-3 h-3" />
                        Ver movimientos / pasar a Negocio
                      </button>
                      <button
                        onClick={() => openImportForEntity('loan', l.id, l.entity)}
                        className="w-full mt-2 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <FileUp className="w-3 h-3 text-amber-600" />
                        Importar Movimientos del Mes
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Formulario de Carga Manual con Selector de Moneda */}
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
                <label className="text-xs text-slate-500">Descripción ({profileType === 'business' ? 'Gasto del Comercio' : 'Personal'})</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej: Pago de cuota, supermercado o servicio digital" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none focus:border-blue-500" 
                  required 
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-slate-500">Monto</label>
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
                  <label className="text-xs text-slate-500">Moneda</label>
                  <select 
                    value={manualCurrency} 
                    onChange={(e: any) => setManualCurrency(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-bold"
                  >
                    <option value="ARS">ARS ($)</option>
                    <option value="USD">USD (u$s)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Fecha</label>
                  <input 
                    type="date" 
                    value={customDate} 
                    onChange={e => setCustomDate(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Imputar a Tarjeta (opcional)</label>
                  <select 
                    value={selectedCardId} 
                    onChange={e => setSelectedCardId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white text-slate-700"
                  >
                    <option value="">Ninguna / Débito</option>
                    {creditCards.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {transType === 'expense' ? (
                <div>
                  <label className="text-xs text-slate-500">Rubro</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                  >
                    <option value="Servicios">Servicios / Facturas</option>
                    <option value="Supermercado">Supermercado</option>
                    <option value="Alimentos">Alimentos / Restaurantes</option>
                    <option value="Transporte">Transporte / Combustible</option>
                    <option value="Tarjeta de Crédito">Pago Tarjeta</option>
                    <option value="Préstamos">Cuota Préstamo</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-slate-500">Origen del Ingreso</label>
                  <select 
                    value={incomeSource} 
                    onChange={e => setIncomeSource(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                  >
                    <option value="salary">Sueldo Fijo</option>
                    <option value="freelance">Honorarios / Extras</option>
                    <option value="business">Ventas Comercio</option>
                    <option value="reintegro">Reintegro / Nota de Crédito</option>
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

          {/* Gráfico y Botones de Desglose de Rubro */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-bold text-slate-900">Gastos Desglosados por Rubro ({selectedMonth})</h2>
              <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> Toca un rubro para ver el detalle
              </span>
            </div>

            <div className="w-full h-56">
              {expenseDataByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={expenseDataByCategory} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50} 
                      outerRadius={75} 
                      paddingAngle={5} 
                      dataKey="value"
                      onClick={(data: any) => setSelectedCategoryDetail(data?.name || null)}
                      className="cursor-pointer"
                    >
                      {expenseDataByCategory.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatMoney(Number(value), currencyMode)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Sin gastos registrados en este período
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
              {expenseDataByCategory.map((entry: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedCategoryDetail(entry.name)}
                  className="px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 hover:shadow-sm transition-all cursor-pointer bg-slate-50 border-slate-200"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="text-slate-800">{entry.name}:</span>
                  <span className="font-bold text-slate-900">{formatMoney(entry.value, currencyMode)}</span>
                  <Eye className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Historial General */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900">Historial de Movimientos ({filteredTransactions.length} registros)</h3>
            <button 
              onClick={() => window.print()}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Informe
            </button>
          </div>

          <div className="space-y-2">
            {filteredTransactions.map(t => {
              const isPayment = t.operation_type === 'payment';
              const isRefund = t.operation_type === 'refund';
              const isUsd = t.currency === 'USD';

              return (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-800">{withProfile(t.description, false)}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${profileType === 'business' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                        {profileType === 'business' ? 'Negocio' : 'Personal'}
                      </span>
                      {isRefund && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Reintegro
                        </span>
                      )}
                      {isPayment && (
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Pago Tarjeta
                        </span>
                      )}
                      {t.operation_type === 'transfer' && (
                        <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                          Transferencia propia
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">📅 {t.date}</span>
                      <span>• {t.category}</span>
                      {isUsd && <span className="text-emerald-700 font-bold">• u$s Dólares</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount), isUsd ? 'USD' : 'ARS')}
                    </span>
                    <button
                      onClick={() => moveTransactionsToProfile([t.id], profileType === 'personal')}
                      title={profileType === 'personal' ? 'Pasar este movimiento a Negocio' : 'Pasar este movimiento a Personal'}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                    >
                      {profileType === 'personal' ? 'A Negocio' : 'A Personal'}
                    </button>
                    <button
                      onClick={() => openEditTransaction(t)}
                      title="Editar movimiento"
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 cursor-pointer p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODAL: EDITAR TARJETA CON SALDOS EN ARS Y USD */}
      {isEditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Editar Tarjeta</h3>
              <button onClick={() => setIsEditCardModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateCard} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Nombre de la Tarjeta</label>
                <input type="text" value={editCardName} onChange={e => setEditCardName(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-semibold" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Día de Cierre</label>
                  <input type="number" min="1" max="31" value={editCardClosing} onChange={e => setEditCardClosing(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" required />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Día de Vencimiento</label>
                  <input type="number" min="1" max="31" value={editCardDue} onChange={e => setEditCardDue(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo / Deuda en Pesos (ARS $)</label>
                <input type="number" step="0.01" value={editCardLimitArs} onChange={e => setEditCardLimitArs(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo en Dólares (USD u$s - si es a favor colocar con signo menos -)</label>
                <input type="number" step="0.01" value={editCardLimitUsd} onChange={e => setEditCardLimitUsd(e.target.value)} placeholder="0.00" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold text-emerald-700" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">Guardar Modificaciones</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA TARJETA BIMONETARIA */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Nueva Tarjeta de Crédito</h3>
              <button onClick={() => setIsCardModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCard} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Nombre</label>
                <input type="text" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="Ej: Tarjeta Naranja X / Visa BNA" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-semibold" required />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Cierre</label>
                  <input type="number" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} placeholder="Día cierre" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" required />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Vencimiento</label>
                  <input type="number" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} placeholder="Día vencimiento" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" required />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Inicial en Pesos ($)</label>
                <input type="number" step="0.01" value={newCardLimitArs} onChange={e => setNewCardLimitArs(e.target.value)} placeholder="0.00" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Inicial en Dólares (u$s - opcional)</label>
                <input type="number" step="0.01" value={newCardLimitUsd} onChange={e => setNewCardLimitUsd(e.target.value)} placeholder="0.00" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">Guardar Tarjeta</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR BILLETERA / PRÉSTAMO */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Nueva Billetera o Préstamo</h3>
              <button onClick={() => setIsLoanModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateLoan} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Nombre de la Entidad / Billetera</label>
                <input 
                  type="text" 
                  value={newLoanEntity} 
                  onChange={e => setNewLoanEntity(e.target.value)} 
                  placeholder="Ej: Mercado Pago, Naranja X Cuenta, Ualá" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-semibold" 
                  required 
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Deudor o Total Préstamo ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={newLoanTotal} 
                  onChange={e => setNewLoanTotal(e.target.value)} 
                  placeholder="0.00 (si es billetera puedes dejar en 0)" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" 
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Monto Cuota Mensual ($ - opcional)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={newLoanInstallment} 
                  onChange={e => setNewLoanInstallment(e.target.value)} 
                  placeholder="0.00" 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" 
                />
              </div>
              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">
                Guardar Billetera / Préstamo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORTADOR CON REVISIÓN DE COMPRAS, PAGOS Y REINTEGROS */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-3xl rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {targetEntityForImport 
                    ? `Importar Resumen del Mes: ${targetEntityForImport.name}` 
                    : 'Importar Extracto con IA'}
                </h3>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setMigrationData(null); setTargetEntityForImport(null); }}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {targetEntityForImport && (
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-xs text-indigo-900">
                Los consumos se vincularán directamente a <strong>{targetEntityForImport.name}</strong> sin crear duplicados.
              </div>
            )}

            {!migrationData ? (
              <div className="space-y-4">
                <input type="file" id="file-upload-input" accept="application/pdf,image/*" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-1.5 border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:border-indigo-500">
                  <UploadCloud className="w-8 h-8 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-700">{importFile ? importFile.name : 'Subir resumen o extracto en PDF o Imagen'}</span>
                </label>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="O pega filas de texto..." className="w-full h-28 border border-slate-200 rounded-xl p-3 text-xs outline-none font-mono" />
                <button onClick={handleExecuteAIImport} disabled={uploading || (!importFile && !importText.trim())} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">
                  {uploading ? 'Gemini analizando...' : 'Analizar Resumen'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {!targetEntityForImport && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1.5">
                    <p className="text-indigo-900">
                      {migrationData.entity_name
                        ? <>La IA detectó el documento de <strong>{migrationData.entity_name}</strong>. Elegí a qué tarjeta o billetera vincularlo:</>
                        : 'La IA no pudo identificar el emisor. Elegí a qué tarjeta o billetera vincularlo:'}
                    </p>
                    <select
                      value={importLink}
                      onChange={e => setImportLink(e.target.value)}
                      className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 bg-white text-slate-800"
                    >
                      {creditCards.map(c => <option key={c.id} value={`card:${c.id}`}>Tarjeta: {c.name}</option>)}
                      {loans.map(l => <option key={l.id} value={`loan:${l.id}`}>Billetera/Préstamo: {l.entity}</option>)}
                      {migrationData.entity_name && <option value="new-card">Crear tarjeta nueva: {migrationData.entity_name}</option>}
                      <option value="none">No vincular (se puede asignar después)</option>
                    </select>
                  </div>
                )}
                {/* Resumen de totales detectados en el PDF */}
                {(migrationData.total_ars !== undefined || migrationData.total_usd !== undefined) && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs flex justify-between items-center">
                    <span className="font-bold text-indigo-950">Totales Liquidados en Resumen:</span>
                    <div className="flex gap-4">
                      {migrationData.total_ars !== undefined && (
                        <span className="font-extrabold text-slate-900">Total ARS: {formatMoney(Number(migrationData.total_ars), 'ARS')}</span>
                      )}
                      {migrationData.total_usd !== undefined && (
                        <span className={`font-extrabold ${Number(migrationData.total_usd) < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                          Total USD: {formatMoney(Number(migrationData.total_usd), 'USD')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">Operaciones identificadas: {migrationData.items?.length || 0}</span>
                  <span className="text-emerald-700 font-bold">
                    Nuevas a incorporar: {migrationData.items?.filter((i: any) => !i.isDuplicate).length || 0}
                  </span>
                </div>

                <div className="space-y-2">
                  {migrationData.items?.map((item: any, idx: number) => {
                    const isDup = item.isDuplicate;
                    const isPayment = item.operation_type === 'payment';
                    const isRefund = item.operation_type === 'refund';
                    const isIncomeOp = item.operation_type === 'income';
                    const isOwnTransfer = item.operation_type === 'transfer';
                    const isIn = isInflow(item);
                    const isUsd = item.currency === 'USD';

                    return (
                      <div 
                        key={idx} 
                        className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${isDup ? 'bg-slate-100 border-slate-200 opacity-60' : isRefund || isIncomeOp ? 'bg-emerald-50/60 border-emerald-200' : isPayment ? 'bg-blue-50/60 border-blue-200' : isOwnTransfer ? 'bg-violet-50/60 border-violet-200' : 'bg-white border-slate-200'}`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.description}</span>
                            {isRefund && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                Reintegro / Nota de Crédito
                              </span>
                            )}
                            {isPayment && (
                              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                Pago Realizado
                              </span>
                            )}
                            {isIncomeOp && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                Ingreso
                              </span>
                            )}
                            {isOwnTransfer && (
                              <span className="bg-violet-100 text-violet-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                Transferencia propia (no cuenta)
                              </span>
                            )}
                            {isDup && (
                              <span className="bg-slate-200 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                                Ya registrado
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Fecha: {item.date} {isUsd ? '• Moneda: Dólares (USD)' : '• Moneda: Pesos (ARS)'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <span className={`font-bold ${isIn ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isIn ? '+' : '-'}{formatMoney(item.amount, isUsd ? 'USD' : 'ARS')}
                          </span>

                          {!isDup && (
                            <select
                              value={item.operation_type}
                              onChange={(e) => handleChangePreviewOp(idx, e.target.value)}
                              title="Cambiar el tipo de movimiento"
                              className="text-xs border border-slate-200 rounded-lg p-1.5 outline-none bg-white text-slate-700"
                            >
                              <option value="purchase">Gasto</option>
                              <option value="income">Ingreso</option>
                              <option value="transfer">Transferencia propia</option>
                              <option value="payment">Pago de tarjeta</option>
                              <option value="refund">Reintegro</option>
                            </select>
                          )}

                          {item.operation_type === 'purchase' && (
                            <select 
                              value={item.selectedCategory} 
                              onChange={(e) => handleUpdatePreviewCategory(idx, e.target.value)}
                              className={`text-xs border rounded-lg p-1.5 outline-none font-semibold ${item.selectedCategory === 'Por Clasificar' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700'}`}
                            >
                              <option value="Por Clasificar">⚠️ Por Clasificar</option>
                              <option value="Servicios">Servicios / Facturas</option>
                              <option value="Supermercado">Supermercado</option>
                              <option value="Alimentos">Alimentos / Restaurantes</option>
                              <option value="Transporte">Transporte / Combustible</option>
                              <option value="Tarjeta de Crédito">Pago Tarjeta</option>
                              <option value="Préstamos">Cuota Préstamo</option>
                              <option value="Otros">Otros</option>
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                  <button 
                    onClick={() => setMigrationData(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Volver a subir
                  </button>
                  <button 
                    onClick={handleConfirmMigration} 
                    disabled={isSavingBatch} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                  >
                    {isSavingBatch ? 'Guardando...' : 'Confirmar e Incorporar sin Duplicados'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: MOVIMIENTOS DE UNA TARJETA / BILLETERA (pasar a Negocio o a Personal) */}
      {movementsEntity && (() => {
        const rows = transactions
          .filter(t => {
            const linked = (movementsEntity.kind === 'card' ? t.credit_card_id : t.loan_id) === movementsEntity.id;
            const unassigned = !t.credit_card_id && !t.loan_id;
            const scopeOk = movScope === 'all' ? true : movScope === 'linked' ? linked : unassigned;
            return scopeOk && (movMonth === 'all' || (t.date && t.date.startsWith(movMonth)));
          })
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const allSelected = rows.length > 0 && rows.every(t => movSelected.includes(t.id));
        const nBusiness = rows.filter(t => isBusinessDesc(t.description)).length;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-3 max-h-[88vh] flex flex-col border border-slate-100">
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Movimientos de {movementsEntity.name}</h3>
                  <p className="text-[11px] text-slate-500">
                    {rows.length} movimientos • {nBusiness} de Negocio • {rows.length - nBusiness} Personales
                  </p>
                </div>
                <button onClick={() => setMovementsEntity(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <select
                  value={movMonth}
                  onChange={e => { setMovMonth(e.target.value); setMovSelected([]); }}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                >
                  <option value="all">Todos los meses</option>
                  {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select
                  value={movScope}
                  onChange={e => { setMovScope(e.target.value as 'linked' | 'unassigned' | 'all'); setMovSelected([]); }}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
                >
                  <option value="linked">Asignados a esta {movementsEntity.kind === 'card' ? 'tarjeta' : 'billetera'}</option>
                  <option value="unassigned">Sin tarjeta asignada</option>
                  <option value="all">Todos los movimientos</option>
                </select>
                <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => setMovSelected(allSelected ? [] : rows.map(t => t.id))}
                  />
                  Seleccionar todos
                </label>
                <div className="flex flex-wrap gap-2 ml-auto">
                  <button
                    disabled={movSelected.length === 0 || movSaving}
                    onClick={() => assignTransactionsToEntity(movSelected)}
                    className="px-3 py-1.5 rounded-lg bg-white text-slate-700 font-bold border border-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    Asignar a esta {movementsEntity.kind === 'card' ? 'tarjeta' : 'billetera'}
                  </button>
                  <button
                    disabled={movSelected.length === 0 || movSaving}
                    onClick={() => moveTransactionsToProfile(movSelected, true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Pasar a Negocio ({movSelected.length})
                  </button>
                  <button
                    disabled={movSelected.length === 0 || movSaving}
                    onClick={() => moveTransactionsToProfile(movSelected, false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    Pasar a Personal
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {rows.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No hay movimientos en este período.</p>
                ) : rows.map(t => {
                  const biz = isBusinessDesc(t.description);
                  const isIn = t.type === 'income';
                  const label = t.operation_type === 'transfer' ? 'Transferencia propia' : isTransfer(t) ? 'Pago de tarjeta' : isRefund(t) ? 'Reintegro' : null;
                  return (
                    <div key={t.id} className={`p-2.5 border rounded-xl flex items-center gap-2.5 text-xs ${biz ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                      <input
                        type="checkbox"
                        checked={movSelected.includes(t.id)}
                        onChange={() => setMovSelected(s => s.includes(t.id) ? s.filter(x => x !== t.id) : [...s, t.id])}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{withProfile(t.description, false)}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="font-mono">{t.date}</span>
                          {t.category && <span>• {t.category}</span>}
                          {label && <span className="text-amber-600 font-semibold">• {label}</span>}
                          <span className={`px-1.5 py-0.5 rounded font-bold ${biz ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                            {biz ? 'Negocio' : 'Personal'}
                          </span>
                        </div>
                      </div>
                      <span className={`font-bold whitespace-nowrap ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIn ? '+' : '-'}{formatMoney(Number(t.amount), t.currency || 'ARS')}
                      </span>
                      <button
                        disabled={movSaving}
                        onClick={() => moveTransactionsToProfile([t.id], !biz)}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer disabled:opacity-40"
                      >
                        {biz ? 'A Personal' : 'A Negocio'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setMovementsEntity(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: DESGLOSE DE INGRESOS */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Desglose de Ingresos ({selectedMonth})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {incomeTransactions.length} registros que suman {formatMoney(totalIncome, currencyMode)}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsIncomeModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {incomeTransactions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No hay ingresos registrados en este mes seleccionado.</p>
              ) : (
                incomeTransactions.map(t => (
                  <div key={t.id} className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{t.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                        <span className="font-mono">📅 {t.date}</span>
                        <span>• Origen: <strong>{t.income_source || 'Sueldo/Fijo'}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600 text-sm">
                        +{formatMoney(Number(t.amount), t.currency || 'ARS')}
                      </span>
                      <button
                        onClick={() => moveTransactionsToProfile([t.id], profileType === 'personal')}
                        title={profileType === 'personal' ? 'Pasar este ingreso a Negocio' : 'Pasar este ingreso a Personal'}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                      >
                        {profileType === 'personal' ? 'A Negocio' : 'A Personal'}
                      </button>
                      <button
                        onClick={() => openEditTransaction(t)}
                        title="Editar transacción"
                        className="p-1 text-slate-400 hover:text-blue-600 rounded bg-white border border-slate-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsIncomeModalOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Desglose
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DESGLOSE DE GASTOS POR RUBRO */}
      {selectedCategoryDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Desglose: Rubro &quot;{selectedCategoryDetail}&quot;
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {transactionsOfSelectedCategory.length} gastos que suman {formatMoney(sumMode(transactionsOfSelectedCategory), currencyMode)}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCategoryDetail(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {transactionsOfSelectedCategory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No se encontraron movimientos registrados en este rubro.</p>
              ) : (
                transactionsOfSelectedCategory.map(t => (
                  <div key={t.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{t.description}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Fecha del movimiento: {t.date}</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-rose-600">
                        -{formatMoney(Number(t.amount), t.currency || 'ARS')}
                      </span>
                      <button 
                        onClick={() => openEditTransaction(t)}
                        title="Modificar rubro o datos"
                        className="p-1 text-slate-400 hover:text-blue-600 rounded bg-white border border-slate-200"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCategoryDetail(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar Desglose
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR RUBRO, ORIGEN O DATOS */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Modificar Transacción</h3>
              <button onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransactionEdit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Descripción</label>
                <input 
                  type="text" 
                  value={editTxDescription} 
                  onChange={e => setEditTxDescription(e.target.value)} 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">Monto</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={editTxAmount} 
                    onChange={e => setEditTxAmount(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none font-bold" 
                    required 
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Moneda</label>
                  <select 
                    value={editTxCurrency} 
                    onChange={(e: any) => setEditTxCurrency(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-bold"
                  >
                    <option value="ARS">ARS ($)</option>
                    <option value="USD">USD (u$s)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500">Tipo de Operación</label>
                <select 
                  value={editTxOpType} 
                  onChange={(e: any) => {
                    const op = e.target.value;
                    setEditTxOpType(op);
                    if (op !== 'transfer') setEditTxType(op === 'purchase' ? 'expense' : 'income');
                  }} 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-semibold"
                >
                  <option value="purchase">Compra / Consumo (Gasto)</option>
                  <option value="payment">Pago de Tarjeta (Ingreso/Cancelación)</option>
                  <option value="refund">Reintegro / Nota de Crédito (Saldo a favor)</option>
                  <option value="income">Ingreso real (rendimiento, cobro, transferencia de terceros)</option>
                  <option value="transfer">Transferencia entre mis cuentas (no cuenta)</option>
                </select>
              </div>

              {editTxType === 'expense' && (
                <div>
                  <label className="text-xs text-slate-500">Cambiar Rubro</label>
                  <select 
                    value={editTxCategory} 
                    onChange={e => setEditTxCategory(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-semibold"
                  >
                    <option value="Servicios">Servicios / Facturas</option>
                    <option value="Supermercado">Supermercado</option>
                    <option value="Alimentos">Alimentos / Restaurantes</option>
                    <option value="Transporte">Transporte / Combustible</option>
                    <option value="Tarjeta de Crédito">Pago Tarjeta</option>
                    <option value="Préstamos">Cuota Préstamo</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setEditingTransaction(null)} 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CHAT INTERNO */}
      {isChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0B192C] text-slate-100 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#00D7FF]" />
                <h3 className="text-base font-bold text-white">
                  {isSuperUser ? `Chat Clientes • (${adminUsersList.length} usuarios)` : 'Canal Directo con Dionicio (DRM-IA)'}
                </h3>
              </div>
              <button onClick={() => setIsChatModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            {isSuperUser && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
                <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Cliente:</span>
                {adminUsersList.map(u => (
                  <button 
                    key={u.user_id} 
                    onClick={() => { setSelectedChatUser(u); loadChatMessages(u.user_email); }} 
                    className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap cursor-pointer ${selectedChatUser?.user_email === u.user_email ? 'bg-[#00D7FF] text-[#0B192C] font-bold border-[#00D7FF]' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                  >
                    {u.user_email}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 p-3 bg-[#08121f] rounded-2xl border border-slate-800/80 min-h-[260px]">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-10">Sin mensajes previos en esta conversación.</p>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender_email === user?.email ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-slate-400 mb-0.5">{msg.sender_email}</span>
                    <div className={`p-3 rounded-2xl text-xs max-w-[80%] ${msg.sender_email === user?.email ? 'bg-[#00D7FF] text-[#0B192C] font-medium' : 'bg-[#132238] text-white border border-slate-700'}`}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input 
                type="text" 
                value={newChatMessage} 
                onChange={e => setNewChatMessage(e.target.value)} 
                placeholder="Escribe tu mensaje..." 
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#00D7FF]" 
              />
              <button type="submit" className="bg-[#00D7FF] text-[#0B192C] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer">
                <Send className="w-3.5 h-3.5" /> Enviar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DIAGNÓSTICO AUDITOR IA */}
      {isDiagnosisOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0B192C] text-slate-100 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00D7FF]" />
                <h3 className="text-base font-bold text-white">Auditoría Financiera Mensual por IA</h3>
              </div>
              <button onClick={() => setIsDiagnosisOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#132238] rounded-2xl border border-slate-700/80 text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
              {isLoadingDiagnosis ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00D7FF]" />
                  <span>Gemini 3.8 Flash analizando gastos, deudas y flujo de caja...</span>
                </div>
              ) : (
                aiDiagnosis
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SIMULADOR BOLA DE NIEVE */}
      {isSnowballModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0B192C] text-slate-100 w-full max-w-2xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col border border-slate-800">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#00D7FF]" />
                <h3 className="text-base font-bold text-white">Plan Bola de Nieve para Desendeudamiento</h3>
              </div>
              <button onClick={() => setIsSnowballModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>Tu deuda consolidada activa es de: <strong className="text-rose-400 text-sm">{formatMoney(totalDebtArs, 'ARS')}</strong></p>
              <div className="p-4 bg-[#132238] rounded-2xl border border-slate-700 space-y-2">
                <span className="font-bold text-[#00D7FF]">Método bola de nieve: pagá primero el saldo más chico y sumá esa cuota al siguiente.</span>
                {[...creditCards].sort((a, b) => cardBalanceArs(a) - cardBalanceArs(b)).map((c, i) => (
                  <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span>{i + 1}. {c.name} (Vence día {c.due_day})</span>
                    <span className="font-bold text-rose-400">
                      {formatMoney(cardBalanceArs(c), 'ARS')}
                      {Number(c.balance_usd || 0) !== 0 && <span className="block text-[10px] text-slate-400">{formatMoney(Number(c.balance_usd), 'USD')}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel Superusuario */}
      {isAdminPanelOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-4xl rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Auditoría de Pagos</h3>
              <button onClick={() => setIsAdminPanelOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {adminReceipts.map(r => (
                <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{r.user_email} • ${r.amount}</p>
                    <p className="text-slate-500">{r.ai_notes}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleVerifyByAdmin(r.id, 'verified')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer">Aprobar</button>
                    <button onClick={() => handleVerifyByAdmin(r.id, 'rejected')} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer">Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}