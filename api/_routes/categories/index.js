import dbConnect from '../../_lib/db.js';
import Category from '../../_models/Category.js';
import { verifyAuth } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    verifyAuth(req); // All authenticated users can read/create categories

    if (req.method === 'GET') {
      const categories = await Category.find().sort({ name: 1 });
      return res.status(200).json(categories);
    }

    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      let category = await Category.findOne({ name });
      if (!category) {
        category = new Category({ name });
        await category.save();
      }

      return res.status(201).json(category);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
