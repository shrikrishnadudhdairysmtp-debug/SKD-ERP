import dbConnect from '../../_lib/db.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';
import { sendNotification } from '../../_lib/emailService.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);
    requireRole(user, 'ADMIN');

    if (req.method === 'POST') {
      const { recipientEmail } = req.body;
      const target = recipientEmail || user.email || 'admin@skderp.com';

      const result = await sendNotification('TEST_EMAIL', target, {
        customer_name: user.name || 'SKD ERP Administrator',
        company_name: 'SKD ERP Financial System',
        date: new Date().toLocaleString('en-IN'),
      }, `TEST-EMAIL-${Date.now()}`);

      if (result.status !== 'SENT') {
        return res.status(400).json({
          error: `SMTP Delivery Failed: ${result.errorMessage || 'Invalid SMTP server credentials or connection error'}`,
          status: result.status,
          result,
        });
      }

      return res.status(200).json({
        message: `Test email sent and delivered to ${target}! Provider Response: ${result.providerResponse || '250 OK'}`,
        messageId: result.messageId,
        providerResponse: result.providerResponse,
        result,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
