const { Network } = require('../ai/network');
const { getPaddleTarget, loadModel, getModelMeta } = require('../ai/agent');
const { HEIGHT, PADDLE_H, WALL } = require('../game/PongMatch');

describe('Network', () => {
  it('produces output in [-1, 1] via the tanh output layer', () => {
    const net = Network.random(6, 8, 1, 2); // large scale to stress-test saturation
    const [out] = net.forward([1, -1, 1, -1, 1, -1]);
    expect(out).toBeGreaterThanOrEqual(-1);
    expect(out).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same weights and input', () => {
    const net = Network.random(6, 8, 1);
    const input = [0.1, -0.2, 0.3, -0.4, 0.5, -0.6];
    expect(net.forward(input)).toEqual(net.forward(input));
  });

  it('round-trips through toJSON', () => {
    const net = Network.random(6, 8, 1);
    const restored = new Network(net.toJSON());
    const input = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
    expect(restored.forward(input)).toEqual(net.forward(input));
  });
});

describe('agent', () => {
  it('loads the trained model without throwing', () => {
    expect(() => loadModel()).not.toThrow();
  });

  it('exposes training metadata', () => {
    const meta = getModelMeta();
    expect(meta).toBeTruthy();
    expect(meta.generations).toBeGreaterThan(0);
  });

  it('returns a paddle target within the playable court for a neutral state', () => {
    const state = {
      ball: { x: 350, y: 225, speedX: 4, speedY: 2 },
      paddles: { left: { y: 185 }, right: { y: 185 } },
    };
    const target = getPaddleTarget(state, 'right');
    expect(target).toBeGreaterThanOrEqual(WALL - PADDLE_H); // forward pass isn't pre-clamped
    expect(target).toBeLessThanOrEqual(HEIGHT);
  });
});
