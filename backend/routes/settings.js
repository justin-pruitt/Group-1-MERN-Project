const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}

router.patch('/', requireAuth, async (req, res) => {
  const { crtBulge, scanLines } = req.body;
  if (crtBulge !== undefined) req.user.settings.crtBulge = !!crtBulge;
  if (scanLines !== undefined) req.user.settings.scanLines = !!scanLines;

  try {
    await req.user.save();
    res.json({ settings: req.user.settings });
  } catch (err) {
    res.status(500).json({ error: 'Could not save settings' });
  }
});

module.exports = router;