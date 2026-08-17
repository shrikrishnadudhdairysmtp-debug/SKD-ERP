import dbConnect from '../../_lib/db.js';
import User from '../../_models/User.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const currentUser = verifyAuth(req);
    requireRole(currentUser, 'ADMIN');

    if (req.method === 'GET') {
      const { page = 1, limit = 50 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const total = await User.countDocuments();
      const totalPages = Math.ceil(total / limitNum);

      const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      return res.status(200).json({
        data: users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
        },
      });
    }

    if (req.method === 'POST') {
      const { userId, name, password, role } = req.body;

      if (!userId || !name || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existing = await User.findOne({ userId: userId.toLowerCase().trim() });
      if (existing) {
        return res.status(400).json({ error: 'User ID already exists' });
      }

      const user = new User({ userId: userId.toLowerCase().trim(), name, password, role });
      await user.save();

      const userResponse = user.toObject();
      delete userResponse.password;

      return res.status(201).json(userResponse);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
