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
      const obj = settings.toObject({ virtuals: true });
      // SECURITY: Mask password before returning to frontend
      if (obj.smtpPassword) {
        obj.smtpPassword = '••••••••••••';
      }
      return res.status(200).json(obj);
    }

    if (req.method === 'POST') {
      requireRole(user, 'ADMIN');

      const {
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPassword,
        senderName,
        senderEmail,
        secureSsl,
        enabled,
        notificationToggles,
        companyName,
        companyLogoUrl,
        companyContact,
      } = req.body;

      if (smtpHost !== undefined) settings.smtpHost = smtpHost;
      if (smtpPort !== undefined) settings.smtpPort = Number(smtpPort);
      if (smtpUsername !== undefined) settings.smtpUsername = smtpUsername;
      
      // Update password only if user provided a new non-masked password
      if (smtpPassword && !smtpPassword.startsWith('••••')) {
        settings.smtpPassword = smtpPassword;
      }

      if (senderName !== undefined) settings.senderName = senderName;
      if (senderEmail !== undefined) settings.senderEmail = senderEmail;
      if (secureSsl !== undefined) settings.secureSsl = Boolean(secureSsl);
      if (enabled !== undefined) settings.enabled = Boolean(enabled);
      if (notificationToggles !== undefined) settings.notificationToggles = { ...settings.notificationToggles, ...notificationToggles };
      if (companyName !== undefined) settings.companyName = companyName;
      if (companyLogoUrl !== undefined) settings.companyLogoUrl = companyLogoUrl;
      if (companyContact !== undefined) settings.companyContact = companyContact;

      await settings.save();

      await AuditTrail.create({
        action: 'EMAIL_SETTINGS_UPDATED',
        user: user.name,
        role: user.role,
        details: { enabled: settings.enabled, senderEmail: settings.senderEmail, smtpHost: settings.smtpHost },
      });

      const updatedObj = settings.toObject({ virtuals: true });
      if (updatedObj.smtpPassword) {
        updatedObj.smtpPassword = '••••••••••••';
      }

      return res.status(200).json(updatedObj);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
