const { PongMatch, WALL, HEIGHT, PADDLE_H, MAX_BALL_SPEED } = require('../game/PongMatch');

describe('PongMatch', () => {
  it('advances the ball position every tick', () => {
    const updates = [];
    const match = new PongMatch('t1', 'a', 'b', (s) => updates.push(JSON.parse(JSON.stringify(s))));
    match.tick();
    match.tick();
    expect(updates.length).toBe(2);
    expect(updates[1].ball.x).not.toBe(updates[0].ball.x);
  });

  it('clamps paddle position to stay inside the court', () => {
    const match = new PongMatch('t2', 'a', 'b');
    match.setPaddleTarget('left', -999);
    expect(match.state.paddles.left.y).toBeGreaterThanOrEqual(WALL);
    match.setPaddleTarget('left', 999);
    expect(match.state.paddles.left.y).toBeLessThanOrEqual(HEIGHT - WALL - PADDLE_H);
  });

  it('caps ball speed instead of letting it ramp forever', () => {
    const match = new PongMatch('t4', 'a', 'b');
    for (let i = 0; i < 60; i++) {
      match.state.ball.speedX = -Math.abs(match.state.ball.speedX);
      match.state.ball.x = 20;
      match.state.ball.y = match.state.paddles.left.y + 10;
      match.tick();
    }
    expect(Math.abs(match.state.ball.speedX)).toBeLessThanOrEqual(MAX_BALL_SPEED);
  });

  it('keeps the ball mostly horizontal after a fast paddle flick', () => {
    const match = new PongMatch('t4b', 'a', 'b');
    match.state.ball.x = 20;
    match.state.ball.y = match.state.paddles.left.y + 10;
    match.state.ball.speedX = -4;
    match.state.ball.speedY = 2;
    match.state.paddles.left.y = 100;
    match.prevPaddleY.left = 0;

    match.tick();

    expect(Math.abs(match.state.ball.speedX)).toBeGreaterThan(Math.abs(match.state.ball.speedY));
  });

  it('can reset the ball to a more horizontal trajectory', () => {
    const match = new PongMatch('t4c', 'a', 'b');
    match.state.ball.speedX = -1;
    match.state.ball.speedY = 10;

    match.resetBallToHorizontal(1);

    expect(match.state.ball.speedX).toBeGreaterThan(0);
    expect(Math.abs(match.state.ball.speedX)).toBeGreaterThan(Math.abs(match.state.ball.speedY));
  });

  it('awards the point to the opposite side and resets the ball', () => {
    const match = new PongMatch('t5', 'a', 'b');
    match.state.ball.x = 1;
    match.state.ball.speedX = -50;
    const before = match.state.score.right;
    match.tick();
    expect(match.state.score.right).toBe(before + 1);
  });

  it('stops ticking once a side reaches the win score', () => {
    const match = new PongMatch('t6', 'a', 'b');
    match.state.score.left = 6;
    match.state.ball.x = 691;
    match.state.ball.speedX = 50;
    let finalScore = null;
    match.onGameEnd = (score) => (finalScore = score);
    match.start();
    match.tick();
    expect(finalScore).toEqual({ left: 7, right: 0 });
    expect(match.interval).toBeNull();
  });
});
