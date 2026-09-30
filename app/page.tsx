'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
  Save
} from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS = ['#FF8042', '#00C49F', '#0088FE', '#faad14', '#8884d8', '#ff4d4f', '#13c2c2', '#a0d911'];
const ADMIN_EMAILS = ['drafaultimo@gmail.com', 'd_rafael_m@hotmail.com'];
const TRIAL_DAYS = 10;

// Precios de Lanzamiento
const PLAN_ESENCIAL_REGULAR = 12000;
const PLAN_ESENCIAL_PROMO = 7200;
const PLAN_PRO_REGULAR = 24500;
const PLAN_PRO_PROMO = 14700;

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

  // Período de prueba y suscripción
  const [isTrialActive, setIsTrialActive] = useState<boolean>(true);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(TRIAL_DAYS);
  const [hasPaidPlan, setHasPaidPlan] = useState<boolean>(false);
  const [selectedPlanToPay, setSelectedPlanToPay] = useState<'base' | 'pro'>('pro');

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Perfil Dual y Multimoneda
  const [profileType, setProfileType] = useState<'personal' | 'business'>('personal');
  const [currencyMode, setCurrencyMode] = useState<'ARS' | 'USD'>('ARS');
  const usdRate = 1350;

  // Datos financieros
  const [transactions, setTransactions] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Modales de Desglose
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  // Estado para Edición Rápida de Transacciones
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTxType, setEditTxType] = useState<'income' | 'expense'>('income');
  const [editTxCategory, setEditTxCategory] = useState('Alimentos');
  const [editTxIncomeSource, setEditTxIncomeSource] = useState('salary');
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
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  // Comprobantes
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptFeedback, setReceiptFeedback] = useState<any>(null);
  const [adminReceipts, setAdminReceipts] = useState<any[]>([]);

  // Formulario manual
  const [transType, setTransType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentos');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [incomeSource, setIncomeSource] = useState('salary');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Importador masivo IA
  const [importText, setImportText] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [migrationData, setMigrationData] = useState<any>(null);

  // Tarjetas
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('20');
  const [newCardDue, setNewCardDue] = useState('5');
  const [newCardLimit, setNewCardLimit] = useState('');

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardClosing, setEditCardClosing] = useState('20');
  const [editCardDue, setEditCardDue] = useState('5');
  const [editCardLimit, setEditCardLimit] = useState('');

  const isSuperUser = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await evaluateAccessAndLoad(session.user);
        await checkUnreadMessages(session.user);
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
        await evaluateAccessAndLoad(session.user);
        await checkUnreadMessages(session.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function evaluateAccessAndLoad(currentUser: any) {
    if (ADMIN_EMAILS.includes(currentUser.email?.toLowerCase())) {
      setIsTrialActive(true);
      setHasPaidPlan(true);
      await loadAdminMetrics();
      await refreshAll(currentUser.id);
      return;
    }

    const createdAt = new Date(currentUser.created_at || new Date().toISOString());
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    const daysSinceRegistration = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, TRIAL_DAYS - daysSinceRegistration);

    setTrialDaysLeft(remainingDays);

    const { data: receipts } = await supabase
      .from('payment_receipts')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const hasVerifiedPayment = receipts && receipts.length > 0 && 
      (receipts[0].ai_status === 'approved_by_ai' || receipts[0].admin_status === 'verified');

    if (hasVerifiedPayment) {
      setHasPaidPlan(true);
      setIsTrialActive(false);
    } else if (remainingDays > 0) {
      setIsTrialActive(true);
      setHasPaidPlan(false);
    } else {
      setIsTrialActive(false);
      setHasPaidPlan(false);
    }

    if (receipts && receipts.length > 0) {
      setReceiptFeedback(receipts[0]);
    }

    await refreshAll(currentUser.id);
  }

  async function loadAdminMetrics() {
    const { data: receipts } = await supabase
      .from('payment_receipts')
      .select('*')
      .order('created_at', { ascending: false });
    if (receipts) setAdminReceipts(receipts);

    const { data: usersData } = await supabase
      .from('payment_receipts')
      .select('user_email, user_id');

    if (usersData) {
      const filtered = usersData.filter(u => u.user_email && !ADMIN_EMAILS.includes(u.user_email.toLowerCase()));
      const uniqueUsers = Array.from(new Set(filtered.map(u => u.user_email)))
        .map(email => filtered.find(u => u.user_email === email));
      setAdminUsersList(uniqueUsers);
      setTotalAppUsersCount(Math.max(uniqueUsers.length, 1));
    }
  }

  async function checkUnreadMessages(currentUser: any) {
    const { count } = await supabase
      .from('user_support_chats')
      .select('*', { count: 'exact' })
      .eq('receiver_email', currentUser.email)
      .eq('is_read', false);

    if (count !== null) setUnreadCount(count);
  }

  async function loadChatMessages(targetUserEmail?: string) {
    if (!user) return;
    const adminMain = ADMIN_EMAILS[0];
    const otherEmail = targetUserEmail || (isSuperUser ? selectedChatUser?.user_email : adminMain);
    if (!otherEmail) return;

    const { data } = await supabase
      .from('user_support_chats')
      .select('*')
      .or(`and(sender_email.eq.${user.email},receiver_email.eq.${otherEmail}),and(sender_email.eq.${otherEmail},receiver_email.eq.${user.email})`)
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

    const adminMain = ADMIN_EMAILS[0];
    const receiverEmail = isSuperUser ? selectedChatUser?.user_email : adminMain;
    if (!receiverEmail) return;

    const { error } = await supabase
      .from('user_support_chats')
      .insert([{
        sender_id: user.id,
        sender_email: user.email,
        receiver_id: isSuperUser ? selectedChatUser.user_id : user.id,
        receiver_email: receiverEmail,
        message: newChatMessage.trim(),
        is_read: false
      }]);

    if (!error) {
      setNewChatMessage('');
      await loadChatMessages(receiverEmail);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        if (data?.user) {
          setUser(data.user);
          await evaluateAccessAndLoad(data.user);
          await checkUnreadMessages(data.user);
          setViewMode('app');
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setAuthSuccess('¡Cuenta creada con éxito! Tenés 10 días gratis con acceso completo.');
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

      const res = await fetch('/api/verify-receipt', { method: 'POST', body: formData });
      const analysis = await res.json();
      if (!res.ok) throw new Error(analysis.error || 'Error al validar');

      const isApproved = analysis.is_valid_transfer === true;
      const amountPromo = selectedPlanToPay === 'pro' ? PLAN_PRO_PROMO : PLAN_ESENCIAL_PROMO;

      const { data: inserted, error: insertError } = await supabase
        .from('payment_receipts')
        .insert([{
          user_id: user.id,
          user_email: user.email,
          amount: analysis.amount || amountPromo,
          transfer_date: analysis.transfer_date || new Date().toISOString().split('T')[0],
          sender_name: analysis.sender_name || 'No determinado',
          alias_destination: analysis.destination || 'drm-ia',
          ai_status: isApproved ? 'approved_by_ai' : 'rejected_by_ai',
          ai_notes: `Plan: ${selectedPlanToPay.toUpperCase()} (Promo 40% OFF). Veredicto: ${analysis.reason || 'Sin detalles'}`,
          admin_status: 'pending'
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      setReceiptFeedback(inserted);
      if (isApproved) {
        setHasPaidPlan(true);
        alert('¡Comprobante verificado con éxito por IA! Se activó tu suscripción bonificada.');
      } else {
        alert('Comprobante recibido. La IA lo derivó a revisión manual.');
      }
    } catch (err: any) {
      alert('Error al enviar comprobante: ' + err.message);
    } finally {
      setIsUploadingReceipt(false);
      setReceiptFile(null);
    }
  }

  async function handleVerifyByAdmin(receiptId: string, status: 'verified' | 'rejected') {
    const { error } = await supabase
      .from('payment_receipts')
      .update({ admin_status: status })
      .eq('id', receiptId);

    if (!error) {
      await loadAdminMetrics();
      alert(`Comprobante marcado como: ${status === 'verified' ? 'Verificado' : 'Rechazado'}`);
    }
  }

  async function handleRunAIDiagnosis() {
    setIsLoadingDiagnosis(true);
    setIsDiagnosisOpen(true);
    setAiDiagnosis('');

    try {
      const res = await fetch('/api/financial-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: totalIncome,
          expense: totalExpense,
          debt: totalDebt,
          transactions: filteredTransactions,
          profileType: profileType === 'business' ? 'Comercio / PyME' : 'Personal'
        })
      });
      const data = await res.json();
      setAiDiagnosis(data.diagnosis || 'Auditoría completada sin observaciones.');
    } catch (e: any) {
      setAiDiagnosis('Error conectando con el auditor de IA: ' + e.message);
    } finally {
      setIsLoadingDiagnosis(false);
    }
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
      description: profileType === 'business' ? `[NEGOCIO] ${description}` : description,
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

  // Abrir Modal de Edición Rápida
  function openEditTransaction(tx: any) {
    setEditingTransaction(tx);
    setEditTxType(tx.type);
    setEditTxCategory(tx.category || 'Otros');
    setEditTxIncomeSource(tx.income_source || 'salary');
    setEditTxAmount(String(tx.amount || '0'));
    setEditTxDescription(tx.description || '');
  }

  // Guardar Cambios de Edición en Supabase
  async function handleSaveTransactionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTransaction || !user) return;

    const payload = {
      description: editTxDescription,
      amount: parseFloat(editTxAmount) || 0,
      type: editTxType,
      category: editTxType === 'expense' ? editTxCategory : 'Ingreso',
      income_source: editTxType === 'income' ? editTxIncomeSource : null
    };

    const { error } = await supabase
      .from('transactions')
      .update(payload)
      .eq('id', editingTransaction.id);

    if (!error) {
      setEditingTransaction(null);
      await refreshAll(user.id);
      alert('¡Transacción modificada correctamente!');
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
      credit_limit: parseFloat(newCardLimit || '0')
    }]);

    if (!error) {
      setNewCardName('');
      setNewCardLimit('');
      setIsCardModalOpen(false);
      refreshAll(user.id);
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
      alert('Sesión expirada.');
      return;
    }

    if (!migrationData?.items?.length) {
      alert('No se detectaron movimientos.');
      return;
    }

    setIsSavingBatch(true);

    try {
      if (migrationData.detected_cards?.length > 0) {
        const cardsToInsert = migrationData.detected_cards.map((c: any) => ({
          user_id: currentSessionUser.id,
          name: String(c.name || 'Tarjeta'),
          closing_day: 20,
          due_day: 5,
          credit_limit: parseFloat(String(c.balance || '0').replace(/[^0-9.-]+/g, '')) || 0
        }));
        await supabase.from('credit_cards').insert(cardsToInsert);
      }

      if (migrationData.detected_loans?.length > 0) {
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
        let cleanAmount = typeof item.amount === 'number' 
          ? item.amount 
          : parseFloat(String(item.amount || '0').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]+/g, '')) || 0;

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
      if (txError) throw txError;

      setIsImportModalOpen(false);
      setMigrationData(null);
      setImportText('');
      setImportFile(null);
      await refreshAll(currentSessionUser.id);
      alert(`¡Éxito! Se guardaron ${rows.length} registros.`);
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
      const isBusinessTx = t.description?.startsWith('[NEGOCIO]');
      const matchProfile = profileType === 'business' ? isBusinessTx : !isBusinessTx;
      return matchMonth && matchProfile;
    });
  }, [transactions, selectedMonth, profileType]);

  const incomeTransactions = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'income');
  }, [filteredTransactions]);

  const totalIncome = useMemo(() => {
    return incomeTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [incomeTransactions]);

  const totalExpense = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalExpense;

  const totalDebt = useMemo(() => {
    return creditCards.reduce((acc, c) => acc + Number(c.credit_limit || 0), 0);
  }, [creditCards]);

  const debtRatio = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return (totalDebt / totalIncome) * 100;
  }, [totalDebt, totalIncome]);

  const savingsRate = useMemo(() => {
    if (totalIncome <= 0) return 0;
    return ((totalIncome - totalExpense) / totalIncome) * 100;
  }, [totalIncome, totalExpense]);

  const dailyAverageExpense = useMemo(() => {
    const now = new Date();
    const currentDay = Math.max(now.getDate(), 1);
    return totalExpense / currentDay;
  }, [totalExpense]);

  const survivalDays = useMemo(() => {
    if (dailyAverageExpense <= 0) return 999;
    const availableCash = Math.max(netBalance, 0);
    return Math.floor(availableCash / dailyAverageExpense);
  }, [netBalance, dailyAverageExpense]);

  const projectedMonthEndExpense = useMemo(() => {
    return dailyAverageExpense * 30;
  }, [dailyAverageExpense]);

  function formatMoney(amountArs: number) {
    if (currencyMode === 'USD') {
      const usdValue = amountArs / usdRate;
      return `US$ ${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$ ${amountArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

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

  const transactionsOfSelectedCategory = useMemo(() => {
    if (!selectedCategoryDetail) return [];
    return filteredTransactions.filter(t => t.type === 'expense' && (t.category || 'Otros') === selectedCategoryDetail);
  }, [filteredTransactions, selectedCategoryDetail]);

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
            Auditoría Inteligente con Google Gemini 3.8 Flash • Descargable en tu Smartphone
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            Controlá tus finanzas, tarjetas y deudas con <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D7FF] to-cyan-400">Inteligencia Artificial</span>
          </h1>

          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Eliminá el caos de tus extractos y planillas. Nuestra IA clasifica tus consumos, proyecta tu salud patrimonial y diseña tu plan de desendeudamiento en segundos.
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
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Hasta 3 tarjetas con fechas reales de corte</li>
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
                <p className="text-xs text-slate-400">Automatización total para profesionales, comercios y PyMEs.</p>
                <div>
                  <span className="text-xs text-slate-500 line-through mr-2">$ {PLAN_PRO_REGULAR.toLocaleString('es-AR')}</span>
                  <span className="text-3xl font-extrabold text-white">$ {PLAN_PRO_PROMO.toLocaleString('es-AR')}</span>
                  <span className="text-xs text-slate-400 font-normal"> / mes</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Todo lo incluido en el Plan Esencial</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Importaciones masivas con Gemini 3.8 Flash</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Auditor Financiero IA ("Diagnóstico Mensual")</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Simulador Bola de Nieve para deudas</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00D7FF]" /> Perfil dual: Caja Personal vs. Negocio / PyME</li>
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
  // RENDER: PANTALLA DE PAGO (NO APLICA AL SUPERUSUARIO)
  // ==========================================
  if (user && !isSuperUser && !isTrialActive && !hasPaidPlan) {
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
                  {receiptFile ? `Archivo: ${receiptFile.name}` : 'Subir comprobante de transferencia al alias drm-ia'}
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
  // RENDER: PANEL PRINCIPAL (DASHBOARD)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header con Perfil Dual, Multimoneda y Superusuario */}
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
                        Plan Activo (40% OFF)
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
              onClick={() => setIsImportModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-200" /> Importar IA
            </button>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="text-xs text-red-500 border border-red-200 px-2.5 py-2 rounded-xl hover:bg-red-50 cursor-pointer"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Acceso Directo al Auditor IA */}
        <div className="bg-gradient-to-r from-[#0B192C] to-[#132238] p-4 rounded-2xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00D7FF]/10 text-[#00D7FF] flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Auditor Financiero con Inteligencia Artificial</p>
              <p className="text-[11px] text-slate-400">Diagnóstico mensual de gastos hormiga, orden de liquidación de pasivos y optimización de caja</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSnowballModalOpen(true)}
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

        {/* Métricas Principales (La tarjeta de Ingresos ahora es cliqueable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => setIsIncomeModalOpen(true)}
            title="Toca para ver el desglose de ingresos"
            className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-400">Total Ingresos ({selectedMonth})</p>
                <Eye className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-xl font-bold text-emerald-600">{formatMoney(totalIncome)}</h3>
              <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Toca para ver desglose ➔</p>
            </div>
            <ArrowUpCircle className="w-8 h-8 text-emerald-500 opacity-20 group-hover:opacity-80 transition-all" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Total Gastos ({selectedMonth})</p>
              <h3 className="text-xl font-bold text-rose-600">{formatMoney(totalExpense)}</h3>
            </div>
            <ArrowDownCircle className="w-8 h-8 text-rose-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Superávit del Período</p>
              <h3 className={`text-xl font-bold ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                {formatMoney(netBalance)}
              </h3>
            </div>
            <Wallet className="w-8 h-8 text-blue-500 opacity-20" />
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Deuda Tarjetas Activa</p>
              <h3 className="text-xl font-bold text-rose-700">{formatMoney(totalDebt)}</h3>
            </div>
            <CreditCard className="w-8 h-8 text-rose-600 opacity-20" />
          </div>
        </div>

        {/* KPIs de Salud Patrimonial */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Ratio de Endeudamiento</span>
              <span className={`w-3 h-3 rounded-full ${debtRatio < 30 ? 'bg-emerald-500' : debtRatio <= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
            </div>
            <div className="text-2xl font-black text-slate-900">{debtRatio.toFixed(1)}%</div>
            <p className="text-[10px] text-slate-400">
              {debtRatio < 30 ? '🟢 Saludable (<30%)' : debtRatio <= 50 ? '🟡 Alerta (30-50%)' : '🔴 Crítico (>50%)'}
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
              <span className="text-xs text-slate-400">Días de Supervivencia</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-600">{survivalDays} días</div>
            <p className="text-[10px] text-slate-400">Duración con saldo líquido actual</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Gasto Diario / Proyección</span>
              <BarChart3 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-lg font-black text-slate-900">{formatMoney(dailyAverageExpense)}/día</div>
            <p className="text-[10px] text-slate-400">Cierre estimado: {formatMoney(projectedMonthEndExpense)}</p>
          </div>
        </div>

        {/* Tarjetas de Crédito y Préstamos */}
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
                        <button onClick={() => openEditCard(c)} className="p-1 text-slate-400 hover:text-blue-600 rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCard(c.id)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Cierre: <strong className="text-slate-700">Día {c.closing_day}</strong> • Vence: <strong className="text-slate-700">Día {c.due_day}</strong>
                    </p>
                    {c.credit_limit > 0 && (
                      <p className="text-[10px] text-rose-600 font-semibold">Deuda: {formatMoney(Number(c.credit_limit))}</p>
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
                      <p className="text-[10px] text-slate-500">Cuota: {formatMoney(Number(l.installment_amount))}</p>
                    )}
                    <p className="text-[10px] text-amber-600 font-semibold">Total: {formatMoney(Number(l.total_amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Formulario y Gráfico con Desglose Interactivo de Rubros */}
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
                  placeholder="Ej: Pago a proveedor o supermercado" 
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
                  <label className="text-xs text-slate-500">Fecha</label>
                  <input 
                    type="date" 
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white"
                    required 
                  />
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
                    <Tooltip formatter={(value: any) => formatMoney(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Sin gastos registrados en este período
                </div>
              )}
            </div>

            {/* Fila interactiva para ver el listado de cada rubro */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
              {expenseDataByCategory.map((entry: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setSelectedCategoryDetail(entry.name)}
                  className="px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center gap-1.5 hover:shadow-sm transition-all cursor-pointer bg-slate-50 border-slate-200"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="text-slate-800">{entry.name}:</span>
                  <span className="font-bold text-slate-900">{formatMoney(entry.value)}</span>
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
            {filteredTransactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:bg-slate-50/50">
                <div>
                  <p className="text-xs font-semibold text-slate-800">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">📅 {t.date}</span>
                    <span>• {t.type === 'income' ? `Ingreso (${t.income_source || 'general'})` : `Rubro: ${t.category}`}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatMoney(Number(t.amount))}
                  </span>
                  <button 
                    onClick={() => openEditTransaction(t)}
                    title="Editar rubro, origen o monto"
                    className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-500 cursor-pointer p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL: DESGLOSE COMPLETO DE INGRESOS */}
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
                    {incomeTransactions.length} registros que suman {formatMoney(totalIncome)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsIncomeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
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
                        +{formatMoney(Number(t.amount))}
                      </span>
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
                    Desglose: Rubro "{selectedCategoryDetail}"
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {transactionsOfSelectedCategory.length} gastos que suman {formatMoney(transactionsOfSelectedCategory.reduce((acc, t) => acc + Number(t.amount || 0), 0))}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCategoryDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
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
                        -{formatMoney(Number(t.amount))}
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

      {/* MODAL: EDITAR RUBRO, ORIGEN O DATOS DE TRANSACCIÓN */}
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

              <div>
                <label className="text-xs text-slate-500">Monto ($)</label>
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
                <label className="text-xs text-slate-500">Tipo de Movimiento</label>
                <select 
                  value={editTxType} 
                  onChange={(e: any) => setEditTxType(e.target.value)} 
                  className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-semibold"
                >
                  <option value="income">Ingreso (+)</option>
                  <option value="expense">Gasto (-)</option>
                </select>
              </div>

              {editTxType === 'expense' ? (
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
              ) : (
                <div>
                  <label className="text-xs text-slate-500">Cambiar Origen de Ingreso</label>
                  <select 
                    value={editTxIncomeSource} 
                    onChange={e => setEditTxIncomeSource(e.target.value)} 
                    className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none bg-white font-semibold"
                  >
                    <option value="salary">Sueldo Fijo</option>
                    <option value="freelance">Honorarios / Extras</option>
                    <option value="business">Ventas Comercio</option>
                    <option value="investments">Rendimientos / Inversiones</option>
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
              <p>Tu deuda consolidada activa es de: <strong className="text-rose-400 text-sm">{formatMoney(totalDebt)}</strong></p>
              <div className="p-4 bg-[#132238] rounded-2xl border border-slate-700 space-y-2">
                <span className="font-bold text-[#00D7FF]">Orden recomendado de liquidación de pasivos:</span>
                {creditCards.map((c, i) => (
                  <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                    <span>{i + 1}. {c.name} (Vence día {c.due_day})</span>
                    <span className="font-bold text-rose-400">{formatMoney(Number(c.credit_limit))}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modales auxiliares */}
      {isEditCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Editar Tarjeta</h3>
              <button onClick={() => setIsEditCardModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateCard} className="space-y-3">
              <input type="text" value={editCardName} onChange={e => setEditCardName(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="1" max="31" value={editCardClosing} onChange={e => setEditCardClosing(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
                <input type="number" min="1" max="31" value={editCardDue} onChange={e => setEditCardDue(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
              </div>
              <input type="number" step="0.01" value={editCardLimit} onChange={e => setEditCardLimit(e.target.value)} className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">Guardar</button>
            </form>
          </div>
        </div>
      )}

      {isCardModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Nueva Tarjeta</h3>
              <button onClick={() => setIsCardModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCard} className="space-y-3">
              <input type="text" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="Nombre tarjeta" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} placeholder="Día cierre" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
                <input type="number" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} placeholder="Día vencimiento" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" required />
              </div>
              <input type="number" value={newCardLimit} onChange={e => setNewCardLimit(e.target.value)} placeholder="Límite o saldo" className="w-full text-xs border border-slate-200 rounded-xl p-2.5 outline-none" />
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">Guardar</button>
            </form>
          </div>
        </div>
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Migrar con IA</h3>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setMigrationData(null); }}><X className="w-5 h-5" /></button>
            </div>
            {!migrationData ? (
              <div className="space-y-4">
                <input type="file" id="file-upload-input" accept="application/pdf,image/*" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} />
                <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center gap-1.5 border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center">
                  <UploadCloud className="w-8 h-8 text-indigo-500" />
                  <span className="text-xs font-semibold text-slate-700">{importFile ? importFile.name : 'Subir resumen o planilla'}</span>
                </label>
                <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="O pega filas de Excel..." className="w-full h-28 border border-slate-200 rounded-xl p-3 text-xs outline-none font-mono" />
                <button onClick={handleExecuteAIImport} disabled={uploading || (!importFile && !importText.trim())} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs py-2.5 rounded-xl cursor-pointer">
                  {uploading ? 'Gemini analizando...' : 'Analizar'}
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="space-y-1.5">
                  {migrationData.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <span>{item.description} ({item.date})</span>
                      <span className="font-bold">${item.amount}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleConfirmMigration} disabled={isSavingBatch} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 rounded-xl cursor-pointer">
                  Confirmar y Guardar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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