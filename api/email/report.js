import dbConnect from '../_lib/db.js';
import { verifyAuth } from '../_lib/auth.js';
import { sendNotification } from '../_lib/emailService.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    if (req.method === 'POST') {
      const { recipientEmail, reportTitle, period, attachments = [] } = req.body;
      const target = recipientEmail || user.email || 'admin@skderp.com';

      const result = await sendNotification('REPORT_EMAIL', target, {
        customer_name: user.name || 'Valued Recipient',
        report_title: reportTitle || 'Statement Report',
        period: period || 'All Time',
        company_name: 'SKD ERP Financial System',
        date: new Date().toLocaleString('en-IN'),
      }, `REPORT-EMAIL-${Date.now()}`, attachments);

      return res.status(200).json({
        message: `${reportTitle || 'Report'} sent to ${target}`,
        result,
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
