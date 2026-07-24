// AI Protocol match: identical physics to PongMatch (VS mode) — the only
// difference is the right paddle is driven by the trained agent instead
// of a second socket's input. Subclassing rather than forking the file
// keeps the physics as a single source of truth.

const { PongMatch, PADDLE_H } = require('./PongMatch');
const { getPaddleTarget } = require('../ai/agent');
const { stepPaddleTowardTarget } = require('../ai/paddleMotion');

const AI_SIDE = 'right';

class AiMatch extends PongMatch {
  constructor(id, humanSocketId, onUpdate, onGameEnd) {
    super(id, humanSocketId, 'ai-agent', onUpdate, onGameEnd);
  }

  tick() {
    // Retargets every tick (50Hz) so it can time a flick precisely at
    // the moment of contact — but the actual position is *glided*
    // toward that target (see paddleMotion.js), not snapped to it, so
    // it reads as smooth tracking that occasionally bursts into a fast,
    // deliberate hit rather than a paddle teleporting around the court.
    const desired = getPaddleTarget(this.state, AI_SIDE);
    const current = this.state.paddles[AI_SIDE].y + PADDLE_H / 2;
    const desiredCenter = desired + PADDLE_H / 2;
    const nextCenter = stepPaddleTowardTarget(current, desiredCenter);
    this.setPaddleTarget(AI_SIDE, nextCenter - PADDLE_H / 2);

    super.tick();
  }
}

module.exports = { AiMatch, AI_SIDE };
