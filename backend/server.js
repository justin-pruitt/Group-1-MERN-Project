const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./db');
const { attachPongHandlers } = require('./game/matchmaking');
const { attachAiHandlers } = require('./game/aiMatchmaking');
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
  if (!socket.request.user) return next(new Error('Sign in required to play VS mode'));
  // Mirrors the frontend's mode-card gating in App.jsx — VS/AI both require
  // a verified email, not just a signed-in session. Enforced here too so
  // it can't be skipped by talking to the socket directly.
  if (!socket.request.user.emailVerified) {
    return next(new Error('Please verify your email to play VS/AI mode'));
  }
  next();
});

attachPongHandlers(io);
attachAiHandlers(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Vector backend listening on port ${PORT}`);
});
