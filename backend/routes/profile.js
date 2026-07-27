const express = require('express');
const User = require('../models/User');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
// Images live inline on the user doc as a data URI, so keep them small.
// The frontend resizes to 128x128 before upload, which lands well under this.
const MAX_IMAGE_BYTES = 300 * 1024;
const ALLOWED_IMAGE_PREFIXES = [
  'data:image/png;base64,',
  'data:image/jpeg;base64,',
  'data:image/webp;base64,',
];

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}

// Frontend polls this to render the signed-in player's own profile editor
router.get('/', requireAuth, (req, res) => {
  res.json({
    username: req.user.username || null,
    profilePicture: req.user.profilePicture || null,
    displayName: req.user.displayName,
    avatarUrl: req.user.avatarUrl || null,
  });
});

router.patch('/', requireAuth, async (req, res) => {
  const { username, profilePicture } = req.body;

  if (username !== undefined) {
    const trimmed = String(username).trim();
    if (!USERNAME_RE.test(trimmed)) {
      return res.status(400).json({
        error: 'Username must be 3-20 characters, using only letters, numbers, and underscores',
      });
    }
    const taken = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } });
    if (taken) {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    req.user.username = trimmed;
  }

  if (profilePicture !== undefined) {
    if (profilePicture === null || profilePicture === '') {
      req.user.profilePicture = undefined; // clear it — falls back to Google avatar/initials
    } else {
      const prefixOk = ALLOWED_IMAGE_PREFIXES.some((p) => profilePicture.startsWith(p));
      if (!prefixOk) {
        return res.status(400).json({ error: 'Profile picture must be a PNG, JPEG, or WEBP image' });
      }
      const base64Data = profilePicture.slice(profilePicture.indexOf(',') + 1);
      const byteLength = Buffer.byteLength(base64Data, 'base64');
      if (byteLength > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: 'Profile picture is too large (max 300KB)' });
      }
      req.user.profilePicture = profilePicture;
    }
  }

  try {
    await req.user.save();
    res.json({
      username: req.user.username || null,
      profilePicture: req.user.profilePicture || null,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl || null,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    console.error('Failed to update profile:', err.message);
    res.status(500).json({ error: 'Could not save profile' });
  }
});

module.exports = router;
