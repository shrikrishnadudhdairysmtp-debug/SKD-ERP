import dbConnect from '../../_lib/db.js';
import Account from '../../_models/Account.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const accounts = await Account.find();
      return res.status(200).json(accounts);
    }

    if (req.method === 'POST') {
      requireRole(user, 'ADMIN'); // Only admin can create raw accounts

      const { accountId, name, type, group } = req.body;
      if (!accountId || !name || !type || !group) {
         return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await Account.findOne({ accountId });
      if (existing) return res.status(400).json({ error: 'Account ID already exists' });

      const account = new Account({ accountId, name, type, group });
      await account.save();

      return res.status(201).json(account);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
