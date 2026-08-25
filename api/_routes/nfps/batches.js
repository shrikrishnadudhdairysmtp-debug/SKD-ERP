import dbConnect from '../../_lib/db.js';
import NfpsBatch from '../../_models/NfpsBatch.js';
import NfpsRecord from '../../_models/NfpsRecord.js';
import { verifyAuth } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'GET') {
      const { batchId } = req.query;

      // If specific batchId is requested, return batch and detailed records
      if (batchId) {
        const batch = await NfpsBatch.findOne({ batchId }).lean();
        if (!batch) {
          return res.status(404).json({ error: 'NFPS batch not found.' });
        }
        const records = await NfpsRecord.find({ batchId }).lean();
        return res.status(200).json({ batch, records });
      }

      // Return list of all historical batches
      const batches = await NfpsBatch.find({}).sort({ createdAt: -1 }).limit(100).lean();
      return res.status(200).json({ batches });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('NFPS Batches Error:', error);
    res.status(500).json({ error: error.message });
  }
}
