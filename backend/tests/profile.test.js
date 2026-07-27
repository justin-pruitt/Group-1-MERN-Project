const request = require('supertest');
const app = require('../app');

describe('GET /api/profile', () => {
  it('rejects a request with no signed-in session', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /api/profile', () => {
  it('rejects a request with no signed-in session', async () => {
    const res = await request(app).patch('/api/profile').send({ username: 'newname' });
    expect(res.statusCode).toBe(401);
  });
});
