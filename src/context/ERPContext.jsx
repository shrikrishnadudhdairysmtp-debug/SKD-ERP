import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants/defaults.js';
import { authService } from '../services/authService.js';
import { transactionService } from '../services/transactionService.js';
import { partyService } from '../services/partyService.js';
import { userService } from '../services/userService.js';
import { dataService } from '../services/dataService.js';
import { loanService } from '../services/loanService.js';

export const ERPContext = createContext(null);

export function ERPProvider({ children }) {
  const [isInitializing, setIsInitializing] = useState(true);
  
  // App state
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [parties, setParties] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loansSummary, setLoansSummary] = useState({});
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);

  // Pagination state
  const [txnPagination, setTxnPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [partyPagination, setPartyPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });

  // Dashboard aggregated data
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    totalAR: 0,
    totalAP: 0,
    pendingCount: 0,
  });
  const [accountBalances, setAccountBalances] = useState({});

  // Global filters
  const [fiscalYear, setFiscalYear] = useState('ALL');

  // Toast hook will be injected via setter from App
  const [toastFns, setToastFns] = useState(null);
  const notify = useMemo(() => ({
    success: (msg) => toastFns?.showSuccess?.(msg),
    error: (msg) => toastFns?.showError?.(msg),
    warning: (msg) => toastFns?.showWarning?.(msg),
    info: (msg) => toastFns?.showInfo?.(msg),
  }), [toastFns]);

  // Load initial data if authenticated
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (token) {
        try {
          const { user } = await authService.me();
          setCurrentUser(user);
          await loadAppData(user);
        } catch (error) {
          console.error('Session expired or invalid', error);
          authService.logout();
        }
      }
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  const loadAppData = async (user, page = 1) => {
    try {
      const [accs, cats, ptsRes, txnsRes, dash, loansRes] = await Promise.all([
        dataService.getAccounts(),
        dataService.getCategories(),
        partyService.getAll({ limit: 200 }),
        transactionService.getAll({ page, limit: 50 }),
        dataService.getDashboard(),
        loanService.getAll().catch(() => ({ data: [], summary: {} })),
      ]);

      setAccounts(accs);
      setCategories(cats.map(c => c.name));
      setParties(ptsRes.data || ptsRes);
      if (ptsRes.pagination) setPartyPagination(ptsRes.pagination);
      
      setTransactions(txnsRes.data || txnsRes);
      if (txnsRes.pagination) setTxnPagination(txnsRes.pagination);
      
      setLoans(loansRes.data || []);
      setLoansSummary(loansRes.summary || {});

      setSummary(dash.summary);
      setAccountBalances(dash.accountBalances);
      setAuditTrail(dash.auditTrail);

      if (user.role === 'ADMIN') {
        const usersRes = await userService.getAll();
        setUsers(usersRes.data || usersRes);
      }
    } catch (error) {
      console.error('Failed to load app data', error);
    }
  };

  // ── Pagination Actions ──────────────────────────────────────
  const loadTransactionPage = useCallback(async (page, filters = {}) => {
    setIsLoading(true);
    try {
      const res = await transactionService.getAll({ page, limit: 50, ...filters });
      setTransactions(res.data || res);
      if (res.pagination) setTxnPagination(res.pagination);
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const isAuthenticated = currentUser !== null;

  const login = useCallback(async (userId, password) => {
    try {
      const data = await authService.login(userId, password);
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      setCurrentUser(data.user);
      await loadAppData(data.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setCurrentUser(null);
    setTransactions([]);
    setParties([]);
    setAccounts([]);
    setAuditTrail([]);
    setUsers([]);
  }, []);

  // ── Actions ────────────────────────────────────────────────
  const addTransaction = useCallback(async (txnPayload) => {
    setIsLoading(true);
    try {
      const newTxn = await transactionService.create(txnPayload);
      setTransactions(prev => [newTxn, ...prev]);
      const dash = await dataService.getDashboard();
      setSummary(dash.summary);
      setAccountBalances(dash.accountBalances);
      notify.success('Transaction created successfully');
      return newTxn;
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const editTransaction = useCallback(async (id, txnPayload) => {
    setIsLoading(true);
    try {
      const updated = await transactionService.update(id, txnPayload);
      setTransactions(prev => prev.map(t => t._id === id || t.id === id ? updated : t));
      const dash = await dataService.getDashboard();
      setSummary(dash.summary);
      setAccountBalances(dash.accountBalances);
      notify.success('Transaction updated successfully');
      return updated;
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const approveTransaction = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const updated = await transactionService.approve(id);
      setTransactions(prev => prev.map(t => t._id === id || t.id === id ? updated : t));
      notify.success('Transaction approved');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const rejectTransaction = useCallback(async (id, note) => {
    setIsLoading(true);
    try {
      const updated = await transactionService.reject(id, note);
      setTransactions(prev => prev.map(t => t._id === id || t.id === id ? updated : t));
      notify.success('Transaction rejected');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const deleteTransaction = useCallback(async (id, reason) => {
    setIsLoading(true);
    try {
      const updated = await transactionService.delete(id, reason);
      setTransactions(prev => prev.map(t => t._id === id || t.id === id ? updated : t));
      notify.success('Transaction deleted');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const addParty = useCallback(async (partyPayload) => {
    setIsLoading(true);
    try {
      const newParty = await partyService.create(partyPayload);
      setParties(prev => [...prev, newParty]);
      const accs = await dataService.getAccounts();
      setAccounts(accs);
      notify.success(`Party "${newParty.name}" created`);
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const editParty = useCallback(async (id, updates) => {
    setIsLoading(true);
    try {
      const updated = await partyService.update(id, updates);
      setParties(prev => prev.map(p => p._id === id || p.id === id ? updated : p));
      if (updates.name) {
        const accs = await dataService.getAccounts();
        setAccounts(accs);
      }
      notify.success('Party updated');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const deleteParty = useCallback(async (id) => {
    setIsLoading(true);
    try {
      await partyService.delete(id);
      setParties(prev => prev.filter(p => p._id !== id && p.id !== id));
      const accs = await dataService.getAccounts();
      setAccounts(accs);
      notify.success('Party deleted');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const addCategory = useCallback(async (name) => {
    try {
      const newCat = await dataService.createCategory(name);
      setCategories(prev => [...prev, newCat.name]);
      notify.success(`Category "${name}" added`);
    } catch (err) {
      notify.error(err.message);
    }
  }, [notify]);

  const addUser = useCallback(async (userPayload) => {
    setIsLoading(true);
    try {
      const newUser = await userService.create(userPayload);
      setUsers(prev => [...prev, newUser]);
      notify.success(`User "${newUser.name}" created`);
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const editUser = useCallback(async (id, updates) => {
    setIsLoading(true);
    try {
      const updated = await userService.update(id, updates);
      setUsers(prev => prev.map(u => u.userId === id ? updated : u));
      notify.success('User updated');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const updateUserPermissions = useCallback(async (id, permissions) => {
    setIsLoading(true);
    try {
      const updated = await userService.updatePermissions(id, permissions);
      setUsers(prev => prev.map(u => u.userId === id ? updated : u));
      notify.success('Permissions updated');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const deleteUser = useCallback(async (id) => {
    setIsLoading(true);
    try {
      await userService.delete(id);
      setUsers(prev => prev.filter(u => u.userId !== id));
      notify.success('User deleted');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  // ── Loan Actions ────────────────────────────────────────────
  const refreshLoans = useCallback(async () => {
    try {
      const res = await loanService.getAll();
      setLoans(res.data || []);
      setLoansSummary(res.summary || {});
    } catch (err) {
      console.error('Failed to refresh loans', err);
    }
  }, []);

  const addLoan = useCallback(async (payload) => {
    setIsLoading(true);
    try {
      const newLoan = await loanService.create(payload);
      await refreshLoans();
      const dash = await dataService.getDashboard();
      setSummary(dash.summary);
      notify.success(`Loan ${newLoan.loanId} created for ${newLoan.partyName}`);
      return newLoan;
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify, refreshLoans]);

  const editLoan = useCallback(async (id, payload) => {
    setIsLoading(true);
    try {
      const updated = await loanService.update(id, payload);
      await refreshLoans();
      notify.success('Loan parameters updated');
      return updated;
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify, refreshLoans]);

  const recordLoanPayment = useCallback(async (id, paymentPayload) => {
    setIsLoading(true);
    try {
      const res = await loanService.recordPayment(id, paymentPayload);
      await refreshLoans();
      const dash = await dataService.getDashboard();
      setSummary(dash.summary);
      notify.success(`Payment of ₹${paymentPayload.amount.toLocaleString()} recorded for Loan ${res.loan.loanId}`);
      return res;
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify, refreshLoans]);

  const closeLoan = useCallback(async (id) => {
    setIsLoading(true);
    try {
      await loanService.close(id);
      await refreshLoans();
      notify.success('Loan closed');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify, refreshLoans]);

  const resetLoanEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      await loanService.resetAllEntries();
      await refreshLoans();
      const dash = await dataService.getDashboard();
      setSummary(dash.summary);
      notify.success('All loan payment entries have been reset to zero!');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [notify, refreshLoans]);

  // ── Derived State ──────────────────────────────────────────
  
  // Format IDs consistently since MongoDB uses _id but frontend might expect id
  const normalizedTransactions = useMemo(() => {
    return transactions.map(t => ({ ...t, id: t._id || t.id }));
  }, [transactions]);

  const activeTransactions = useMemo(() => {
    return normalizedTransactions.filter(t => t.status === 'APPROVED' && !t.isDeleted);
  }, [normalizedTransactions]);

  const filteredTransactions = useMemo(() => {
    if (fiscalYear === 'ALL') return activeTransactions;
    return activeTransactions.filter(t => new Date(t.date).getFullYear().toString() === fiscalYear);
  }, [activeTransactions, fiscalYear]);

  const pendingTransactions = useMemo(() => {
    return normalizedTransactions.filter(t => t.status === 'PENDING' && !t.isDeleted);
  }, [normalizedTransactions]);

  const availableYears = useMemo(() => {
    const years = new Set(activeTransactions.map(t => new Date(t.date).getFullYear().toString()));
    return [...years].sort().reverse();
  }, [activeTransactions]);

  const normalizedParties = useMemo(() => parties.map(p => ({...p, id: p._id || p.id})), [parties]);
  const normalizedAccounts = useMemo(() => accounts.map(a => ({...a, id: a.accountId})), [accounts]);
  const normalizedUsers = useMemo(() => users.map(u => ({...u, id: u.userId})), [users]);

  const value = useMemo(() => ({
    // Raw data
    accounts: normalizedAccounts,
    parties: normalizedParties,
    transactions: normalizedTransactions,
    categories,
    auditTrail,
    loans,
    loansSummary,

    // Auth & Users
    currentUser,
    isAuthenticated,
    login,
    logout,
    users: normalizedUsers,
    addUser,
    editUser,
    updateUserPermissions,
    deleteUser,

    // Filtered
    filteredTransactions,
    pendingTransactions,
    fiscalYear,
    setFiscalYear,
    availableYears,

    // Balances
    accountBalances,
    periodBalances: accountBalances,
    summary,

    // Pagination
    txnPagination,
    partyPagination,
    loadTransactionPage,

    // Loading
    isLoading,

    // Toast injection
    setToastFns,

    // Actions
    addTransaction,
    editTransaction,
    deleteTransaction,
    approveTransaction,
    rejectTransaction,
    addParty,
    editParty,
    deleteParty,
    addAccount: () => notify.warning('Adding manual accounts is disabled in this version.'),
    addCategory,
    addLoan,
    editLoan,
    recordLoanPayment,
    closeLoan,
    refreshLoans,
    resetLoanEntries,
  }), [
    normalizedAccounts, normalizedParties, normalizedTransactions, categories, auditTrail,
    currentUser, isAuthenticated, login, logout, normalizedUsers,
    addUser, editUser, updateUserPermissions, deleteUser,
    filteredTransactions, pendingTransactions, fiscalYear, availableYears,
    accountBalances, summary,
    txnPagination, partyPagination, loadTransactionPage, isLoading,
    addTransaction, editTransaction, deleteTransaction, approveTransaction, rejectTransaction,
    addParty, editParty, deleteParty, addCategory, notify,
    loans, loansSummary, addLoan, editLoan, recordLoanPayment, closeLoan, refreshLoans, resetLoanEntries
  ]);

  if (isInitializing) {
    return (
      <div className="init-loader">
        <div className="init-spinner"></div>
        <p>Loading SKD ERP...</p>
      </div>
    );
  }

  return (
    <ERPContext.Provider value={value}>
      {children}
    </ERPContext.Provider>
  );
}
