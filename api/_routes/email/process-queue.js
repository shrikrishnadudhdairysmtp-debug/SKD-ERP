import dbConnect from '../../_lib/db.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { processPendingQueue } from '../../_lib/emailService.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);
    requireRole(user, 'ADMIN', 'CHECKER');

    if (req.method === 'POST') {
      const result = await processPendingQueue();

      await AuditTrail.create({
        action: 'EMAIL_QUEUE_PROCESSED',
        user: user.name,
        role: user.role,
        details: { processed: result.processed, total: result.total },
      });

      return res.status(200).json({
        message: `Successfully processed ${result.processed} items in queue with up to 3 retries each.`,
        ...result,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
