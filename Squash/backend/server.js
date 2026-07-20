const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Placeholder endpoint - proves the API is reachable through nginx.
// Auth, MongoDB, and everything else gets added incrementally later.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Squash backend listening on port ${PORT}`);
});