const { AiMatch } = require('./AiMatch');
const Score = require('../models/Score');
const { getCommentary } = require('../ai/commentary');

// No matchmaking needed here (unlike VS mode) — it's always one human
// against the agent, so a match can start the moment the socket asks
// (subject to the concurrency cap below).
//
// Matches CountdownOverlay's total run time on the frontend (4 steps x
// 1000ms, timed to the countdown audio clip) — the ball shouldn't start
// moving until the player's "GO" lands.
const COUNTDOWN_DELAY_MS = 4000;
const matchBySocket = new Map();
const watcherBySocket = new Map(); // polls for score changes to trigger commentary

// Caps how many AI Protocol matches can be live at once, server-wide.
// This is NOT primarily about avoiding 429s — commentary.js's own
// throttle (MIN_MS_BETWEEN_CALLS + requestInFlight) already caps
// outbound Gemini calls globally no matter how many matches are
// running; extra concurrent matches just fall back to canned lines more
// often, they don't risk exceeding the RPM ceiling on their own.
//
// What concurrency actually costs is the shared 500 RPD daily budget:
// with only 1-2 matches running, there are natural gaps between rallies
// where nothing needs a Gemini call, so the throttle sits idle between
// events. With many matches running at once, some match almost always
// has a fresh score event ready, so the shared throttle can end up
// firing every 4500ms nonstop — burning the whole day's RPD in under an
// hour of continuous concurrent play instead of spreading it out.
//
// 2 was picked as a starting point: it's enough for two people to play
// at once (or one person to rematch immediately while a friend's match
// wraps up) without letting the throttle slot become permanently
// contested. Drop to 1 via AI_PROTOCOL_MAX_CONCURRENT=1 if RPD still
// runs out too fast in practice; there's no reason not to raise it if
// this project ever moves to a paid tier with real RPD headroom.
const MAX_CONCURRENT_AI_MATCHES = Number(process.env.AI_PROTOCOL_MAX_CONCURRENT) || 2;

// FIFO queue of sockets waiting for a match slot. Holds actual socket
// references (not just ids) since promotion needs to emit to them
// directly and check .connected — matchBySocket/watcherBySocket key by
// id because those only ever get looked up by a socket that's already
// known to be live (the event came in on it), but a queued socket might
// have disconnected while waiting, hence the .connected check on promotion.
const waitingQueue = [];

function activeMatchCount() {
  return matchBySocket.size;
}

// Tells every socket still waiting where it stands. Called after any
// change to the queue's contents (push, promotion, or a queued socket
// leaving) so positions stay accurate — O(n) but the queue is expected
// to stay small for a project this size, and it's just a couple of
// number comparisons per queued socket.
function broadcastQueuePositions() {
  waitingQueue.forEach((queuedSocket, index) => {
    queuedSocket.emit('ai:queued', { position: index + 1, ahead: index });
  });
}

// Drops a socket from the queue if it's in there (disconnect while
// waiting, or a duplicate 'ai:start' from double-clicking). Returns
// whether anything was actually removed so callers can skip the
// broadcast when nothing changed.
function removeFromQueue(socketId) {
  const index = waitingQueue.findIndex((queuedSocket) => queuedSocket.id === socketId);
  if (index === -1) return false;
  waitingQueue.splice(index, 1);
  return true;
}

// Same "longest volley ranks the board" reasoning as VS mode's
// saveVsScore — see matchmaking.js.
async function saveAiScore(user, longestVolley) {
  if (!user || !longestVolley) return;
  try {
    await Score.create({
      user: user._id,
      displayName: user.displayName,
      score: longestVolley,
      mode: 'ai',
    });
  } catch (err) {
    console.error('Failed to save AI score:', err.message);
  }
}

// Flips the "beat the AI" flag the first time a signed-in player wins —
// left is always the human in an AI Protocol match (see AiMatch.js), so
// score.left > score.right is enough to know they won. Fire-and-forget
// with its own try/catch, same pattern as saveAiScore above, so a Mongo
// hiccup here can't block the match-end flow.
async function markAiVictory(user) {
  if (!user || user.hasBeatenAI) return;
  try {
    user.hasBeatenAI = true;
    await user.save();
  } catch (err) {
    console.error('Failed to record AI Protocol win:', err.message);
  }
}

function cleanupSocket(socketId) {
  const match = matchBySocket.get(socketId);
  if (match) {
    clearTimeout(match.startTimeout);
    match.stop();
    matchBySocket.delete(socketId);
  }
  const watcher = watcherBySocket.get(socketId);
  if (watcher) {
    clearInterval(watcher);
    watcherBySocket.delete(socketId);
  }
}

