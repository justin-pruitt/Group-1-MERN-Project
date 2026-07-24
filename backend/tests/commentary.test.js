// Each test re-requires commentary.js fresh (jest.resetModules) since
// its rate limiter / circuit breaker are module-level state — without
// resetting, tests would leak throttling state into each other.

function freshCommentary() {
  jest.resetModules();
  return require('../ai/commentary');
}

describe('getCommentary', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('returns a fallback line without ever calling fetch when no API key is set', async () => {
    delete process.env.GEMINI_API_KEY;
    const { getCommentary } = freshCommentary();

    const line = await getCommentary('match_start', {});

    expect(typeof line).toBe('string');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls Gemini and returns its text when configured and healthy', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Model online.' }] } }],
      }),
    });
    const { getCommentary } = freshCommentary();

    const line = await getCommentary('match_start', {});

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(line).toBe('Model online.');
  });

  it('self-throttles back-to-back calls instead of firing one request per event', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Line.' }] } }] }),
    });
    const { getCommentary } = freshCommentary();

    // Simulates a burst of events (e.g. several points in quick
    // succession) — only the first should actually hit the network.
    await getCommentary('ai_scored', {});
    await getCommentary('human_scored', {});
    await getCommentary('ai_scored', {});

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('opens the circuit breaker on a 429 and stops calling Gemini until it cools down', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockResolvedValue({ ok: false, status: 429 });
    const { getCommentary } = freshCommentary();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await getCommentary('match_start', {});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(typeof first).toBe('string'); // still gets a fallback line, not an error

    // Immediately after a 429, further calls should skip the network
    // entirely (breaker open) rather than retrying and getting
    // rate-limited again.
    global.fetch.mockClear();
    const second = await getCommentary('ai_scored', {});
    expect(global.fetch).not.toHaveBeenCalled();
    expect(typeof second).toBe('string');
    expect(warnSpy).toHaveBeenCalledTimes(1); // one clear log line, not one per skipped call
  });

  it('falls back gracefully on a network error without throwing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockRejectedValue(new Error('network down'));
    const { getCommentary } = freshCommentary();

    await expect(getCommentary('match_start', {})).resolves.toEqual(expect.any(String));
  });

  it('logs a diagnosable error for non-429 failures instead of silently swallowing them', async () => {
    // Regression test: a deprecated/invalid model name, bad API key, or
    // any other non-429 failure used to return null with zero log
    // output — indistinguishable from "no API key configured" and
    // permanently invisible. This is exactly what happened when
    // gemini-2.5-flash was retired out from under this app.
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '{"error":{"message":"model not found"}}',
    });
    const { getCommentary } = freshCommentary();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const line = await getCommentary('match_start', {});

    expect(typeof line).toBe('string'); // still degrades gracefully
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/404/);
  });
});
