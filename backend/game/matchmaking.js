const { PongMatch } = require('./PongMatch');

// Simple FIFO matchmaking: first two players to queue get paired. Fine
// for a class demo; real matchmaking/invites is a natural upgrade once
// accounts exist.
let waitingSocket = null;
const matchBySocket = new Map();
const sideBySocket = new Map();

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

        const match = new PongMatch(
          roomId,
          left.id,
          right.id,
          (state) => io.to(roomId).emit('pong:state', state),
          (score) => io.to(roomId).emit('pong:end', score)
        );

        matchBySocket.set(left.id, match);
        matchBySocket.set(right.id, match);

        left.emit('pong:matched', { side: 'left' });
        right.emit('pong:matched', { side: 'right' });
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
