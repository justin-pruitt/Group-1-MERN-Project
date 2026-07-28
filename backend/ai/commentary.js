// Optional AI Protocol commentary, powered by Gemini. Matches the
// project's existing pattern for optional secrets (Google OAuth,
// nodemailer): missing GEMINI_API_KEY disables the feature quietly
// instead of crashing the app — matches still run fine without it, they
// just fall back to a small set of canned lines.

// Using gemini-3.5-flash-lite, NOT a 2.5-series model. Google has closed
// the entire Gemini 2.5 line (Pro, Flash, and Flash-Lite) off to
// newly-created API keys/projects — they 404 with "This model ... is no
// longer available to new users," a different and more permanent
// condition than any Oct 2026 deprecation date on that same model page.
//
// Published free-tier numbers (blog posts, even Google's own generic
// rate-limits page) are NOT reliable for this — this project's actual
// per-model quota, pulled straight from its AI Studio quota dashboard,
// is much stricter and uneven across models:
//   Gemini 3.5 Flash      5 RPM /  20 RPD  (this is what we were on —
//                                           already over both when checked)
//   Gemini 2.5 Flash      5 RPM /  20 RPD  (also 2.5-series — blocked anyway)
//   Gemini 2.5 Flash Lite 10 RPM /  20 RPD (also 2.5-series — blocked anyway)
//   Gemini 3 Flash         5 RPM /  20 RPD
//   Gemini 3.6 Flash       5 RPM /  20 RPD
//   Gemini 3.1 Flash Lite 15 RPM / 500 RPD
//   Gemini 3.5 Flash Lite 15 RPM / 500 RPD  <- what we're using: best
//                                              quota on the account by
//                                              far, and the newest
//                                              generation available
// If GEMINI_MODEL ever needs to change again, check the actual quota
// dashboard for the project this key belongs to (AI Studio → API keys
// → quota), not a blog post — per-project limits vary independently of
// what's "generally" published.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// A bit more generous than a plain text-completion call would need —
// even 'minimal' thinking adds some latency on top of generation time,
// and this is fire-and-forget commentary (see aiMatchmaking.js), not
// something blocking gameplay, so it's cheap to give it more rope
// before falling back.
const REQUEST_TIMEOUT_MS = 6000;

// gemini-3.5-flash-lite is a Gemini 3.x-series model, so it uses the
// `thinkingLevel` field ('minimal' | 'low' | 'medium' | 'high'), NOT
// `thinkingBudget` (a raw token count) — thinkingBudget is a Gemini
// 2.5-only knob, merely accepted-but-ignored on 3.x for backwards
// compatibility. 'minimal' is the lowest level Flash/Flash-Lite models
// support — Gemini 3.x can't fully disable thinking, only get close to
// it. If GEMINI_MODEL ever gets pointed at a 2.5-series model again
// (once the "new users" restriction above lifts, say), that one wants
// thinkingBudget instead, so pick the right field for whichever model
// is actually configured rather than hardcoding one.
function buildThinkingConfig(model) {
  if (/^gemini-3/.test(model)) {
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
// gemini-3.5-flash-lite's actual quota on this project is 15 RPM / 500
// RPD (see the model comment above — pulled from the AI Studio quota
// dashboard, not a published default). 4500ms caps us at ~13.3 req/min,
// leaving margin below the 15 RPM ceiling for TPM overlap and any
// transient dip in the account's effective limit. 500 RPD is also a
// real ceiling worth watching on a busy day — at max throttle rate
// that's exhausted in under an hour of continuous play, so this isn't
// "basically unlimited" the way the old published 1,500 RPD figure
// suggested. Override via GEMINI_MIN_MS_BETWEEN_CALLS if GEMINI_MODEL
// changes to something with a different quota (recheck the dashboard
// for the model actually in use, not a blog post, before touching this).
const MIN_MS_BETWEEN_CALLS = Number(process.env.GEMINI_MIN_MS_BETWEEN_CALLS) || 4500;
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
