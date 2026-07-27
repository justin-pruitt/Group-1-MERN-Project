const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    // Custom username, distinct from the Google-supplied displayName. Optional —
    // falls back to displayName everywhere until the player sets one.
    username: {
      type: String,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
      unique: true,
      sparse: true, // lets many users have no username yet without tripping the unique index
    },
    // Small resized image (data URI) uploaded by the player, distinct from the
    // Google avatarUrl. Falls back to avatarUrl, then initials, when unset.
    profilePicture: { type: String },
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
