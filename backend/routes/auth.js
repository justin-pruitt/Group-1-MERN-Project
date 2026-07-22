const express = require('express');
const { passport, googleConfigured } = require('../config/passport');

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

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ ok: true });
  });
});

module.exports = router;
