import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Helper to format currency for PDF
 */
function formatPdfCurrency(amount) {
  const num = Number(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Shared Header for Server-Generated PDF Documents
 */
function addPdfHeader(doc, title, companyName = 'SKD ERP Financial Services') {
  const pageWidth = doc.internal.pageSize.width;

  // Top Accent Banner
  doc.setFillColor(30, 58, 138); // Dark Navy Blue
  doc.rect(0, 0, pageWidth, 55, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 35, 28);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 35, 45);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text('Date: ' + new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN'), pageWidth - 180, 45);

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(35, 65, pageWidth - 35, 65);

  return 85;
}

/**
 * Shared Footer for Server-Generated PDF Documents
 */
function addPdfFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(35, pageHeight - 35, pageWidth - 35, pageHeight - 35);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`SKD ERP Passbook & Ledger Statement • Page ${i} of ${pageCount} • Valid Without Signature`, pageWidth / 2, pageHeight - 20, { align: 'center' });
  }
}

/**
 * Automatically generate binary PDF Data Base64 string with Ledger Book Passbook History for any ERP transaction
 */
export function generateTransactionPdf(type, data = {}, companyName = 'SKD ERP System') {
  try {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = 85;

    if (type === 'LOAN_CREATED' || type === 'LOAN_PAYMENT' || type === 'LOAN_CLOSED') {
      const isSanction = type === 'LOAN_CREATED';
      const isClosure = type === 'LOAN_CLOSED';
      const title = isSanction ? 'OFFICIAL LOAN SANCTION & DISBURSEMENT ADVICE' : (isClosure ? 'LOAN CLOSURE & NO DUES STATEMENT' : 'LOAN REPAYMENT RECEIPT & PASSBOOK STATEMENT');

      startY = addPdfHeader(doc, title, companyName);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('1. BORROWER & LOAN ACCOUNT DETAILS', 35, startY);
      startY += 20;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Borrower Name: ${data.customer_name || 'N/A'}`, 45, startY);
      doc.text(`Loan Account ID: ${data.loan_id || 'N/A'}`, 300, startY);
      startY += 18;

      doc.text(`Sanction Date: ${data.date || new Date().toLocaleDateString('en-IN')}`, 45, startY);
      doc.text(`Monthly Interest Rule: ${data.interest_rate || 2}% / Month (Rs. 2,000 / Lakh)`, 300, startY);
      startY += 25;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('2. CURRENT FINANCIAL SUMMARY', 35, startY);
      startY += 15;

      // Summary Card Table
      doc.autoTable({
        startY,
        head: [['Disbursed Principal', 'Monthly Interest', 'Total Paid to Date', 'Current Outstanding']],
        body: [[
          formatPdfCurrency(data.loan_amount),
          formatPdfCurrency(data.monthly_interest),
          formatPdfCurrency((Number(data.loan_amount) || 0) - (Number(data.remaining_principal || data.outstanding_amount || data.loan_amount) || 0)),
          formatPdfCurrency(data.outstanding_amount || data.remaining_principal || data.loan_amount),
        ]],
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], fontStyle: 'bold', halign: 'center', fontSize: 9 },
        styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
        margin: { left: 35, right: 35 },
      });

      startY = doc.lastAutoTable.finalY + 25;

      // 3. LEDGER BOOK PASSBOOK TRANSACTION HISTORY TABLE
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('3. LEDGER BOOK REPAYMENT & TRANSACTION HISTORY (PASSBOOK)', 35, startY);
      startY += 15;

      const historyRows = [];
      let runningBalance = Number(data.loan_amount) || 0;

      // Initial Disbursement Row
      historyRows.push([
        data.date || new Date().toLocaleDateString('en-IN'),
        data.loan_id || 'DISBURSED',
        'Loan Principal Disbursed',
        formatPdfCurrency(data.loan_amount),
        '-',
        '-',
        '-',
        formatPdfCurrency(runningBalance) + ' (Dr)',
      ]);

      // Add all previous payments to Ledger Book table
      const payments = data.payments || [];
      payments.forEach(p => {
        const amt = Number(p.amount) || 0;
        const pPaid = Number(p.principalPaid) || 0;
        const iPaid = Number(p.interestPaid) || 0;
        runningBalance -= pPaid > 0 ? pPaid : amt;

        historyRows.push([
          new Date(p.date).toLocaleDateString('en-IN'),
          p.paymentId || 'PAYMENT',
          `Repayment (${p.paymentMode === 'acc_cash' ? 'Cash' : 'Bank'})`,
          '-',
          formatPdfCurrency(amt),
          formatPdfCurrency(iPaid),
          formatPdfCurrency(pPaid),
          formatPdfCurrency(Math.max(0, runningBalance)) + (runningBalance <= 0 ? ' (Nil)' : ' (Dr)'),
        ]);
      });

      doc.autoTable({
        startY,
        head: [['Date', 'Ref ID', 'Particulars / Mode', 'Debit (Loan)', 'Credit (Paid)', 'Interest Component', 'Principal Component', 'Running Balance']],
        body: historyRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8 },
        margin: { left: 35, right: 35 },
        columnStyles: {
          0: { cellWidth: 65 },
          1: { cellWidth: 65 },
          2: { cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 65 },
          4: { halign: 'right', cellWidth: 65 },
          5: { halign: 'right', cellWidth: 65 },
          6: { halign: 'right', cellWidth: 65 },
          7: { halign: 'right', cellWidth: 75 },
        },
      });

    } else if (type === 'NEW_MEMBER' || type === 'PAYMENT_RECEIVED' || type === 'MILK_COLLECTION') {
      const isMilk = type === 'MILK_COLLECTION';
      const isMember = type === 'NEW_MEMBER';
      const title = isMember ? 'MEMBER REGISTRATION & LEDGER ACCOUNT CERTIFICATE' : (isMilk ? 'MILK COLLECTION RECEIPT & PAYOUT SLIP' : 'FINANCIAL PAYMENT VOUCHER & LEDGER STATEMENT');

      startY = addPdfHeader(doc, title, companyName);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text('1. PARTY / ACCOUNT DETAILS', 35, startY);
      startY += 20;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Party / Customer Name: ${data.customer_name || 'N/A'}`, 45, startY);
      doc.text(`Voucher / Member Ref: ${data.member_id || data.txn_id || 'N/A'}`, 300, startY);
      startY += 18;

      doc.text(`Date: ${data.date || new Date().toLocaleDateString('en-IN')}`, 45, startY);
      doc.text(`Category: ${data.category || 'General Ledger'}`, 300, startY);
      startY += 25;

      if (isMilk) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.text('2. MILK COLLECTION PAYOUT CALCULATION', 35, startY);
        startY += 15;

        doc.autoTable({
          startY,
          head: [['Milk Quantity', 'Fat %', 'SNF %', 'Rate / Liter', 'Total Payout Amount']],
          body: [[
            `${data.quantity || 0} Liters`,
            `${data.fat || 0}%`,
            `${data.snf || 0}%`,
            formatPdfCurrency(data.rate || 0),
            formatPdfCurrency(data.total_amount || data.payment_amount),
          ]],
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], fontStyle: 'bold', halign: 'center' },
          styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
          margin: { left: 35, right: 35 },
        });

        startY = doc.lastAutoTable.finalY + 25;
      } else if (!isMember) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 58, 138);
        doc.text('2. VOUCHER SUMMARY', 35, startY);
        startY += 15;

        doc.autoTable({
          startY,
          head: [['Voucher Date', 'Category', 'Description / Particulars', 'Amount Received / Paid']],
          body: [[
            data.date || new Date().toLocaleDateString('en-IN'),
            data.category || 'General Ledger',
            data.remarks || 'Financial Entry Transaction',
            formatPdfCurrency(data.payment_amount || data.total_amount),
          ]],
          theme: 'grid',
          headStyles: { fillColor: [30, 58, 138], fontStyle: 'bold', halign: 'center' },
          styles: { halign: 'center', fontSize: 10, fontStyle: 'bold' },
          margin: { left: 35, right: 35 },
        });

        startY = doc.lastAutoTable.finalY + 25;
      }

      // 3. LEDGER BOOK HISTORY TABLE FOR PARTY
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 58, 138);
      doc.text(`${isMember ? '2' : '3'}. LEDGER BOOK STATEMENT HISTORY (PASSBOOK)`, 35, startY);
      startY += 15;

      const historyRows = [];
      const partyHistory = data.history || [];

      if (partyHistory.length > 0) {
        let runningBal = 0;
        partyHistory.forEach(h => {
          const dr = Number(h.debit) || 0;
          const cr = Number(h.credit) || 0;
          runningBal += (dr - cr);

          historyRows.push([
            new Date(h.date).toLocaleDateString('en-IN'),
            h.voucherRef || h.voucherId || h.id || 'TXN',
            h.remarks || h.description || h.category || 'Transaction Entry',
            dr > 0 ? formatPdfCurrency(dr) : '-',
            cr > 0 ? formatPdfCurrency(cr) : '-',
            formatPdfCurrency(Math.abs(runningBal)) + (runningBal < 0 ? ' (Cr)' : ' (Dr)'),
          ]);
        });
      } else {
        historyRows.push([
          data.date || new Date().toLocaleDateString('en-IN'),
          data.voucherRef || data.memberRef || data.loanRef || data.member_id || data.txn_id || 'TXN-1001',
          data.remarks || (isMember ? 'Member Registration Ledger Opening' : 'Transaction Voucher Entry'),
          isMember ? '-' : formatPdfCurrency(data.payment_amount || data.total_amount),
          isMember ? '-' : '-',
          formatPdfCurrency(data.payment_amount || data.total_amount || 0) + ' (Dr)',
        ]);
      }

      doc.autoTable({
        startY,
        head: [['Date', 'Voucher / Ref ID', 'Particulars / Description', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance']],
        body: historyRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8 },
        margin: { left: 35, right: 35 },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 70 },
          2: { cellWidth: 'auto' },
          3: { halign: 'right', cellWidth: 80 },
          4: { halign: 'right', cellWidth: 80 },
          5: { halign: 'right', cellWidth: 90 },
        },
      });
    } else {
      startY = addPdfHeader(doc, 'SKD ERP OFFICIAL STATEMENT', companyName);
      doc.setFontSize(11);
      doc.text(`Document Reference: ${type}`, 45, startY);
      doc.text(`Date: ${data.date || new Date().toLocaleDateString('en-IN')}`, 45, startY + 20);
      startY += 50;
    }

    addPdfFooter(doc);
    return Buffer.from(doc.output('arraybuffer')).toString('base64');
  } catch (err) {
    console.error('Failed to generate PDF attachment with Ledger Book history:', err);
    return null;
  }
}
