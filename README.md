# Vector

Real-time multiplayer pong, MERN stack, deployed on push.

**Live:** https://neilpena.xyz

## Modes

- **Solo Ops** — practice mode. No opponent. Sign in with Google to save
  a run to the leaderboard; playing itself never requires signing in.
- **VS Encounter** — real-time 2-player. The server runs the physics;
  both browsers render the same match.
- **AI Protocol** — play against a trained model. Not built yet.

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

## Tests

```bash
cd backend
npm test
```

Health endpoint, the leaderboard's auth gate, and the full VS match
engine (movement, paddle clamping, the speed cap, scoring, match-end)
— all as pure logic / request tests, no live Mongo connection needed
for any of them.

## Project structure

```
backend/
  app.js               Express app + all routes (no listen())
  server.js            HTTP server, Socket.io, Mongo connection, listen()
  db.js                Mongoose connection
  config/passport.js   Google OAuth strategy
  models/              User, Score
  routes/               auth.js, leaderboard.js
  game/                 PongMatch.js (VS physics), matchmaking.js
  tests/

frontend/
  src/
    App.jsx             Mode select, volume controls, wraps everything in AuthProvider
    AuthContext.jsx      Session state (who's signed in)
    ProfileMenu.jsx       Sign in / sign out, top corner
    SoloGame.jsx          Solo mode, leaderboard display + save
    VsGame.jsx            VS mode
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
| `DROPLET_HOST` / `DROPLET_USERNAME` / `DROPLET_SSH_KEY` | Already set up — deploy access |

Missing `MONGO_URI` or the Google credentials doesn't crash the app —
Solo and VS play normally, sign-in and score-saving just stay disabled
until those exist.




