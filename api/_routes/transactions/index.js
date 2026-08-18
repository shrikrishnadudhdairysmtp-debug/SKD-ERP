import dbConnect from '../../_lib/db.js';
import Transaction from '../../_models/Transaction.js';
import AuditTrail from '../../_models/AuditTrail.js';
import Party from '../../_models/Party.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { sendNotification } from '../../_lib/emailService.js';
import { generateVoucherRef } from '../../_lib/referenceGenerator.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const { status, fiscalYear, year, partyId, search, voucherRef, type, module: moduleName, page = 1, limit = 50 } = req.query;
      let filter = { isDeleted: false };

      if (status) filter.status = status;
      if (partyId) filter.partyId = partyId;

      if (search) {
        filter.$or = [
          { voucherRef: { $regex: search, $options: 'i' } },
          { remarks: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
        ];
      }

      if (voucherRef) {
        filter.voucherRef = { $regex: voucherRef, $options: 'i' };
      }

      if (type && ['IN', 'OUT'].includes(type.toUpperCase())) {
        filter.refType = type.toUpperCase();
      }

      if (moduleName) {
        filter.refModule = { $regex: moduleName, $options: 'i' };
      }

      const activeYear = year || (fiscalYear && fiscalYear !== 'ALL' ? fiscalYear : null);
      if (activeYear) {
        filter.date = {
          $gte: new Date(`${activeYear}-01-01T00:00:00.000Z`),
          $lte: new Date(`${activeYear}-12-31T23:59:59.999Z`),
        };
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const total = await Transaction.countDocuments(filter);
      const totalPages = Math.ceil(total / limitNum);

      const transactions = await Transaction.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.status(200).json({
        data: transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    }

    if (req.method === 'POST') {
      requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

      const { entries, date, remarks, partyId, category, voucherRef: reqVoucherRef, invoiceNo: reqInvoiceNo, refNo: reqRefNo } = req.body;

      if (!entries || entries.length < 2 || !date || !remarks) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Extract invoiceNo from remarks if not provided directly
      const parsedInvoiceNo = reqInvoiceNo || (remarks?.match(/Inv\s*#?\s*([A-Z0-9-]+)/i)?.[1]) || null;

      // ── Double-entry validation: debits must equal credits ───
      const totalDebits = entries.reduce((sum, e) => sum + (parseFloat(e.debit) || 0), 0);
      const totalCredits = entries.reduce((sum, e) => sum + (parseFloat(e.credit) || 0), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.001) {
        return res.status(400).json({ 
          error: `Double-entry violation: total debits (${totalDebits}) must equal total credits (${totalCredits})` 
        });
      }

      if (totalDebits <= 0) {
        return res.status(400).json({ error: 'Transaction amount must be greater than zero' });
      }

      // Determine Module and Type for reference generation
      let refType = 'IN';
      let refModule = 'PAYMENT';

      const catUpper = (category || '').toUpperCase();
      const remUpper = (remarks || '').toUpperCase();

      if (catUpper.includes('MILK') || remUpper.includes('MILK')) {
        refModule = 'MILK';
        refType = remUpper.includes('DISPATCH') || remUpper.includes('SALE') ? 'OUT' : 'IN';
      } else if (catUpper.includes('EXPENSE') || catUpper.includes('PAYMENT') || remUpper.includes('PAYMENT') || remUpper.includes('EXPENSE')) {
        refModule = 'EXPENSE';
        refType = 'OUT';
      } else if (catUpper.includes('SALE') || remUpper.includes('SALE')) {
        refModule = 'SALE';
        refType = 'IN';
      } else if (catUpper.includes('PURCHASE') || remUpper.includes('PURCHASE')) {
        refModule = 'PURCHASE';
        refType = 'OUT';
      } else if (catUpper.includes('LOAN') || remUpper.includes('LOAN')) {
        refModule = 'LOAN';
        refType = remUpper.includes('REPAY') || remUpper.includes('RECEIPT') ? 'IN' : 'OUT';
      } else {
        refModule = 'TRANSACTION';
        refType = totalCredits >= totalDebits ? 'IN' : 'OUT';
      }

      // Generate atomic reference number: YYYY-TYPE-MODULE-SEQUENCE
      const voucherRef = reqVoucherRef || await generateVoucherRef(refType, refModule, date);

      // Maker role -> PENDING, Admin/Checker -> APPROVED
      const status = user.role === 'MAKER' ? 'PENDING' : 'APPROVED';

      const txn = new Transaction({
        voucherRef,
        refType,
        refModule,
        invoiceNo: parsedInvoiceNo,
        refNo: reqRefNo || null,
        entries,
        date,
        remarks,
        partyId,
        category,
        status,
        createdBy: user.name,
        createdById: user.id,
      });

      await txn.save();

      await AuditTrail.create({
        action: 'TRANSACTION_CREATED',
        user: user.name,
        role: user.role,
        details: { txnId: txn._id, voucherRef, status, remarks },
      });

      // Fetch dynamic party name & email
      const party = partyId ? await Party.findById(partyId) : null;
      const recipientEmail = party?.email || 'party@skderp.com';
      const customerName = party?.name || remarks.split('-')[0] || 'Valued Customer';
      const notificationType = (category === 'Milk Sales' || category === 'Milk Collection') ? 'MILK_COLLECTION' : 'PAYMENT_RECEIVED';

      const recentTxns = partyId ? await Transaction.find({ partyId }).sort({ date: 1 }).limit(15) : [];
      const historyList = recentTxns.map(t => {
        const isDr = t.entries?.some(e => e.debit > 0);
        return {
          date: t.date,
          voucherId: t.voucherRef || String(t._id).slice(-6),
          remarks: t.remarks || t.category || 'Transaction',
          debit: isDr ? t.amount || 0 : 0,
          credit: !isDr ? t.amount || 0 : 0,
        };
      });

      // Trigger automatic email notification after DB save
      sendNotification(notificationType, recipientEmail, {
        customer_name: customerName,
        txn_id: voucherRef || String(txn._id),
        payment_amount: totalDebits,
        category: category || 'General Ledger',
        remarks,
        date: new Date(date || Date.now()).toLocaleDateString('en-IN'),
        history: historyList,
      }, `TXN-CREATED-${txn._id}`).catch(err => console.error('Notification error:', err));

      return res.status(201).json(txn);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
