const { AiMatch } = require('./AiMatch');
const Score = require('../models/Score');
const { getCommentary } = require('../ai/commentary');

// No matchmaking needed here (unlike VS mode) — it's always one human
// against the agent, so a match can start the moment the socket asks.
const matchBySocket = new Map();
const watcherBySocket = new Map(); // polls for score changes to trigger commentary

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

function cleanupSocket(socketId) {
  const match = matchBySocket.get(socketId);
  if (match) {
    match.stop();
    matchBySocket.delete(socketId);
  }
  const watcher = watcherBySocket.get(socketId);
  if (watcher) {
    clearInterval(watcher);
    watcherBySocket.delete(socketId);
  }
}

function attachAiHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('ai:start', () => {
      cleanupSocket(socket.id); // in case they hit "rematch" mid-match

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
          getCommentary(aiWon ? 'match_end_win' : 'match_end_loss', { score, longestVolley })
            .then((line) => io.to(roomId).emit('ai:say', line))
            .catch(() => {});

          cleanupSocket(socket.id);
        }
      );

      matchBySocket.set(socket.id, match);
      socket.emit('ai:matched', { you: { displayName: user?.displayName } });
      match.start();

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
    });

    // Reuses the same event name as VS mode — the human is always 'left'
    // in an AI Protocol match, so no side lookup is needed here.
    socket.on('pong:input', (y) => {
      if (typeof y !== 'number' || Number.isNaN(y)) return;
      const match = matchBySocket.get(socket.id);
      if (match) match.setPaddleTarget('left', y);
    });

    socket.on('ai:stop', () => cleanupSocket(socket.id));
    socket.on('disconnect', () => cleanupSocket(socket.id));
  });
}

module.exports = { attachAiHandlers };
