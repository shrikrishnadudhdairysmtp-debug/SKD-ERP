import dbConnect from '../../_lib/db.js';
import Party from '../../_models/Party.js';
import Account from '../../_models/Account.js';
import Transaction from '../../_models/Transaction.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'PUT') {
      requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

      const { name, phone, email } = req.body;
      const party = await Party.findById(id);

      if (!party) return res.status(404).json({ error: 'Party not found' });

      party.name = name || party.name;
      party.phone = phone !== undefined ? phone : party.phone;
      party.email = email !== undefined ? email : party.email;
      await party.save();

      // Update linked account name if party name changed
      if (name) {
        const linkedAccId = party.type === 'CUSTOMER' ? party.receivableAccountId : party.payableAccountId;
        if (linkedAccId) {
           const prefix = party.type === 'CUSTOMER' ? 'AR' : 'AP';
           await Account.findOneAndUpdate({ accountId: linkedAccId }, { name: `${prefix} - ${name}` });
        }
      }

      return res.status(200).json(party);
    }

    if (req.method === 'DELETE') {
      requireRole(user, 'ADMIN', 'CHECKER', 'MAKER');

      const party = await Party.findById(id);
      if (!party) return res.status(404).json({ error: 'Party not found' });

      // ── Prevent deletion if transactions reference this party ───
      const linkedAccId = party.type === 'CUSTOMER' ? party.receivableAccountId : party.payableAccountId;
      
      const linkedTxnCount = await Transaction.countDocuments({
        $or: [
          { partyId: id },
          { 'entries.accountId': linkedAccId },
        ],
        isDeleted: false,
      });

      if (linkedTxnCount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete party "${party.name}" — ${linkedTxnCount} active transaction(s) reference this party. Delete or reassign those transactions first.` 
        });
      }

      if (linkedAccId) {
        await Account.findOneAndDelete({ accountId: linkedAccId });
      }

      await Party.findByIdAndDelete(id);

      await AuditTrail.create({
        action: 'PARTY_DELETED',
        user: user.name,
        role: user.role,
        details: { partyId: id },
      });

      return res.status(200).json({ message: 'Party deleted successfully' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
