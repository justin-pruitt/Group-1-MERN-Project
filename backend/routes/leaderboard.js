const express = require('express');
const Score = require('../models/Score');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Sign in to submit a score' });
  }
  next();
}

router.get('/', async (req, res) => {
  const mode = req.query.mode === 'vs' ? 'vs' : 'solo';
  try {
    const scores = await Score.find({ mode }).sort({ score: -1 }).limit(10);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: 'Could not load leaderboard' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { score, mode } = req.body;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100000) {
    return res.status(400).json({ error: 'Invalid score' });
  }
  try {
    const entry = await Score.create({
      user: req.user._id,
      displayName: req.user.displayName,
      score,
      mode: mode === 'vs' ? 'vs' : 'solo',
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Could not save score' });
  }
});

module.exports = router;
