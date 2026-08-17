import mongoose from 'mongoose';

const partySchema = new mongoose.Schema(
  {
    memberRef: { type: String, unique: true, sparse: true, index: true },
    voucherRef: { type: String, unique: true, sparse: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['CUSTOMER', 'VENDOR'], required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    receivableAccountId: { type: String, default: null },
    payableAccountId: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Party || mongoose.model('Party', partySchema);
