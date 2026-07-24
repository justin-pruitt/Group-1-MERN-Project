const { AiMatch } = require('../game/AiMatch');
const { WIN_SCORE } = require('../game/PongMatch');
const { AI_MAX_SPEED_PER_TICK } = require('../ai/paddleMotion');

describe('AiMatch', () => {
  it('drives the right paddle without any external input', () => {
    const match = new AiMatch('t1', 'human', () => {});
    const startY = match.state.paddles.right.y;

    // Run enough ticks that the agent has re-targeted (every tick) and
    // the ball has had time to move.
    for (let i = 0; i < 30; i++) match.tick();

    // We can't assert an exact position (it's a trained, somewhat
    // stochastic-feeling policy), just that the AI is actually acting —
    // i.e. the paddle isn't frozen at its spawn position the whole time.
    expect(match.state.paddles.right.y).not.toBe(startY);
  });

  it('glides toward its target instead of teleporting', () => {
    const match = new AiMatch('t1b', 'human', () => {});
    let prevY = match.state.paddles.right.y;
    let maxJump = 0;

    for (let i = 0; i < 200; i++) {
      match.tick();
      const y = match.state.paddles.right.y;
      maxJump = Math.max(maxJump, Math.abs(y - prevY));
      prevY = y;
    }

    // Even a deliberate flick burst is capped at AI_MAX_SPEED_PER_TICK —
    // this is what stops the AI paddle from jumping across the court in
    // a single frame.
    expect(maxJump).toBeLessThanOrEqual(AI_MAX_SPEED_PER_TICK + 0.001);
  });

  it('does not vibrate — direction reversals stay low over a sustained run', () => {
    // Regression test: without target smoothing, the raw network output
    // can flip between two nearby values every tick, and the paddle
    // visibly vibrates back and forth at max speed instead of tracking
    // smoothly. This counts genuine direction changes over 4 sim-seconds
    // and asserts it stays well below "every tick" (which would be ~200
    // reversals over this window).
    const match = new AiMatch('t1c', 'human', () => {});
    let prevY = match.state.paddles.right.y;
    let prevSign = 0;
    let reversals = 0;
    const TICKS = 200; // 4 simulated seconds at 50Hz

    for (let i = 0; i < TICKS; i++) {
      match.tick();
      const y = match.state.paddles.right.y;
      const delta = y - prevY;
      if (Math.abs(delta) > 0.5) {
        const sign = Math.sign(delta);
        if (prevSign !== 0 && sign !== prevSign) reversals += 1;
        prevSign = sign;
      }
      prevY = y;
    }

    // A real rally reverses direction sometimes (the ball bounces), but
    // nowhere near every tick — this threshold is well above normal
    // tracking behavior and well below vibration.
    expect(reversals).toBeLessThan(30);
  });

  it('still lets the human-controlled left paddle move normally', () => {
    const match = new AiMatch('t2', 'human', () => {});
    match.setPaddleTarget('left', 200);
    expect(match.state.paddles.left.y).toBe(200);
  });

  it('plays a full match to completion using the same win condition as VS mode', () => {
    const match = new AiMatch('t3', 'human', () => {});
    let ended = false;
    let finalScore = null;
    match.onGameEnd = (score) => {
      ended = true;
      finalScore = score;
    };

    // Run a bounded number of ticks — a real match ends well within this
    // given WIN_SCORE=7; this just guards against an infinite loop bug.
    for (let i = 0; i < 20000 && !ended; i++) match.tick();

    expect(ended).toBe(true);
    expect(Math.max(finalScore.left, finalScore.right)).toBe(WIN_SCORE);
  });
});
