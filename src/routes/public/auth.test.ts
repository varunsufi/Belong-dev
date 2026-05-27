import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { config } from '../../config';
import { errorHandler } from '../../errors/errorHandler';
import { User, UserTokenEntity } from '../../entities';
import { UserTokenMapper } from '../../mappers/UserTokenMapper';
import { registerRequestTrace, TRACE_ID_HEADER } from '../../plugins/requestTrace';
import authRoutes from './auth';

const buildTestApp = (repositories: FakeRepositories) => {
  const app = Fastify({
    requestIdHeader: TRACE_ID_HEADER,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  app.setErrorHandler(errorHandler);
  registerRequestTrace(app);
  app.decorate('db', {
    getRepository: (entity: unknown) => {
      if (entity === User) {
        return repositories.userRepository;
      }

      if (entity === UserTokenEntity) {
        return repositories.userTokenRepository;
      }

      throw new Error('Unexpected repository requested');
    },
  } as unknown as DataSource);
  app.register(authRoutes, { prefix: '/api/auth' });

  return app;
};

const buildFakeRepositories = () => ({
  userRepository: new FakeUserRepository(),
  userTokenRepository: new FakeUserTokenRepository(),
});

class FakeUserRepository {
  readonly users: User[] = [];

  async findOneBy(where: { email?: string; id?: string }): Promise<User | null> {
    if (where.email) {
      return this.users.find((user) => user.email === where.email) ?? null;
    }

    if (where.id) {
      return this.users.find((user) => user.id === where.id) ?? null;
    }

    return null;
  }

  async save(user: User): Promise<User> {
    user.id = user.id ?? randomUUID();
    user.createdAt = user.createdAt ?? new Date();
    user.updatedAt = user.updatedAt ?? new Date();
    this.users.push(user);
    return user;
  }
}

class FakeUserTokenRepository {
  readonly tokens: UserTokenEntity[] = [];

  async findOneBy(where: { userId?: string; refreshTokenHash?: string }): Promise<UserTokenEntity | null> {
    if (where.userId) {
      return this.tokens.find((token) => token.userId === where.userId && !token.revokedAt) ?? null;
    }

    if (where.refreshTokenHash) {
      return this.tokens.find((token) => token.refreshTokenHash === where.refreshTokenHash) ?? null;
    }

    return null;
  }

  async save(token: UserTokenEntity): Promise<UserTokenEntity> {
    token.id = token.id ?? randomUUID();
    token.createdAt = token.createdAt ?? new Date();
    token.updatedAt = new Date();

    const existingIndex = this.tokens.findIndex((existingToken) => existingToken.id === token.id);

    if (existingIndex >= 0) {
      this.tokens[existingIndex] = token;
    } else {
      this.tokens.push(token);
    }

    return token;
  }
}

interface FakeRepositories {
  userRepository: FakeUserRepository;
  userTokenRepository: FakeUserTokenRepository;
}

describe('POST /api/auth/register', () => {
  it('registers a user and returns only email and displayName', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'Fan@Example.com',
        password: 'strongPassword123',
        displayName: ' Belong Fan ',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      data: {
        email: 'fan@example.com',
        displayName: 'Belong Fan',
      },
    });
    expect(response.json().data).not.toHaveProperty('id');
    expect(response.json().data).not.toHaveProperty('totalPoints');
    expect(response.json().data).not.toHaveProperty('passwordHash');
    expect(response.json().data).not.toHaveProperty('accessToken');
    expect(response.json().data).not.toHaveProperty('refreshToken');

    const savedUser = repositories.userRepository.users[0];
    expect(savedUser.email).toBe('fan@example.com');
    expect(savedUser.passwordHash).not.toBe('strongPassword123');
    await expect(bcrypt.compare('strongPassword123', savedUser.passwordHash)).resolves.toBe(true);

    await app.close();
  });

  it('rejects duplicate email after normalization', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'Fan@Example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.COM',
        password: 'anotherPassword123',
        displayName: 'Another Fan',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists',
        traceId: expect.any(String),
      },
    });

    await app.close();
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
  ])('returns validation error for %s', async (_caseName, payload) => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });
});

