const express = require('express');
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  next();
}

router.patch('/', requireAuth, async (req, res) => {
  const { crtBulge, scanLines, sfxVolume, musicVolume } = req.body;

  if (crtBulge !== undefined) req.user.settings.crtBulge = !!crtBulge;
  if (scanLines !== undefined) req.user.settings.scanLines = !!scanLines;
  if (sfxVolume !== undefined) {
    const v = Number(sfxVolume);
    if (Number.isFinite(v) && v >= 0 && v <= 1) req.user.settings.sfxVolume = v;
  }
  if (musicVolume !== undefined) {
    const v = Number(musicVolume);
    if (Number.isFinite(v) && v >= 0 && v <= 1) req.user.settings.musicVolume = v;
  }

  try {
    await req.user.save();
    res.json({ settings: req.user.settings });
  } catch (err) {
    res.status(500).json({ error: 'Could not save settings' });
  }
});

module.exports = router;