const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true }, // snapshot at submit time, so a later name change doesn't rewrite history
    score: { type: Number, required: true, min: 0, max: 100000 },
    mode: { type: String, enum: ['solo', 'vs'], default: 'solo' },
  },
  { timestamps: true }
);

scoreSchema.index({ mode: 1, score: -1 });

module.exports = mongoose.model('Score', scoreSchema);
