import React, { useState, useMemo } from 'react';
import { useERP } from '../hooks/useERP.js';

const MilkSales = () => {
  const { transactions, parties, accounts, addTransaction, currentUser } = useERP();
  
  // Sub-tabs: OVERVIEW, DISPATCH, RECEIPTS, OUTSTANDING, MONTHLY_REPORT
  const [subTab, setSubTab] = useState('OVERVIEW');

  // --- Dispatch Form State ---
  const [dispFromDate, setDispFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispToDate, setDispToDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispPartyId, setDispPartyId] = useState('');
  const [dispTotalAmount, setDispTotalAmount] = useState('');
  const [dispRemarks, setDispRemarks] = useState('');

  // --- Local Sales Form State ---
  const [localDate, setLocalDate] = useState(new Date().toISOString().split('T')[0]);
  const [localLiters, setLocalLiters] = useState('');
  const [localRate, setLocalRate] = useState('');
  const [localPaymentType, setLocalPaymentType] = useState('CASH'); // CASH, BANK, CREDIT
  const [localPartyId, setLocalPartyId] = useState('');
  const [localRemarks, setLocalRemarks] = useState('');

  // --- Receipt Form State ---
  const [recDate, setRecDate] = useState(new Date().toISOString().split('T')[0]);
  const [recPartyId, setRecPartyId] = useState('');
  const [recInvoiceNo, setRecInvoiceNo] = useState(''); // Selected dispatch voucher
  const [recPaymentMode, setRecPaymentMode] = useState('BANK TRANSFER');
  const [recRefNo, setRecRefNo] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recAccount, setRecAccount] = useState('acc_bank'); // acc_bank or acc_cash
  const [recRemarks, setRecRemarks] = useState('');

  // --- Helpers ---
  const getPartyName = (id) => parties.find(p => p.id === id)?.name || '-';
  const customerParties = useMemo(() => parties.filter(p => p.type === 'CUSTOMER'), [parties]);

  // --- Derived Data: Dispatches (Invoices) and Payments (Receipts) ---
  const dairyDispatches = useMemo(() => {
    return transactions.filter(t => 
      t.status === 'APPROVED' && 
      !t.isDeleted && 
      !t.isLocalSale &&
      t.entries && 
      t.entries.some(e => e.accountId === 'acc_milk_sales')
    ).map(t => {
      const arEntry = t.entries.find(e => e.accountId.startsWith('acc_ar_'));
      const amount = arEntry ? arEntry.debit : 0;
      return {
        id: t._id || t.id,
        voucherNo: t.voucherRef || t.voucherNo || String(t._id || t.id).slice(-6),
        date: t.date,
        fromDate: t.fromDate || t.date,
        toDate: t.toDate || t.date,
        partyId: t.partyId,
        remarks: t.remarks,
        liters: t.liters || 0,
        rate: t.rate || 0,
        fat: t.fat || 0,
        snf: t.snf || 0,
        amount
      };
    });
  }, [transactions]);

  const localSalesList = useMemo(() => {
    return transactions.filter(t => 
      t.status === 'APPROVED' && 
      !t.isDeleted && 
      t.isLocalSale === true
    ).map(t => {
      const arEntry = t.entries.find(e => e.accountId.startsWith('acc_ar_'));
      const cashEntry = t.entries.find(e => e.accountId === 'acc_cash' || e.accountId === 'acc_bank');
      const amount = arEntry ? arEntry.debit : (cashEntry ? cashEntry.debit : 0);
      return {
        id: t._id || t.id,
        voucherNo: t.voucherRef || t.voucherNo || String(t._id || t.id).slice(-6),
        date: t.date,
        partyId: t.partyId,
        paymentType: t.paymentType || 'CASH',
        liters: t.liters || 0,
        rate: t.rate || 0,
        amount,
        remarks: t.remarks
      };
    });
  }, [transactions]);

  const dairyReceipts = useMemo(() => {
    return transactions.filter(t => 
      t.status === 'APPROVED' && 
      !t.isDeleted && 
      (t.type === 'RECEIPT' || t.category === 'Milk Purchase' || t.category === 'Milk Sales' || t.refModule === 'MILK' || t.refModule === 'PAYMENT') &&
      t.entries && 
      t.entries.some(e => e.accountId?.startsWith('acc_ar_') && e.credit > 0) &&
      t.entries.some(e => e.accountId === 'acc_bank' || e.accountId === 'acc_cash')
    ).map(t => {
      const bankEntry = t.entries.find(e => e.accountId === 'acc_bank' || e.accountId === 'acc_cash');
      const amount = bankEntry ? bankEntry.debit : (t.entries.find(e => e.accountId?.startsWith('acc_ar_'))?.credit || 0);
      const parsedInvoice = t.invoiceNo || (t.remarks?.match(/Inv\s*#?\s*([A-Z0-9-]+)/i)?.[1]) || 'Direct Payout';
      return {
        id: t._id || t.id,
        voucherNo: t.voucherRef || t.voucherNo || String(t._id || t.id).slice(-6),
        date: t.date,
        partyId: t.partyId,
        remarks: t.remarks,
        invoiceNo: parsedInvoice,
        paymentMode: t.paymentMode || 'BANK TRANSFER',
        refNo: t.refNo || '',
        amount,
        accountName: bankEntry?.accountId === 'acc_bank' ? 'Bank Account' : 'Cash Account'
      };
    });
  }, [transactions]);

  // --- Outstanding calculations per party ---
  const partyOutstanding = useMemo(() => {
    const report = {};
    
    // Initialise
    customerParties.forEach(p => {
      report[p.id] = {
        name: p.name,
        partyId: p.id,
        invoiceAmount: 0,
        receivedAmount: 0,
        pendingAmount: 0
      };
    });

    // Accumulate Invoices
    dairyDispatches.forEach(disp => {
      if (report[disp.partyId]) {
        report[disp.partyId].invoiceAmount += disp.amount;
      }
    });

    // Accumulate local credit sales
    localSalesList.forEach(ls => {
      if (ls.partyId && ls.paymentType === 'CREDIT' && report[ls.partyId]) {
        report[ls.partyId].invoiceAmount += ls.amount;
      }
    });

    // Accumulate Payments
    dairyReceipts.forEach(rec => {
      if (report[rec.partyId]) {
        report[rec.partyId].receivedAmount += rec.amount;
      }
    });

    // Calculate Pending
    Object.values(report).forEach(r => {
      r.pendingAmount = r.invoiceAmount - r.receivedAmount;
    });

    return Object.values(report);
  }, [customerParties, dairyDispatches, localSalesList, dairyReceipts]);

  // --- Invoice-by-Invoice Settlement List (for matching invoices in payments form) ---
  const unpaidInvoices = useMemo(() => {
    if (!recPartyId) return [];

    // Filter dispatches and local credit sales for this party
    const partyDispatches = [
      ...dairyDispatches.filter(d => d.partyId === recPartyId),
      ...localSalesList.filter(s => s.partyId === recPartyId && s.paymentType === 'CREDIT')
    ];
    
    // Sum receipts matching each voucherNo
    const invoiceReceipts = {};
    dairyReceipts.forEach(r => {
      if (r.partyId === recPartyId && r.invoiceNo) {
        invoiceReceipts[r.invoiceNo] = (invoiceReceipts[r.invoiceNo] || 0) + r.amount;
      }
    });

    return partyDispatches.map(disp => {
      const settled = invoiceReceipts[disp.voucherNo] || 0;
      const pending = disp.amount - settled;
      
      let status = 'Pending';
      if (pending <= 0) status = 'Paid';
      else if (settled > 0) status = 'Partially Paid';
      
      const docDate = new Date(disp.date);
      const ageInDays = Math.ceil(Math.abs(new Date() - docDate) / (1000 * 60 * 60 * 24));
      if (status !== 'Paid' && ageInDays > 30) status = 'Overdue';

      return {
        ...disp,
        settled,
        pending,
        status,
        ageInDays
      };
    }).filter(inv => inv.pending > 0);
  }, [recPartyId, dairyDispatches, localSalesList, dairyReceipts]);

  // --- Dashboard Statistics ---
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    let todayLiters = 0;
    let todayAmount = 0;
    let monthlyRevenue = 0;
    let pendingInvoicesCount = 0;
    let totalOutstandingVal = 0;

    let localTodayLiters = 0;
    let localTodayAmount = 0;
    let localMonthlyRevenue = 0;

    // Today's dispatch
    dairyDispatches.forEach(d => {
      if (d.date === todayStr) {
        todayLiters += d.liters;
        todayAmount += d.amount;
      }
      if (d.date.slice(0, 7) === currentMonthStr) {
        monthlyRevenue += d.amount;
      }
    });

    // Today's local sales
    localSalesList.forEach(ls => {
      if (ls.date === todayStr) {
        localTodayLiters += ls.liters;
        localTodayAmount += ls.amount;
      }
      if (ls.date.slice(0, 7) === currentMonthStr) {
        localMonthlyRevenue += ls.amount;
      }
    });

    // Outstanding report
    partyOutstanding.forEach(p => {
      totalOutstandingVal += p.pendingAmount;
    });

    // Pending counts: count unpaid invoices across all customers
    const invoiceReceipts = {};
    dairyReceipts.forEach(r => {
      if (r.invoiceNo) {
        invoiceReceipts[r.invoiceNo] = (invoiceReceipts[r.invoiceNo] || 0) + r.amount;
      }
    });

    const allInvoices = [
      ...dairyDispatches,
      ...localSalesList.filter(s => s.paymentType === 'CREDIT' && s.partyId)
    ];

    allInvoices.forEach(d => {
      const settled = invoiceReceipts[d.voucherNo] || 0;
      if (d.amount - settled > 0) {
        pendingInvoicesCount += 1;
      }
    });

    return {
      todayLiters,
      todayAmount,
      monthlyRevenue,
      localTodayLiters,
      localTodayAmount,
      localMonthlyRevenue,
      pendingInvoicesCount,
      totalOutstandingVal
    };
  }, [dairyDispatches, localSalesList, dairyReceipts, partyOutstanding]);

  // --- Monthly Income Statement Grid ---
  const monthlyStatement = useMemo(() => {
    const months = {};
    
    // Group dispatches
    dairyDispatches.forEach(d => {
      const m = d.date.slice(0, 7);
      if (!months[m]) {
        months[m] = { month: m, liters: 0, revenue: 0, localLiters: 0, localRevenue: 0, collected: 0, outstanding: 0 };
      }
      months[m].revenue += d.amount;
    });

    // Group local sales
    localSalesList.forEach(ls => {
      const m = ls.date.slice(0, 7);
      if (!months[m]) {
        months[m] = { month: m, liters: 0, revenue: 0, localLiters: 0, localRevenue: 0, collected: 0, outstanding: 0 };
      }
      months[m].localLiters += ls.liters;
      months[m].localRevenue += ls.amount;
      if (ls.paymentType !== 'CREDIT') {
        months[m].collected += ls.amount;
      }
    });

    // Group collections (payments)
    dairyReceipts.forEach(r => {
      const m = r.date.slice(0, 7);
      if (!months[m]) {
        months[m] = { month: m, liters: 0, revenue: 0, localLiters: 0, localRevenue: 0, collected: 0, outstanding: 0 };
      }
      months[m].collected += r.amount;
    });

    // Outstanding = (Revenue + Local Revenue) - Collected per month
    Object.values(months).forEach(v => {
      v.outstanding = (v.revenue + v.localRevenue) - v.collected;
    });

    return Object.values(months).sort((a, b) => b.month.localeCompare(a.month));
  }, [dairyDispatches, localSalesList, dairyReceipts]);

  // --- Dispatch Submission Handler ---
  const handleDispatchSubmit = (e) => {
    e.preventDefault();
    if (!dispPartyId) return alert('Please select a Dairy Customer Plant.');
    if (!dispFromDate) return alert('Please select a From Date.');
    if (!dispToDate) return alert('Please select a To Date.');
    if (new Date(dispFromDate) > new Date(dispToDate)) {
      return alert('From Date cannot be after To Date.');
    }
    if (!dispTotalAmount || isNaN(dispTotalAmount) || parseFloat(dispTotalAmount) <= 0) {
      return alert('Please enter a valid Total Sales Amount.');
    }

    const totalAmount = parseFloat(dispTotalAmount);
    const party = parties.find(p => p.id === dispPartyId);
    if (!party || !party.receivableAccountId) {
      return alert('Party is missing a linked Accounts Receivable account.');
    }

    // Auto-create journal entries: Debit AR, Credit Milk Sales Income
    const txn = {
      id: 'txn_milk_disp_' + Date.now().toString(),
      date: dispToDate, // use To Date as transaction posting date
      fromDate: dispFromDate,
      toDate: dispToDate,
      remarks: dispRemarks.trim() || `Milk Dispatch Billing Cycle: ${dispFromDate} to ${dispToDate}`,
      type: 'JOURNAL',
      entries: [
        { accountId: party.receivableAccountId, debit: totalAmount, credit: 0 },
        { accountId: 'acc_milk_sales', debit: 0, credit: totalAmount }
      ],
      partyId: dispPartyId,
      category: 'Milk Purchase',
      createdAt: new Date().toISOString()
    };

    addTransaction(txn);
    alert('Milk dispatch record and accounting journal successfully added!');

    // Reset Form
    setDispTotalAmount('');
    setDispRemarks('');
  };

  // --- Local Sales Submission Handler ---
  const handleLocalSubmit = (e) => {
    e.preventDefault();
    if (!localLiters || isNaN(localLiters) || parseFloat(localLiters) <= 0) {
      return alert('Please enter valid Liters.');
    }
    if (!localRate || isNaN(localRate) || parseFloat(localRate) <= 0) {
      return alert('Please enter a valid Rate per Liter.');
    }
    if (localPaymentType === 'CREDIT' && !localPartyId) {
      return alert('Please select a Customer for Credit Sales.');
    }

    const liters = parseFloat(localLiters);
    const rate = parseFloat(localRate);
    const totalAmount = liters * rate;

    let debitAccount = 'acc_cash';
    if (localPaymentType === 'BANK') {
      debitAccount = 'acc_bank';
    } else if (localPaymentType === 'CREDIT') {
      const party = parties.find(p => p.id === localPartyId);
      if (!party || !party.receivableAccountId) {
        return alert('Customer is missing a linked Accounts Receivable account.');
      }
      debitAccount = party.receivableAccountId;
    }

    // Auto-create ledger journal entries
    const txn = {
      id: 'txn_milk_local_' + Date.now().toString(),
      date: localDate,
      remarks: localRemarks.trim() || `Local Milk Sale: ${liters} L @ ₹${rate}/L | Mode: ${localPaymentType}`,
      type: 'JOURNAL',
      entries: [
        { accountId: debitAccount, debit: totalAmount, credit: 0 },
        { accountId: 'acc_milk_sales', debit: 0, credit: totalAmount }
      ],
      partyId: localPaymentType === 'CREDIT' ? localPartyId : undefined,
      category: 'Milk Purchase',
      isLocalSale: true,
      paymentType: localPaymentType,
      liters,
      rate,
      createdAt: new Date().toISOString()
    };

    addTransaction(txn);
    alert('Local milk sale and accounting journal successfully added!');

    // Reset Form
    setLocalLiters('');
    setLocalRate('');
    setLocalRemarks('');
  };

  // --- Receipt Submission Handler ---
  const handleReceiptSubmit = (e) => {
    e.preventDefault();
    if (!recPartyId) return alert('Please select a Dairy Customer Plant.');
    if (!recInvoiceNo) return alert('Please select an Invoice/Voucher to clear.');
    if (!recAmount || isNaN(recAmount) || parseFloat(recAmount) <= 0) return alert('Please enter a valid amount.');

    const amt = parseFloat(recAmount);
    const party = parties.find(p => p.id === recPartyId);
    if (!party || !party.receivableAccountId) {
      return alert('Party is missing a linked Accounts Receivable account.');
    }

    // Auto-create receipt ledger entries: Debit Cash/Bank, Credit AR
    const txn = {
      id: 'txn_milk_pay_' + Date.now().toString(),
      date: recDate,
      remarks: recRemarks.trim() || `Milk Sales Payment: Inv #${recInvoiceNo} | Mode: ${recPaymentMode}`,
      type: 'RECEIPT',
      paymentMode: recPaymentMode,
      refNo: recRefNo.trim(),
      invoiceNo: recInvoiceNo, // link voucher
      entries: [
        { accountId: recAccount, debit: amt, credit: 0 },
        { accountId: party.receivableAccountId, debit: 0, credit: amt }
      ],
      partyId: recPartyId,
      category: 'Milk Purchase',
      createdAt: new Date().toISOString()
    };

    addTransaction(txn);
    alert('Payment receipt record and accounting journal successfully added!');

    // Reset Form
    setRecAmount('');
    setRecRefNo('');
    setRecRemarks('');
    setRecInvoiceNo('');
  };

  return (
    <div className="milk-sales-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-tab navigation */}
      <div className="glass-panel" style={{ display: 'flex', gap: '10px', padding: '12px 20px', flexWrap: 'wrap' }}>
        {[
          { id: 'OVERVIEW', label: 'Dashboard Overview', icon: '📊' },
          { id: 'DISPATCH', label: 'Milk Dispatches', icon: '🚚' },
          { id: 'LOCAL_SALES', label: 'Local Sales', icon: '🥛' },
          { id: 'RECEIPTS', label: 'Income Receipts', icon: '💵' },
          { id: 'OUTSTANDING', label: 'Outstanding Aging', icon: '⏳' },
          { id: 'MONTHLY_REPORT', label: 'Monthly Statement', icon: '📅' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`action-btn ${subTab === tab.id ? 'primary-btn' : ''}`}
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
          >
            <span style={{ marginRight: '5px' }}>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB: OVERVIEW */}
      {subTab === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KPI Dashboard */}
          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Today's Dispatch</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#60a5fa' }}>
                ₹{stats.todayAmount.toLocaleString()}
              </div>
              {stats.todayLiters > 0 ? (
                <span style={{ fontSize: '0.85rem', color: '#10b981' }}>Qty: {stats.todayLiters.toLocaleString()} Liters</span>
              ) : (
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total dispatch sales today</span>
              )}
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Today's Local Sales</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#60a5fa' }}>
                ₹{stats.localTodayAmount.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#10b981' }}>Qty: {stats.localTodayLiters.toLocaleString()} L</span>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Monthly Dairy Revenue</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>
                ₹{stats.monthlyRevenue.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Dairy dispatches this month</span>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Monthly Local Sales</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>
                ₹{stats.localMonthlyRevenue.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Local milk sales this month</span>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Pending Bills</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {stats.pendingInvoicesCount} Invoices
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Awaiting payments</span>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 10px 0', textTransform: 'uppercase', fontSize: '0.8rem' }}>Total Outstanding</h4>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>
                ₹{stats.totalOutstandingVal.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Cumulative receivables</span>
            </div>
          </div>

          {/* Quick Summary Tables */}
          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Recent Dispatches */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Recent Milk Dispatches</h3>
              <div className="table-responsive">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Billing Period / Date</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Dairy Plant</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dairyDispatches.slice(0, 5).map(d => (
                      <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px' }}>
                          {d.fromDate && d.toDate && d.fromDate !== d.toDate 
                            ? `${new Date(d.fromDate).toLocaleDateString()} - ${new Date(d.toDate).toLocaleDateString()}`
                            : new Date(d.date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '8px 6px' }}>{getPartyName(d.partyId)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>₹{d.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {dairyDispatches.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center text-secondary" style={{ padding: '15px' }}>No dispatches logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Local Sales */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Recent Local Sales</h3>
              <div className="table-responsive">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {localSalesList.slice(0, 5).map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px' }}>{new Date(s.date).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>{s.liters} L</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{s.rate}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold' }}>₹{s.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {localSalesList.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-secondary" style={{ padding: '15px' }}>No local sales logged.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Payout Collections */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', margin: '0 0 12px 0' }}>Recent Payment Collections</h3>
              <div className="table-responsive">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Dairy</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Mode</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dairyReceipts.slice(0, 5).map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 6px' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td style={{ padding: '8px 6px' }}>{getPartyName(r.partyId)}</td>
                        <td style={{ padding: '8px 6px', textTransform: 'capitalize' }}>{r.paymentMode.toLowerCase()}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>₹{r.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    {dairyReceipts.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-secondary" style={{ padding: '15px' }}>No payments collected.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: DISPATCH */}
      {subTab === 'DISPATCH' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          {/* Dispatch Form */}
          <form className="transaction-form glass-panel" onSubmit={handleDispatchSubmit} style={{ height: 'fit-content' }}>
            <h3>Log Milk Dispatch Outgoing</h3>
            
            <div className="form-group">
              <label>Select Dairy Plant (Customer)</label>
              <select value={dispPartyId} onChange={e => setDispPartyId(e.target.value)} required>
                <option value="">— Select Dairy Customer —</option>
                {customerParties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>From Date</label>
                <input type="date" value={dispFromDate} onChange={e => setDispFromDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>To Date</label>
                <input type="date" value={dispToDate} onChange={e => setDispToDate(e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label>Total Sales Amount (₹)</label>
              <input
                type="number"
                value={dispTotalAmount}
                onChange={e => setDispTotalAmount(e.target.value)}
                placeholder="e.g. 50000"
                min="0.01"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <input
                type="text"
                value={dispRemarks}
                onChange={e => setDispRemarks(e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>

            <button type="submit" className="primary-btn" style={{ marginTop: '15px', width: '100%' }}>
              Commit Dispatch & Post Ledger
            </button>
          </form>

          {/* Dispatches List */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 15px 0' }}>Daily Dispatch Logs</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Billing Period</th>
                    <th>Voucher No</th>
                    <th>Dairy Customer</th>
                    <th>Posting Date</th>
                    <th className="text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {dairyDispatches.map(d => (
                    <tr key={d.id}>
                      <td>
                        {d.fromDate && d.toDate && d.fromDate !== d.toDate 
                          ? `${new Date(d.fromDate).toLocaleDateString()} - ${new Date(d.toDate).toLocaleDateString()}`
                          : new Date(d.date).toLocaleDateString()}
                      </td>
                      <td><code style={{ color: '#60a5fa' }}>{d.voucherNo}</code></td>
                      <td>{getPartyName(d.partyId)}</td>
                      <td>{new Date(d.date).toLocaleDateString()}</td>
                      <td className="text-right font-semibold">₹{d.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {dairyDispatches.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-secondary" style={{ padding: '20px' }}>
                        No milk dispatches recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: LOCAL_SALES */}
      {subTab === 'LOCAL_SALES' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          {/* Local Sales Form */}
          <form className="transaction-form glass-panel" onSubmit={handleLocalSubmit} style={{ height: 'fit-content' }}>
            <h3>Log Local Milk Sale</h3>

            <div className="form-group">
              <label>Sale Date</label>
              <input type="date" value={localDate} onChange={e => setLocalDate(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Liters Sold</label>
              <input
                type="number"
                value={localLiters}
                onChange={e => setLocalLiters(e.target.value)}
                placeholder="e.g. 12.5"
                min="0.1"
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label>Rate per Liter (₹)</label>
              <input
                type="number"
                value={localRate}
                onChange={e => setLocalRate(e.target.value)}
                placeholder="e.g. 50.00"
                min="0.1"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Payment Method / Type</label>
              <select value={localPaymentType} onChange={e => {
                setLocalPaymentType(e.target.value);
                if (e.target.value !== 'CREDIT') setLocalPartyId('');
              }}>
                <option value="CASH">Cash Sale</option>
                <option value="BANK">Bank Transfer / UPI</option>
                <option value="CREDIT">Credit Customer</option>
              </select>
            </div>

            {localPaymentType === 'CREDIT' && (
              <div className="form-group">
                <label>Select Customer</label>
                <select value={localPartyId} onChange={e => setLocalPartyId(e.target.value)} required>
                  <option value="">— Select Customer —</option>
                  {customerParties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Remarks</label>
              <input
                type="text"
                value={localRemarks}
                onChange={e => setLocalRemarks(e.target.value)}
                placeholder="Description details (optional)"
              />
            </div>

            {localLiters && localRate && (
              <div className="entry-preview glass-panel" style={{ marginTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Calculated Sale Amount:</span>
                  <span style={{ color: '#60a5fa' }}>₹{(parseFloat(localLiters) * parseFloat(localRate)).toLocaleString()}</span>
                </div>
              </div>
            )}

            <button type="submit" className="primary-btn" style={{ marginTop: '15px', width: '100%' }}>
              Commit Local Sale & Post Ledger
            </button>
          </form>

          {/* Local Sales Logs Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 15px 0' }}>Local Sales Logs</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Voucher No</th>
                    <th>Liters</th>
                    <th>Rate</th>
                    <th>Amount (₹)</th>
                    <th>Payment Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {localSalesList.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td><code style={{ color: '#60a5fa' }}>{s.voucherNo}</code></td>
                      <td>{s.liters} L</td>
                      <td>₹{s.rate}</td>
                      <td className="text-right font-semibold">₹{s.amount.toLocaleString()}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {s.paymentType.toLowerCase()}
                        {s.paymentType === 'CREDIT' && (
                          <span style={{ fontSize: '0.75rem', opacity: 0.6, display: 'block' }}>
                            ({getPartyName(s.partyId)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {localSalesList.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-secondary" style={{ padding: '20px' }}>
                        No local milk sales recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: RECEIPTS */}
      {subTab === 'RECEIPTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          {/* Payment Receipt Form */}
          <form className="transaction-form glass-panel" onSubmit={handleReceiptSubmit} style={{ height: 'fit-content' }}>
            <h3>Log Dairy Payout Receipt</h3>

            <div className="form-group">
              <label>Receipt Date</label>
              <input type="date" value={recDate} onChange={e => setRecDate(e.target.value)} required />
            </div>

            <div className="form-group">
              <label>Dairy Plant (Customer)</label>
              <select value={recPartyId} onChange={e => { setRecPartyId(e.target.value); setRecInvoiceNo(''); }} required>
                <option value="">— Select Customer —</option>
                {customerParties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Match Pending Invoice / Dispatch No</label>
              <select value={recInvoiceNo} onChange={e => {
                setRecInvoiceNo(e.target.value);
                const inv = unpaidInvoices.find(i => i.voucherNo === e.target.value);
                if (inv) setRecAmount(inv.pending);
              }} required disabled={!recPartyId}>
                <option value="">— Select Pending Bill —</option>
                {unpaidInvoices.map(inv => (
                  <option key={inv.id} value={inv.voucherNo}>
                    {inv.voucherNo} ({new Date(inv.date).toLocaleDateString()} | Pending: ₹{inv.pending.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Receipt Payout Mode</label>
              <select value={recPaymentMode} onChange={e => setRecPaymentMode(e.target.value)}>
                <option value="BANK TRANSFER">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div className="form-group">
              <label>Reference Number (Cheque No / Transaction ID)</label>
              <input
                type="text"
                value={recRefNo}
                onChange={e => setRecRefNo(e.target.value)}
                placeholder="e.g. TXN-10928, CHQ-20391"
              />
            </div>

            <div className="form-group">
              <label>Clearing Cash/Bank Ledger Account</label>
              <select value={recAccount} onChange={e => setRecAccount(e.target.value)}>
                <option value="acc_bank">Bank Account</option>
                <option value="acc_cash">Cash Account</option>
              </select>
            </div>

            <div className="form-group">
              <label>Amount Received (₹)</label>
              <input
                type="number"
                value={recAmount}
                onChange={e => setRecAmount(e.target.value)}
                placeholder="e.g. 45000"
                min="0.1"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <input
                type="text"
                value={recRemarks}
                onChange={e => setRecRemarks(e.target.value)}
                placeholder="Description details"
              />
            </div>

            <button type="submit" className="primary-btn" style={{ marginTop: '15px', width: '100%' }}>
              Collect Payout & Post Ledger
            </button>
          </form>

          {/* Payment Collection Report */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 15px 0' }}>Payment Collection Report</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt No</th>
                    <th>Dairy</th>
                    <th>Mode/Ref</th>
                    <th>Invoice No</th>
                    <th className="text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {dairyReceipts.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.date).toLocaleDateString()}</td>
                      <td><code style={{ color: '#10b981' }}>{r.voucherNo}</code></td>
                      <td>{getPartyName(r.partyId)}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{r.paymentMode.toLowerCase()}</span>
                        {r.refNo && <span style={{ fontSize: '0.75rem', opacity: 0.6, display: 'block' }}>Ref: {r.refNo}</span>}
                      </td>
                      <td><code style={{ color: '#60a5fa' }}>{r.invoiceNo}</code></td>
                      <td className="text-right font-semibold" style={{ color: '#10b981' }}>₹{r.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {dairyReceipts.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-secondary" style={{ padding: '20px' }}>
                        No receipt payouts recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: OUTSTANDING */}
      {subTab === 'OUTSTANDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Outstanding report table */}
          <div className="transaction-list glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Outstanding Accounts Statement</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Dairy Customer Name</th>
                    <th className="text-right">Invoice Amount (₹)</th>
                    <th className="text-right">Received Amount (₹)</th>
                    <th className="text-right">Pending Amount (₹)</th>
                    <th>Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody>
                  {partyOutstanding.map(row => {
                    const statusBadge = row.pendingAmount <= 0 ? (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '4px' }}>Paid</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                        Outstanding
                      </span>
                    );

                    return (
                      <tr key={row.partyId}>
                        <td><strong>{row.name}</strong></td>
                        <td className="text-right">₹{row.invoiceAmount.toLocaleString()}</td>
                        <td className="text-right">₹{row.receivedAmount.toLocaleString()}</td>
                        <td className="text-right font-semibold" style={{ color: row.pendingAmount > 0 ? '#ef4444' : '#10b981' }}>
                          ₹{row.pendingAmount.toLocaleString()}
                        </td>
                        <td>{statusBadge}</td>
                      </tr>
                    );
                  })}
                  {partyOutstanding.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-secondary" style={{ padding: '20px' }}>
                        No dairy plants registered in customer parties list.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Due Date Overdue table */}
          <div className="transaction-list glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Invoice Due / Overdue Report</h3>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Voucher No</th>
                    <th>Invoice Date</th>
                    <th>Dairy Plant</th>
                    <th className="text-right">Total Amount (₹)</th>
                    <th className="text-right">Pending Payout (₹)</th>
                    <th>Age</th>
                    <th>Overdue Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerParties.flatMap(p => {
                    const partyDispatches = [
                      ...dairyDispatches.filter(d => d.partyId === p.id),
                      ...localSalesList.filter(s => s.partyId === p.id && s.paymentType === 'CREDIT')
                    ];
                    const invoiceReceipts = {};
                    dairyReceipts.forEach(r => {
                      if (r.partyId === p.id && r.invoiceNo) {
                        invoiceReceipts[r.invoiceNo] = (invoiceReceipts[r.invoiceNo] || 0) + r.amount;
                      }
                    });

                    return partyDispatches.map(disp => {
                      const settled = invoiceReceipts[disp.voucherNo] || 0;
                      const pending = disp.amount - settled;
                      const docDate = new Date(disp.date);
                      const ageInDays = Math.ceil(Math.abs(new Date() - docDate) / (1000 * 60 * 60 * 24));
                      
                      let status = 'Pending';
                      if (pending <= 0) status = 'Paid';
                      else if (settled > 0) status = 'Partially Paid';
                      if (status !== 'Paid' && ageInDays > 30) status = 'Overdue';

                      return { ...disp, pending, status, ageInDays, partyName: p.name };
                    });
                  })
                  .filter(inv => inv.pending > 0)
                  .sort((a, b) => b.ageInDays - a.ageInDays)
                  .map(inv => (
                    <tr key={inv.id}>
                      <td><code style={{ color: '#60a5fa' }}>{inv.voucherNo}</code></td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td>{inv.partyName}</td>
                      <td className="text-right">₹{inv.amount.toLocaleString()}</td>
                      <td className="text-right font-semibold" style={{ color: '#ef4444' }}>₹{inv.pending.toLocaleString()}</td>
                      <td>{inv.ageInDays} Days</td>
                      <td>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: inv.status === 'Overdue' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: inv.status === 'Overdue' ? '#ef4444' : '#f59e0b',
                          fontWeight: '600'
                        }}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB: MONTHLY_REPORT */}
      {subTab === 'MONTHLY_REPORT' && (
        <div className="transaction-list glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Monthly Dairy Income & Payout Statement</h3>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="text-right">Dairy Revenue (₹)</th>
                  <th className="text-right">Local Qty (Liters)</th>
                  <th className="text-right">Local Revenue (₹)</th>
                  <th className="text-right">Total Revenue (₹)</th>
                  <th className="text-right">Total Collection Settled (₹)</th>
                  <th className="text-right">Outstanding Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStatement.map(row => (
                  <tr key={row.month}>
                    <td><strong>{row.month}</strong></td>
                    <td className="text-right font-semibold">₹{row.revenue.toLocaleString()}</td>
                    <td className="text-right">{row.localLiters.toLocaleString()} L</td>
                    <td className="text-right font-semibold">₹{row.localRevenue.toLocaleString()}</td>
                    <td className="text-right font-semibold" style={{ color: '#60a5fa' }}>₹{(row.revenue + row.localRevenue).toLocaleString()}</td>
                    <td className="text-right" style={{ color: '#10b981', fontWeight: '500' }}>₹{row.collected.toLocaleString()}</td>
                    <td className="text-right font-semibold" style={{ color: row.outstanding > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{row.outstanding.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {monthlyStatement.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-secondary" style={{ padding: '20px' }}>
                      No statement logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default MilkSales;
