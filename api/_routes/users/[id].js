import dbConnect from '../../_lib/db.js';
import User from '../../_models/User.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query; // This is the _id of the User document

  try {
    await dbConnect();
    const currentUser = verifyAuth(req);
    requireRole(currentUser, 'ADMIN');

    if (req.method === 'PUT') {
      const { name, password, role } = req.body;
      const user = await User.findOne({ userId: id });

      if (!user) return res.status(404).json({ error: 'User not found' });

      if (user.userId === 'admin' && role && role !== 'ADMIN') {
        return res.status(400).json({ error: 'Cannot change admin role' });
      }

      if (name) user.name = name;
      if (password) user.password = password; // pre-save hook handles hashing
      if (role) user.role = role;

      await user.save();
      
      const userResponse = user.toObject();
      delete userResponse.password;

      return res.status(200).json(userResponse);
    }

    if (req.method === 'DELETE') {
      const user = await User.findOne({ userId: id });
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (user.userId === 'admin') {
        return res.status(400).json({ error: 'Cannot delete admin account' });
      }

      await User.findOneAndDelete({ userId: id });
      return res.status(200).json({ message: 'User deleted successfully' });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