// Actually starts a match for a socket that already has a free slot —
// this is the body of the old 'ai:start' handler, factored out so both
// a fresh request (slot free right away) and a queue promotion (slot
// just freed up) go through identical setup.
function beginMatch(io, socket) {
  const user = socket.request.user;
  const roomId = `ai:${socket.id}`;
  socket.join(roomId);

  const match = new AiMatch(
    roomId,
    socket.id,
    (state) => io.to(roomId).emit('pong:state', state),
    (score, longestVolley) => {
      io.to(roomId).emit('pong:end', { score, longestVolley });
      saveAiScore(user, longestVolley);

      const aiWon = score.right > score.left;
      if (!aiWon) markAiVictory(user);
      getCommentary(aiWon ? 'match_end_win' : 'match_end_loss', { score, longestVolley })
        .then((line) => io.to(roomId).emit('ai:say', line))
        .catch(() => {});

      cleanupSocket(socket.id);
      promoteFromQueue(io); // this match's slot just freed up
    }
  );

  matchBySocket.set(socket.id, match);
  socket.emit('ai:matched', { you: { displayName: user?.displayName } });
  // Delay the actual ball movement so it lines up with the
  // "3, 2, 1, GO" countdown the client is showing right now.
  match.startTimeout = setTimeout(() => match.start(), COUNTDOWN_DELAY_MS);

  getCommentary('match_start', {})
    .then((line) => io.to(roomId).emit('ai:say', line))
    .catch(() => {});

  // Lightweight polling watcher (2Hz) to fire commentary on score
  // changes — simplest way to hook into PongMatch's tick loop without
  // adding an event-emitter interface it doesn't otherwise need.
  let prevScore = { left: 0, right: 0 };
  const watcher = setInterval(() => {
    const current = matchBySocket.get(socket.id);
    if (!current) return; // match already ended/cleaned up
    const { left, right } = current.state.score;
    if (left !== prevScore.left || right !== prevScore.right) {
      const aiScored = right > prevScore.right;
      prevScore = { left, right };
      getCommentary(aiScored ? 'ai_scored' : 'human_scored', {
        score: current.state.score,
        longestVolley: current.longestVolley,
      })
        .then((line) => io.to(roomId).emit('ai:say', line))
        .catch(() => {});
    }
  }, 500);
  watcherBySocket.set(socket.id, watcher);
}

// Pulls waiting sockets into free slots, in FIFO order, skipping anyone
// who disconnected while queued. Safe to call any time a slot might
// have opened up (match end, explicit stop, or disconnect) — it's a
// no-op if the queue's empty or every slot is already taken.
function promoteFromQueue(io) {
  let promoted = false;
  while (waitingQueue.length > 0 && activeMatchCount() < MAX_CONCURRENT_AI_MATCHES) {
    const nextSocket = waitingQueue.shift();
    promoted = true;
    if (!nextSocket.connected) continue; // gave up their spot by leaving
    beginMatch(io, nextSocket);
  }
  if (promoted) broadcastQueuePositions(); // let anyone still waiting know their position moved up
}

function attachAiHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('ai:start', () => {
      cleanupSocket(socket.id); // in case they hit "rematch" mid-match
      removeFromQueue(socket.id); // in case of a double-click while already queued

      if (activeMatchCount() < MAX_CONCURRENT_AI_MATCHES) {
        beginMatch(io, socket);
      } else {
        waitingQueue.push(socket);
        socket.emit('ai:queued', { position: waitingQueue.length, ahead: waitingQueue.length - 1 });
      }
    });

    // Reuses the same event name as VS mode — the human is always 'left'
    // in an AI Protocol match, so no side lookup is needed here.
    socket.on('pong:input', (y) => {
      if (typeof y !== 'number' || Number.isNaN(y)) return;
      const match = matchBySocket.get(socket.id);
      if (match) match.setPaddleTarget('left', y);
    });

    socket.on('ai:stop', () => {
      const wasQueued = removeFromQueue(socket.id);
      cleanupSocket(socket.id);
      if (wasQueued) broadcastQueuePositions();
      promoteFromQueue(io); // no-op unless leaving actually freed a slot
    });
    socket.on('disconnect', () => {
      const wasQueued = removeFromQueue(socket.id);
      cleanupSocket(socket.id);
      if (wasQueued) broadcastQueuePositions();
      promoteFromQueue(io);
    });
  });
}

module.exports = { attachAiHandlers };
