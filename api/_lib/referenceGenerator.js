import dbConnect from './db.js';
import SequenceCounter from '../_models/SequenceCounter.js';
import Transaction from '../_models/Transaction.js';
import Party from '../_models/Party.js';
import Loan from '../_models/Loan.js';

/**
 * Robust Atomic Reference Generator
 * Format: YYYY-TYPE-MODULE-SEQUENCE (e.g. 2026-IN-MEMBER-000001)
 *
 * @param {string} type 'IN' (Incoming) or 'OUT' (Outgoing)
 * @param {string} moduleName 'MEMBER', 'LOAN', 'PAYMENT', 'MILK', 'EXPENSE', 'SALE', 'PURCHASE', etc.
 * @param {Date|string} customDate Optional transaction date (defaults to current date)
 * @returns {Promise<string>} Generated reference string e.g. "2026-IN-MEMBER-000001"
 */
export async function generateVoucherRef(type = 'IN', moduleName = 'TRANSACTION', customDate = new Date()) {
  await dbConnect();

  const year = new Date(customDate || Date.now()).getFullYear() || new Date().getFullYear();
  const upperType = (type || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN';
  const upperModule = (moduleName || 'TRANSACTION').toUpperCase().replace(/[^A-Z0-9_]/g, '');

  const key = `${year}-${upperType}-${upperModule}`;

  // Atomic findOneAndUpdate with $inc guarantees 100% duplicate-free sequence allocation under high concurrency
  const counter = await SequenceCounter.findOneAndUpdate(
    { key },
    {
      $inc: { seq: 1 },
      $setOnInsert: { year, type: upperType, module: upperModule },
    },
    { returnDocument: 'after', upsert: true }
  );

  const seqPadded = String(counter.seq).padStart(6, '0');
  return `${year}-${upperType}-${upperModule}-${seqPadded}`;
}

/**
 * Migration & Backfilling Utility for Legacy Database Records
 */
export async function migrateExistingReferences() {
  await dbConnect();

  console.log('🔄 Checking existing records for missing reference numbers...');
  const stats = { parties: 0, loans: 0, transactions: 0, payments: 0 };

  // 1. Backfill Parties / Members
  const unrefParties = await Party.find({
    $or: [{ memberRef: { $exists: false } }, { memberRef: null }, { memberRef: '' }]
  });

  for (const party of unrefParties) {
    const type = 'IN';
    const moduleName = 'MEMBER';
    const ref = await generateVoucherRef(type, moduleName, party.createdAt || new Date());
    party.memberRef = ref;
    party.voucherRef = ref;
    await party.save();
    stats.parties++;
  }

  // 2. Backfill Loans
  const unrefLoans = await Loan.find({
    $or: [{ loanRef: { $exists: false } }, { loanRef: null }, { loanRef: '' }]
  });

  for (const loan of unrefLoans) {
    const ref = await generateVoucherRef('OUT', 'LOAN', loan.startDate || loan.createdAt || new Date());
    loan.loanRef = ref;
    loan.voucherRef = ref;

    // Backfill loan payments sub-documents if missing refs
    if (loan.payments && loan.payments.length > 0) {
      for (const p of loan.payments) {
        if (!p.paymentRef) {
          const pRef = await generateVoucherRef('IN', 'PAYMENT', p.date || loan.createdAt || new Date());
          p.paymentRef = pRef;
          p.voucherRef = pRef;
          stats.payments++;
        }
      }
    }

    await loan.save();
    stats.loans++;
  }

  // 3. Backfill Ledger Transactions
  const unrefTransactions = await Transaction.find({
    $or: [{ voucherRef: { $exists: false } }, { voucherRef: null }, { voucherRef: '' }]
  });

  for (const txn of unrefTransactions) {
    // Determine TYPE: check debits vs credits
    let type = 'IN';
    let moduleName = 'TRANSACTION';

    const netDebit = txn.entries ? txn.entries.reduce((sum, e) => sum + (e.debit || 0), 0) : 0;
    const netCredit = txn.entries ? txn.entries.reduce((sum, e) => sum + (e.credit || 0), 0) : 0;

    const cat = (txn.category || '').toUpperCase();
    const rem = (txn.remarks || '').toUpperCase();

    if (cat.includes('MILK') || rem.includes('MILK')) {
      moduleName = 'MILK';
      type = rem.includes('DISPATCH') || rem.includes('SALE') ? 'OUT' : 'IN';
    } else if (cat.includes('EXPENSE') || cat.includes('PAYMENT') || rem.includes('PAYMENT')) {
      moduleName = 'EXPENSE';
      type = 'OUT';
    } else if (cat.includes('INCOME') || cat.includes('RECEIPT') || rem.includes('RECEIPT')) {
      moduleName = 'PAYMENT';
      type = 'IN';
    } else {
      type = netCredit >= netDebit ? 'IN' : 'OUT';
    }

    const ref = await generateVoucherRef(type, moduleName, txn.date || txn.createdAt || new Date());
    txn.voucherRef = ref;
    txn.refType = type;
    txn.refModule = moduleName;
    await txn.save();
    stats.transactions++;
  }

  console.log('✅ Reference migration complete:', stats);
  return stats;
}
