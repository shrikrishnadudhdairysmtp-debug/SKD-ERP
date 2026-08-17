import dbConnect from '../../_lib/db.js';
import Transaction from '../../_models/Transaction.js';
import Account from '../../_models/Account.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();
    verifyAuth(req);

    // Get all approved transactions (not deleted)
    const activeTransactions = await Transaction.find({ status: 'APPROVED', isDeleted: false });
    
    // Get all accounts to classify balances
    const accounts = await Account.find();
    
    let totalIncome = 0;
    let totalExpense = 0;
    let totalAR = 0;
    let totalAP = 0;

    const balances = {};

    activeTransactions.forEach(txn => {
      txn.entries.forEach(entry => {
        balances[entry.accountId] = (balances[entry.accountId] || 0) + (entry.debit - entry.credit);
      });
    });

    accounts.forEach(acc => {
      const bal = balances[acc.accountId] || 0;
      if (acc.group === 'INCOME') totalIncome += -bal; // Credit is negative balance, income is credit-heavy
      if (acc.group === 'EXPENSE') totalExpense += bal;
      if (acc.group === 'RECEIVABLE') totalAR += bal;
      if (acc.group === 'PAYABLE') totalAP += Math.abs(bal);
    });

    // Get pending count
    const pendingCount = await Transaction.countDocuments({ status: 'PENDING', isDeleted: false });

    // Get recent audit trail
    const auditTrail = await AuditTrail.find().sort({ timestamp: -1 }).limit(100);

    res.status(200).json({
      summary: {
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        totalAR,
        totalAP,
        pendingCount,
      },
      accountBalances: balances,
      auditTrail,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
