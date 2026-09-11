import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { Designation } from '../../src/modules/masters/models/designation.model';

describe('Auth Session Persistence & Refresh Lifecycle Integration Test', () => {
  const app = createApp();

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    // Clean up any test records
    await Designation.destroy({ where: { code: 'TEST_REFRESH_PERSIST' } });
  });

  it('should complete the full login -> create -> refresh -> reload lifecycle', async () => {
    // 1. User logs into HRMS
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'hradmin@blueroyal.com',
        password: 'HrAdmin@2026!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.user.email).toBe('hradmin@blueroyal.com');
    expect(loginRes.headers['set-cookie']).toBeDefined();

    const accessToken = loginRes.body.data.accessToken;
    const cookies = loginRes.headers['set-cookie'];

    // 2. User verifies identity on initial load (/auth/me)
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe('hradmin@blueroyal.com');
    expect(meRes.body.data.roles).toContain('hr_admin');
    expect(meRes.body.data.permissions).toContain('designations:create');

    // 3. User creates a new record
    await Designation.destroy({ where: { code: 'TEST_REFRESH_PERSIST' } });

    const createRes = await request(app)
      .post('/api/v1/designations')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code: 'TEST_REFRESH_PERSIST',
        title: 'Session Persistence Test Specialist',
        description: 'Verifies database persistence across page refresh and session recovery',
        isActive: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const createdId = createRes.body.data.id;
    expect(createdId).toBeDefined();

    // 4. Verify PostgreSQL persistence directly at database level
    const dbRecord = await Designation.findByPk(createdId);
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.code).toBe('TEST_REFRESH_PERSIST');

    // 5. SIMULATE BROWSER REFRESH (F5):
    // Angular bootstraps from scratch. Stored access token hydrates auth session via /auth/me
    const refreshBootstrapRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(refreshBootstrapRes.status).toBe(200);
    expect(refreshBootstrapRes.body.data.email).toBe('hradmin@blueroyal.com');
    expect(refreshBootstrapRes.body.data.permissions).toContain('designations:read');

    // 6. After refresh, user page reloads data from PostgreSQL
    const fetchCreatedRes = await request(app)
      .get(`/api/v1/designations/${createdId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(fetchCreatedRes.status).toBe(200);
    expect(fetchCreatedRes.body.success).toBe(true);
    expect(fetchCreatedRes.body.data.code).toBe('TEST_REFRESH_PERSIST');
    expect(fetchCreatedRes.body.data.title).toBe('Session Persistence Test Specialist');

    // 7. SIMULATE ACCESS TOKEN EXPIRATION (15m elapsed):
    // API returns 401 on expired token
    const expiredRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid_or_expired_token');

    expect(expiredRes.status).toBe(401);

    // 8. Transparent refresh using HttpOnly cookie
    const tokenRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .send({});

    expect(tokenRefreshRes.status).toBe(200);
    expect(tokenRefreshRes.body.success).toBe(true);
    const newAccessToken = tokenRefreshRes.body.data.accessToken;
    expect(typeof newAccessToken).toBe('string');
    expect(newAccessToken.length).toBeGreaterThan(20);

    // 9. Replayed request with new token succeeds seamlessly
    const replayedMeRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`);

    expect(replayedMeRes.status).toBe(200);
    expect(replayedMeRes.body.data.email).toBe('hradmin@blueroyal.com');

    // 10. Clean up
    await Designation.destroy({ where: { id: createdId } });
  });
});
