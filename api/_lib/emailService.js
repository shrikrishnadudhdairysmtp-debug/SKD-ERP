import nodemailer from 'nodemailer';
import dbConnect from './db.js';
import EmailSetting from '../_models/EmailSetting.js';
import EmailLog from '../_models/EmailLog.js';
import { generateTransactionPdf } from './pdfGenerator.js';

/**
 * Creates Nodemailer transporter using dynamic database settings or environment variables
 */
export async function createTransporter() {
  await dbConnect();

  const settings = await EmailSetting.findOne({ singletonKey: 'GLOBAL_SETTINGS' });

  const host = settings?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const portNum = Number(settings?.smtpPort || process.env.SMTP_PORT || 587);

  // Force secure: true ONLY for Port 465 (Direct SSL/TLS).
  // For Port 587/25/2525, secure MUST be false (STARTTLS) to prevent OpenSSL 'wrong version number' errors.
  const isSecure = portNum === 465;

  const user = settings?.smtpUsername || process.env.SMTP_USER || '';
  const pass = settings?.smtpPassword || process.env.SMTP_PASS || '';

  const senderName = settings?.senderName || 'SKD ERP Dairy System';
  const senderEmail = settings?.senderEmail || user || 'notifications@skderp.com';

  const isRealSmtp = Boolean(user && pass);

  if (isRealSmtp) {
    const transporter = nodemailer.createTransport({
      host,
      port: portNum,
      secure: isSecure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    return { transporter, senderName, senderEmail, isRealSmtp: true, settings };
  }

  // Fallback Ethereal / Simulated local transporter if SMTP not configured
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return { transporter, senderName, senderEmail, isRealSmtp: false, settings };
}

/**
 * Helper to replace {{template_variables}} in email subject/body
 */
function replaceVariables(templateStr, data) {
  if (!templateStr) return '';
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== null ? data[key] : `{{${key}}}`;
  });
}

/**
 * Premium Responsive HTML Email Layout Wrapper
 */
