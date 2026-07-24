// Moves a paddle's y toward a desired target, capped at a max px/tick
// speed, instead of snapping straight there. This is what makes the AI
// paddle glide instead of teleport — and, not incidentally, it's also
// what makes a flick *possible*: a fast approach to the target near the
// moment of contact IS a flick (see PongMatch's paddleVelocity ->
// FLICK_INFLUENCE). Shared between AiMatch.js (live) and train.js
// (offline training) so the trained weights transfer exactly — if
// training used a different motion model than live play, the agent
// would be optimizing for physics it never actually experiences.

const AI_MAX_SPEED_PER_TICK = 55; // ~2750px/sec — well above anything needed for normal tracking, enough for a real flick burst

function stepPaddleTowardTarget(currentY, desiredY, maxSpeedPerTick = AI_MAX_SPEED_PER_TICK) {
  const delta = desiredY - currentY;
  if (Math.abs(delta) <= maxSpeedPerTick) return desiredY;
  return currentY + Math.sign(delta) * maxSpeedPerTick;
}

module.exports = { stepPaddleTowardTarget, AI_MAX_SPEED_PER_TICK };
