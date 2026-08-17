import mongoose from 'mongoose';

const sequenceCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. "2026-IN-MEMBER"
    year: { type: Number, required: true },
    type: { type: String, required: true, enum: ['IN', 'OUT'] },
    module: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

sequenceCounterSchema.index({ year: 1, type: 1, module: 1 });

export default mongoose.models.SequenceCounter || mongoose.model('SequenceCounter', sequenceCounterSchema);
