// Server-authoritative 2-player pong. One PongMatch = one active match.
// The server owns the ball and both paddles; clients only send their own
// paddle Y and render whatever state comes back — two independent
// client-side simulations would drift apart between two different
// browsers, so a single server-side simulation is what keeps both
// players watching the same game.

const WIDTH = 700;
const HEIGHT = 450;
const WALL = 8;
const PADDLE_MARGIN = 15;
const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 8;
const MAX_BALL_SPEED = 20;
const WIN_SCORE = 7;
const FLICK_MAX_BALL_SPEED = MAX_BALL_SPEED * 1.6; // hard flicks can briefly exceed the normal cap
const FLICK_INFLUENCE = 0.012; // converts paddle px/sec into ball speed units — tune to taste
const TICK_MS = 20; // 50Hz

class PongMatch {
  constructor(id, leftSocketId, rightSocketId, onUpdate, onGameEnd) {
    this.id = id;
    this.sockets = { left: leftSocketId, right: rightSocketId };
    this.onUpdate = onUpdate || (() => {});
    this.onGameEnd = onGameEnd || (() => {});
    this.interval = null;
    this.state = this.initialState();
    // track paddle y from previous tick to compute flick velocity
    this.prevPaddleY = {
      left: this.state.paddles.left.y,
      right: this.state.paddles.right.y,
    };
  }

  initialState() {
    return {
      ball: this.freshBall(Math.random() < 0.5 ? 1 : -1),
      paddles: {
        left: { y: HEIGHT / 2 - PADDLE_H / 2 },
        right: { y: HEIGHT / 2 - PADDLE_H / 2 },
      },
      score: { left: 0, right: 0 },
    };
  }

  // volley = consecutive paddle touches since the last point, shared
  // between both players since it's a joint rally stat, not a per-player
  // one. longestVolley is the high-water mark across the whole match —
  // that's what gets submitted to the VS leaderboard on game end, so the
  // longest *rallies* rank the board rather than raw win/loss score.
  volley = 0;
  longestVolley = 0;

  freshBall(direction) {
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      speedX: 4 * direction,
      speedY: 3 * (Math.random() < 0.5 ? 1 : -1),
    };
  }

  setPaddleTarget(side, y) {
    if (side !== 'left' && side !== 'right') return;
    const clamped = Math.max(WALL, Math.min(y, HEIGHT - WALL - PADDLE_H));
    this.state.paddles[side].y = clamped;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }

  // Keeps ball speed within [min, max] while preserving direction.
  clampBallSpeed(max) {
    const { ball } = this.state;
    const speed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
    if (speed > max) {
      const scale = max / speed;
      ball.speedX *= scale;
      ball.speedY *= scale;
    }
  }

  tick() {
    const { ball, paddles, score } = this.state;
    const dt = TICK_MS / 1000;

    // Paddle velocity since the previous tick, in px/sec — this is the "flick."
    const paddleVelocity = {
      left: (paddles.left.y - this.prevPaddleY.left) / dt,
      right: (paddles.right.y - this.prevPaddleY.right) / dt,
    };
    this.prevPaddleY.left = paddles.left.y;
    this.prevPaddleY.right = paddles.right.y;

    ball.x += ball.speedX;
    ball.y += ball.speedY;

    if (ball.y - BALL_R <= WALL || ball.y + BALL_R >= HEIGHT - WALL) {
      ball.speedY *= -1;
    }

    if (
      ball.speedX < 0 &&
      ball.x - BALL_R <= PADDLE_MARGIN + PADDLE_W &&
      ball.x + BALL_R >= PADDLE_MARGIN &&
      ball.y + BALL_R >= paddles.left.y &&
      ball.y - BALL_R <= paddles.left.y + PADDLE_H
    ) {
      ball.speedX = Math.min(Math.abs(ball.speedX) * 1.05, MAX_BALL_SPEED);
      ball.speedY += paddleVelocity.left * FLICK_INFLUENCE;
      this.clampBallSpeed(FLICK_MAX_BALL_SPEED);
      this.volley += 1;
      if (this.volley > this.longestVolley) this.longestVolley = this.volley;
    }

    if (
      ball.speedX > 0 &&
      ball.x + BALL_R >= WIDTH - PADDLE_MARGIN - PADDLE_W &&
      ball.x - BALL_R <= WIDTH - PADDLE_MARGIN &&
      ball.y + BALL_R >= paddles.right.y &&
      ball.y - BALL_R <= paddles.right.y + PADDLE_H
    ) {
      ball.speedX = -Math.min(Math.abs(ball.speedX) * 1.05, MAX_BALL_SPEED);
      ball.speedY += paddleVelocity.right * FLICK_INFLUENCE;
      this.clampBallSpeed(FLICK_MAX_BALL_SPEED);
      this.volley += 1;
      if (this.volley > this.longestVolley) this.longestVolley = this.volley;
    }

    if (ball.x - BALL_R <= 0) {
      score.right += 1;
      this.volley = 0;
      this.state.ball = this.freshBall(-1);
    } else if (ball.x + BALL_R >= WIDTH) {
      score.left += 1;
      this.volley = 0;
      this.state.ball = this.freshBall(1);
    }

    this.onUpdate(this.state);

    if (score.left >= WIN_SCORE || score.right >= WIN_SCORE) {
      this.stop();
      this.onGameEnd(score, this.longestVolley);
    }
  }
}

module.exports = {
  PongMatch,
  WIDTH,
  HEIGHT,
  WALL,
  PADDLE_MARGIN,
  PADDLE_W,
  PADDLE_H,
  BALL_R,
  MAX_BALL_SPEED,
  WIN_SCORE,
};