describe('POST /api/auth/login', () => {
  it('logs in a user and returns only access and refresh tokens', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'FAN@example.com',
        password: 'strongPassword123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Object.keys(body.data).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(body.data).not.toHaveProperty('user');
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(body.data).not.toHaveProperty('email');
    expect(body.data).not.toHaveProperty('displayName');

    const savedUser = repositories.userRepository.users[0];
    const accessPayload = jwt.verify(body.data.accessToken, config.jwt.accessSecret);
    const refreshPayload = jwt.verify(body.data.refreshToken, config.jwt.refreshSecret);

    expect(accessPayload).toMatchObject({
      sub: savedUser.id,
      type: 'access',
    });
    expect(refreshPayload).toMatchObject({
      sub: savedUser.id,
      type: 'refresh',
    });
    expect(repositories.userTokenRepository.tokens).toHaveLength(1);
    expect(repositories.userTokenRepository.tokens[0]).toMatchObject({
      userId: savedUser.id,
      accessTokenHash: UserTokenMapper.hashToken(body.data.accessToken),
      refreshTokenHash: UserTokenMapper.hashToken(body.data.refreshToken),
      revokedAt: null,
    });

    await app.close();
  });

  it('revokes the old token row on second login for the same user', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const firstAccessTokenHash = UserTokenMapper.hashToken(firstResponse.json().data.accessToken);
    const firstRefreshTokenHash = UserTokenMapper.hashToken(firstResponse.json().data.refreshToken);

    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const secondAccessTokenHash = UserTokenMapper.hashToken(secondResponse.json().data.accessToken);
    const secondRefreshTokenHash = UserTokenMapper.hashToken(secondResponse.json().data.refreshToken);
    const oldTokenRow = repositories.userTokenRepository.tokens.find(
      (token) => token.refreshTokenHash === firstRefreshTokenHash,
    );
    const newTokenRow = repositories.userTokenRepository.tokens.find(
      (token) => token.refreshTokenHash === secondRefreshTokenHash,
    );

    expect(repositories.userTokenRepository.tokens).toHaveLength(2);
    expect(oldTokenRow).toMatchObject({
      accessTokenHash: firstAccessTokenHash,
      refreshTokenHash: firstRefreshTokenHash,
    });
    expect(oldTokenRow?.revokedAt).toBeInstanceOf(Date);
    expect(newTokenRow).toMatchObject({
      accessTokenHash: secondAccessTokenHash,
      refreshTokenHash: secondRefreshTokenHash,
      revokedAt: null,
    });

    await app.close();
  });

  it.each([
    ['unknown email', 'missing@example.com', 'strongPassword123'],
    ['wrong password', 'fan@example.com', 'wrongPassword123'],
  ])('returns invalid credentials for %s', async (_caseName, email, password) => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email,
        password,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });

  it.each([
    ['invalid email', { email: 'not-an-email', password: 'strongPassword123' }],
    ['short password', { email: 'fan@example.com', password: 'short' }],
    ['extra fields', { email: 'fan@example.com', password: 'strongPassword123', rememberMe: true }],
  ])('returns validation error for %s', async (_caseName, payload) => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates a valid refresh token and revokes the old token pair', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const oldRefreshToken = loginResponse.json().data.refreshToken;
    const oldAccessToken = loginResponse.json().data.accessToken;

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken: oldRefreshToken,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);
    const body = refreshResponse.json();
    expect(Object.keys(body.data).sort()).toEqual(['accessToken', 'refreshToken']);
    expect(body.data.accessToken).not.toBe(oldAccessToken);
    expect(body.data.refreshToken).not.toBe(oldRefreshToken);

    const oldTokenRow = repositories.userTokenRepository.tokens.find(
      (token) => token.refreshTokenHash === UserTokenMapper.hashToken(oldRefreshToken),
    );
    const newTokenRow = repositories.userTokenRepository.tokens.find(
      (token) => token.refreshTokenHash === UserTokenMapper.hashToken(body.data.refreshToken),
    );

    expect(oldTokenRow?.revokedAt).toBeInstanceOf(Date);
    expect(oldTokenRow?.accessTokenHash).toBe(UserTokenMapper.hashToken(oldAccessToken));
    expect(newTokenRow).toMatchObject({
      refreshTokenHash: UserTokenMapper.hashToken(body.data.refreshToken),
      accessTokenHash: UserTokenMapper.hashToken(body.data.accessToken),
      revokedAt: null,
    });

    const accessPayload = jwt.verify(body.data.accessToken, config.jwt.accessSecret);
    const refreshPayload = jwt.verify(body.data.refreshToken, config.jwt.refreshSecret);

    expect(accessPayload).toMatchObject({ type: 'access' });
    expect(refreshPayload).toMatchObject({ type: 'refresh' });

    await app.close();
  });

  it('rejects reuse of an old refresh token after rotation', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const oldRefreshToken = loginResponse.json().data.refreshToken;

    await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken: oldRefreshToken,
      },
    });

    const reuseResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken: oldRefreshToken,
      },
    });

    expect(reuseResponse.statusCode).toBe(401);
    expect(reuseResponse.json()).toEqual({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });

  it.each([
    ['malformed token', 'not-a-jwt'],
    [
      'unknown token',
      jwt.sign({ sub: randomUUID(), type: 'refresh', jti: randomUUID() }, config.jwt.refreshSecret, {
        expiresIn: '7d',
      }),
    ],
    [
      'access token used as refresh',
      jwt.sign({ sub: randomUUID(), type: 'access', jti: randomUUID() }, config.jwt.accessSecret, {
        expiresIn: '15m',
      }),
    ],
    [
      'expired token',
      jwt.sign({ sub: randomUUID(), type: 'refresh', jti: randomUUID() }, config.jwt.refreshSecret, {
        expiresIn: '-1s',
      }),
    ],
  ])('returns invalid refresh token for %s', async (_caseName, refreshToken) => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });

  it.each([
    ['empty token', { refreshToken: '' }],
    ['extra fields', { refreshToken: 'token', extra: true }],
  ])('returns validation error for %s', async (_caseName, payload) => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the token pair matched by the refresh token', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const { accessToken, refreshToken } = loginResponse.json().data;

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: {
        refreshToken,
      },
    });

    expect(logoutResponse.statusCode).toBe(204);
    expect(logoutResponse.body).toBe('');

    const tokenRow = repositories.userTokenRepository.tokens[0];
    expect(tokenRow.revokedAt).toBeInstanceOf(Date);
    expect(tokenRow.accessTokenHash).toBe(UserTokenMapper.hashToken(accessToken));
    expect(tokenRow.refreshTokenHash).toBe(UserTokenMapper.hashToken(refreshToken));

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: {
        refreshToken,
      },
    });

    expect(refreshAfterLogout.statusCode).toBe(401);

    await app.close();
  });

  it('is idempotent for repeated or unknown logout tokens', async () => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
        displayName: 'Belong Fan',
      },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'fan@example.com',
        password: 'strongPassword123',
      },
    });
    const refreshToken = loginResponse.json().data.refreshToken;

    const firstLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken },
    });
    const secondLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken },
    });
    const unknownLogout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken: 'unknown-token' },
    });

    expect(firstLogout.statusCode).toBe(204);
    expect(secondLogout.statusCode).toBe(204);
    expect(unknownLogout.statusCode).toBe(204);

    await app.close();
  });

  it.each([
    ['empty token', { refreshToken: '' }],
    ['extra fields', { refreshToken: 'token', extra: true }],
  ])('returns validation error for %s', async (_caseName, payload) => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });
});
