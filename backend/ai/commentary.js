// Optional AI Protocol commentary, powered by Gemini. Matches the
// project's existing pattern for optional secrets (Google OAuth,
// nodemailer): missing GEMINI_API_KEY disables the feature quietly
// instead of crashing the app — matches still run fine without it, they
// just fall back to a small set of canned lines.

// Using gemini-2.5-flash-lite: same 15 RPM ceiling as gemini-3.5-flash on
// the free tier, but a much more generous daily cap (1,000 RPD vs. a few
// hundred) — the RPD limit was the bigger problem for a chatty
// nice-to-have feature like this one, not just RPM. Its own official
// shutdown date is also Oct 16, 2026 (Google's deprecations page lists
// it alongside gemini-2.5-flash), and as of mid-July 2026 there are
// forum reports of both intermittently 404ing ("model no longer
// available") ahead of that date on some accounts. If that starts
// showing up here, callGemini's generic non-429 error handling already
// logs it and falls back to canned lines rather than crashing — but
// keep an eye on the logs and swap GEMINI_MODEL if it gets persistent.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// A bit more generous than a plain text-completion call would need —
// even 'minimal' thinking adds some latency on top of generation time,
// and this is fire-and-forget commentary (see aiMatchmaking.js), not
// something blocking gameplay, so it's cheap to give it more rope
// before falling back.
const REQUEST_TIMEOUT_MS = 6000;

// gemini-2.5-flash-lite is a Gemini 2.5-series model, so it uses the
// `thinkingBudget` (raw token count) field, not `thinkingLevel` — that's
// a Gemini 3.x-only knob. thinkingBudget: 0 is a true zero budget on
// 2.5 models (Flash-Lite actually defaults to thinking OFF already, so
// this is mostly a belt-and-suspenders no-op here, but keeps behavior
// explicit rather than relying on the model's current default). If
// GEMINI_MODEL ever gets pointed back at a Gemini 3.x model, that one
// wants thinkingLevel instead, so pick the right field for whichever
// model is actually configured rather than hardcoding one.
function buildThinkingConfig(model) {
  if (/^gemini-3/.test(model)) {
    // 'minimal' is the lowest level Flash/Flash-Lite support — Gemini 3
    // Flash models can't fully disable thinking, only get close to it.
    return { thinkingLevel: 'minimal' };
  }
  return { thinkingBudget: 0 }; // true zero budget, supported on 2.5 Flash / Flash-Lite
}

// Self-throttling so a burst of match events (several concurrent
// matches, or a fast rally with several points close together) can't
// fire more requests than the API tier allows. This is a real fix, not
// a workaround for a code bug elsewhere — commentary is a nice-to-have,
// so under load it should quietly drop to fallback lines instead of
// hammering Gemini and eating into everyone else's quota too.
//
// 2000ms (30 req/min) was set without checking the actual free-tier
// ceiling — Google's documented free-tier limit for Flash models
// (gemini-2.5-flash-lite included) is 15 RPM, and some accounts/regions
// see as low as 5-10 RPM (https://ai.google.dev/gemini-api/docs/rate-limits).
// At 30/min we were requesting roughly double what the tier allows
// whenever a rally produced score events close together, which is why
// the 429 breaker below was tripping so often. 7000ms caps us at ~8.5
// req/min — under even the conservative end of that range, with margin
// for TPM/RPD counting against the same quota. Override via
// GEMINI_MIN_MS_BETWEEN_CALLS if a paid tier raises the real ceiling.
const MIN_MS_BETWEEN_CALLS = Number(process.env.GEMINI_MIN_MS_BETWEEN_CALLS) || 7000;
let lastCallAt = 0;

// Hard lock on top of the rate floor above. MIN_MS_BETWEEN_CALLS only
// checks the gap between when calls *start* — if a call is still in
// flight past that window (slow response, close to the 6s timeout, a
// stalled connection, etc.) the old check let a second one start anyway,
// so two requests could be outstanding to Gemini at once. This flag
// makes "previous request finished" a separate, explicit condition:
// set true right before the fetch, cleared in a finally so it resets on
// success, error, AND timeout/abort alike, and checked before anything
// else in getCommentary so a still-running call always wins and the new
// event just falls back to a canned line instead of queuing up.
let requestInFlight = false;

// Circuit breaker: once Gemini itself tells us we're rate-limited (429),
// stop trying for a cooldown window instead of retrying on the very next
// event and getting rate-limited again. One log line on the transition
// so it's diagnosable without spamming the console on every skipped call.
const COOLDOWN_MS = 60000;
let cooldownUntil = 0;

const FALLBACK_LINES = {
  match_start: ['Protocol online. Let\'s see what you\'ve got.', 'Model loaded. Serve when ready.'],
  ai_scored: ['Point logged.', 'As modeled.', 'Trajectory confirmed.'],
  human_scored: ['Recalibrating.', 'Noted. Adjusting weights.', 'That one slipped through.'],
  match_end_win: ['Simulation complete. I win this one.', 'Model held. Good rally though.'],
  match_end_loss: ['...unexpected. Rerunning the model.', 'You beat the model. Rare.'],
};

