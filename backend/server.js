const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { attachPongHandlers } = require('./game/matchmaking');

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }, // tighten to the real domain once it's finalized
});

attachPongHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Squash backend listening on port ${PORT}`);
});
