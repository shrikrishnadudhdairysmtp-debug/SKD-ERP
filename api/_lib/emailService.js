import nodemailer from 'nodemailer';
import dbConnect from './db.js';
import EmailSetting from '../_models/EmailSetting.js';
import EmailLog from '../_models/EmailLog.js';
import { generateTransactionPdf } from './pdfGenerator.js';

// Singleton Transporter Cache for Sub-Millisecond High Performance
let cachedTransporter = null;
let cachedSettingsHash = '';

/**
 * Fetch or initialize global email settings.
 */
export async function getEmailSettings() {
  await dbConnect();
  let settings = await EmailSetting.findOne({ key: 'GLOBAL_SETTINGS' });
  if (!settings) {
    try {
      settings = await EmailSetting.create({ key: 'GLOBAL_SETTINGS' });
    } catch (err) {
      if (err.code === 11000) {
        settings = await EmailSetting.findOne({ key: 'GLOBAL_SETTINGS' });
      } else {
        throw err;
      }
    }
  }
  return settings;
}

/**
 * Replace placeholders like {{customer_name}}, {{loan_amount}} with actual values.
 */
export function replaceVariables(templateStr = '', data = {}) {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = data[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'number') {
        return val.toLocaleString('en-IN');
      }
      return String(val);
    }
    return '';
  });
}

/**
 * Get or create high-performance pooled Nodemailer Transporter.
 */
