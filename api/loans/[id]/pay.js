import dbConnect from '../../_lib/db.js';
import Loan from '../../_models/Loan.js';
import Transaction from '../../_models/Transaction.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { sendNotification } from '../../_lib/emailService.js';
import { calculateLoanMetrics } from '../index.js';
import Party from '../../_models/Party.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const user = verifyAuth(req);
    requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

    const { amount, date, paymentMode = 'acc_bank', remarks = '' } = req.body;

    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }

    const rawLoan = await Loan.findById(id) || await Loan.findOne({ loanId: id });
    if (!rawLoan) return res.status(404).json({ error: 'Loan not found.' });

    if (rawLoan.status === 'COMPLETED' || rawLoan.status === 'CLOSED') {
      return res.status(400).json({ error: `Cannot record payment for ${rawLoan.status.toLowerCase()} loan.` });
    }

    const loanMetrics = calculateLoanMetrics(rawLoan);

    if (numAmount > loanMetrics.totalOutstanding + 0.01) {
      return res.status(400).json({
        error: `Payment amount (₹${numAmount.toLocaleString()}) cannot exceed total outstanding amount (₹${loanMetrics.totalOutstanding.toLocaleString()}).`
      });
    }

    // Allocation logic: Interest first, then Principal
    const outstandingInterest = loanMetrics.outstandingInterest;
    const interestPaidThisTime = Math.min(numAmount, outstandingInterest);
    const principalPaidThisTime = Math.max(0, numAmount - interestPaidThisTime);

    // Generate Payment ID
    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;

    // Add payment entry
    rawLoan.payments.push({
      paymentId,
      date: new Date(date || Date.now()),
      amount: numAmount,
      interestPaid: interestPaidThisTime,
      principalPaid: principalPaidThisTime,
      paymentMode,
      remarks,
    });

    rawLoan.interestPaid = (rawLoan.interestPaid || 0) + interestPaidThisTime;
    rawLoan.principalPaid = (rawLoan.principalPaid || 0) + principalPaidThisTime;

    // Check if fully paid
    if (rawLoan.principalPaid >= rawLoan.loanAmount - 0.01) {
      rawLoan.status = 'COMPLETED';
    }

    await rawLoan.save();

    // Auto-create double-entry accounting transaction for ERP ledger
    const entries = [
      { accountId: paymentMode, debit: numAmount, credit: 0 }, // Dr Cash/Bank
    ];

    if (interestPaidThisTime > 0) {
      entries.push({ accountId: 'acc_income', debit: 0, credit: interestPaidThisTime }); // Cr Interest Income
    }

    if (principalPaidThisTime > 0) {
      entries.push({ accountId: 'acc_expense', debit: 0, credit: principalPaidThisTime }); // Cr Principal Recovery
    }

    const txn = new Transaction({
      entries,
      date: new Date(date || Date.now()),
      remarks: `Loan Repayment - ${rawLoan.loanId} (${rawLoan.partyName}). Interest: ₹${interestPaidThisTime}, Principal: ₹${principalPaidThisTime}. ${remarks}`.trim(),
      partyId: rawLoan.partyId,
      category: 'Investment',
      status: 'APPROVED',
      createdBy: user.name,
      createdById: user.id,
    });
    await txn.save();

    await AuditTrail.create({
      action: 'LOAN_REPAYMENT_RECORDED',
      user: user.name,
      role: user.role,
      details: {
        loanId: rawLoan.loanId,
        amount: numAmount,
        interestPaid: interestPaidThisTime,
        principalPaid: principalPaidThisTime,
        paymentMode,
      },
    });

    const updatedMetrics = calculateLoanMetrics(rawLoan);

    // Fetch dynamic party email after successful loan repayment save
    const party = rawLoan.partyId ? await Party.findById(rawLoan.partyId) : null;
    const recipientEmail = party?.email || 'customer@skderp.com';

    // Trigger automatic email notification after DB save
    sendNotification('LOAN_PAYMENT', recipientEmail, {
      customer_name: rawLoan.partyName,
      loan_id: rawLoan.loanId,
      loan_amount: rawLoan.amount,
      interest_rate: rawLoan.monthlyInterestRate || 2,
      monthly_interest: updatedMetrics.monthlyInterest,
      date: new Date(rawLoan.startDate || rawLoan.createdAt).toLocaleDateString('en-IN'),
      payment_date: new Date(date || Date.now()).toLocaleDateString('en-IN'),
      payment_amount: numAmount,
      principal_paid: principalPaidThisTime,
      interest_paid: interestPaidThisTime,
      remaining_principal: updatedMetrics.outstandingPrincipal,
      remaining_interest: updatedMetrics.outstandingInterest,
      outstanding_amount: updatedMetrics.totalOutstanding,
      due_date: new Date(updatedMetrics.nextDueDate).toLocaleDateString('en-IN'),
      payments: rawLoan.payments || [],
    }, `LOAN-PAYMENT-${rawLoan.loanId}-${paymentId}`).catch(err => console.error('Notification error:', err));
    return res.status(200).json({
      message: 'Loan payment recorded successfully',
      payment: {
        paymentId,
        amount: numAmount,
        interestPaid: interestPaidThisTime,
        principalPaid: principalPaidThisTime,
      },
      loan: updatedMetrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
