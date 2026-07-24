// AI Protocol match: identical physics to PongMatch (VS mode) — the only
// difference is the right paddle is driven by the trained agent instead
// of a second socket's input. Subclassing rather than forking the file
// keeps the physics as a single source of truth.

const { PongMatch, PADDLE_H } = require('./PongMatch');
const { getPaddleTarget } = require('../ai/agent');
const { stepPaddleTowardTarget, smoothTarget } = require('../ai/paddleMotion');

const AI_SIDE = 'right';

class AiMatch extends PongMatch {
  constructor(id, humanSocketId, onUpdate, onGameEnd) {
    super(id, humanSocketId, 'ai-agent', onUpdate, onGameEnd);
    // Smoothed target center, carried across ticks — see paddleMotion.js.
    // Without this, the raw network output can flip between two nearby
    // values tick to tick and the paddle vibrates instead of gliding.
    this._smoothedCenter = this.state.paddles[AI_SIDE].y + PADDLE_H / 2;
  }

  tick() {
    // Retargets every tick (50Hz) so it can time a flick precisely at
    // the moment of contact — but the desired position is smoothed
    // first, then glided toward (not snapped to), so it reads as clean
    // tracking that occasionally bursts into a fast, deliberate hit
    // rather than a paddle vibrating between two nearby points.
    const rawTargetCenter = getPaddleTarget(this.state, AI_SIDE) + PADDLE_H / 2;
    this._smoothedCenter = smoothTarget(this._smoothedCenter, rawTargetCenter);

    const current = this.state.paddles[AI_SIDE].y + PADDLE_H / 2;
    const nextCenter = stepPaddleTowardTarget(current, this._smoothedCenter);
    this.setPaddleTarget(AI_SIDE, nextCenter - PADDLE_H / 2);

    super.tick();
  }
}

module.exports = { AiMatch, AI_SIDE };
