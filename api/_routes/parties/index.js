import dbConnect from '../../_lib/db.js';
import Party from '../../_models/Party.js';
import Account from '../../_models/Account.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { sendNotification } from '../../_lib/emailService.js';
import { generateVoucherRef } from '../../_lib/referenceGenerator.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const { page = 1, limit = 50, search, type, year, memberRef } = req.query;
      const filter = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { memberRef: { $regex: search, $options: 'i' } },
          { voucherRef: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      if (memberRef) {
        filter.$or = [
          { memberRef: { $regex: memberRef, $options: 'i' } },
          { voucherRef: { $regex: memberRef, $options: 'i' } },
        ];
      }

      if (type && ['CUSTOMER', 'VENDOR'].includes(type)) {
        filter.type = type;
      }

      if (year) {
        const start = new Date(`${year}-01-01T00:00:00.000Z`);
        const end = new Date(`${year}-12-31T23:59:59.999Z`);
        filter.createdAt = { $gte: start, $lte: end };
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const total = await Party.countDocuments(filter);
      const totalPages = Math.ceil(total / limitNum);

      const parties = await Party.find(filter)
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.status(200).json({
        data: parties,
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

      const { name, type, phone, email } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' });
      }

      // Generate atomic member reference: YYYY-IN-MEMBER-XXXXXX
      const memberRef = await generateVoucherRef('IN', 'MEMBER', new Date());

      const party = new Party({
        name,
        type,
        phone,
        email,
        memberRef,
        voucherRef: memberRef,
      });
      await party.save();

      const accId = type === 'CUSTOMER' ? `acc_ar_${party._id}` : `acc_ap_${party._id}`;
      const accName = type === 'CUSTOMER' ? `AR - ${name}` : `AP - ${name}`;
      const accType = type === 'CUSTOMER' ? 'ASSET' : 'LIABILITY';
      const accGroup = type === 'CUSTOMER' ? 'RECEIVABLE' : 'PAYABLE';

      const account = new Account({
        accountId: accId,
        name: accName,
        type: accType,
        group: accGroup,
        isSystem: false,
      });
      await account.save();

      if (type === 'CUSTOMER') {
        party.receivableAccountId = accId;
      } else {
        party.payableAccountId = accId;
      }
      await party.save();

      await AuditTrail.create({
        action: 'PARTY_CREATED',
        user: user.name,
        role: user.role,
        details: { partyId: party._id, memberRef, name, type },
      });

      // Compulsory Email Notification
      sendNotification('NEW_MEMBER', email || 'member@skderp.com', {
        customer_name: name,
        member_id: memberRef || String(party._id),
        phone: phone || 'N/A',
        email: email || 'N/A',
      }, `MEMBER-CREATED-${party._id}`).catch(err => console.error('Notification error:', err));

      return res.status(201).json(party);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
