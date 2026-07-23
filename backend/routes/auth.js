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

// below is new route for resending verification email (lines 68-97)

const crypto = require('crypto');
const { sendVerificationEmail } = require('../config/mailer');

// Requires an active session — reuses passport's req.user
router.post('/resend-verification', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  if (req.user.emailVerified) {
    return res.status(400).json({ error: 'Email already verified' });
  }
  if (!req.user.email) {
    return res.status(400).json({ error: 'No email on file for this account' });
  }

  try {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    req.user.verificationToken = verificationToken;
    req.user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
    await req.user.save();

    const verifyUrl = `${CLIENT_URL}/api/auth/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(req.user.email, verifyUrl);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to resend verification email:', err.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;
