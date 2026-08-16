import React, { useState, useEffect } from 'react';
import { useERP } from '../hooks/useERP.js';
import { useToast } from '../context/ToastContext.jsx';

const TransactionForm = ({ editingTxn, onCancelEdit }) => {
  const { accounts, parties, categories, addTransaction, editTransaction, addCategory, currentUser, isLoading } = useERP();
  const { showWarning } = useToast();

  // Form state
  const [txnType, setTxnType] = useState('PAYMENT'); // RECEIPT, PAYMENT, JOURNAL
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [category, setCategory] = useState('');
  const [partyId, setPartyId] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');

  // New category inline
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  // Populate state when editingTxn changes
  useEffect(() => {
    if (editingTxn) {
      const dr = editingTxn.entries?.find(e => e.debit > 0);
      const cr = editingTxn.entries?.find(e => e.credit > 0);
      const amt = dr?.debit || cr?.credit || 0;
      setAmount(amt.toString());
      setDate(editingTxn.date ? new Date(editingTxn.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setRemarks(editingTxn.remarks || '');
      setCategory(editingTxn.category || '');
      setPartyId(editingTxn.partyId || '');
      setDebitAccountId(dr?.accountId || '');
      setCreditAccountId(cr?.accountId || '');

      if (dr?.accountId === 'acc_bank' || dr?.accountId === 'acc_cash') {
        setTxnType('RECEIPT');
      } else if (cr?.accountId === 'acc_bank' || cr?.accountId === 'acc_cash') {
        setTxnType('PAYMENT');
      } else {
        setTxnType('JOURNAL');
      }
    } else {
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setRemarks('');
      setCategory('');
      setPartyId('');
      setTxnType('PAYMENT');
      setDebitAccountId('acc_expense');
      setCreditAccountId('acc_bank');
    }
  }, [editingTxn]);

  // Filter accounts by group for the dropdowns
  const assetAccounts = accounts.filter(a => a.type === 'ASSET');
  const allAccounts = accounts;

  // Parties: for RECEIPT show customers, for PAYMENT show vendors
  const relevantParties = parties.filter(p =>
    txnType === 'RECEIPT' ? p.type === 'CUSTOMER' : p.type === 'VENDOR'
  );

  // Smart defaults when txnType changes
  const handleTypeChange = (type) => {
    setTxnType(type);
    setPartyId('');

    if (type === 'RECEIPT') {
      setDebitAccountId('acc_bank');
      setCreditAccountId('acc_income');
    } else if (type === 'PAYMENT') {
      setDebitAccountId('acc_expense');
      setCreditAccountId('acc_bank');
    } else {
      setDebitAccountId('');
      setCreditAccountId('');
    }
  };

  // When a party is selected, auto-set the AR/AP account
  const handlePartyChange = (pid) => {
    setPartyId(pid);
    if (!pid) {
      if (txnType === 'RECEIPT') {
        setCreditAccountId('acc_income');
      } else if (txnType === 'PAYMENT') {
        setDebitAccountId('acc_expense');
      }
      return;
    }

    const party = parties.find(p => p.id === pid);
    if (!party) return;

    if (txnType === 'RECEIPT') {
      if (party.receivableAccountId) {
        setCreditAccountId(party.receivableAccountId);
      }
    } else if (txnType === 'PAYMENT') {
      if (party.payableAccountId) {
        setDebitAccountId(party.payableAccountId);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      showWarning('Please enter a valid amount.');
      return;
    }
    if (!remarks.trim()) {
      showWarning('Remarks is mandatory. Please describe this transaction.');
      return;
    }
    if (!debitAccountId || !creditAccountId) {
      showWarning('Please select both Debit and Credit accounts.');
      return;
    }
    if (debitAccountId === creditAccountId) {
      showWarning('Debit and Credit accounts must be different.');
      return;
    }

    const parsedAmount = parseFloat(amount);

    const txn = {
      date,
      remarks: remarks.trim(),
      entries: [
        { accountId: debitAccountId, debit: parsedAmount, credit: 0 },
        { accountId: creditAccountId, debit: 0, credit: parsedAmount },
      ],
      partyId: partyId || null,
      category: category || (txnType === 'RECEIPT' ? 'Salary' : 'Expense'),
    };

    if (editingTxn) {
      await editTransaction(editingTxn.id, txn);
      if (onCancelEdit) onCancelEdit();
    } else {
      await addTransaction(txn);
    }

    // Reset form
    setAmount('');
    setRemarks('');
    setPartyId('');
    setCategory('');
    handleTypeChange(txnType);
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setShowNewCat(false);
    }
  };

  const getAccountName = (id) => accounts.find(a => a.id === id)?.name || id;

  return (
    <form className="transaction-form glass-panel" onSubmit={handleSubmit}>
      <h3>{editingTxn ? 'Edit Transaction' : 'Add Transaction'}</h3>

      {/* Transaction Type */}
      <div className="form-group">
        <label>Transaction Type</label>
        <div className="txn-type-toggle">
          {['RECEIPT', 'PAYMENT', 'JOURNAL'].map(t => (
            <button
              key={t}
              type="button"
              className={`toggle-btn ${txnType === t ? 'active' : ''} ${t === 'RECEIPT' ? 'receipt' : t === 'PAYMENT' ? 'payment' : 'journal'}`}
              onClick={() => handleTypeChange(t)}
            >
              {t === 'RECEIPT' ? '↓ Receipt' : t === 'PAYMENT' ? '↑ Payment' : '⇄ Journal'}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="form-group">
        <label>Amount (₹)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="e.g. 5000"
          min="0.01"
          step="0.01"
          required
        />
      </div>

      {/* Date */}
      <div className="form-group">
        <label>Date</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
        />
      </div>

      {/* Remarks (mandatory) */}
      <div className="form-group">
        <label>Remarks <span className="required-star">*</span></label>
        <input
          type="text"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="e.g. Office rent for April"
          required
        />
      </div>

      {/* Party (optional, contextual) */}
      {txnType !== 'JOURNAL' && relevantParties.length > 0 && (
        <div className="form-group">
          <label>{txnType === 'RECEIPT' ? 'Received From (Customer)' : 'Paid To (Vendor)'}</label>
          <select value={partyId} onChange={e => handlePartyChange(e.target.value)}>
            <option value="">— No Party (Direct) —</option>
            {relevantParties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Payment Mode / Account selection for Receipt and Payment, full inputs for Journal */}
      {txnType !== 'JOURNAL' ? (
        <div className="form-group">
          <label>Payment Mode / Account</label>
          <select
            value={txnType === 'RECEIPT' ? debitAccountId : creditAccountId}
            onChange={e => {
              if (txnType === 'RECEIPT') {
                setDebitAccountId(e.target.value);
              } else {
                setCreditAccountId(e.target.value);
              }
            }}
            required
          >
            <option value="acc_bank">Bank Account</option>
            <option value="acc_cash">Cash</option>
          </select>
        </div>
      ) : (
        <>
          {/* Debit Account */}
          <div className="form-group">
            <label>Debit Account <span className="acc-hint">(money goes into)</span></label>
            <select value={debitAccountId} onChange={e => setDebitAccountId(e.target.value)} required>
              <option value="" disabled>Select Account</option>
              {allAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Credit Account */}
          <div className="form-group">
            <label>Credit Account <span className="acc-hint">(money comes from)</span></label>
            <select value={creditAccountId} onChange={e => setCreditAccountId(e.target.value)} required>
              <option value="" disabled>Select Account</option>
              {allAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Category */}
      <div className="form-group">
        <label>Category</label>
        <select
          value={category}
          onChange={e => {
            if (e.target.value === 'ADD_NEW') {
              setShowNewCat(true);
            } else {
              setCategory(e.target.value);
              setShowNewCat(false);
            }
          }}
        >
          <option value="">Select Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="ADD_NEW">+ Add Custom Category</option>
        </select>
        {showNewCat && (
          <div className="new-category-input">
            <input
              type="text"
              placeholder="New Category Name"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
            />
            <button type="button" onClick={handleAddCategory}>Add</button>
          </div>
        )}
      </div>

      {/* Preview */}
      {debitAccountId && creditAccountId && amount && (
        <div className="entry-preview glass-panel">
          <p className="preview-title">Entry Preview</p>
          <div className="preview-row">
            <span className="preview-dr">Dr.</span>
            <span>{getAccountName(debitAccountId)}</span>
            <span className="preview-amt">₹{parseFloat(amount || 0).toLocaleString()}</span>
          </div>
          <div className="preview-row">
            <span className="preview-cr">Cr.</span>
            <span>{getAccountName(creditAccountId)}</span>
            <span className="preview-amt">₹{parseFloat(amount || 0).toLocaleString()}</span>
          </div>
        </div>
      )}

      {currentUser.role === 'MAKER' && (
        <div className="maker-notice">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{verticalAlign: 'middle', marginRight: '4px'}}>
            <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Transactions will be submitted for approval
        </div>
      )}

      <button type="submit" className="primary-btn" disabled={isLoading}>
        {isLoading ? 'Saving...' : editingTxn ? 'Update Transaction' : (currentUser.role === 'MAKER' ? 'Submit for Approval' : 'Add Transaction')}
      </button>

      {editingTxn && onCancelEdit && (
        <button type="button" className="action-btn" onClick={onCancelEdit} style={{ marginTop: '0.5rem', width: '100%' }}>
          Cancel Edit
        </button>
      )}
    </form>
  );
};

export default TransactionForm;
