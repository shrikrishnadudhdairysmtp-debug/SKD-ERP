import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatINR_PDF } from '../utils/formatters';
import { computePnL, computeBalanceSheet, computeAccountLedger } from '../utils/calculations';

// ═══════════════════════════════════════════════════════════════
// Shared PDF Helpers
// ═══════════════════════════════════════════════════════════════

const BRAND_BLUE = [59, 130, 246];
const BRAND_GREEN = [16, 185, 129];
const BRAND_RED = [239, 68, 68];
const BRAND_PURPLE = [139, 92, 246];
const BRAND_AMBER = [245, 158, 11];

function addHeader(doc, title, period) {
  const pageWidth = doc.internal.pageSize.width;

  // Brand bar
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageWidth, 60, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SKD ERP', 40, 30);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 40, 48);

  // Period and date line
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.text('Period: ' + period, 40, 78);
  doc.text('Generated: ' + new Date().toLocaleDateString() + ' at ' + new Date().toLocaleTimeString(), 40, 92);

  return 105; // Return startY for content
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('SKD ERP - Page ' + i + ' of ' + pageCount, pageWidth / 2, pageHeight - 15, { align: 'center' });
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. Profit & Loss Statement
// ═══════════════════════════════════════════════════════════════

export function generatePnLReport(transactions, accounts, period, options = {}) {
  const doc = new jsPDF('p', 'pt', 'a4');
  let startY = addHeader(doc, 'Profit & Loss Statement', period);

  const pnl = computePnL(transactions, accounts);

  // Summary cards
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Summary', 40, startY);
  startY += 10;

  doc.autoTable({
    startY,
    head: [['Total Revenue', 'Total Expenses', 'Net Profit / (Loss)']],
    body: [[
      formatINR_PDF(pnl.totalRevenue),
      formatINR_PDF(pnl.totalExpenses),
      formatINR_PDF(pnl.netProfit),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, fontStyle: 'bold', halign: 'center' },
    styles: { halign: 'center', fontSize: 12, fontStyle: 'bold' },
  });

  startY = doc.lastAutoTable.finalY + 25;

  // Revenue breakdown
  const revenueRows = Object.entries(pnl.revenue).map(([accId, amt]) => {
    const acc = accounts.find(a => a.id === accId);
    return [acc?.name || accId, formatINR_PDF(amt)];
  });

  if (revenueRows.length > 0) {
    doc.autoTable({
      startY,
      head: [['Revenue Account', 'Amount']],
      body: revenueRows,
      foot: [['Total Revenue', formatINR_PDF(pnl.totalRevenue)]],
      theme: 'striped',
      headStyles: { fillColor: BRAND_GREEN },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });
    startY = doc.lastAutoTable.finalY + 20;
  }

  // Expense breakdown
  const expenseRows = Object.entries(pnl.expenses).map(([accId, amt]) => {
    const acc = accounts.find(a => a.id === accId);
    return [acc?.name || accId, formatINR_PDF(amt)];
  });

  if (expenseRows.length > 0) {
    doc.autoTable({
      startY,
      head: [['Expense Account', 'Amount']],
      body: expenseRows,
      foot: [['Total Expenses', formatINR_PDF(pnl.totalExpenses)]],
      theme: 'striped',
      headStyles: { fillColor: BRAND_RED },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });
  }

  addFooter(doc);
  if (options.returnDoc) return doc;
  doc.save('PnL_Statement_' + period.replace(/\s+/g, '_') + '.pdf');
}

// ═══════════════════════════════════════════════════════════════
// 2. Balance Sheet
// ═══════════════════════════════════════════════════════════════

export function generateBalanceSheetReport(transactions, accounts, period) {
  const doc = new jsPDF('p', 'pt', 'a4');
  let startY = addHeader(doc, 'Balance Sheet', period);

  const bs = computeBalanceSheet(transactions, accounts);

  // Assets
  const assetRows = Object.entries(bs.assets).map(([id, data]) => [data.name, data.group, formatINR_PDF(data.balance)]);

  doc.autoTable({
    startY,
    head: [['Asset Account', 'Group', 'Balance']],
    body: assetRows.length > 0 ? assetRows : [['No asset accounts', '', 'Rs. 0.00']],
    foot: [['', 'Total Assets', formatINR_PDF(bs.totalAssets)]],
    theme: 'striped',
    headStyles: { fillColor: BRAND_GREEN },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  startY = doc.lastAutoTable.finalY + 20;

  // Liabilities
  const liabilityRows = Object.entries(bs.liabilities).map(([id, data]) => [data.name, data.group, formatINR_PDF(data.balance)]);

  doc.autoTable({
    startY,
    head: [['Liability Account', 'Group', 'Balance']],
    body: liabilityRows.length > 0 ? liabilityRows : [['No liability accounts', '', 'Rs. 0.00']],
    foot: [['', 'Total Liabilities', formatINR_PDF(bs.totalLiabilities)]],
    theme: 'striped',
    headStyles: { fillColor: BRAND_RED },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  startY = doc.lastAutoTable.finalY + 20;

  // Equity
  doc.autoTable({
    startY,
    head: [['Equity', 'Amount']],
    body: [['Retained Earnings (Cumulative P&L)', formatINR_PDF(bs.equity.retainedEarnings)]],
    foot: [['Total Equity', formatINR_PDF(bs.totalEquity)]],
    theme: 'striped',
    headStyles: { fillColor: BRAND_PURPLE },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  startY = doc.lastAutoTable.finalY + 25;

  // Accounting equation check
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Assets (' + formatINR_PDF(bs.totalAssets) + ') = Liabilities (' + formatINR_PDF(bs.totalLiabilities) + ') + Equity (' + formatINR_PDF(bs.totalEquity) + ')',
    40,
    startY
  );

  addFooter(doc);
  doc.save('Balance_Sheet_' + period.replace(/\s+/g, '_') + '.pdf');
}

// ═══════════════════════════════════════════════════════════════
// 3. Party Ledger Statement
// ═══════════════════════════════════════════════════════════════

export function generatePartyLedgerReport(transactions, party, accounts, period) {
  const doc = new jsPDF('p', 'pt', 'a4');
  let startY = addHeader(doc, 'Party Ledger - ' + (party?.name || 'Party'), period);

  if (!party) {
    doc.setFontSize(12);
    doc.text('No party specified for ledger report.', 40, startY + 20);
    addFooter(doc);
    doc.save('Party_Ledger_Report.pdf');
    return;
  }

  // Party Info Box
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.text('Party Name: ' + party.name, 40, startY);
  doc.text('Account Type: ' + (party.type === 'CUSTOMER' ? 'Customer (Accounts Receivable)' : 'Vendor (Accounts Payable)'), 40, startY + 15);
  if (party.phone) doc.text('Phone: ' + party.phone, 40, startY + 30);
  if (party.email) doc.text('Email: ' + party.email, 40, startY + 45);

  startY += (party.phone || party.email) ? 65 : 35;

  // Filter transactions belonging to this party
  const partyTxns = transactions.filter(txn => {
    if (txn.partyId && txn.partyId === party.id) return true;
    if (txn.partyName && party.name && txn.partyName.toLowerCase().trim() === party.name.toLowerCase().trim()) return true;
    if (txn.party && party.name && typeof txn.party === 'string' && txn.party.toLowerCase().trim() === party.name.toLowerCase().trim()) return true;
    const linkedAccId = party.receivableAccountId || party.payableAccountId;
    if (linkedAccId && txn.entries && txn.entries.some(e => e.accountId === linkedAccId)) return true;
    return false;
  });

  // Sort by date ascending
  partyTxns.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Build ledger entries with running balance
  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const ledgerRows = partyTxns.map(txn => {
    let debit = 0;
    let credit = 0;

    if (txn.entries && txn.entries.length > 0) {
      const partyEntry = txn.entries.find(e => 
        e.accountId === party.receivableAccountId || 
        e.accountId === party.payableAccountId || 
        e.accountId === party.id || 
        e.accountId === 'acc_ar' || 
        e.accountId === 'acc_ap'
      );

      if (partyEntry) {
        debit = partyEntry.debit || 0;
        credit = partyEntry.credit || 0;
      } else {
        const amt = txn.amount || txn.entries.reduce((max, e) => Math.max(max, e.debit || 0, e.credit || 0), 0);
        if (txn.type === 'PAYMENT' || txn.type === 'EXPENSE') {
          debit = amt;
        } else {
          credit = amt;
        }
      }
    } else {
      const amt = txn.amount || 0;
      if (txn.type === 'INCOME' || txn.type === 'RECEIPT') {
        credit = amt;
      } else {
        debit = amt;
      }
    }

    totalDebit += debit;
    totalCredit += credit;

    if (party.type === 'VENDOR') {
      runningBalance += credit - debit;
    } else {
      runningBalance += debit - credit;
    }

    return [
      new Date(txn.date).toLocaleDateString(),
      txn.remarks || txn.description || 'Transaction',
      txn.category || (party.type === 'VENDOR' ? 'Vendor Transaction' : 'Customer Transaction'),
      debit > 0 ? formatINR_PDF(debit) : '-',
      credit > 0 ? formatINR_PDF(credit) : '-',
      formatINR_PDF(Math.abs(runningBalance)) + (runningBalance < 0 ? ' (Dr)' : ' (Cr)'),
    ];
  });

  if (ledgerRows.length === 0) {
    doc.setFontSize(12);
    doc.text('No transactions found for this party in the selected period.', 40, startY + 20);
  } else {
    doc.autoTable({
      startY,
      head: [['Date', 'Remarks / Details', 'Category', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
      body: ledgerRows,
      foot: [['', '', 'Totals', formatINR_PDF(totalDebit), formatINR_PDF(totalCredit), formatINR_PDF(Math.abs(runningBalance)) + (runningBalance < 0 ? ' (Dr)' : ' (Cr)')]],
      theme: 'striped',
      headStyles: { fillColor: party.type === 'VENDOR' ? BRAND_PURPLE : BRAND_AMBER },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 80 },
        3: { halign: 'right', cellWidth: 75 },
        4: { halign: 'right', cellWidth: 75 },
        5: { halign: 'right', cellWidth: 85 },
      },
    });

    startY = doc.lastAutoTable.finalY + 20;

    // Outstanding summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    const label = party.type === 'CUSTOMER' ? 'Net Outstanding Receivable' : 'Net Outstanding Payable';
    doc.text(label + ': ' + formatINR_PDF(Math.abs(runningBalance)) + (runningBalance < 0 ? ' (Dr)' : ' (Cr)'), 40, startY);
  }

  addFooter(doc);
  doc.save('Party_Ledger_' + party.name.replace(/\s+/g, '_') + '_' + period.replace(/\s+/g, '_') + '.pdf');
}

// ═══════════════════════════════════════════════════════════════
// 4. Category-wise Report
// ═══════════════════════════════════════════════════════════════

export function generateCategoryReport(transactions, period) {
  const doc = new jsPDF('p', 'pt', 'a4');
  let startY = addHeader(doc, 'Category-wise Summary', period);

  // Group by category
  const categoriesMap = {};

  transactions.forEach(txn => {
    if (txn.isDeleted) return;
    const cat = txn.category || 'General';
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = {
        name: cat,
        count: 0,
        receipts: 0,
        payments: 0,
      };
    }

    const debitEntry = txn.entries?.find(e => e.debit > 0);
    const creditEntry = txn.entries?.find(e => e.credit > 0);
    const amount = debitEntry?.debit || creditEntry?.credit || 0;

    categoriesMap[cat].count += 1;
    if (txn.type === 'RECEIPT') {
      categoriesMap[cat].receipts += amount;
    } else if (txn.type === 'PAYMENT') {
      categoriesMap[cat].payments += amount;
    }
  });

  const rows = Object.values(categoriesMap).map(c => {
    const netFlow = c.receipts - c.payments;
    return [
      c.name,
      c.count.toString(),
      c.receipts > 0 ? formatINR_PDF(c.receipts) : '-',
      c.payments > 0 ? formatINR_PDF(c.payments) : '-',
      formatINR_PDF(netFlow),
    ];
  });

  const totalCount = Object.values(categoriesMap).reduce((s, c) => s + c.count, 0);
  const totalReceipts = Object.values(categoriesMap).reduce((s, c) => s + c.receipts, 0);
  const totalPayments = Object.values(categoriesMap).reduce((s, c) => s + c.payments, 0);
  const totalNet = totalReceipts - totalPayments;

  doc.autoTable({
    startY,
    head: [['Category', 'Txn Count', 'Total Receipts', 'Total Payments', 'Net Flow']],
    body: rows,
    foot: [['Totals', totalCount.toString(), formatINR_PDF(totalReceipts), formatINR_PDF(totalPayments), formatINR_PDF(totalNet)]],
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 70 },
      2: { halign: 'right', cellWidth: 100 },
      3: { halign: 'right', cellWidth: 100 },
      4: { halign: 'right', cellWidth: 100 },
    },
  });

  addFooter(doc);
  doc.save('Category_Wise_Report_' + period.replace(/\s+/g, '_') + '.pdf');
}

// ═══════════════════════════════════════════════════════════════
// 5. Loan & Repayment Management Report
// ═══════════════════════════════════════════════════════════════

export function generateLoanReport(loans = [], summary = {}, period = 'All Time') {
  const doc = new jsPDF('l', 'pt', 'a4'); // Landscape for wide table columns
  let startY = addHeader(doc, 'Loan & Repayment Management Report', period);

  // Summary KPI Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Loan Portfolio Summary', 40, startY);
  startY += 12;

  const totalDisbursed = summary.totalLoanAmount || loans.reduce((s, l) => s + (l.loanAmount || 0), 0);
  const totalActive = summary.totalActiveLoans || loans.filter(l => l.status === 'ACTIVE').length;
  const totalPrinOut = summary.totalOutstandingPrincipal || loans.reduce((s, l) => s + (l.outstandingPrincipal || 0), 0);
  const totalIntOut = summary.totalOutstandingInterest || loans.reduce((s, l) => s + (l.outstandingInterest || 0), 0);
  const totalPaid = summary.totalPaid || loans.reduce((s, l) => s + (l.totalPaid || ((l.principalPaid || 0) + (l.interestPaid || 0))), 0);

  doc.autoTable({
    startY,
    head: [['Total Disbursed', 'Active Loans', 'Outstanding Principal', 'Outstanding Interest', 'Total Collections']],
    body: [[
      formatINR_PDF(totalDisbursed),
      totalActive.toString(),
      formatINR_PDF(totalPrinOut),
      formatINR_PDF(totalIntOut),
      formatINR_PDF(totalPaid),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, fontStyle: 'bold', halign: 'center' },
    styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  startY = doc.lastAutoTable.finalY + 20;

  // Loan Accounts Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Loan Accounts Registry', 40, startY);
  startY += 12;

  const rows = loans.map(l => {
    const monthlyInt = (l.loanAmount * (l.monthlyInterestRate || 2.0)) / 100;
    const paid = l.totalPaid || ((l.principalPaid || 0) + (l.interestPaid || 0));
    return [
      l.loanId || 'LN-1001',
      l.partyName || 'Customer',
      l.startDate ? new Date(l.startDate).toLocaleDateString() : 'N/A',
      formatINR_PDF(l.loanAmount || 0),
      `${l.monthlyInterestRate || 2.0}%`,
      formatINR_PDF(monthlyInt),
      formatINR_PDF(paid),
      formatINR_PDF(l.outstandingPrincipal || 0),
      formatINR_PDF(l.outstandingInterest || 0),
      formatINR_PDF(l.totalOutstanding || 0),
      l.status || 'ACTIVE',
    ];
  });

  doc.autoTable({
    startY,
    head: [['Loan ID', 'Customer / Member', 'Start Date', 'Disbursed', 'Rate', 'Monthly Int.', 'Total Paid', 'Out. Principal', 'Out. Interest', 'Total Out.', 'Status']],
    body: rows.length > 0 ? rows : [['-', 'No active loan records found', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: BRAND_BLUE, fontSize: 8 },
    styles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 120 },
      2: { cellWidth: 70 },
      3: { halign: 'right' },
      4: { halign: 'center', cellWidth: 40 },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'center', cellWidth: 60 },
    }
  });

  addFooter(doc);
  doc.save(`SKD_ERP_Loan_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// 6. Single Loan ID Wise Statement & Repayment Schedule Report
// ═══════════════════════════════════════════════════════════════

export function generateSingleLoanReport(loan, loanDetails = null) {
  if (!loan) return;
  const doc = new jsPDF('p', 'pt', 'a4');
  const loanId = loan.loanId || 'LN-1001';
  let startY = addHeader(doc, `Loan Account Statement - ${loanId}`, 'As of Today');

  const partyName = loan.partyName || 'Customer / Member';
  const startDate = loan.startDate ? new Date(loan.startDate).toLocaleDateString() : 'N/A';
  const rate = loan.monthlyInterestRate || 2.0;
  const loanAmt = loan.loanAmount || 0;
  const monthlyInt = (loanAmt * rate) / 100;
  const tenure = loan.tenureMonths || 12;

  const outPrin = loanDetails?.outstandingPrincipal ?? (loan.outstandingPrincipal || 0);
  const outInt = loanDetails?.outstandingInterest ?? (loan.outstandingInterest || 0);
  const totalOut = loanDetails?.totalOutstanding ?? (loan.totalOutstanding || (outPrin + outInt));
  const totalPaid = loan.totalPaid || ((loan.principalPaid || 0) + (loan.interestPaid || 0));

  // Loan Overview Information Card
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text('Borrower & Account Details', 40, startY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Customer / Member: ${partyName}`, 40, startY + 15);
  doc.text(`Loan ID: ${loanId}`, 40, startY + 30);
  doc.text(`Disbursement Date: ${startDate}`, 40, startY + 45);
  doc.text(`Tenure: ${tenure} Months`, 320, startY + 15);
  doc.text(`Fixed Rate: ${rate}% / month (Rs. ${(rate * 1000).toLocaleString()}/lakh)`, 320, startY + 30);
  doc.text(`Loan Status: ${loan.status || 'ACTIVE'}`, 320, startY + 45);

  startY += 65;

  // Financial Breakdown Card
  doc.autoTable({
    startY,
    head: [['Disbursed Amount', 'Monthly Interest', 'Total Paid', 'Outstanding Principal', 'Outstanding Interest', 'Total Outstanding']],
    body: [[
      formatINR_PDF(loanAmt),
      formatINR_PDF(monthlyInt),
      formatINR_PDF(totalPaid),
      formatINR_PDF(outPrin),
      formatINR_PDF(outInt),
      formatINR_PDF(totalOut),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND_BLUE, fontStyle: 'bold', halign: 'center' },
    styles: { halign: 'center', fontSize: 9, fontStyle: 'bold' },
    margin: { left: 40, right: 40 },
  });

  startY = doc.lastAutoTable.finalY + 20;

  // Monthly Repayment Schedule Table (with fallback on-the-fly calculation)
  let schedule = loanDetails?.schedule || loan.schedule || [];
  if (!schedule || schedule.length === 0) {
    schedule = [];
    const start = loan.startDate ? new Date(loan.startDate) : new Date();
    const monthlyPrin = loanAmt / (tenure || 12);
    for (let i = 1; i <= (tenure || 12); i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);
      const isPaid = (loan.principalPaid || 0) >= (monthlyPrin * i);
      schedule.push({
        monthNumber: i,
        dueDate: dueDate.toISOString(),
        interestDue: Math.round(monthlyInt),
        principalDue: Math.round(monthlyPrin),
        totalDue: Math.round(monthlyInt + monthlyPrin),
        status: isPaid ? 'PAID' : (dueDate < new Date() ? 'OVERDUE' : 'UPCOMING'),
      });
    }
  }

  if (schedule.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Monthly Repayment Schedule', 40, startY);
    startY += 12;

    const scheduleRows = schedule.map(s => [
      `Month ${s.monthNumber}`,
      new Date(s.dueDate).toLocaleDateString(),
      formatINR_PDF(s.interestDue),
      formatINR_PDF(s.principalDue),
      formatINR_PDF(s.totalDue),
      s.status,
    ]);

    doc.autoTable({
      startY,
      head: [['Installment', 'Due Date', 'Interest (2%)', 'Principal Due', 'Total Monthly Installment', 'Status']],
      body: scheduleRows,
      theme: 'striped',
      headStyles: { fillColor: BRAND_AMBER, fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 80 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center', cellWidth: 70 },
      }
    });

    startY = doc.lastAutoTable.finalY + 20;
  }

  // Payment Records Registry Table
  const payments = loanDetails?.payments || loan.payments || [];
  if (payments.length > 0) {
    if (startY > doc.internal.pageSize.height - 120) {
      doc.addPage();
      startY = 40;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Payment History Registry', 40, startY);
    startY += 12;

    const paymentRows = payments.map(p => [
      new Date(p.date).toLocaleDateString(),
      p.paymentId || 'PAY-1001',
      formatINR_PDF(p.amount),
      formatINR_PDF(p.interestPaid || 0),
      formatINR_PDF(p.principalPaid || 0),
      p.paymentMode === 'acc_cash' ? 'Cash' : 'Bank',
    ]);

    doc.autoTable({
      startY,
      head: [['Payment Date', 'Payment Ref. ID', 'Total Paid', 'Interest Component', 'Principal Component', 'Payment Mode']],
      body: paymentRows,
      theme: 'striped',
      headStyles: { fillColor: BRAND_GREEN, fontSize: 8 },
      styles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 90 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center', cellWidth: 75 },
      }
    });
  }

  addFooter(doc);
  doc.save(`Loan_Statement_${loanId}.pdf`);
}

/**
 * Generate PDF Data Base64 String for Email Attachments
 */
export function generateReportPdfBase64(reportType, params = {}) {
  const { transactions = [], accounts = [], party = null, period = 'All Time', loans = [], loansSummary = {}, loan = null } = params;
  let doc = null;

  if (reportType === 'PNL') {
    doc = generatePnLReport(transactions, accounts, period, { returnDoc: true });
  } else if (reportType === 'BALANCE_SHEET') {
    doc = generateBalanceSheetReport(transactions, accounts, period, { returnDoc: true });
  } else if (reportType === 'PARTY_LEDGER') {
    doc = generatePartyLedgerReport(transactions, party, accounts, period, { returnDoc: true });
  } else if (reportType === 'CATEGORY_WISE') {
    doc = generateCategoryReport(transactions, period, { returnDoc: true });
  } else if (reportType === 'LOAN_REPORT') {
    doc = generateLoanReport(loans, loansSummary, period, { returnDoc: true });
  } else if (reportType === 'SINGLE_LOAN_REPORT') {
    doc = generateSingleLoanReport(loan, null, { returnDoc: true });
  }

  if (doc && typeof doc.output === 'function') {
    return doc.output('datauristring');
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Legacy export (backward compatibility)
// ═══════════════════════════════════════════════════════════════

export const generateAuditReport = (summary, transactions, period) => {
  const fakeAccounts = [
    { id: 'acc_income', name: 'Income', type: 'REVENUE', group: 'INCOME' },
    { id: 'acc_expense', name: 'General Expense', type: 'EXPENSE', group: 'EXPENSE' },
  ];
  generatePnLReport(transactions, fakeAccounts, period);
};
