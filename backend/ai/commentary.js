// Optional AI Protocol commentary, powered by Gemini. Matches the
// project's existing pattern for optional secrets (Google OAuth,
// nodemailer): missing GEMINI_API_KEY disables the feature quietly
// instead of crashing the app — matches still run fine without it, they
// just fall back to a small set of canned lines.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const REQUEST_TIMEOUT_MS = 4000;

// Self-throttling so a burst of match events (several concurrent
// matches, or a fast rally with several points close together) can't
// fire more requests than the API tier allows. This is a real fix, not
// a workaround for a code bug elsewhere — commentary is a nice-to-have,
// so under load it should quietly drop to fallback lines instead of
// hammering Gemini and eating into everyone else's quota too.
const MIN_MS_BETWEEN_CALLS = 10000; // hard floor on request rate, regardless of tier
let lastCallAt = 0;

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

// Returns { text } on success, or { rateLimited: true } / { text: null }
// on failure — the caller decides what to do (fall back), this function
// just reports what actually happened instead of collapsing every
// failure into the same silent null.
async function callGemini(prompt, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 40, temperature: 0.9 },
      }),
      signal: controller.signal,
    });
    if (res.status === 429) return { rateLimited: true };
    if (!res.ok) return { text: null };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return { text: text || null };
  } finally {
    clearTimeout(timeout);
  }
}

// event: 'match_start' | 'ai_scored' | 'human_scored' | 'match_end_win' | 'match_end_loss'
async function getCommentary(event, context = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackLine(event);

  const now = Date.now();
  if (now < cooldownUntil) return fallbackLine(event); // breaker is open, skip Gemini entirely
  if (now - lastCallAt < MIN_MS_BETWEEN_CALLS) return fallbackLine(event); // self-throttle
  lastCallAt = now;

  try {
    const result = await callGemini(buildPrompt(event, context), apiKey);

    if (result.rateLimited) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      console.warn(
        `Gemini rate-limited (429) — pausing AI Protocol commentary for ${COOLDOWN_MS / 1000}s, using fallback lines until then.`
      );
      return fallbackLine(event);
    }
    if (!result.text) return fallbackLine(event);
    return result.text.replace(/^["']|["']$/g, '').slice(0, 140);
  } catch (err) {
    console.error('Gemini commentary failed:', err.message);
    return fallbackLine(event);
  }
}

module.exports = { getCommentary };