function buildPremiumHtmlEmail(subject, bodyText, companyName = 'SKD ERP Dairy System', contact = 'support@skderp.com') {
  const formattedBody = bodyText.replace(/\n/g, '<br/>');
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
        .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
        .content { padding: 28px; line-height: 1.6; font-size: 15px; color: #cbd5e1; }
        .footer { background-color: #0f172a; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
        .badge { display: inline-block; padding: 4px 12px; background: #3b82f622; color: #60a5fa; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${companyName}</h1>
        </div>
        <div class="content">
          <div class="badge">Official Transaction Notice</div>
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">${subject}</h2>
          <div>${formattedBody}</div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
          <p>Need assistance? Contact us at ${contact}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Main Email Notification Dispatcher Engine
 */
export async function sendNotification(type, recipient, data = {}, eventRefId = null, attachments = []) {
  try {
    await dbConnect();

    const settings = await EmailSetting.findOne({ singletonKey: 'GLOBAL_SETTINGS' }) || {};

    if (settings.enabled === false) {
      return { status: 'DISABLED' };
    }

    const toggleKeyMap = {
      NEW_MEMBER: 'memberRegistration',
      LOAN_CREATED: 'loanDisbursal',
      LOAN_PAYMENT: 'loanPayment',
      MILK_COLLECTION: 'milkCollection',
      PAYMENT_RECEIVED: 'paymentReceived',
      LOAN_CLOSED: 'loanClosure',
      REPORT_EMAIL: 'invoice',
    };

    const toggleKey = toggleKeyMap[type];
    if (toggleKey && settings.notificationToggles && settings.notificationToggles[toggleKey] === false) {
      return { status: 'TOGGLE_DISABLED' };
    }

    if (!recipient || !recipient.includes('@')) {
      recipient = process.env.SENDER_EMAIL || settings.senderEmail || 'customer@skderp.com';
    }

    // Event Reference ID for Duplicate Protection
    const refId = eventRefId || `${type}-${data.loan_id || data.member_id || data.txn_id || Date.now()}-${new Date().toISOString().slice(0, 10)}`;

    const existingLog = await EmailLog.findOne({ eventRefId: refId });
    if (existingLog && existingLog.status === 'SENT') {
      return { status: 'DUPLICATE_PREVENTED', log: existingLog };
    }

    // Render template
    const templateObj = (settings.templates && settings.templates[type]) || {
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

    // Auto-generate official PDF receipt attachment
    let finalAttachments = attachments || [];
    if ((!finalAttachments || finalAttachments.length === 0) && type !== 'TEST_EMAIL') {
      try {
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
      } catch (pdfErr) {
        console.error('PDF generation warning (continuing email dispatch):', pdfErr);
      }
    }

    // Create or update log entry
    let emailLog = existingLog;
    if (!emailLog) {
      emailLog = await EmailLog.create({
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
    }

    // Immediately trigger active dispatch with up to 3 retries
    try {
      await processSingleEmail(emailLog._id);
    } catch (dispatchErr) {
      console.error('Email dispatch error:', dispatchErr);
    }

    const updatedLog = await EmailLog.findById(emailLog._id);
    return {
      status: updatedLog ? updatedLog.status : 'QUEUED',
      logId: emailLog._id,
      errorMessage: updatedLog ? updatedLog.errorMessage : null,
    };
  } catch (error) {
    console.error(`Failed to dispatch notification ${type}:`, error);
    return { status: 'ERROR', error: error.message };
  }
}

/**
 * Single Email Dispatcher with Active Immediate Retry Loop (Up to 3 Times)
 */
export async function processSingleEmail(emailLogId) {
  try {
    await dbConnect();

    // Atomically claim the log
    const log = await EmailLog.findOneAndUpdate(
      {
        _id: emailLogId,
        status: { $in: ['PENDING', 'FAILED', 'PROCESSING'] },
      },
      { $set: { status: 'PROCESSING' } },
      { returnDocument: 'after' }
    );

    if (!log) return;

    const { transporter, senderName, senderEmail, isRealSmtp } = await createTransporter();

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
        if (typeof rawContent === 'string') {
          if (rawContent.includes('base64,')) {
            rawContent = rawContent.split('base64,')[1];
          }
          const cleanBase64 = rawContent.replace(/[^A-Za-z0-9+/=]/g, '');
          const pdfBuf = Buffer.from(cleanBase64, 'base64');
          return {
            filename: att.filename || 'SKD_ERP_Report.pdf',
            content: pdfBuf,
            contentType: 'application/pdf',
          };
        }
        return {
          filename: att.filename || 'SKD_ERP_Report.pdf',
          content: rawContent,
          contentType: 'application/pdf',
        };
      });
    }

    const maxRetries = log.maxRetries || 3;
    let lastError = null;
    let success = false;

    // Immediate active retry loop up to 3 times
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 [EMAIL DISPATCH] Attempt ${attempt}/${maxRetries} to ${log.recipient} ("${log.subject}")...`);

        await EmailLog.updateOne(
          { _id: log._id },
          { $set: { retryCount: attempt, status: 'PROCESSING', errorMessage: `Attempt ${attempt}/${maxRetries} in progress...` } }
        );

        const sendResult = await transporter.sendMail(mailOptions);

        await EmailLog.updateOne(
          { _id: log._id },
          {
            $set: {
              status: 'SENT',
              sentAt: new Date(),
              retryCount: attempt,
              errorMessage: isRealSmtp ? '' : 'SMTP credentials not set; email was simulated locally.',
              metadata: { ...log.metadata, messageId: sendResult.messageId, isRealSmtp },
            }
          }
        );
        console.log(`⚡ [EMAIL DISPATCH SUCCESS] Attempt ${attempt}/${maxRetries} | To: ${log.recipient} | SMTP: ${isRealSmtp ? 'REAL' : 'SIMULATED'}`);
        success = true;
        break; // Exit retry loop immediately on success!
      } catch (err) {
        lastError = err;
        console.error(`⚠️ [EMAIL DISPATCH FAILED] Attempt ${attempt}/${maxRetries} to ${log.recipient}: ${err.message}`);
        
        if (attempt < maxRetries) {
          // Pause 1 second before immediate next retry attempt
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    }

    if (!success) {
      await EmailLog.updateOne(
        { _id: log._id },
        {
          $set: {
            status: 'FAILED',
            retryCount: maxRetries,
            errorMessage: `Failed after ${maxRetries} immediate attempts: ${lastError ? lastError.message : 'Unknown transport error'}`,
          }
        }
      );
      console.error(`❌ [EMAIL DISPATCH PERMANENT FAILURE] All ${maxRetries} immediate retry attempts failed for ${log.recipient}.`);
    }
  } catch (err) {
    console.error('Single email process error:', err);
  }
}

/**
 * Process all pending & failed emails with immediate retries
 */
export async function processPendingQueue() {
  await dbConnect();
  const pendingLogs = await EmailLog.find({ status: { $in: ['PENDING', 'FAILED'] } }).sort({ createdAt: 1 }).limit(50);
  console.log(`🔄 Processing ${pendingLogs.length} pending queue email items...`);
  
  let processed = 0;
  for (const log of pendingLogs) {
    await processSingleEmail(log._id);
    processed++;
  }
  
  return { total: pendingLogs.length, processed };
}
