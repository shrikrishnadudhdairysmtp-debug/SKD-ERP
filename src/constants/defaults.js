// ═══════════════════════════════════════════════════════════
// defaults.js — Application constants (frontend-safe only)
// ═══════════════════════════════════════════════════════════
// NOTE: All user credentials and seed data live exclusively
// on the backend. Nothing secret should ever be in this file.

/**
 * System-level chart of accounts (reference only — source of truth is DB).
 */
export const SYSTEM_ACCOUNTS = [
  { id: 'acc_cash',    name: 'Cash',            type: 'ASSET',   group: 'CASH',    isSystem: true },
  { id: 'acc_bank',    name: 'Bank Account',    type: 'ASSET',   group: 'BANK',    isSystem: true },
  { id: 'acc_income',  name: 'Income',          type: 'REVENUE', group: 'INCOME',  isSystem: true },
  { id: 'acc_expense', name: 'General Expense', type: 'EXPENSE', group: 'EXPENSE', isSystem: true },
];

/**
 * Default transaction categories (reference only — source of truth is DB).
 */
export const DEFAULT_CATEGORIES = [
  'Expense',
  'Investment',
  'Education',
  'Salary',
  'Freelance',
  'Other',
];

/**
 * Role definitions with human-readable labels.
 */
export const ROLE_OPTIONS = [
  { value: 'ADMIN',   label: 'Admin (Full Access)' },
  { value: 'CHECKER', label: 'Checker (Approver)' },
  { value: 'MAKER',   label: 'Maker (Accountant)' },
  { value: 'VIEWER',  label: 'Viewer (Read Only)' },
];

/**
 * Role display labels (short form for badges and pills).
 */
export const ROLE_LABELS = {
  ADMIN:   'Admin',
  CHECKER: 'Checker',
  MAKER:   'Accountant',
  VIEWER:  'Viewer',
};

/**
 * CSS class mappings for role-based color coding.
 */
export const ROLE_COLORS = {
  ADMIN:   'admin-role',
  CHECKER: 'checker-role',
  MAKER:   'maker-role',
  VIEWER:  'viewer-role',
};

/**
 * Human-readable labels for granular permissions.
 */
export const PERMISSION_LABELS = {
  pages: {
    overview: 'Overview Dashboard',
    analytics: 'Analytics & Charts',
    transactions: 'Transactions (All)',
    approvals: 'Pending Approvals',
    ledger: 'General Ledger',
    parties: 'Parties (Customers/Vendors)',
    loans: 'Loan Management',
    users: 'User Management',
  },
  actions: {
    createTransactions: 'Create Transactions',
    approveReject: 'Approve / Reject',
    deleteTransactions: 'Delete Transactions',
    manageParties: 'Manage Parties',
    downloadReports: 'Download PDF Reports',
  }
};

/**
 * localStorage keys — only used for auth token.
 */
export const STORAGE_KEYS = {
  TOKEN: 'erp_token',
};

/**
 * Application metadata.
 */
export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'SKD ERP',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  currencySymbol: import.meta.env.VITE_CURRENCY_SYMBOL || '₹',
  currencyCode: import.meta.env.VITE_CURRENCY_CODE || 'INR',
};
