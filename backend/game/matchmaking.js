const { PongMatch } = require('./PongMatch');
const Score = require('../models/Score');

// Simple FIFO matchmaking: first two players to queue get paired. Fine
// for a class demo; real matchmaking/invites is a natural upgrade once
// accounts exist.
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

        left.emit('pong:matched', {
          side: 'left',
          you: { displayName: leftUser?.displayName },
          opponent: { displayName: rightUser?.displayName },
        });
        right.emit('pong:matched', {
          side: 'right',
          you: { displayName: rightUser?.displayName },
          opponent: { displayName: leftUser?.displayName },
        });
        match.start();
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
