import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    accountId: { type: String, required: true },
    debit: { type: Number, required: true, default: 0 },
    credit: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    voucherRef: { type: String, unique: true, sparse: true, index: true },
    refType: { type: String, enum: ['IN', 'OUT'], default: 'IN' },
    refModule: { type: String, default: 'TRANSACTION' },
    entries: [entrySchema],
    date: { type: Date, required: true },
    remarks: { type: String, required: true },
    partyId: { type: String, default: null },
    category: { type: String, default: null },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
    },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
    createdById: { type: String, default: null },
    approvedBy: { type: String, default: null },
    approvedById: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    rejectedById: { type: String, default: null },
    rejectionNote: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    deleteReason: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Pre-save validation: debits must equal credits
transactionSchema.pre('save', function () {
  if (this.isModified('entries')) {
    const totalDebits = this.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = this.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(`Double-entry violation: debits (${totalDebits}) ≠ credits (${totalCredits})`);
    }
  }
});

// Composite index for the most common query pattern
transactionSchema.index({ status: 1, isDeleted: 1, date: -1 });
transactionSchema.index({ partyId: 1, date: -1 });
transactionSchema.index({ createdById: 1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
