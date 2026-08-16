import React from 'react';
import { useERP } from '../hooks/useERP.js';

const DashboardOverview = () => {
  const { summary, loansSummary } = useERP();

  const cards = [
    { label: 'Income', value: summary.totalIncome, className: 'positive', icon: '↓' },
    { label: 'Expenses', value: summary.totalExpense, className: 'negative', icon: '↑' },
    { label: 'Profit / Loss', value: summary.netProfit, className: summary.netProfit >= 0 ? 'positive' : 'negative', icon: '≡' },
    { label: 'Receivables (AR)', value: summary.totalAR, className: 'ar', icon: '📥' },
    { label: 'Payables (AP)', value: summary.totalAP, className: 'ap', icon: '📤' },
    { label: 'Active Loans', value: loansSummary.totalActiveLoans || 0, className: 'ar', icon: '🏦', isRawNumber: true },
    { label: 'Loan Outstanding', value: loansSummary.totalOutstanding || 0, className: 'negative', icon: '⏳' },
    { label: 'Loan Interest Due', value: loansSummary.totalOutstandingInterest || 0, className: 'ap', icon: '💡' },
  ];

  return (
    <div className="cards">
      {cards.map(card => (
        <div key={card.label} className="card">
          <div className="card-header-row">
            <h3>{card.label}</h3>
            <span className="card-icon">{card.icon}</span>
          </div>
          <p className={`amount ${card.className}`}>
            {card.isRawNumber ? card.value : `₹${Math.abs(card.value).toLocaleString()}`}
          </p>
        </div>
      ))}
    </div>
  );
};

export default DashboardOverview;
