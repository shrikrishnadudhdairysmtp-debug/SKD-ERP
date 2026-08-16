import mongoose from 'mongoose';

const DEFAULT_TEMPLATES = {
  NEW_MEMBER: {
    subject: 'Welcome to SKD ERP — New Member Registration Confirmed',
    body: 'Dear {{customer_name}},\n\nWelcome to {{company_name}}! Your member registration has been successfully created.\n\nMember ID: {{member_id}}\nRegistration Date: {{date}}\nContact: {{phone}}\n\nThank you for choosing SKD ERP.\n\nBest regards,\n{{company_name}} Team',
  },
  LOAN_CREATED: {
    subject: 'Loan Issued Successfully — ID: {{loan_id}}',
    body: 'Dear {{customer_name}},\n\nYour loan request of ₹{{loan_amount}} has been approved and issued successfully.\n\nLoan Details:\n• Loan ID: {{loan_id}}\n• Amount Disbursed: ₹{{loan_amount}}\n• Monthly Fixed Interest Rate: {{interest_rate}}% (₹2,000/lakh)\n• Monthly Interest: ₹{{monthly_interest}}\n• Start Date: {{date}}\n• Tenure: {{tenure}} Months\n• Total Outstanding: ₹{{outstanding_amount}}\n\nThank you,\n{{company_name}}',
  },
  LOAN_PAYMENT: {
    subject: 'Loan Payment Confirmation — ID: {{loan_id}}',
    body: 'Dear {{customer_name}},\n\nWe have received your loan payment of ₹{{payment_amount}} on {{payment_date}}.\n\nPayment Breakdown:\n• Principal Paid: ₹{{principal_paid}}\n• Interest Paid: ₹{{interest_paid}}\n• Remaining Principal: ₹{{remaining_principal}}\n• Remaining Interest: ₹{{remaining_interest}}\n• Total Outstanding: ₹{{outstanding_amount}}\n• Next Due Date: {{due_date}}\n\nThank you for your timely payment!\n\nBest regards,\n{{company_name}}',
  },
  PAYMENT_REMINDER: {
    subject: 'Payment Reminder — Loan ID: {{loan_id}} Due Soon',
    body: 'Dear {{customer_name}},\n\nThis is a friendly reminder that your loan repayment of ₹{{payment_amount}} is due on {{due_date}}.\n\nLoan ID: {{loan_id}}\nTotal Outstanding: ₹{{outstanding_amount}}\n\nPlease make your payment on or before the due date to avoid overdue charges.\n\nThank you,\n{{company_name}}',
  },
  PAYMENT_OVERDUE: {
    subject: '⚠️ Urgent: Loan Payment Overdue — ID: {{loan_id}}',
    body: 'Dear {{customer_name}},\n\nYour loan payment of ₹{{payment_amount}} for Loan ID {{loan_id}} was due on {{due_date}} and is now OVERDUE.\n\nTotal Outstanding Balance: ₹{{outstanding_amount}}\n\nPlease clear the pending installment immediately using Cash or Bank transfer.\n\nRegards,\n{{company_name}} Recovery Desk',
  },
  MILK_COLLECTION: {
    subject: 'Milk Collection Entry Confirmation — {{date}}',
    body: 'Dear {{customer_name}},\n\nMilk collection recorded for {{date}}.\n\nCollection Details:\n• Milk Type: {{milk_type}}\n• Quantity: {{quantity}} Liters\n• Fat: {{fat}}%\n• SNF: {{snf}}%\n• Rate per Liter: ₹{{rate}}\n• Total Credit Amount: ₹{{total_amount}}\n\nThank you,\n{{company_name}} Dairy Unit',
  },
  PAYMENT_RECEIVED: {
    subject: 'Financial Payment Confirmation — Ref: {{txn_id}}',
    body: 'Dear {{customer_name}},\n\nWe have processed a transaction of ₹{{payment_amount}} on {{date}}.\n\nTransaction ID: {{txn_id}}\nCategory: {{category}}\nRemarks: {{remarks}}\n\nThank you,\n{{company_name}} Accounts Team',
  },
  LOAN_CLOSED: {
    subject: 'Loan Account Closed & No Dues Certificate — ID: {{loan_id}}',
    body: 'Dear {{customer_name}},\n\nCongratulations! Your loan account {{loan_id}} has been fully paid off and officially CLOSED.\n\nTotal Amount Paid: ₹{{loan_amount}}\nClosure Date: {{date}}\n\nThank you for doing business with {{company_name}}.\n\nWarm regards,\n{{company_name}} Management',
  },
  REPORT_EMAIL: {
    subject: 'SKD ERP Statement Report — {{report_title}}',
    body: 'Dear {{customer_name}},\n\nPlease find your requested {{report_title}} report below.\n\nReport Period: {{period}}\nGenerated On: {{date}}\n\nThank you for choosing {{company_name}}.\n\nBest regards,\n{{company_name}} Reporting Desk',
  },
  TEST_EMAIL: {
    subject: 'SMTP Connection Test — SKD ERP Notification System',
    body: 'Dear {{customer_name}},\n\nThis is an automated test email to confirm that your SMTP Mail Server settings are configured correctly.\n\nDispatch Time: {{date}}\n\nBest regards,\n{{company_name}} System Admin',
  },
};

const EmailSettingSchema = new mongoose.Schema({
  // Key identifier for singleton settings
  key: { type: String, default: 'GLOBAL_SETTINGS', unique: true },

  // SMTP Credentials & Server Config
  smtpHost: { type: String, default: 'smtp.gmail.com' },
  smtpPort: { type: Number, default: 587 },
  smtpUsername: { type: String, default: '' },
  smtpPassword: { type: String, default: '' },
  senderName: { type: String, default: 'SKD ERP Financial System' },
  senderEmail: { type: String, default: 'noreply@skderp.com' },
  secureSsl: { type: Boolean, default: false },
  enabled: { type: Boolean, default: true },

  // Notification Control Toggles
  notificationToggles: {
    type: Object,
    default: {
      newMember: true,
      newLoan: true,
      paymentReceived: true,
      paymentReminder: true,
      overduePayment: true,
      loanClosure: true,
      milkCollection: true,
      invoice: true,
    }
  },

  // Company Branding & Custom Email Templates
  companyName: { type: String, default: 'SKD ERP Services' },
  companyLogoUrl: { type: String, default: '' },
  companyContact: { type: String, default: '+91 98765 43210 | support@skderp.com' },

  templates: {
    type: Object,
    default: DEFAULT_TEMPLATES,
  },
}, { timestamps: true });

export default mongoose.models.EmailSetting || mongoose.model('EmailSetting', EmailSettingSchema);
