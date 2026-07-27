const { PongMatch } = require('./PongMatch');
const Score = require('../models/Score');
const { publicPlayer } = require('./publicPlayer');

// Simple FIFO matchmaking: first two players to queue get paired. Fine
// for a class demo; real matchmaking/invites is a natural upgrade once
// accounts exist.
//
// Two things happen client-side before the ball can move: ClashScreen's
// versus intro (timed to Clash.mp3, ~3.3s — see ClashScreen.jsx) and
// then CountdownOverlay's "3, 2, 1, GO" (4 steps x 1000ms, timed to the
// countdown audio clip). Frontend and backend are separate processes, so
// these are kept in sync by hand rather than a shared import — if either
// clip's duration changes, update both sides.
const CLASH_DELAY_MS = 3300;
const COUNTDOWN_DELAY_MS = 4000;
const MATCH_START_DELAY_MS = CLASH_DELAY_MS + COUNTDOWN_DELAY_MS;
let waitingSocket = null;
const matchBySocket = new Map();
const sideBySocket = new Map();

// Saves a VS-mode leaderboard entry using the longest volley reached in
// the match, not win/loss score — that's what puts the longest rallies
// at the top of the board rather than whoever happened to win. Every
// socket here is already required to be authenticated (see server.js),
// so `user` should always be present, but this stays defensive in case a
// session expires mid-match.
async function saveVsScore(user, longestVolley) {
  if (!user || !longestVolley) return;
  try {
    await Score.create({
      user: user._id,
      displayName: user.displayName,
      score: longestVolley,
      mode: 'vs',
    });
  } catch (err) {
    console.error('Failed to save VS score:', err.message);
  }
}

function attachPongHandlers(io) {
  io.on('connection', (socket) => {
    socket.on('pong:queue', () => {
      if (matchBySocket.has(socket.id)) return;

      if (waitingSocket && waitingSocket.connected && waitingSocket.id !== socket.id) {
        const left = waitingSocket;
        const right = socket;
        waitingSocket = null;

        const roomId = `match:${left.id}:${right.id}`;
        left.join(roomId);
        right.join(roomId);
        sideBySocket.set(left.id, 'left');
        sideBySocket.set(right.id, 'right');

        const leftUser = left.request.user;
        const rightUser = right.request.user;

        const match = new PongMatch(
          roomId,
          left.id,
          right.id,
          (state) => io.to(roomId).emit('pong:state', state),
          (score, longestVolley) => {
            io.to(roomId).emit('pong:end', { score, longestVolley });
            saveVsScore(leftUser, longestVolley);
            saveVsScore(rightUser, longestVolley);
          }
        );

        matchBySocket.set(left.id, match);
        matchBySocket.set(right.id, match);

        const leftPlayer = publicPlayer(leftUser);
        const rightPlayer = publicPlayer(rightUser);

        left.emit('pong:matched', { side: 'left', you: leftPlayer, opponent: rightPlayer });
        right.emit('pong:matched', { side: 'right', you: rightPlayer, opponent: leftPlayer });
        // Delay the actual ball movement so it lines up with the
        // clash animation + "3, 2, 1, GO" countdown both clients are
        // showing right now.
        match.startTimeout = setTimeout(() => match.start(), MATCH_START_DELAY_MS);
      } else {
        waitingSocket = socket;
        socket.emit('pong:waiting');
      }
    });

    socket.on('pong:input', (y) => {
      if (typeof y !== 'number' || Number.isNaN(y)) return;
      const match = matchBySocket.get(socket.id);
      const side = sideBySocket.get(socket.id);
      if (match && side) match.setPaddleTarget(side, y);
    });

    socket.on('disconnect', () => {
      if (waitingSocket && waitingSocket.id === socket.id) {
        waitingSocket = null;
      }

      const match = matchBySocket.get(socket.id);
      if (match) {
        clearTimeout(match.startTimeout);
        match.stop();
        io.to(match.id).emit('pong:opponent_left');
        matchBySocket.delete(match.sockets.left);
        matchBySocket.delete(match.sockets.right);
        sideBySocket.delete(match.sockets.left);
        sideBySocket.delete(match.sockets.right);
      }
    });
  });
}

module.exports = { attachPongHandlers };
