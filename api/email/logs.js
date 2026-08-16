import dbConnect from '../_lib/db.js';
import EmailLog from '../_models/EmailLog.js';
import { verifyAuth, requireRole } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);
    requireRole(user, 'ADMIN', 'CHECKER');

    if (req.method === 'GET') {
      const { search, status, type, page = 1, limit = 50 } = req.query;
      let filter = {};

      if (status && status !== 'ALL') {
        filter.status = status;
      }

      if (type && type !== 'ALL') {
        filter.notificationType = type;
      }

      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [
          { recipient: regex },
          { recipientName: regex },
          { subject: regex },
          { eventRefId: regex },
        ];
      }

      const totalLogs = await EmailLog.countDocuments(filter);
      const logs = await EmailLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

      // Calculate overview metrics
      const summary = {
        total: await EmailLog.countDocuments(),
        sent: await EmailLog.countDocuments({ status: 'SENT' }),
        pending: await EmailLog.countDocuments({ status: 'PENDING' }),
        failed: await EmailLog.countDocuments({ status: 'FAILED' }),
      };

      return res.status(200).json({
        data: logs,
        pagination: {
          total: totalLogs,
          page: Number(page),
          pages: Math.ceil(totalLogs / Number(limit)),
        },
        summary,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
