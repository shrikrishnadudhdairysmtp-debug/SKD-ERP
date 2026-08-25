import mongoose from 'mongoose';

const NfpsRecordSchema = new mongoose.Schema({
  batchId: { type: String, required: true, index: true },
  sourceFilename: { type: String, required: true },
  sourceRowNumber: { type: Number, default: 0 },
  sourceCode: { type: String, default: '' },

  // NFPS Master Format Fields
  pymtProdTypeCode: { type: String, default: 'PAB_VENDOR' },
  pymtMode: { type: String, default: 'NEFT' },
  debitAccNo: { type: String, required: true },
  farmerName: { type: String, required: true }, // BNF_NAME
  beneAccNo: { type: String, required: true, index: true }, // BENE_ACC_NO
  beneIfsc: { type: String, required: true }, // BENE_IFSC
  amount: { type: Number, required: true },
  creditNarr: { type: String, default: 'MILK PAYMENT' },
  paymentDate: { type: String, required: true }, // PYMT_DATE
  mobileNum: { type: String, default: '' },
  emailId: { type: String, default: '' },
  remark: { type: String, default: '' },
  refNo: { type: String, required: true, unique: true, index: true }, // REF_NO (NEFTYYYYMMDDXXXX)

  status: { type: String, enum: ['VALID', 'INVALID', 'DUPLICATE', 'SAVED'], default: 'VALID' },
  errorMessage: { type: String, default: '' },

  createdBy: { type: String, default: 'System Admin' },
}, { timestamps: true });

export default mongoose.models.NfpsRecord || mongoose.model('NfpsRecord', NfpsRecordSchema);
