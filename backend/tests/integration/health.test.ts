import request from 'supertest';
import { createApp } from '../../src/app';

describe('Health API Integration Test', () => {
  const app = createApp();

  it('GET /api/v1/health should respond with a valid health payload and correlation ID', async () => {
    const response = await request(app).get('/api/v1/health');

    // Should return 200 (if DB running) or 503 (if degraded), but response envelope must always match schema
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('correlationId');
    expect(response.headers['x-correlation-id']).toBeDefined();
    expect(response.body.data).toHaveProperty('status');
    expect(response.body.data).toHaveProperty('components');
  });

  it('GET /undefined-route should return standardized 404 error envelope', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.meta.correlationId).toBeDefined();
  });
});
