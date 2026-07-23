const session = require('express-session');
const MongoStore = require('connect-mongo').default;

// Extracted out of app.js so server.js can hand the exact same middleware
// to Socket.IO — that's what lets a VS match know which account is on
// each end of the connection, using the same cookie the browser already
// sends on every HTTP request.
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGO_URI
    ? MongoStore.create({ mongoUrl: process.env.MONGO_URI, collectionName: 'sessions' })
    : undefined, // falls back to MemoryStore locally if Mongo isn't configured yet
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});

module.exports = { sessionMiddleware };
