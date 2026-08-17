import dbConnect from '../../_lib/db.js';
import Loan from '../../_models/Loan.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { calculateLoanMetrics } from './index.js';

/**
 * Generates month-by-month repayment schedule for a loan.
 */
function generateRepaymentSchedule(loan) {
  const schedule = [];
  const startDate = new Date(loan.startDate);
  const tenure = loan.tenureMonths || 12;
  const principalPerMonth = Math.round(loan.loanAmount / tenure);
  const monthlyInterest = (loan.loanAmount * (loan.monthlyInterestRate || 2.0)) / 100;
  let accumulatedPaid = loan.totalPaid || (loan.principalPaid + loan.interestPaid) || 0;

  let remainingPrincipal = loan.loanAmount;

  for (let i = 1; i <= tenure; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const currentInterestDue = (remainingPrincipal * (loan.monthlyInterestRate || 2.0)) / 100;
    const dueAmount = currentInterestDue + principalPerMonth;

    let isPaid = false;
    let isPartial = false;
    if (accumulatedPaid >= dueAmount) {
      isPaid = true;
      accumulatedPaid -= dueAmount;
    } else if (accumulatedPaid > 0) {
      isPartial = true;
      accumulatedPaid = 0;
    }

    schedule.push({
      monthNumber: i,
      dueDate: dueDate.toISOString(),
      principalDue: principalPerMonth,
      interestDue: currentInterestDue,
      totalDue: dueAmount,
      status: isPaid ? 'PAID' : isPartial ? 'PARTIAL' : new Date() > dueDate ? 'OVERDUE' : 'UPCOMING',
    });

    remainingPrincipal = Math.max(0, remainingPrincipal - principalPerMonth);
  }

  return schedule;
}

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const rawLoan = await Loan.findById(id) || await Loan.findOne({ loanId: id });
      if (!rawLoan) return res.status(404).json({ error: 'Loan not found' });

      const loan = calculateLoanMetrics(rawLoan);
      const schedule = generateRepaymentSchedule(loan);

      return res.status(200).json({
        ...loan,
        schedule,
      });
    }

    if (req.method === 'PUT') {
      requireRole(user, 'ADMIN');

      const { monthlyInterestRate, status, tenureMonths } = req.body;
      const loan = await Loan.findById(id) || await Loan.findOne({ loanId: id });
      if (!loan) return res.status(404).json({ error: 'Loan not found' });

      if (monthlyInterestRate !== undefined) {
        const rate = parseFloat(monthlyInterestRate);
        if (isNaN(rate) || rate < 0) return res.status(400).json({ error: 'Invalid interest rate' });
        loan.monthlyInterestRate = rate;
      }

      if (status && ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'CLOSED'].includes(status)) {
        loan.status = status;
      }

      if (tenureMonths && parseInt(tenureMonths) > 0) {
        loan.tenureMonths = parseInt(tenureMonths);
      }

      await loan.save();

      await AuditTrail.create({
        action: 'LOAN_UPDATED',
        user: user.name,
        role: user.role,
        details: { loanId: loan.loanId, monthlyInterestRate, status },
      });

      const updatedLoan = calculateLoanMetrics(loan);
      return res.status(200).json(updatedLoan);
    }

    if (req.method === 'DELETE') {
      requireRole(user, 'ADMIN');

      const loan = await Loan.findById(id) || await Loan.findOne({ loanId: id });
      if (!loan) return res.status(404).json({ error: 'Loan not found' });

      loan.status = 'CLOSED';
      await loan.save();

      await AuditTrail.create({
        action: 'LOAN_CLOSED',
        user: user.name,
        role: user.role,
        details: { loanId: loan.loanId },
      });

      return res.status(200).json({ message: 'Loan closed successfully', loanId: loan.loanId });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
