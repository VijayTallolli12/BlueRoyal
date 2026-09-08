import request from 'supertest';
import { createApp } from '../../src/app';

describe('Auth API Validation Integration Test', () => {
  const app = createApp();

  it('POST /api/v1/auth/login should reject empty body with 422 VALIDATION_FAILED', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({});

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details).toBeDefined();
    expect(response.body.meta.correlationId).toBeDefined();
  });

  it('POST /api/v1/auth/login should reject invalid email format with 422', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.error.details.some((d: any) => d.field === 'email')).toBe(true);
  });

  it('POST /api/v1/auth/refresh should reject missing refresh token with 401 UNAUTHORIZED', async () => {
    const response = await request(app).post('/api/v1/auth/refresh').send({});

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/v1/auth/me should reject unauthenticated request with 401 UNAUTHORIZED', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
