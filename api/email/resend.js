import dbConnect from '../_lib/db.js';
import EmailLog from '../_models/EmailLog.js';
import AuditTrail from '../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../_lib/auth.js';
import { processSingleEmail } from '../_lib/emailService.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);
    requireRole(user, 'ADMIN');

    if (req.method === 'POST') {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Missing email log ID.' });
      }

      const log = await EmailLog.findById(id);
      if (!log) {
        return res.status(404).json({ error: 'Email log entry not found.' });
      }

      // Reset retry state and process
      log.status = 'PENDING';
      log.errorMessage = '';
      await log.save();

      await processSingleEmail(log._id);

      const updatedLog = await EmailLog.findById(id);

      await AuditTrail.create({
        action: 'EMAIL_RESENT',
        user: user.name,
        role: user.role,
        details: { logId: id, recipient: log.recipient, newStatus: updatedLog.status },
      });

      return res.status(200).json({
        message: 'Email resend attempted.',
        log: updatedLog,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
