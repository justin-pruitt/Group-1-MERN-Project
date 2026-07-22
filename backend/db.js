const mongoose = require('mongoose');

async function connectDB() {
  if (!process.env.MONGO_URI) {
    console.warn('No MONGO_URI set — auth sessions and the leaderboard will not work until it is.');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
  }
}

module.exports = { connectDB };
