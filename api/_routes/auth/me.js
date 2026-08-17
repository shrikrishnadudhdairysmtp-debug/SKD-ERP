import dbConnect from '../../_lib/db.js';
import User from '../../_models/User.js';
import { verifyAuth } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const decoded = verifyAuth(req);

    const user = await User.findOne({ userId: decoded.id }).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      user: {
        id: user.userId,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
}
