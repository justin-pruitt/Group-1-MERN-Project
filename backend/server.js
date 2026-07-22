const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./db');
const { attachPongHandlers } = require('./game/matchmaking');

connectDB();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'https://neilpena.xyz', credentials: true },
});

attachPongHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Vector backend listening on port ${PORT}`);
});
