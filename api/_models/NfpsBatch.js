import mongoose from 'mongoose';

const NfpsBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true, index: true },
  originalFilename: { type: String, required: true },
  debitAccountNo: { type: String, default: '' },
  creditNarration: { type: String, default: 'MILK PAYMENT' },
  paymentDate: { type: String, default: '' },
  refPrefix: { type: String, default: 'NEFT' },

  totalRecords: { type: Number, default: 0 },
  validRecords: { type: Number, default: 0 },
  invalidRecords: { type: Number, default: 0 },
  duplicateRecords: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },

  nfpsFilename: { type: String, default: '' },
  nfpsFileBase64: { type: String, default: '' }, // Store generated file for direct re-downloading
  status: { type: String, enum: ['PROCESSED', 'PARTIAL', 'FAILED'], default: 'PROCESSED' },

  createdBy: { type: String, default: 'System Admin' },
  createdById: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.NfpsBatch || mongoose.model('NfpsBatch', NfpsBatchSchema);
