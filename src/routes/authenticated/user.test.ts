import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { config } from '../../config';
import { ChallengeCompletion, RewardRedemption, User, UserTokenEntity } from '../../entities';
import { errorHandler } from '../../errors/errorHandler';
import { UserTokenMapper } from '../../mappers/UserTokenMapper';
import { registerRequestTrace, TRACE_ID_HEADER } from '../../plugins/requestTrace';
import authenticatedRoutes from '.';

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

      if (entity === ChallengeCompletion) {
        return repositories.completionRepository;
      }

      if (entity === RewardRedemption) {
        return repositories.redemptionRepository;
      }

      throw new Error('Unexpected repository requested');
    },
  } as unknown as DataSource);
  app.register(authenticatedRoutes, { prefix: '/api' });

  return app;
};

const buildFakeRepositories = () => ({
  userRepository: new FakeUserRepository(),
  userTokenRepository: new FakeUserTokenRepository(),
  completionRepository: new FakeAggregateRepository<ChallengeCompletion>('pointsEarned'),
  redemptionRepository: new FakeAggregateRepository<RewardRedemption>('pointsSpent'),
});

class FakeUserRepository {
  readonly users: User[] = [];

  async findOneBy(where: { id?: string }): Promise<User | null> {
    if (where.id) {
      return this.users.find((user) => user.id === where.id) ?? null;
    }

    return null;
  }

  async save(user: User): Promise<User> {
    const existingIndex = this.users.findIndex((existingUser) => existingUser.id === user.id);

    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }

    return user;
  }
}

class FakeUserTokenRepository {
  readonly tokens: UserTokenEntity[] = [];

  async findOneBy(where: { accessTokenHash?: string }): Promise<UserTokenEntity | null> {
    if (where.accessTokenHash) {
      return this.tokens.find((token) => token.accessTokenHash === where.accessTokenHash) ?? null;
    }

    return null;
  }
}

class FakeAggregateRepository<T extends { userId: string }> {
  readonly rows: T[] = [];

  constructor(private readonly sumColumn: keyof T) {
  }

  async countBy(where: { userId: string }): Promise<number> {
    return this.rows.filter((row) => row.userId === where.userId).length;
  }

  async sum(_column: string, where: { userId: string }): Promise<number | null> {
    const values = this.rows
      .filter((row) => row.userId === where.userId)
      .map((row) => Number(row[this.sumColumn]));

    if (values.length === 0) {
      return null;
    }

    return values.reduce((total, value) => total + value, 0);
  }
}

interface FakeRepositories {
  userRepository: FakeUserRepository;
  userTokenRepository: FakeUserTokenRepository;
  completionRepository: FakeAggregateRepository<ChallengeCompletion>;
  redemptionRepository: FakeAggregateRepository<RewardRedemption>;
}

const buildUser = () => {
  const user = new User();
  user.id = randomUUID();
  user.email = 'fan@example.com';
  user.displayName = 'Belong Fan';
  user.passwordHash = 'hashed-password';
  user.totalPoints = 325;
  user.createdAt = new Date('2026-01-01T00:00:00.000Z');
  user.updatedAt = new Date('2026-01-02T00:00:00.000Z');

  return user;
};

const createAccessToken = (userId: string, expiresIn = '15m') =>
  jwt.sign({ sub: userId, type: 'access', jti: randomUUID() }, config.jwt.accessSecret, {
    expiresIn: expiresIn as SignOptions['expiresIn'],
  });

const createRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId, type: 'refresh', jti: randomUUID() }, config.jwt.refreshSecret, { expiresIn: '7d' });

const addTokenRow = (
  repository: FakeUserTokenRepository,
  options: {
    userId: string;
    accessToken: string;
    revokedAt?: Date | null;
    accessTokenExpiresAt?: Date;
  },
) => {
  const token = new UserTokenEntity();
  token.id = randomUUID();
  token.userId = options.userId;
  token.accessTokenHash = UserTokenMapper.hashToken(options.accessToken);
  token.refreshTokenHash = UserTokenMapper.hashToken(`refresh-${randomUUID()}`);
  token.accessTokenExpiresAt = options.accessTokenExpiresAt ?? new Date(Date.now() + 15 * 60 * 1000);
  token.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  token.revokedAt = options.revokedAt ?? null;
  token.createdAt = new Date();
  token.updatedAt = new Date();
  repository.tokens.push(token);

  return token;
};

