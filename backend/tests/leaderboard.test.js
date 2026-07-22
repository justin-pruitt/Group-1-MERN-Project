const request = require('supertest');
const app = require('../app');

describe('POST /api/leaderboard', () => {
  it('rejects a score submission with no signed-in session', async () => {
    const res = await request(app).post('/api/leaderboard').send({ score: 42, mode: 'solo' });
    expect(res.statusCode).toBe(401);
  });
});
