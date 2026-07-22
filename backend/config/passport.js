const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'https://neilpena.xyz/api/auth/google/callback';

let googleConfigured = false;

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails?.[0]?.value || '',
              displayName: profile.displayName,
              avatarUrl: profile.photos?.[0]?.value,
            });
          }
          done(null, user);
        } catch (err) {
          done(err, null);
        }
      }
    )
  );
  googleConfigured = true;
} else {
  console.warn(
    'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in is disabled until they are.'
  );
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = { passport, googleConfigured };
