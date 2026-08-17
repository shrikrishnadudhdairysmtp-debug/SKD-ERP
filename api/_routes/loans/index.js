import dbConnect from '../../_lib/db.js';
import Loan from '../../_models/Loan.js';
import Transaction from '../../_models/Transaction.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { sendNotification } from '../../_lib/emailService.js';

/**
 * Calculates loan summary metrics for a loan document.
 * Fixed interest rule: 2% per month (or configured monthlyInterestRate) on outstanding principal.
 */
export function calculateLoanMetrics(loan) {
  const loanObj = typeof loan.toObject === 'function' ? loan.toObject({ virtuals: true }) : { ...loan };
  
  const principalPaid = loanObj.principalPaid || 0;
  const interestPaid = loanObj.interestPaid || 0;
  const loanAmount = loanObj.loanAmount || 0;
  const monthlyRate = loanObj.monthlyInterestRate ?? 2.0; // 2% per month
  const startDate = new Date(loanObj.startDate || Date.now());
  const today = new Date();

  // Outstanding principal
  const outstandingPrincipal = Math.max(0, loanAmount - principalPaid);

  // Calculate elapsed months since start date (minimum 1 month for active loan)
  let monthsElapsed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
  if (today.getDate() >= startDate.getDate()) {
    monthsElapsed += 1;
  }
  monthsElapsed = Math.max(1, monthsElapsed);

  // Monthly interest amount on initial principal (or current principal)
  // Standard rule: 2% of initial loan amount per month accrued, or 2% of remaining principal
  const monthlyInterestAmount = (loanAmount * monthlyRate) / 100;
  const totalAccruedInterest = Math.round(monthsElapsed * monthlyInterestAmount);
  
  // Outstanding interest
  const outstandingInterest = Math.max(0, totalAccruedInterest - interestPaid);
  const totalOutstanding = Math.round(outstandingPrincipal + outstandingInterest);

  // Calculate next due date
  const nextDueDate = new Date(startDate);
  let dueMonthOffset = Math.floor(interestPaid / monthlyInterestAmount) + 1;
  nextDueDate.setMonth(nextDueDate.getMonth() + dueMonthOffset);

  // Status check: if principal paid >= loan amount, status is COMPLETED
  let currentStatus = loanObj.status;
  if (outstandingPrincipal <= 0 && currentStatus !== 'CLOSED') {
    currentStatus = 'COMPLETED';
  } else if (today > nextDueDate && currentStatus === 'ACTIVE' && outstandingInterest > 0) {
    currentStatus = 'ACTIVE'; // or OVERDUE indicator
  }

  return {
    ...loanObj,
    id: loanObj._id || loanObj.id,
    monthlyInterestAmount,
    totalAccruedInterest,
    outstandingPrincipal,
    outstandingInterest,
    totalOutstanding,
    totalPaid: principalPaid + interestPaid,
    nextDueDate: nextDueDate.toISOString(),
    monthsElapsed,
    status: currentStatus,
  };
}

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const { status, partyId } = req.query;
      let filter = {};

      if (status && status !== 'ALL') filter.status = status;
      if (partyId) filter.partyId = partyId;

      const rawLoans = await Loan.find(filter).sort({ createdAt: -1 });
      const loans = rawLoans.map(calculateLoanMetrics);

      // Compute aggregated loan metrics for dashboard / summary header
      const summary = {
        totalLoansCount: loans.length,
        totalActiveLoans: loans.filter(l => l.status === 'ACTIVE').length,
        totalLoanAmount: loans.reduce((sum, l) => sum + (l.loanAmount || 0), 0),
        totalOutstandingPrincipal: loans.reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0),
        totalOutstandingInterest: loans.reduce((sum, l) => sum + (l.outstandingInterest || 0), 0),
        totalOutstanding: loans.reduce((sum, l) => sum + (l.totalOutstanding || 0), 0),
        totalInterestPaid: loans.reduce((sum, l) => sum + (l.interestPaid || 0), 0),
        totalPrincipalPaid: loans.reduce((sum, l) => sum + (l.principalPaid || 0), 0),
        totalPaid: loans.reduce((sum, l) => sum + (l.totalPaid || 0), 0),
      };

      return res.status(200).json({ data: loans, summary });
    }

    if (req.method === 'POST') {
      requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

      const {
        partyId,
        partyName,
        loanAmount,
        startDate,
        monthlyInterestRate = 2.0,
        tenureMonths = 12,
        disbursementMode = 'acc_bank',
        remarks = '',
      } = req.body;

      if (!partyId || !partyName || !loanAmount || parseFloat(loanAmount) <= 0 || !startDate) {
        return res.status(400).json({ error: 'Missing required loan fields (Customer, Amount, Start Date).' });
      }

      const numAmount = parseFloat(loanAmount);
      const rate = parseFloat(monthlyInterestRate) || 2.0;
      const tenure = parseInt(tenureMonths) || 12;

      // Auto-generate Loan ID (e.g. LN-1001)
      const count = await Loan.countDocuments();
      const loanId = `LN-${1001 + count}`;

      const loan = new Loan({
        loanId,
        partyId,
        partyName,
        loanAmount: numAmount,
        startDate: new Date(startDate),
        monthlyInterestRate: rate,
        tenureMonths: tenure,
        status: 'ACTIVE',
        createdBy: user.name,
      });

      await loan.save();

      // Automatically post double-entry disbursement transaction
      const txn = new Transaction({
        entries: [
          { accountId: 'acc_expense', debit: numAmount, credit: 0 }, // Dr Loan Receivable / Issued
          { accountId: disbursementMode || 'acc_bank', debit: 0, credit: numAmount }, // Cr Cash/Bank
        ],
        date: new Date(startDate),
        remarks: `Loan Disbursement - ${loanId} for ${partyName}. ${remarks}`.trim(),
        partyId,
        category: 'Investment',
        status: 'APPROVED',
        createdBy: user.name,
        createdById: user.id,
      });
      await AuditTrail.create({
        action: 'LOAN_CREATED',
        user: user.name,
        role: user.role,
        details: { loanId, partyName, amount: numAmount, monthlyInterestRate: rate },
      });

      // Fetch dynamic party email after successful loan save
      const party = partyId ? await Party.findById(partyId) : null;
      const recipientEmail = party?.email || 'customer@skderp.com';

      // Trigger automatic email notification after DB save
      sendNotification('LOAN_CREATED', recipientEmail, {
        customer_name: partyName,
        loan_id: loanId,
        loan_amount: numAmount,
        interest_rate: rate,
        monthly_interest: (numAmount * rate) / 100,
        tenure,
        outstanding_amount: numAmount,
      }, `LOAN-CREATED-${loanId}`).catch(err => console.error('Notification error:', err));

      const processedLoan = calculateLoanMetrics(loan);
      return res.status(201).json(processedLoan);
    }

    if (req.method === 'DELETE') {
      requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

      await Loan.updateMany({}, {
        $set: {
          principalPaid: 0,
          interestPaid: 0,
          payments: [],
          status: 'ACTIVE'
        }
      });

      await AuditTrail.create({
        action: 'LOANS_RESET',
        user: user.name,
        role: user.role,
        details: { message: 'All loan entries and payment records have been reset.' },
      });

      return res.status(200).json({ message: 'All loan entries reset successfully.' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
