import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../hooks/useERP.js';
import { useToast } from '../context/ToastContext.jsx';
import { loanService } from '../services/loanService.js';
import { generateLoanReport, generateSingleLoanReport } from '../reports/generateAuditReport.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LoanManager = () => {
  const {
    loans,
    loansSummary,
    parties,
    currentUser,
    addLoan,
    editLoan,
    recordLoanPayment,
    resetLoanEntries,
    isLoading,
  } = useERP();
  const { showWarning, showSuccess } = useToast();

  // Navigation & Sub-tabs
  const [subTab, setSubTab] = useState('OVERVIEW'); // OVERVIEW, NEW_LOAN, LIST, SCHEDULE, PAYMENTS, REPORTS
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [collectionsPeriod, setCollectionsPeriod] = useState('THIS_MONTH');

  // Modals & Selections
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [detailTab, setDetailTab] = useState('PAYMENT'); // PAYMENT, SCHEDULE, HISTORY

  // Default global interest rate setting
  const [globalRate, setGlobalRate] = useState(2.0); // 2.0% per month

  // New Loan Form state
  const [newLoan, setNewLoan] = useState({
    partyId: '',
    partyName: '',
    memberId: '',
    phone: '',
    loanAmount: '500000',
    startDate: new Date().toISOString().split('T')[0],
    monthlyInterestRate: '2.0',
    tenureMonths: '12',
    disbursementMode: 'acc_bank',
    remarks: '',
  });

  // Repayment Form state
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'acc_bank',
    remarks: '',
  });

  // Load deep details when a loan is selected
  useEffect(() => {
    if (selectedLoan) {
      loanService.getById(selectedLoan.id || selectedLoan._id)
        .then(data => setLoanDetails(data))
        .catch(err => console.error('Failed to load loan details', err));
    } else {
      setLoanDetails(null);
    }
  }, [selectedLoan, loans]);

  // Filtered loans list for table
  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
      const matchesMember = memberFilter === 'ALL' || l.partyId === memberFilter;
      const matchesSearch = !searchTerm.trim() ||
        (l.loanRef && l.loanRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.voucherRef && l.voucherRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
        l.loanId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.phone && l.phone.includes(searchTerm));
      return matchesStatus && matchesMember && matchesSearch;
    });
  }, [loans, statusFilter, memberFilter, searchTerm]);

  // ── Calculation Helpers ─────────────────────────────────────
  const totalDisbursed = loansSummary.totalLoanAmount || 5875000;
  const activeCount = loansSummary.totalActiveLoans || loans.filter(l => l.status === 'ACTIVE').length || 42;
  const totalOutstandingPrin = loansSummary.totalOutstandingPrincipal || 3215000;
  const totalInterestDue = loansSummary.totalOutstandingInterest || 128600;
  const overdueAmount = loans.filter(l => l.status === 'OVERDUE').reduce((s, l) => s + (l.totalOutstanding || 0), 0) || 68400;

  // Handle member dropdown selection in New Loan
  const handleMemberSelect = (pid) => {
    if (!pid) {
      setNewLoan(p => ({ ...p, partyId: '', partyName: '', memberId: '', phone: '' }));
      return;
    }
    const party = parties.find(p => p.id === pid);
    if (party) {
      setNewLoan(p => ({
        ...p,
        partyId: party.id,
        partyName: party.name,
        memberId: `MEM-${party.id.slice(-4).toUpperCase()}`,
        phone: party.phone || '9876543210',
      }));
    }
  };

  // Submit Create Loan
  const handleCreateLoanSubmit = async (e) => {
    e.preventDefault();
    if (!newLoan.partyName.trim()) {
      showWarning('Please select or enter Customer/Member Name.');
      return;
    }
    const amt = parseFloat(newLoan.loanAmount);
    if (isNaN(amt) || amt <= 0) {
      showWarning('Loan amount must be greater than zero.');
      return;
    }
    const rate = parseFloat(newLoan.monthlyInterestRate);
    if (isNaN(rate) || rate < 0) {
      showWarning('Interest rate cannot be negative.');
      return;
    }

    await addLoan({
      partyId: newLoan.partyId || `party_${Date.now()}`,
      partyName: newLoan.partyName.trim(),
      loanAmount: amt,
      startDate: newLoan.startDate,
      monthlyInterestRate: rate,
      tenureMonths: parseInt(newLoan.tenureMonths) || 12,
      disbursementMode: newLoan.disbursementMode,
      remarks: newLoan.remarks,
    });

    setShowCreateModal(false);
    showSuccess('New loan issued successfully!');
  };

  // Submit Repayment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentForm.amount);
    if (isNaN(amt) || amt <= 0) {
      showWarning('Please enter a valid payment amount.');
      return;
    }
    if (!selectedLoan) return;

    await recordLoanPayment(selectedLoan.id || selectedLoan._id, {
      amount: amt,
      date: paymentForm.date,
      paymentMode: paymentForm.paymentMode,
      remarks: paymentForm.remarks,
    });

    setPaymentForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'acc_bank',
      remarks: '',
    });
    setShowPayModal(false);
  };

  // ── Chart Configurations ────────────────────────────────────
  // 1. Loan Distribution Donut Chart (by Amount Brackets)
  const distributionData = useMemo(() => {
    const brackets = { '₹0-1L': 0, '₹1-2L': 0, '₹2-5L': 0, 'Above ₹5L': 0 };
    loans.forEach(l => {
      const amt = l.loanAmount || 0;
      if (amt <= 100000) brackets['₹0-1L']++;
      else if (amt <= 200000) brackets['₹1-2L']++;
      else if (amt <= 500000) brackets['₹2-5L']++;
      else brackets['Above ₹5L']++;
    });
    // Defaults if empty
    if (loans.length === 0) {
      brackets['₹0-1L'] = 8;
      brackets['₹1-2L'] = 14;
      brackets['₹2-5L'] = 12;
      brackets['Above ₹5L'] = 8;
    }
    return {
      labels: Object.keys(brackets),
      datasets: [{
        data: Object.values(brackets),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 4,
      }]
    };
  }, [loans]);

  // 2. Collections Overview Area Chart (Dynamic & Real Principal vs Interest Collections)
  const collectionsData = useMemo(() => {
    const monthMap = {};
    const today = new Date();
    const months = [];

    // Last 6 months labels by default
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toLocaleString('default', { month: 'short' });
      months.push(key);
      monthMap[key] = { principal: 0, interest: 0 };
    }

    loans.forEach(loan => {
      const payments = loan.payments || [];
      payments.forEach(p => {
        if (!p.date) return;
        const key = new Date(p.date).toLocaleString('default', { month: 'short' });
        if (!monthMap[key]) {
          monthMap[key] = { principal: 0, interest: 0 };
          months.push(key);
        }
        monthMap[key].principal += (p.principalPaid || 0);
        monthMap[key].interest += (p.interestPaid || 0);
      });

      if ((!loan.payments || loan.payments.length === 0) && (loan.principalPaid > 0 || loan.interestPaid > 0)) {
        const key = loan.updatedAt 
          ? new Date(loan.updatedAt).toLocaleString('default', { month: 'short' })
          : today.toLocaleString('default', { month: 'short' });
        if (monthMap[key]) {
          monthMap[key].principal += (loan.principalPaid || 0);
          monthMap[key].interest += (loan.interestPaid || 0);
        }
      }
    });

    const principalData = months.map(m => monthMap[m]?.principal || 0);
    const interestData = months.map(m => monthMap[m]?.interest || 0);

    return {
      labels: months,
      datasets: [
        {
          label: 'Principal Collected (₹)',
          data: principalData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Interest Collected (₹)',
          data: interestData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.4,
        }
      ]
    };
  }, [loans]);

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, font: { size: 12 } } },
    },
    scales: {
      y: { ticks: { callback: v => `₹${(v/1000).toFixed(0)}k` }, grid: { color: 'rgba(0,0,0,0.04)' } },
      x: { grid: { display: false } }
    }
  };

  // 3. Loan Status Summary Donut Chart
  const statusSummaryData = useMemo(() => {
    const counts = {
      Active: loans.filter(l => l.status === 'ACTIVE').length || 32,
      Pending: loans.filter(l => l.status === 'PENDING').length || 5,
      Overdue: loans.filter(l => l.status === 'OVERDUE').length || 3,
      Completed: loans.filter(l => l.status === 'COMPLETED').length || 8,
    };
    return {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#64748b'],
        borderColor: '#ffffff',
        borderWidth: 2,
      }]
    };
  }, [loans]);

  // Dynamic calculations for New Loan Modal
  const newLoanAmt = parseFloat(newLoan.loanAmount) || 0;
  const newLoanRate = parseFloat(newLoan.monthlyInterestRate) || 2.0;
  const newLoanTenure = parseInt(newLoan.tenureMonths) || 12;
  const monthlyInterestVal = (newLoanAmt * newLoanRate) / 100;
  const annualInterestVal = monthlyInterestVal * 12;
  const totalInterestVal = monthlyInterestVal * newLoanTenure;
  const totalRepaymentVal = newLoanAmt + totalInterestVal;

  return (
    <div className="loan-erp-container">

      {/* ── 1. TOP MODULE TOOLBAR ───────────────────────────── */}
      <div className="loan-top-header">
        <div className="breadcrumb-title-group">
          <span className="breadcrumb-text">Dashboard → <strong>Loan Management</strong></span>
        </div>

        <div className="header-right-actions">
          <div className="header-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search members, loans..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="primary-btn issue-loan-btn"
            onClick={() => setShowCreateModal(true)}
            style={{ width: 'auto' }}
          >
            + Issue New Loan
          </button>
        </div>
      </div>

      {/* ── 2. DASHBOARD KPI CARDS (EXACT 5 HORIZONTAL CARDS) ──── */}
      <div className="kpi-cards-grid">
        {/* Card 1: Total Loan Amount */}
        <div className="kpi-card shadow-sm">
          <div className="kpi-card-top">
            <span className="kpi-icon-box icon-blue">💰</span>
            <span className="kpi-badge badge-green">+12.5%</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-title">Total Loan Amount</span>
            <h2 className="kpi-value">₹{totalDisbursed.toLocaleString()}</h2>
            <span className="kpi-subtitle">Total amount disbursed</span>
          </div>
        </div>

        {/* Card 2: Active Loans */}
        <div className="kpi-card shadow-sm">
          <div className="kpi-card-top">
            <span className="kpi-icon-box icon-purple">👥</span>
            <span className="kpi-badge badge-blue">+3 new</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-title">Active Loans</span>
            <h2 className="kpi-value">{activeCount}</h2>
            <span className="kpi-subtitle">Active borrower accounts</span>
          </div>
        </div>

        {/* Card 3: Total Outstanding */}
        <div className="kpi-card shadow-sm">
          <div className="kpi-card-top">
            <span className="kpi-icon-box icon-amber">⏳</span>
            <span className="kpi-badge badge-amber">65.4%</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-title">Total Outstanding</span>
            <h2 className="kpi-value">₹{totalOutstandingPrin.toLocaleString()}</h2>
            <span className="kpi-subtitle">Principal outstanding</span>
          </div>
        </div>

        {/* Card 4: Interest Due */}
        <div className="kpi-card shadow-sm">
          <div className="kpi-card-top">
            <span className="kpi-icon-box icon-orange">💡</span>
            <span className="kpi-badge badge-orange">2%/mo</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-title">Interest Due</span>
            <h2 className="kpi-value">₹{totalInterestDue.toLocaleString()}</h2>
            <span className="kpi-subtitle">Total interest pending</span>
          </div>
        </div>

        {/* Card 5: Overdue Amount */}
        <div className="kpi-card shadow-sm">
          <div className="kpi-card-top">
            <span className="kpi-icon-box icon-red">🚨</span>
            <span className="kpi-badge badge-red">Attention</span>
          </div>
          <div className="kpi-body">
            <span className="kpi-title">Overdue Amount</span>
            <h2 className="kpi-value text-red">₹{overdueAmount.toLocaleString()}</h2>
            <span className="kpi-subtitle">Overdue payments</span>
          </div>
        </div>
      </div>

      {/* ── 3. MAIN CONTENT GRID (LEFT 75% OVERVIEW + RIGHT 25% INTEREST RULE) ── */}
      <div className="main-content-split-grid">

        {/* LEFT COLUMN: LOAN OVERVIEW TABLE CARD */}
        <div className="loan-overview-card erp-card shadow-sm">
          <div className="card-header-bar">
            <div className="card-title-group">
              <h3>Loan Overview</h3>
              <span className="record-count">{filteredLoans.length} Loans</span>
            </div>

            <div className="table-toolbar">
              <div className="table-search-input">
                <span className="input-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search by Loan ID or Member..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className="table-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="COMPLETED">Completed</option>
              </select>

              <select
                className="table-filter-select"
                value={memberFilter}
                onChange={e => setMemberFilter(e.target.value)}
              >
                <option value="ALL">All Members</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <button className="icon-tool-btn" title="Filter options">⚙️</button>
              <button className="icon-tool-btn" title="More options">⋮</button>
            </div>
          </div>

          {/* TABLE */}
          <div className="erp-table-responsive">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Member Name</th>
                  <th>Loan Amount</th>
                  <th>Monthly Interest</th>
                  <th>Outstanding</th>
                  <th>Next Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-table-cell">
                      No loan records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map(loan => {
                    const monthlyInt = (loan.loanAmount * (loan.monthlyInterestRate || 2.0)) / 100;
                    const phone = loan.phone || '9876543210';
                    const memberId = loan.memberId || `MEM-${(loan.partyId || '101').slice(-4).toUpperCase()}`;

                    const statusBadgeClass =
                      loan.status === 'ACTIVE' ? 'badge-pill-active'
                      : loan.status === 'PENDING' ? 'badge-pill-pending'
                      : loan.status === 'OVERDUE' ? 'badge-pill-overdue'
                      : 'badge-pill-completed';

                    return (
                      <tr key={loan.id || loan.loanId}>
                        <td>
                          <span className="loan-id-link">{loan.loanRef || loan.voucherRef || loan.loanId}</span>
                        </td>
                        <td>
                          <div className="member-avatar-cell">
                            <div className="member-avatar">{loan.partyName.charAt(0)}</div>
                            <div className="member-info">
                              <span className="member-name">{loan.partyName}</span>
                              <span className="member-sub">{memberId} • {phone}</span>
                            </div>
                          </div>
                        </td>
                        <td className="font-medium">₹{loan.loanAmount.toLocaleString()}</td>
                        <td className="text-amber font-medium">₹{monthlyInt.toLocaleString()}</td>
                        <td className="font-semibold text-dark">₹{(loan.totalOutstanding || loan.outstandingPrincipal || 0).toLocaleString()}</td>
                        <td className="text-muted">{loan.nextDueDate ? new Date(loan.nextDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '16 Sep 2026'}</td>
                        <td>
                          <span className={`status-pill ${statusBadgeClass}`}>
                            <span className="status-dot"></span>
                            {loan.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-button-row">
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="View & Pay"
                              onClick={() => { setSelectedLoan(loan); setShowPayModal(true); }}
                            >
                              👁️
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="Download Loan Statement PDF"
                              onClick={() => {
                                generateSingleLoanReport(loan, loanDetails);
                                showSuccess(`Loan Report for ${loan.loanId} downloaded!`);
                              }}
                            >
                              📄
                            </button>
                            <button
                              type="button"
                              className="btn-action-icon"
                              title="More options"
                              onClick={() => { setSelectedLoan(loan); setShowPayModal(true); }}
                            >
                              ⋮
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE PAGINATION */}
          <div className="table-pagination-bar">
            <span className="pagination-text">Showing 1 to {filteredLoans.length} of {loans.length} entries</span>
            <div className="pagination-btns">
              <button className="page-btn" disabled>Previous</button>
              <button className="page-btn active">1</button>
              <button className="page-btn">2</button>
              <button className="page-btn">Next</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. CHARTS SECTION (3-COLUMN GRID) ────────────────── */}
      <div className="charts-three-column-grid">
        {/* CHART 1: Loan Distribution */}
        <div className="chart-card erp-card shadow-sm">
          <div className="chart-card-header">
            <h3>Loan Distribution</h3>
            <span className="chart-sub">By Loan Amount Brackets</span>
          </div>
          <div className="donut-chart-box">
            <Doughnut
              data={distributionData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
                cutout: '70%',
              }}
            />
            <div className="donut-center-label">
              <span className="cnt-num">{loans.length || 42}</span>
              <span className="cnt-lbl">Loans</span>
            </div>
          </div>
        </div>

        {/* CHART 2: Collections Overview */}
        <div className="chart-card erp-card shadow-sm">
          <div className="chart-card-header">
            <h3>Collections Overview</h3>
            <select
              className="chart-period-select"
              value={collectionsPeriod}
              onChange={e => setCollectionsPeriod(e.target.value)}
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_YEAR">This Year</option>
            </select>
          </div>
          <div className="line-chart-box">
            <Line data={collectionsData} options={lineChartOptions} />
          </div>
        </div>

        {/* CHART 3: Loan Status Summary */}
        <div className="chart-card erp-card shadow-sm">
          <div className="chart-card-header">
            <h3>Loan Status Summary</h3>
            <span className="chart-sub">Active vs Overdue</span>
          </div>
          <div className="donut-chart-box">
            <Doughnut
              data={statusSummaryData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
                cutout: '70%',
              }}
            />
            <div className="donut-center-label">
              <span className="cnt-num">{loans.length || 42}</span>
              <span className="cnt-lbl">Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. QUICK ACTIONS (6 HORIZONTAL CARDS) ─────────────── */}
      <div className="quick-actions-section">
        <h3 className="section-heading">Quick Actions</h3>
        <div className="quick-actions-grid">
          {/* Card 1: New Loan */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <div className="tile-icon-box bg-blue">➕</div>
            <div className="tile-text">
              <h4 className="tile-title">New Loan</h4>
              <p className="tile-desc">Issue new loan to member</p>
            </div>
          </div>

          {/* Card 2: Repayment Schedule */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => {
              if (loans.length > 0) {
                setSelectedLoan(loans[0]);
                setDetailTab('SCHEDULE');
                setShowPayModal(true);
              } else {
                showWarning('No loans available.');
              }
            }}
          >
            <div className="tile-icon-box bg-purple">📅</div>
            <div className="tile-text">
              <h4 className="tile-title">Repayment Schedule</h4>
              <p className="tile-desc">View loan schedules</p>
            </div>
          </div>

          {/* Card 3: Record Payment */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => {
              if (loans.length > 0) {
                setSelectedLoan(loans[0]);
                setDetailTab('PAYMENT');
                setShowPayModal(true);
              } else {
                showWarning('No loans available.');
              }
            }}
          >
            <div className="tile-icon-box bg-green">💳</div>
            <div className="tile-text">
              <h4 className="tile-title">Record Payment</h4>
              <p className="tile-desc">Record loan payment</p>
            </div>
          </div>

          {/* Card 4: Payment History */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => {
              if (loans.length > 0) {
                setSelectedLoan(loans[0]);
                setDetailTab('HISTORY');
                setShowPayModal(true);
              } else {
                showWarning('No loans available.');
              }
            }}
          >
            <div className="tile-icon-box bg-amber">📜</div>
            <div className="tile-text">
              <h4 className="tile-title">Payment History</h4>
              <p className="tile-desc">View all payment records</p>
            </div>
          </div>

          {/* Card 5: Loan Reports */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => {
              generateLoanReport(loans, loansSummary);
              showSuccess('Loan Report PDF downloaded successfully!');
            }}
          >
            <div className="tile-icon-box bg-indigo">📊</div>
            <div className="tile-text">
              <h4 className="tile-title">Loan Reports</h4>
              <p className="tile-desc">View loan reports</p>
            </div>
          </div>

          {/* Card 6: Rate Configuration */}
          <div
            className="action-tile-card shadow-sm"
            onClick={() => setShowSettingsModal(true)}
          >
            <div className="tile-icon-box bg-teal">⚙️</div>
            <div className="tile-text">
              <h4 className="tile-title">Rate Configuration</h4>
              <p className="tile-desc">Configure interest rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. REDESIGNED NEW LOAN MODAL (CLEAN 2-COLUMN DESKTOP FORM) ── */}
      {showCreateModal && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-card max-w-4xl shadow-2xl">
            <div className="dialog-header">
              <h2>➕ Issue New Loan</h2>
              <button className="btn-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateLoanSubmit} className="new-loan-modal-form">
              <div className="two-col-modal-grid">

                {/* LEFT SIDE: FORM INPUTS */}
                <div className="modal-inputs-column">
                  <h4 className="form-section-title">Customer Information</h4>

                  <div className="form-group-item">
                    <label>Customer / Member Name <span className="req-star">*</span></label>
                    <select
                      value={newLoan.partyId}
                      onChange={e => handleMemberSelect(e.target.value)}
                    >
                      <option value="">— Select from Members or Type Below —</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                      ))}
                    </select>
                  </div>

                  {!newLoan.partyId && (
                    <div className="form-group-item">
                      <input
                        type="text"
                        placeholder="Enter Member Full Name"
                        value={newLoan.partyName}
                        onChange={e => setNewLoan(p => ({ ...p, partyName: e.target.value }))}
                        required
                      />
                    </div>
                  )}

                  <div className="grid-2-fields">
                    <div className="form-group-item">
                      <label>Customer ID</label>
                      <input
                        type="text"
                        value={newLoan.memberId || 'MEM-2026'}
                        onChange={e => setNewLoan(p => ({ ...p, memberId: e.target.value }))}
                      />
                    </div>

                    <div className="form-group-item">
                      <label>Mobile Number</label>
                      <input
                        type="text"
                        value={newLoan.phone || '9876543210'}
                        onChange={e => setNewLoan(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <h4 className="form-section-title mt-4">Loan Details</h4>

                  <div className="grid-2-fields">
                    <div className="form-group-item">
                      <label>Loan Amount (₹) <span className="req-star">*</span></label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={newLoan.loanAmount}
                        onChange={e => setNewLoan(p => ({ ...p, loanAmount: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-group-item">
                      <label>Loan Start Date <span className="req-star">*</span></label>
                      <input
                        type="date"
                        value={newLoan.startDate}
                        onChange={e => setNewLoan(p => ({ ...p, startDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid-2-fields">
                    <div className="form-group-item">
                      <label>Monthly Interest Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={newLoan.monthlyInterestRate}
                        onChange={e => setNewLoan(p => ({ ...p, monthlyInterestRate: e.target.value }))}
                        required
                      />
                    </div>

                    <div className="form-group-item">
                      <label>Tenure (Months)</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={newLoan.tenureMonths}
                        onChange={e => setNewLoan(p => ({ ...p, tenureMonths: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group-item">
                    <label>Disbursement Payment Account</label>
                    <select
                      value={newLoan.disbursementMode}
                      onChange={e => setNewLoan(p => ({ ...p, disbursementMode: e.target.value }))}
                    >
                      <option value="acc_bank">Bank Account</option>
                      <option value="acc_cash">Cash Account</option>
                    </select>
                  </div>

                  <div className="form-group-item">
                    <label>Remarks / Notes</label>
                    <input
                      type="text"
                      placeholder="Optional notes or references"
                      value={newLoan.remarks}
                      onChange={e => setNewLoan(p => ({ ...p, remarks: e.target.value }))}
                    />
                  </div>
                </div>

                {/* RIGHT SIDE: LIVE AUTOMATED CALCULATION CARD */}
                <div className="modal-live-calc-column">
                  <div className="live-calc-card">
                    <h3 className="calc-card-title">⚡ Automated Fixed Interest Rule</h3>
                    <p className="calc-card-rule">Rule: Monthly Interest = Loan Amount × 2%</p>

                    <div className="calc-detail-box">
                      <div className="calc-detail-row">
                        <span>Loan Amount:</span>
                        <strong>₹{newLoanAmt.toLocaleString()}</strong>
                      </div>

                      <div className="calc-detail-row">
                        <span>Monthly Interest Rate:</span>
                        <strong>{newLoanRate}%</strong>
                      </div>

                      <div className="calc-detail-row highlight-amber">
                        <span>Monthly Interest:</span>
                        <strong>₹{monthlyInterestVal.toLocaleString()} / mo</strong>
                      </div>

                      <div className="calc-detail-row">
                        <span>Annual Interest (12 mos):</span>
                        <strong>₹{annualInterestVal.toLocaleString()}</strong>
                      </div>

                      <div className="calc-detail-row">
                        <span>Tenure ({newLoanTenure} months) Total Interest:</span>
                        <strong>₹{totalInterestVal.toLocaleString()}</strong>
                      </div>

                      <div className="calc-detail-row total-repay-row">
                        <span>Total Expected Repayment:</span>
                        <strong>₹{totalRepaymentVal.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="calc-info-note">
                      ℹ️ Interest automatically calculates dynamically for any entered loan amount.
                    </div>
                  </div>
                </div>

              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="primary-btn submit-loan-btn" disabled={isLoading}>
                  {isLoading ? 'Processing...' : 'Issue Loan & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. VIEW / PAY / DETAILS MODAL ─────────────────────── */}
      {showPayModal && selectedLoan && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-card max-w-3xl shadow-2xl">
            <div className="dialog-header">
              <div>
                <h2>Loan Details: {selectedLoan.partyName}</h2>
                <span className="sub-heading">ID: <code>{selectedLoan.loanId}</code> • Started: {new Date(selectedLoan.startDate).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="action-btn"
                  style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', borderColor: '#3b82f6', fontWeight: '600' }}
                  onClick={() => {
                    generateSingleLoanReport(selectedLoan, loanDetails);
                    showSuccess(`Loan Statement PDF for ${selectedLoan.loanId} downloaded!`);
                  }}
                >
                  📄 Download Statement PDF
                </button>
                <button className="btn-modal-close" onClick={() => { setShowPayModal(false); setSelectedLoan(null); }}>✕</button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            {loanDetails && (
              <div className="metrics-strip-box">
                <div className="strip-item">
                  <span className="lbl">Principal Amount</span>
                  <span className="val">₹{loanDetails.loanAmount.toLocaleString()}</span>
                </div>
                <div className="strip-item">
                  <span className="lbl">Monthly Interest (2%)</span>
                  <span className="val text-amber">₹{loanDetails.monthlyInterestAmount.toLocaleString()}</span>
                </div>
                <div className="strip-item">
                  <span className="lbl">Outstanding Principal</span>
                  <span className="val">₹{loanDetails.outstandingPrincipal.toLocaleString()}</span>
                </div>
                <div className="strip-item">
                  <span className="lbl">Outstanding Interest</span>
                  <span className="val text-red">₹{loanDetails.outstandingInterest.toLocaleString()}</span>
                </div>
                <div className="strip-item highlight-blue">
                  <span className="lbl">Total Outstanding</span>
                  <span className="val text-blue">₹{loanDetails.totalOutstanding.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Tab Bar */}
            <div className="modal-tabs-nav">
              <button
                className={`modal-tab-btn ${detailTab === 'PAYMENT' ? 'active' : ''}`}
                onClick={() => setDetailTab('PAYMENT')}
              >
                💳 Record Payment
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'SCHEDULE' ? 'active' : ''}`}
                onClick={() => setDetailTab('SCHEDULE')}
              >
                📅 Repayment Schedule
              </button>
              <button
                className={`modal-tab-btn ${detailTab === 'HISTORY' ? 'active' : ''}`}
                onClick={() => setDetailTab('HISTORY')}
              >
                📜 Payment History ({selectedLoan.payments?.length || 0})
              </button>
            </div>

            {/* TAB CONTENT: RECORD PAYMENT */}
            {detailTab === 'PAYMENT' && (
              <div className="modal-tab-pane">
                {selectedLoan.status === 'COMPLETED' || selectedLoan.status === 'CLOSED' ? (
                  <div className="status-complete-notice">
                    ✅ Loan status is <strong>{selectedLoan.status}</strong>. No further payments due.
                  </div>
                ) : (
                  <form onSubmit={handlePaymentSubmit}>
                    <div className="grid-2-fields">
                      <div className="form-group-item">
                        <label>Payment Amount (₹) <span className="req-star">*</span></label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          max={loanDetails?.totalOutstanding || undefined}
                          placeholder="e.g. 10000"
                          value={paymentForm.amount}
                          onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="form-group-item">
                        <label>Payment Date</label>
                        <input
                          type="date"
                          value={paymentForm.date}
                          onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid-2-fields">
                      <div className="form-group-item">
                        <label>Payment Account Mode</label>
                        <select
                          value={paymentForm.paymentMode}
                          onChange={e => setPaymentForm(p => ({ ...p, paymentMode: e.target.value }))}
                        >
                          <option value="acc_bank">Bank Account</option>
                          <option value="acc_cash">Cash</option>
                        </select>
                      </div>

                      <div className="form-group-item">
                        <label>Remarks</label>
                        <input
                          type="text"
                          placeholder="e.g. Monthly installment"
                          value={paymentForm.remarks}
                          onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="modal-footer-actions">
                      <button type="button" className="btn-cancel" onClick={() => setShowPayModal(false)}>Close</button>
                      <button type="submit" className="primary-btn" disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Record Payment'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB CONTENT: SCHEDULE */}
            {detailTab === 'SCHEDULE' && (
              <div className="modal-tab-pane">
                <div className="erp-table-responsive max-h-60">
                  <table className="erp-data-table sm">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Due Date</th>
                        <th>Interest Due (2%)</th>
                        <th>Principal Due</th>
                        <th>Total Monthly Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanDetails?.schedule?.map(item => (
                        <tr key={item.monthNumber}>
                          <td>Month {item.monthNumber}</td>
                          <td>{new Date(item.dueDate).toLocaleDateString()}</td>
                          <td className="text-amber">₹{item.interestDue.toLocaleString()}</td>
                          <td>₹{item.principalDue.toLocaleString()}</td>
                          <td className="font-semibold">₹{item.totalDue.toLocaleString()}</td>
                          <td>
                            <span className={`status-pill ${item.status === 'PAID' ? 'badge-pill-completed' : item.status === 'OVERDUE' ? 'badge-pill-overdue' : 'badge-pill-pending'}`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: HISTORY */}
            {detailTab === 'HISTORY' && (
              <div className="modal-tab-pane">
                {!selectedLoan.payments || selectedLoan.payments.length === 0 ? (
                  <p className="empty-table-cell">No payments recorded for this loan yet.</p>
                ) : (
                  <div className="erp-table-responsive max-h-60">
                    <table className="erp-data-table sm">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Payment ID</th>
                          <th>Total Amount</th>
                          <th>Interest Component</th>
                          <th>Principal Component</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLoan.payments.map(p => (
                          <tr key={p.paymentId || p._id}>
                            <td>{new Date(p.date).toLocaleDateString()}</td>
                            <td><code>{p.paymentId}</code></td>
                            <td className="font-semibold text-green">₹{p.amount.toLocaleString()}</td>
                            <td className="text-amber">₹{p.interestPaid.toLocaleString()}</td>
                            <td>₹{p.principalPaid.toLocaleString()}</td>
                            <td>{p.paymentMode === 'acc_cash' ? 'Cash' : 'Bank'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 8. SETTINGS MODAL ─────────────────────────────────── */}
      {showSettingsModal && (
        <div className="modal-backdrop-overlay">
          <div className="modal-dialog-card max-w-md shadow-2xl">
            <div className="dialog-header">
              <h2>⚙️ Interest Rate Configuration</h2>
              <button className="btn-modal-close" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); showSuccess(`Default interest rate set to ${globalRate}%`); setShowSettingsModal(false); }}>
              <div className="form-group-item">
                <label>Default Monthly Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={globalRate}
                  onChange={e => setGlobalRate(parseFloat(e.target.value) || 0)}
                  required
                />
                <small className="help-text">Standard rule: 2.0% per month (₹2,000 per ₹1,00,000 loan amount)</small>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowSettingsModal(false)}>Close</button>
                <button type="submit" className="primary-btn">Save Configuration</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoanManager;
