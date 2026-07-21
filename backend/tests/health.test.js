const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('responds with 200 and a status field', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
