import jwt from 'jsonwebtoken';
import { IntegrationTestApp, setupIntegrationTestApp } from '../../test/integrationTestUtils';

describe('auth routes integration', () => {
  let testApp: IntegrationTestApp;

  beforeAll(async () => {
    testApp = await setupIntegrationTestApp();
  });

  beforeEach(async () => {
    await testApp.resetDatabase();
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.stop();
    }
  });

  it('registers a user and returns only public profile fields', async () => {
    const response = await testApp.request
      .post('/api/auth/register')
      .send({
        email: 'Fan@Example.com',
        password: 'strongPassword123',
        displayName: ' Belong Fan ',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        email: 'fan@example.com',
        displayName: 'Belong Fan',
      },
    });
    expect(response.body.data).not.toHaveProperty('id');
    expect(response.body.data).not.toHaveProperty('totalPoints');
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('accessToken');
    expect(response.body.data).not.toHaveProperty('refreshToken');

    const savedUsers = await testApp.db.query('SELECT email, display_name, password_hash FROM users');
    expect(savedUsers).toHaveLength(1);
    expect(savedUsers[0]).toMatchObject({
      email: 'fan@example.com',
      display_name: 'Belong Fan',
    });
    expect(savedUsers[0].password_hash).not.toBe('strongPassword123');
  });

  it('rejects duplicate email after normalization', async () => {
    await registerUser();

    const response = await testApp.request
      .post('/api/auth/register')
      .send({
        email: 'fan@example.COM',
        password: 'anotherPassword123',
        displayName: 'Another Fan',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
        traceId: expect.any(String),
      },
    });
  });

  it.each([
    ['invalid email', { email: 'not-an-email', password: 'strongPassword123', displayName: 'Belong Fan' }],
    ['short password', { email: 'fan@example.com', password: 'short', displayName: 'Belong Fan' }],
    ['blank display name', { email: 'fan@example.com', password: 'strongPassword123', displayName: '   ' }],
    [
      'extra fields',
      {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
        role: 'admin',
      },
    ],
  ])('returns validation error for %s registration payload', async (_caseName, payload) => {
    const response = await testApp.request.post('/api/auth/register').send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });
  });

  it('logs in a registered user and returns only tokens', async () => {
    await registerUser();

    const response = await loginUser();

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.data).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(response.body.data).not.toHaveProperty('user');
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('email');
    expect(response.body.data).not.toHaveProperty('displayName');
    expect(jwt.verify(response.body.data.accessToken, process.env.JWT_ACCESS_SECRET as string)).toMatchObject({
      type: 'access',
    });
    expect(jwt.verify(response.body.data.refreshToken, process.env.JWT_REFRESH_SECRET as string)).toMatchObject({
      type: 'refresh',
    });
  });

  it('rejects login with the wrong password', async () => {
    await registerUser();

    const response = await testApp.request
      .post('/api/auth/login')
      .send({
        email: 'fan@example.com',
        password: 'wrongPassword123',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        traceId: expect.any(String),
      },
    });
  });

  it('rotates refresh tokens and rejects reuse of an old refresh token', async () => {
    await registerUser();
    const loginResponse = await loginUser();
    const oldRefreshToken = loginResponse.body.data.refreshToken;

    const refreshResponse = await testApp.request
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(Object.keys(refreshResponse.body.data).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(refreshResponse.body.data.refreshToken).not.toBe(oldRefreshToken);

    const reuseResponse = await testApp.request
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body).toEqual({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
        traceId: expect.any(String),
      },
    });
  });

  it('logs out and rejects a later refresh with the same token', async () => {
    await registerUser();
    const loginResponse = await loginUser();
    const refreshToken = loginResponse.body.data.refreshToken;

    const logoutResponse = await testApp.request
      .post('/api/auth/logout')
      .send({ refreshToken });

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.text).toBe('');

    const refreshAfterLogout = await testApp.request
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshAfterLogout.status).toBe(401);
  });

  const registerUser = () =>
    testApp.request
      .post('/api/auth/register')
      .send({
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      });

  const loginUser = () =>
    testApp.request
      .post('/api/auth/login')
      .send({
        email: 'fan@example.com',
        password: 'strongPassword123',
      });
});