function fallbackLine(event) {
  const pool = FALLBACK_LINES[event] || FALLBACK_LINES.ai_scored;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildPrompt(event, context) {
  const { score = { left: 0, right: 0 }, longestVolley } = context || {};
  const eventDescriptions = {
    match_start: 'The match is just starting.',
    ai_scored: 'You (the AI) just scored a point.',
    human_scored: 'Your human opponent just scored a point.',
    match_end_win: 'The match just ended — you won.',
    match_end_loss: 'The match just ended — you lost.',
  };

  return [
    'You are the opposing paddle AI in "Vector," a retro CRT-styled pong game.',
    'Reply with exactly one short line, under 12 words, dry and confident, sci-fi-game-AI flavored.',
    'No emoji, no quotation marks, no markdown, plain text only, keep it PG-13.',
    eventDescriptions[event] || '',
    `Score right now — you: ${score.right}, opponent: ${score.left}.`,
    longestVolley ? `Longest volley so far: ${longestVolley}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// Returns { text } on success, or { rateLimited: true } / { error } on
// failure — the caller decides what to do (fall back either way), but
// now every failure reports *why*, not just 429s. Previously any
// non-429 failure (wrong/deprecated model name, bad key, 5xx, etc.)
// silently returned null with zero trace in the logs — meaning a
// permanently broken model name would fall back to canned lines forever
// and look identical to "no API key configured."
async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Sent via the x-goog-api-key header rather than a ?key= query
    // param — this is Google's documented method regardless of key
    // format, and newer "AQ." style keys (as opposed to the older
    // "AIza" format) have been reported to work reliably here but not
    // always as a query param.
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // Thinking tokens are counted against the SAME maxOutputTokens
          // budget as the visible reply (confirmed still true for Gemini
          // 3 in Google's own tracker, not just legacy 2.5). Even at
          // 'minimal' — the lowest level Flash supports — that's not a
          // guaranteed zero, so keep real headroom above what a ~12-word
          // line needs (well under 100 tokens) rather than cutting it close.
          maxOutputTokens: 10000,
          temperature: 0.9,
          thinkingConfig: buildThinkingConfig(GEMINI_MODEL),
        },
      }),
      signal: controller.signal,
    });
    if (res.status === 429) return { rateLimited: true };
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { error: `HTTP ${res.status}${body ? ` — ${body.slice(0, 300)}` : ''}` };
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      // Surface finishReason AND the token breakdown explicitly —
      // "MAX_TOKENS" with thoughtsTokenCount near/at maxOutputTokens is
      // the fingerprint of thinking eating the whole budget (see
      // thinkingConfig above); without the numbers this looks identical
      // in the logs to a bad key or a dead model name.
      const finishReason = data?.candidates?.[0]?.finishReason;
      const thoughtsTokens = data?.usageMetadata?.thoughtsTokenCount;
      const outputTokens = data?.usageMetadata?.candidatesTokenCount;
      return {
        error:
          `empty response (finishReason: ${finishReason || 'unknown'}, ` +
          `thoughtsTokenCount: ${thoughtsTokens ?? 'n/a'}, candidatesTokenCount: ${outputTokens ?? 'n/a'}) — ` +
          `${JSON.stringify(data).slice(0, 300)}`,
      };
    }
    return { text };
  } finally {
    clearTimeout(timeout);
  }
}

// Throttles repeated identical error logs so a sustained outage doesn't
// spam the console once per match event, while still making the
// *first* occurrence (and the first after it changes) immediately
// visible — that first line is what you'd grep for in the logs.
let lastLoggedError = null;
let lastErrorLogAt = 0;
function logGeminiError(message) {
  const now = Date.now();
  if (message === lastLoggedError && now - lastErrorLogAt < 60000) return;
  lastLoggedError = message;
  lastErrorLogAt = now;
  console.error(`Gemini commentary request failed (model: ${GEMINI_MODEL}): ${message}`);
}

// One-time, redacted startup diagnostic. The single biggest source of
// "why is it always falling back?" confusion is that a missing/empty
// GEMINI_API_KEY produces *zero* log output (see the early return
// below) — completely silent, identical-looking to Gemini being down.
// This makes the two cases distinguishable from pm2 logs alone, without
// ever printing the actual key.
let hasLoggedKeyStatus = false;
function logKeyStatusOnce() {
  if (hasLoggedKeyStatus) return;
  hasLoggedKeyStatus = true;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('AI Protocol commentary: GEMINI_API_KEY is not set — fallback lines only, Gemini will never be called.');
  } else {
    console.log(`AI Protocol commentary: GEMINI_API_KEY detected (starts with "${apiKey.slice(0, 4)}…"), model=${GEMINI_MODEL}.`);
  }
}

// event: 'match_start' | 'ai_scored' | 'human_scored' | 'match_end_win' | 'match_end_loss'
async function getCommentary(event, context = {}) {
  logKeyStatusOnce();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackLine(event);

  const now = Date.now();
  if (requestInFlight) return fallbackLine(event); // previous call hasn't finished — never overlap requests
  if (now < cooldownUntil) return fallbackLine(event); // breaker is open, skip Gemini entirely
  if (now - lastCallAt < MIN_MS_BETWEEN_CALLS) return fallbackLine(event); // self-throttle
  lastCallAt = now;
  requestInFlight = true;

  try {
    const result = await callGemini(buildPrompt(event, context), apiKey);

    if (result.rateLimited) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      console.warn(
        `Gemini rate-limited (429) — pausing AI Protocol commentary for ${COOLDOWN_MS / 1000}s, using fallback lines until then.`
      );
      return fallbackLine(event);
    }
    if (result.error) {
      logGeminiError(result.error);
      return fallbackLine(event);
    }
    return result.text.replace(/^["']|["']$/g, '').slice(0, 140);
  } catch (err) {
    logGeminiError(err.message);
    return fallbackLine(event);
  } finally {
    requestInFlight = false;
  }
}

module.exports = { getCommentary };
