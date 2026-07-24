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

  it('sends the API key via the x-goog-api-key header, not a query param', async () => {
    // Query-param auth (?key=...) has been reported to fail for newer
    // "AQ." format keys even when the key itself is valid — the header
    // is Google's documented method and works for both key formats.
    process.env.GEMINI_API_KEY = 'AQ.Ab-test-key';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Line.' }] } }] }),
    });
    const { getCommentary } = freshCommentary();

    await getCommentary('match_start', {});

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).not.toContain('key=AQ.Ab-test-key');
    expect(options.headers['x-goog-api-key']).toBe('AQ.Ab-test-key');
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

  it('sends thinkingLevel (not thinkingBudget) for a Gemini 3.x model', async () => {
    // Regression test: Gemini 3.x doesn't honor thinkingBudget (that's a
    // 2.5-series-only field) — sending it alone is a silent no-op, and
    // the model quietly keeps its own default ('medium' for 3.5 Flash),
    // which burns most of maxOutputTokens on thinking exactly like having
    // no config at all. This is what caused commentary to keep falling
    // back to canned lines even after thinkingBudget: 0 was added.
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-3.5-flash';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Line.' }] } }] }),
    });
    const { getCommentary } = freshCommentary();

    await getCommentary('match_start', {});

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
  });

  it('sends thinkingBudget: 0 for a Gemini 2.5 model', async () => {
    // If GEMINI_MODEL is ever rolled back to a 2.5-series model (e.g.
    // during another deprecation scramble), that generation DOES support
    // a true zero thinking budget via thinkingBudget, not thinkingLevel.
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Line.' }] } }] }),
    });
    const { getCommentary } = freshCommentary();

    await getCommentary('match_start', {});

    const [, options] = global.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('includes finishReason and thinking-token counts when Gemini returns an empty candidate', async () => {
    // Regression test: MAX_TOKENS-with-empty-text used to log as an
    // opaque "empty response" — indistinguishable from a malformed
    // response for any other reason. The token breakdown is what
    // actually proves "thinking ate the budget" instead of leaving it
    // to be inferred.
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }],
        usageMetadata: { thoughtsTokenCount: 300, candidatesTokenCount: 0 },
      }),
    });
    const { getCommentary } = freshCommentary();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const line = await getCommentary('match_start', {});

    expect(typeof line).toBe('string');
    expect(errorSpy.mock.calls[0][0]).toMatch(/MAX_TOKENS/);
    expect(errorSpy.mock.calls[0][0]).toMatch(/thoughtsTokenCount: 300/);
  });
});
