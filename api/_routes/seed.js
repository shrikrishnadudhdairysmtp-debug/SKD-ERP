import { runSeed } from './_lib/seed.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: In production, you might want to protect this with a secret key
  // if (req.headers.authorization !== `Bearer ${process.env.SEED_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    const results = await runSeed();
    res.status(200).json({
      message: 'Database seeded successfully',
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
