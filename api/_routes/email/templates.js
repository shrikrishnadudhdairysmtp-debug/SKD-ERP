import dbConnect from '../../_lib/db.js';
import EmailSetting from '../../_models/EmailSetting.js';
import AuditTrail from '../../_models/AuditTrail.js';
import { verifyAuth, requireRole } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    await dbConnect();
    const user = verifyAuth(req);

    let settings = await EmailSetting.findOne({ key: 'GLOBAL_SETTINGS' });
    if (!settings) {
      settings = await EmailSetting.create({ key: 'GLOBAL_SETTINGS' });
    }

    if (req.method === 'GET') {
      return res.status(200).json(settings.templates || {});
    }

    if (req.method === 'POST') {
      requireRole(user, 'ADMIN');
      const { templates } = req.body;

      if (!templates || typeof templates !== 'object') {
        return res.status(400).json({ error: 'Invalid templates payload.' });
      }

      settings.templates = {
        ...settings.templates,
        ...templates,
      };

      await settings.save();

      await AuditTrail.create({
        action: 'EMAIL_TEMPLATES_UPDATED',
        user: user.name,
        role: user.role,
        details: { updatedKeys: Object.keys(templates) },
      });

      return res.status(200).json(settings.templates);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
