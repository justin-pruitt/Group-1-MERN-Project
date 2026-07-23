const express = require('express');
const { passport, googleConfigured } = require('../config/passport');
const User = require('../models/User');

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || 'https://neilpena.xyz';

router.get('/google', (req, res, next) => {
  if (!googleConfigured) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server yet' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleConfigured) return res.redirect(CLIENT_URL);
    next();
  },
  passport.authenticate('google', { failureRedirect: CLIENT_URL }),
  (req, res) => res.redirect(CLIENT_URL)
);

// Frontend polls this on load to find out if there's a logged-in user
router.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

// Verification link sent in the account-creation email. Not auth-gated —
// the token itself is the credential, since the person may be clicking
// this from a different browser/device than the one they signed up on.
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect(`${CLIENT_URL}/?verify=missing`);

  try {
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.redirect(`${CLIENT_URL}/?verify=invalid`);
    }

    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    return res.redirect(`${CLIENT_URL}/?verify=success`);
  } catch (err) {
    console.error('Email verification failed:', err.message);
    return res.redirect(`${CLIENT_URL}/?verify=error`);
  }
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

module.exports = router;
