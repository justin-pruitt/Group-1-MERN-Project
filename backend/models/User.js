const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    settings: {
      crtBulge: { type: Boolean, default: false },
      scanLines: { type: Boolean, default: false },
      sfxVolume: { type: Number, default: 0.8, min: 0, max: 1 },
      musicVolume: { type: Number, default: 0.5, min: 0, max: 1 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
