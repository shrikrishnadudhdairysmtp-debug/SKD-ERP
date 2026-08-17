import dbConnect from '../../_lib/db.js';
import User from '../../_models/User.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();
    const currentUser = verifyAuth(req);
    requireRole(currentUser, 'ADMIN');

    const { permissions } = req.body;

    if (!permissions || !permissions.pages || !permissions.actions) {
      return res.status(400).json({ error: 'Invalid permissions format' });
    }

    const user = await User.findOne({ userId: id });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Prevent modifying admin's own permissions (admin always has full access)
    if (user.userId === 'admin') {
      return res.status(400).json({ error: 'Cannot modify admin permissions' });
    }

    // Update permissions
    user.permissions = permissions;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    return res.status(200).json(userResponse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
