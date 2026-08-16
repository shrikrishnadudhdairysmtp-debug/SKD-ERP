import mongoose from 'mongoose';

const EmailLogSchema = new mongoose.Schema({
  // Unique Reference ID to prevent duplicate sending (e.g. LOAN-2026-0001-PAYMENT-20260816)
  eventRefId: { type: String, unique: true, index: true },

  recipient: { type: String, required: true, index: true },
  recipientName: { type: String, default: '' },
  subject: { type: String, required: true },
  notificationType: {
    type: String,
    enum: [
      'NEW_MEMBER',
      'LOAN_CREATED',
      'LOAN_PAYMENT',
      'PAYMENT_REMINDER',
      'PAYMENT_OVERDUE',
      'MILK_COLLECTION',
      'PAYMENT_RECEIVED',
      'LOAN_CLOSED',
      'REPORT_EMAIL',
      'TEST_EMAIL'
    ],
    required: true,
    index: true,
  },

  bodyHtml: { type: String, required: true },
  bodyText: { type: String, default: '' },

  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'SENT', 'FAILED'],
    default: 'PENDING',
    index: true,
  },

  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  errorMessage: { type: String, default: '' },
  sentAt: { type: Date, default: null },

  metadata: { type: Object, default: {} },
  attachments: [{
    filename: { type: String },
    content: { type: String },
    contentType: { type: String, default: 'application/pdf' },
  }],
}, { timestamps: true });

export default mongoose.models.EmailLog || mongoose.model('EmailLog', EmailLogSchema);
