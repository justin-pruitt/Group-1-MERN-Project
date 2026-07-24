// Turns raw PongMatch state into the fixed-size, roughly [-1, 1] input
// vector the network expects. Shared by train.js and agent.js on purpose
// — if these two ever disagreed, the trained weights would mean nothing
// at inference time.

const { WIDTH, HEIGHT, MAX_BALL_SPEED, PADDLE_H } = require('../game/PongMatch');

const FEATURE_SIZE = 6;

function extractFeatures(state, side) {
  const paddle = state.paddles[side];
  const { ball } = state;
  const paddleCenter = paddle.y + PADDLE_H / 2;

  return [
    (ball.x / WIDTH) * 2 - 1,
    (ball.y / HEIGHT) * 2 - 1,
    Math.max(-1, Math.min(1, ball.speedX / MAX_BALL_SPEED)),
    Math.max(-1, Math.min(1, ball.speedY / MAX_BALL_SPEED)),
    (paddleCenter / HEIGHT) * 2 - 1,
    Math.max(-1, Math.min(1, (paddleCenter - ball.y) / HEIGHT)),
  ];
}

module.exports = { extractFeatures, FEATURE_SIZE };