describe('authenticated user routes', () => {
  it.each([
    ['missing authorization', undefined],
    ['malformed authorization', 'Token abc'],
  ])('rejects %s', async (_caseName, authorization) => {
    const repositories = buildFakeRepositories();
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: authorization ? { authorization } : undefined,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });

  it('rejects an expired access token', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id, '-1s');
    addTokenRow(repositories.userTokenRepository, { userId: user.id, accessToken });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_ACCESS_TOKEN');

    await app.close();
  });

  it('rejects a refresh token used as an access token', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const refreshToken = createRefreshToken(user.id);
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${refreshToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_ACCESS_TOKEN');

    await app.close();
  });

  it('rejects a valid JWT when the stored token row is missing', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id);
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_ACCESS_TOKEN');

    await app.close();
  });

  it('rejects a revoked token row', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id);
    addTokenRow(repositories.userTokenRepository, {
      userId: user.id,
      accessToken,
      revokedAt: new Date(),
    });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_ACCESS_TOKEN');

    await app.close();
  });

  it('returns a sanitized current user profile', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id);
    addTokenRow(repositories.userTokenRepository, { userId: user.id, accessToken });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        id: user.id,
        email: 'fan@example.com',
        displayName: 'Belong Fan',
        totalPoints: 325,
      },
    });
    expect(response.json().data).not.toHaveProperty('passwordHash');
    expect(response.json().data).not.toHaveProperty('createdAt');
    expect(response.json().data).not.toHaveProperty('updatedAt');

    await app.close();
  });

  it('updates displayName and returns a sanitized profile', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id);
    addTokenRow(repositories.userTokenRepository, { userId: user.id, accessToken });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        displayName: ' Updated Fan ',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        id: user.id,
        email: 'fan@example.com',
        displayName: 'Updated Fan',
        totalPoints: 325,
      },
    });
    expect(repositories.userRepository.users[0].displayName).toBe('Updated Fan');
    expect(response.json().data).not.toHaveProperty('passwordHash');
    expect(response.json().data).not.toHaveProperty('createdAt');
    expect(response.json().data).not.toHaveProperty('updatedAt');

    await app.close();
  });

  it.each([
    ['blank displayName', { displayName: '   ' }],
    ['email update', { displayName: 'Fan', email: 'new@example.com' }],
    ['password update', { displayName: 'Fan', password: 'newPassword123' }],
  ])('rejects invalid profile patch for %s', async (_caseName, payload) => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    const accessToken = createAccessToken(user.id);
    addTokenRow(repositories.userTokenRepository, { userId: user.id, accessToken });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'PATCH',
      url: '/api/users/me',
      headers: { authorization: `Bearer ${accessToken}` },
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

  it('returns current user stats', async () => {
    const user = buildUser();
    const repositories = buildFakeRepositories();
    repositories.userRepository.users.push(user);
    repositories.completionRepository.rows.push(
      { userId: user.id, pointsEarned: 100 } as ChallengeCompletion,
      { userId: user.id, pointsEarned: 50 } as ChallengeCompletion,
      { userId: randomUUID(), pointsEarned: 999 } as ChallengeCompletion,
    );
    repositories.redemptionRepository.rows.push(
      { userId: user.id, pointsSpent: 40 } as RewardRedemption,
      { userId: user.id, pointsSpent: 20 } as RewardRedemption,
    );
    const accessToken = createAccessToken(user.id);
    addTokenRow(repositories.userTokenRepository, { userId: user.id, accessToken });
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/stats',
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        totalPoints: 325,
        completionsCount: 2,
        redemptionsCount: 2,
        pointsEarned: 150,
        pointsSpent: 60,
      },
    });

    await app.close();
  });
});
