import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import { DataSource } from 'typeorm';
import { config } from '../../config';
import { Challenge, ChallengeDifficulty } from '../../entities';
import { errorHandler } from '../../errors/errorHandler';
import { registerRequestTrace, TRACE_ID_HEADER } from '../../plugins/requestTrace';
import adminRoutes from '.';

const adminApiKey = 'test-admin-api-key';

const buildTestApp = (repository: FakeChallengeRepository) => {
  config.admin.apiKey = adminApiKey;
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
      if (entity === Challenge) {
        return repository;
      }

      throw new Error('Unexpected repository requested');
    },
  } as unknown as DataSource);
  app.register(adminRoutes, { prefix: '/api/admin' });

  return app;
};

const authHeaders = () => ({
  'x-admin-api-key': adminApiKey,
});

const createPayload = () => ({
  title: 'All Night',
  artist: 'Camo & Krooked',
  description: 'Listen to this drum & bass classic to earn points',
  points: 150,
  durationSeconds: 219,
  difficulty: ChallengeDifficulty.Easy,
  isActive: true,
});

class FakeChallengeRepository {
  readonly challenges: Challenge[] = [];

  create(input: Partial<Challenge>): Challenge {
    return Object.assign(new Challenge(), input);
  }

  async save(challenge: Challenge): Promise<Challenge> {
    challenge.id = challenge.id ?? randomUUID();
    challenge.createdAt = challenge.createdAt ?? new Date();
    challenge.updatedAt = new Date();

    const index = this.challenges.findIndex((existingChallenge) => existingChallenge.id === challenge.id);

    if (index >= 0) {
      this.challenges[index] = challenge;
    } else {
      this.challenges.push(challenge);
    }

    return challenge;
  }

  async findAndCount(options: {
    where: Partial<Challenge>;
    skip: number;
    take: number;
  }): Promise<[Challenge[], number]> {
    const filtered = this.challenges.filter((challenge) => {
      return Object.entries(options.where).every(([key, value]) => {
        return challenge[key as keyof Challenge] === value;
      });
    });

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: { id: string }): Promise<Challenge | null> {
    return this.challenges.find((challenge) => challenge.id === where.id) ?? null;
  }
}

describe('admin challenge routes', () => {
  it('rejects missing or invalid admin API key', async () => {
    const app = buildTestApp(new FakeChallengeRepository());

    const missingKeyResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/challenges',
      payload: createPayload(),
    });
    const invalidKeyResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/challenges',
      headers: {
        'x-admin-api-key': 'wrong-key',
      },
      payload: createPayload(),
    });

    expect(missingKeyResponse.statusCode).toBe(403);
    expect(missingKeyResponse.json()).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        traceId: expect.any(String),
      },
    });
    expect(invalidKeyResponse.statusCode).toBe(403);

    await app.close();
  });

  it('creates a challenge', async () => {
    const repository = new FakeChallengeRepository();
    const app = buildTestApp(repository);

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/challenges',
      headers: authHeaders(),
      payload: createPayload(),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject(createPayload());
    expect(response.json().data.id).toEqual(expect.any(String));
    expect(repository.challenges).toHaveLength(1);

    await app.close();
  });

  it.each([
    ['required fields', { title: 'All Night' }],
    ['extra fields', { ...createPayload(), unexpected: true }],
  ])('validates create request %s', async (_caseName, payload) => {
    const app = buildTestApp(new FakeChallengeRepository());

    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/challenges',
      headers: authHeaders(),
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

  it('lists paginated challenges', async () => {
    const repository = new FakeChallengeRepository();
    await repository.save(repository.create(createPayload()));
    await repository.save(repository.create({
      ...createPayload(),
      title: 'New Forms',
      difficulty: ChallengeDifficulty.Medium
    }));
    const app = buildTestApp(repository);

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/challenges?page=1&limit=1&difficulty=easy&isActive=true',
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [expect.objectContaining({ title: 'All Night' })],
      meta: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });

    await app.close();
  });

  it('gets challenge by ID or returns 404', async () => {
    const repository = new FakeChallengeRepository();
    const challenge = await repository.save(repository.create(createPayload()));
    const app = buildTestApp(repository);

    const foundResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/challenges/${challenge.id}`,
      headers: authHeaders(),
    });
    const missingResponse = await app.inject({
      method: 'GET',
      url: `/api/admin/challenges/${randomUUID()}`,
      headers: authHeaders(),
    });

    expect(foundResponse.statusCode).toBe(200);
    expect(foundResponse.json().data).toMatchObject({ id: challenge.id });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toEqual({
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found',
        traceId: expect.any(String),
      },
    });

    await app.close();
  });

  it('patches title, description, points, and isActive', async () => {
    const repository = new FakeChallengeRepository();
    const challenge = await repository.save(repository.create(createPayload()));
    const app = buildTestApp(repository);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/challenges/${challenge.id}`,
      headers: authHeaders(),
      payload: {
        title: 'Updated title',
        description: 'Updated description',
        points: 200,
        isActive: false,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      title: 'Updated title',
      description: 'Updated description',
      points: 200,
      isActive: false,
      artist: 'Camo & Krooked',
      durationSeconds: 219,
      difficulty: ChallengeDifficulty.Easy,
    });

    await app.close();
  });

  it.each([
    ['artist', { artist: 'New Artist' }],
    ['durationSeconds', { durationSeconds: 300 }],
    ['difficulty', { difficulty: ChallengeDifficulty.Hard }],
    ['empty body', {}],
  ])('rejects invalid patch field %s', async (_caseName, payload) => {
    const repository = new FakeChallengeRepository();
    const challenge = await repository.save(repository.create(createPayload()));
    const app = buildTestApp(repository);

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/admin/challenges/${challenge.id}`,
      headers: authHeaders(),
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

  it('deactivates challenge on delete', async () => {
    const repository = new FakeChallengeRepository();
    const challenge = await repository.save(repository.create(createPayload()));
    const app = buildTestApp(repository);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/admin/challenges/${challenge.id}`,
      headers: authHeaders(),
    });

    expect(response.statusCode).toBe(204);
    expect(challenge.isActive).toBe(false);

    await app.close();
  });
});
