import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    interestPaid: { type: Number, required: true },
    principalPaid: { type: Number, required: true },
    paymentMode: { type: String, default: 'acc_bank' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

const loanSchema = new mongoose.Schema(
  {
    loanId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    partyId: {
      type: String,
      required: true,
    },
    partyName: {
      type: String,
      required: true,
    },
    loanAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    monthlyInterestRate: {
      type: Number,
      required: true,
      default: 2.0, // 2.0% per month (₹2,000 per ₹1,00,000)
    },
    tenureMonths: {
      type: Number,
      required: true,
      default: 12,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'DEFAULTED', 'CLOSED'],
      default: 'ACTIVE',
    },
    principalPaid: {
      type: Number,
      default: 0,
    },
    interestPaid: {
      type: Number,
      default: 0,
    },
    payments: [paymentSchema],
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Helper virtual for monthly interest amount
loanSchema.virtual('monthlyInterestAmount').get(function () {
  const currentOutstandingPrincipal = Math.max(0, this.loanAmount - (this.principalPaid || 0));
  return (currentOutstandingPrincipal * (this.monthlyInterestRate || 2.0)) / 100;
});

loanSchema.set('toJSON', { virtuals: true });
loanSchema.set('toObject', { virtuals: true });

export default mongoose.models.Loan || mongoose.model('Loan', loanSchema);