export async function createTransporter() {
  const settings = await getEmailSettings();

  if (
    settings.enabled &&
    settings.smtpHost &&
    settings.smtpUsername &&
    settings.smtpPassword
  ) {
    const portNum = Number(settings.smtpPort) || 587;
    const isSecure = portNum === 465;
    const currentHash = `${settings.smtpHost}:${portNum}:${settings.smtpUsername}:${settings.smtpPassword}:${settings.secureSsl}`;

    // Reuse existing pooled connection if configuration hasn't changed
    if (cachedTransporter && cachedSettingsHash === currentHash) {
      return {
        transporter: cachedTransporter,
        senderName: settings.senderName || 'SKD ERP Financial System',
        senderEmail: settings.senderEmail || settings.smtpUsername,
        isRealSmtp: true,
      };
    }

    // Initialize new high-performance pooled connection
    cachedTransporter = nodemailer.createTransport({
      pool: true, // Reuse TCP/TLS connections
      maxConnections: 5,
      maxMessages: 100,
      host: settings.smtpHost,
      port: portNum,
      secure: isSecure,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    cachedSettingsHash = currentHash;

    return {
      transporter: cachedTransporter,
      senderName: settings.senderName || 'SKD ERP Financial System',
      senderEmail: settings.senderEmail || settings.smtpUsername,
      isRealSmtp: true,
    };
  }

  // Fallback: Simulated logger transport when SMTP credentials aren't set yet
  return {
    transporter: {
      sendMail: async (mailOptions) => {
        console.log(`[SIMULATED EMAIL LOG] To: ${mailOptions.to} | Subject: "${mailOptions.subject}"`);
        return { messageId: `simulated-${Date.now()}` };
      }
    },
    senderName: settings.senderName || 'SKD ERP (Simulated)',
    senderEmail: settings.senderEmail || 'noreply@skderp.local',
    isRealSmtp: false,
  };
}

/**
 * Premium Modern HTML Email Layout Builder
 */
function buildPremiumHtmlEmail(subject, bodyContent, companyName, companyContact) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b; }
    .email-container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .email-header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 24px 30px; text-align: left; }
    .email-header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .email-header p { color: #93c5fd; margin: 4px 0 0 0; font-size: 13px; }
    .email-body { padding: 30px; font-size: 15px; line-height: 1.6; color: #334155; }
    .email-body p { margin-top: 0; margin-bottom: 16px; }
    .email-footer { background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    .email-badge { display: inline-block; padding: 4px 10px; background: #e0f2fe; color: #0369a1; font-weight: 600; border-radius: 4px; font-size: 12px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>${companyName || 'SKD ERP Financial System'}</h1>
      <p>Official System Notification</p>
    </div>
    <div class="email-body">
      <div class="email-badge">✓ Verified System Transaction</div>
      <div style="white-space: pre-wrap;">${bodyContent}</div>
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 4px 0;"><strong>${companyName || 'SKD ERP'}</strong> • ${companyContact || 'Support & Customer Desk'}</p>
      <p style="margin: 0; color: #94a3b8;">This is an automated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Centralized Reusable Notification Function (Sub-Millisecond Response)
 */
export async function sendNotification(type, recipient, data = {}, eventRefId = null, attachments = []) {
  try {
    await dbConnect();
    const settings = await getEmailSettings();

    // Check global toggle
    if (!settings.enabled) {
      return { status: 'DISABLED' };
    }

    // Check event toggle
    const toggleKeyMap = {
      NEW_MEMBER: 'newMember',
      LOAN_CREATED: 'newLoan',
      LOAN_PAYMENT: 'paymentReceived',
      PAYMENT_REMINDER: 'paymentReminder',
      PAYMENT_OVERDUE: 'overduePayment',
      MILK_COLLECTION: 'milkCollection',
      PAYMENT_RECEIVED: 'paymentReceived',
      LOAN_CLOSED: 'loanClosure',
      REPORT_EMAIL: 'invoice',
    };

    const toggleKey = toggleKeyMap[type];
    if (toggleKey && settings.notificationToggles[toggleKey] === false) {
      return { status: 'TOGGLE_DISABLED' };
    }

    if (!recipient || !recipient.includes('@')) {
      recipient = settings.senderEmail || 'customer@skderp.com';
    }

    // Event Reference ID for Duplicate Protection
    const refId = eventRefId || `${type}-${data.loan_id || data.member_id || data.txn_id || Date.now()}-${new Date().toISOString().slice(0, 10)}`;

    const existingLog = await EmailLog.findOne({ eventRefId: refId });
    if (existingLog) {
      return { status: 'DUPLICATE_PREVENTED', log: existingLog };
    }

    // Render template
    const templateObj = settings.templates[type] || {
      subject: `SKD ERP Notification - ${type}`,
      body: `Dear {{customer_name}},\n\nThis is an automated notification regarding ${type}.\n\nBest regards,\n{{company_name}}`,
    };

    const dataWithCompany = {
      company_name: settings.companyName || 'SKD ERP',
      customer_name: data.customer_name || data.partyName || data.name || 'Valued Customer',
      date: new Date().toLocaleDateString('en-IN'),
      ...data,
    };

    const renderedSubject = replaceVariables(templateObj.subject, dataWithCompany);
    const renderedBodyText = replaceVariables(templateObj.body, dataWithCompany);
    const renderedBodyHtml = buildPremiumHtmlEmail(
      renderedSubject,
      renderedBodyText,
      settings.companyName,
      settings.companyContact
    );

    // Auto-generate official PDF receipt attachment with complete calculations for every transaction
    let finalAttachments = attachments || [];
    if ((!finalAttachments || finalAttachments.length === 0) && type !== 'TEST_EMAIL') {
      const autoPdf = generateTransactionPdf(type, dataWithCompany, settings.companyName);
      if (autoPdf) {
        const filenameMap = {
          LOAN_CREATED: `Loan_Sanction_Advice_${data.loan_id || 'LOAN'}.pdf`,
          LOAN_PAYMENT: `Loan_Payment_Receipt_${data.loan_id || 'PAY'}.pdf`,
          NEW_MEMBER: `Member_Registration_${data.member_id || 'MEMBER'}.pdf`,
          MILK_COLLECTION: `Milk_Collection_Slip_${data.txn_id || 'MILK'}.pdf`,
          PAYMENT_RECEIVED: `Payment_Voucher_${data.txn_id || 'TXN'}.pdf`,
          LOAN_CLOSED: `Loan_Closure_Certificate_${data.loan_id || 'CLOSED'}.pdf`,
        };
        finalAttachments = [{
          filename: filenameMap[type] || `SKD_ERP_${type}_Receipt.pdf`,
          content: autoPdf,
          contentType: 'application/pdf',
        }];
      }
    }

    // Save to Queue (Instant response)
    const emailLog = await EmailLog.create({
      eventRefId: refId,
      recipient,
      recipientName: dataWithCompany.customer_name,
      subject: renderedSubject,
      notificationType: type,
      bodyHtml: renderedBodyHtml,
      bodyText: renderedBodyText,
      status: 'PENDING',
      metadata: dataWithCompany,
      attachments: finalAttachments,
    });

    // Trigger instant background dispatch without blocking API tick
    setImmediate(() => {
      processSingleEmail(emailLog._id).catch(err => console.error('Instant dispatch error:', err));
    });

    return { status: 'QUEUED', logId: emailLog._id };
  } catch (error) {
    console.error(`Failed to dispatch notification ${type}:`, error);
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * High-Speed Single Email Dispatcher
 */
export async function processSingleEmail(emailLogId) {
  try {
    await dbConnect();

    // Atomically claim the log so no parallel worker tick processes it concurrently
    const log = await EmailLog.findOneAndUpdate(
      {
        _id: emailLogId,
        status: { $in: ['PENDING', 'FAILED'] },
      },
      { $set: { status: 'PROCESSING' } },
      { returnDocument: 'after' }
    );

    if (!log) return;

    const { transporter, senderName, senderEmail } = await createTransporter();

    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: log.recipient,
      subject: log.subject,
      text: log.bodyText,
      html: log.bodyHtml,
    };

    if (log.attachments && log.attachments.length > 0) {
      mailOptions.attachments = log.attachments.map(att => {
        let rawContent = att.content || '';
        if (rawContent.includes('base64,')) {
          rawContent = rawContent.split('base64,')[1];
        }
        // Strip any whitespace/URI params that corrupt binary decoding
        const cleanBase64 = rawContent.replace(/[^A-Za-z0-9+/=]/g, '');
        const pdfBuf = Buffer.from(cleanBase64, 'base64');
        return {
          filename: att.filename || 'SKD_ERP_Report.pdf',
          content: pdfBuf,
          contentType: 'application/pdf',
        };
      });
    }

    try {
      await transporter.sendMail(mailOptions);

      await EmailLog.updateOne(
        { _id: log._id },
        {
          $set: {
            status: 'SENT',
            sentAt: new Date(),
            errorMessage: '',
          }
        }
      );
      console.log(`⚡ [INSTANT EMAIL SENT] To: ${log.recipient} | Subject: "${log.subject}"`);
    } catch (err) {
      const newRetry = (log.retryCount || 0) + 1;
      const isFailed = newRetry >= (log.maxRetries || 3);
      await EmailLog.updateOne(
        { _id: log._id },
        {
          $set: {
            retryCount: newRetry,
            errorMessage: err.message || 'Delivery failed',
            status: isFailed ? 'FAILED' : 'PENDING',
          }
        }
      );
      console.error(`❌ Email send failed (Attempt ${newRetry}/${log.maxRetries || 3}): ${err.message}`);
    }
  } catch (err) {
    console.error('Single email process error:', err);
  }
}

/**
 * Ultra-Fast Parallel Queue Processing Engine (Batch Concurrent Processing)
 */
export async function processEmailQueue() {
  try {
    await dbConnect();
    const pendingLogs = await EmailLog.find({
      status: { $in: ['PENDING', 'FAILED'] },
      $expr: { $lt: ['$retryCount', '$maxRetries'] }
    }).limit(10);

    if (pendingLogs.length > 0) {
      // Process pending emails concurrently in parallel
      await Promise.allSettled(pendingLogs.map(log => processSingleEmail(log._id)));
    }
  } catch (err) {
    console.error('Queue processing worker error:', err);
  }
}
