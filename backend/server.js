const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./db');
const { attachPongHandlers } = require('./game/matchmaking');
const { sessionMiddleware } = require('./config/session');
const { passport } = require('./config/passport');

connectDB();

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'https://neilpena.xyz', credentials: true },
});

// Run the same session/passport middleware Express uses, so a socket
// connection carries the same login state as the HTTP request that made
// it (via the same session cookie). This is what lets VS mode require an
// account and know which user is on each side of a match.
const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));
io.use((socket, next) => {
  if (socket.request.user) return next();
  next(new Error('Sign in required to play VS mode'));
});

attachPongHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Vector backend listening on port ${PORT}`);
});
