import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'CHECKER', 'MAKER', 'VIEWER'],
      default: 'VIEWER',
    },
    permissions: {
      pages: {
        overview:     { type: Boolean, default: true },
        analytics:    { type: Boolean, default: true },
        transactions: { type: Boolean, default: true },
        approvals:    { type: Boolean, default: false },
        ledger:       { type: Boolean, default: true },
        parties:      { type: Boolean, default: false },
        loans:        { type: Boolean, default: true },
        users:        { type: Boolean, default: false },
      },
      actions: {
        createTransactions: { type: Boolean, default: false },
        approveReject:      { type: Boolean, default: false },
        deleteTransactions: { type: Boolean, default: false },
        manageParties:      { type: Boolean, default: false },
        downloadReports:    { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User || mongoose.model('User', userSchema);
