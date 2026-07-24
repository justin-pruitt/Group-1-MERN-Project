# Vector

Real-time multiplayer pong, MERN stack, deployed on push.

**Live:** https://neilpena.xyz

## Modes

- **Solo Ops** — practice mode. No opponent. Sign in with Google to save
  a run to the leaderboard; playing itself never requires signing in.
- **VS Encounter** — real-time 2-player. The server runs the physics;
  both browsers render the same match.
- **AI Protocol** — single-player against a trained paddle-control
  model, with optional Gemini-powered trash talk from the AI. Sign in
  with Google to play (same account gate as VS, and results count
  toward the leaderboard the same way — longest volley, not win/loss).

## Stack

- **Frontend:** React (Vite), Socket.io-client, Web Audio API for sound
- **Backend:** Express, Socket.io, Passport (Google OAuth), Mongoose
- **Database:** MongoDB — accounts and the Solo leaderboard
- **Deploy:** GitHub Actions → SSH into the droplet → `git pull` +
  rebuild → PM2 (backend) / nginx serving the static frontend build

## Running locally

```bash
cd backend
cp .env.example .env   # fill in at least MONGO_URI to test the leaderboard
npm install
npm start               # :5000
```

```bash
cd frontend
npm install
npm run dev              # :5173, proxies /api and /socket.io to :5000
```

Open `http://localhost:5173`. Google sign-in works locally too, once
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set and `http://localhost:5000/api/auth/google/callback`
is added as an authorized redirect URI in Google Cloud Console. Without
those two set, the app still runs — sign-in is just disabled, matching
what happens in production before those secrets exist.

To try VS mode locally, open a second tab (or a private window — it
needs to be a separate connection) and queue up in both.

## Auth + leaderboard, together on purpose

Saving a score requires being signed in — there's no separate
anonymous/typed-name path. That's deliberate: it's what actually ties
these two features together, rather than having a leaderboard and an
auth system that just happen to exist in the same app. The one
limitation worth knowing: a signed-in user could still open devtools
and submit an inflated number directly — the score is tied to a real
account, but isn't cryptographically proven to match an actual
completed run. Closing that fully would need a server-issued, single-use
token minted when a run starts; not built, and a reasonable thing to
scope separately later rather than block this on.

## AI Protocol

Two independent pieces:

**The paddle model.** A small feedforward network (6 inputs → 12 hidden
→ 1 output — ball position/velocity and the paddle's own position in, a
target y out) trained offline with neuroevolution, using the *exact*
physics from `game/PongMatch.js` (imported directly, not reimplemented)
so training and live inference never drift apart. `game/AiMatch.js`
subclasses `PongMatch` and drives the right paddle from the trained
weights instead of a second socket's input; everything else (ticking,
scoring, win condition) is identical to VS mode.

The paddle *glides* toward its target at a capped speed
(`ai/paddleMotion.js`) rather than teleporting — the same motion model
is used during training and live play, so the trained behavior transfers
exactly. It retargets every tick (50Hz), which is also what lets it time
a flick precisely: in this game's physics a flick isn't a special move,
it's just paddle velocity at the moment of contact affecting the ball
(see `FLICK_INFLUENCE` in `PongMatch.js`) — a network trained to hit
decisively naturally produces real flicks, no scripting needed.

Training uses three scripted sparring tiers with a reaction delay and
momentum cap (can't reverse direction instantly), not just tracking
error — `human` (slow, hesitant, the tier that teaches exploiting
hesitation) up through `elite` (fast, near-instant reaction). Fitness
rewards win margin, rally length, and the exit speed of the agent's own
hits, so it's shaped toward winning decisively, not just eventually.

```bash
cd backend
node ai/train.js            # writes ai/model.json (defaults: 500 generations, population 50)
node ai/train.js 800 60     # longer run — generations, then population size
```

`ai/model.json` is checked in so the app works out of the box; rerun
training any time to produce a new opponent. No ML libraries involved —
`ai/network.js` is a plain-array forward pass and `ai/train.js` is
mutate-and-select, on purpose, given how small the network is.

**The commentary.** `ai/commentary.js` calls the Gemini API for short
in-character lines on match start, each point, and match end, sent to
the client over the `ai:say` socket event. Requires `GEMINI_API_KEY`;
without it, matches still run fine and fall back to a small set of
canned lines (same "missing secret disables the feature, not the app"
pattern as Google OAuth / the mailer).

## Tests

```bash
cd backend
npm test
```

Health endpoint, the leaderboard's auth gate, the full VS match engine
(movement, paddle clamping, the speed cap, scoring, match-end), the
AI Protocol match (agent-driven paddle, same win condition as VS), and
the network/agent inference layer (determinism, output range, model
loads) — all as pure logic / request tests, no live Mongo connection
needed for any of them.

## Project structure

```
backend/
  app.js               Express app + all routes (no listen())
  server.js            HTTP server, Socket.io, Mongo connection, listen()
  db.js                Mongoose connection
  config/passport.js   Google OAuth strategy
  models/              User, Score
  routes/               auth.js, leaderboard.js
  game/                 PongMatch.js (VS physics), matchmaking.js,
                         AiMatch.js (AI Protocol physics), aiMatchmaking.js
  ai/                   network.js, features.js, train.js, agent.js,
                         commentary.js, model.json (trained weights)
  tests/

frontend/
  src/
    App.jsx             Mode select, volume controls, wraps everything in AuthProvider
    AuthContext.jsx      Session state (who's signed in)
    ProfileMenu.jsx       Sign in / sign out, top corner
    SoloGame.jsx          Solo mode, leaderboard display + save
    VsGame.jsx            VS mode
    AiGame.jsx             AI Protocol mode + commentary bubble
    sound.js              SFX + music playback

deprecated/   old code kept for reference, not imported anywhere live
.github/      CI/CD workflow
```

## Environment variables / secrets

Set locally in `backend/.env`; set in production
via GitHub → repo → Settings → Secrets and variables → Actions — the
deploy workflow writes them into the droplet's `.env` on every push:

| Secret | What it's for |
|---|---|
| `MONGO_URI` | Atlas connection string |
| `SESSION_SECRET` | Signs the login session cookie — any long random string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GMAIL_USER` / `GMAIL_REFRESH_TOKEN` | Sends verification emails via the Gmail API (see `config/mailer.js`) |
| `GEMINI_API_KEY` | Powers AI Protocol's in-match commentary; matches still work without it |
| `DROPLET_HOST` / `DROPLET_USERNAME` / `DROPLET_SSH_KEY` | Already set up — deploy access |

Missing `MONGO_URI` or the Google credentials doesn't crash the app —
Solo and VS play normally, sign-in and score-saving just stay disabled
until those exist. Same story for `GEMINI_API_KEY`: AI Protocol matches
play normally without it, just with canned commentary lines instead of
live ones.




