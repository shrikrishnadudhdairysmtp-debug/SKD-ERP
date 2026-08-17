import dbConnect from '../../_lib/db.js';
import User from '../../_models/User.js';
import { generateToken } from '../../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    const user = await User.findOne({ userId: userId.toLowerCase().trim() });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    const token = generateToken(user);

    res.status(200).json({
      token,
      user: {
        id: user.userId,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
