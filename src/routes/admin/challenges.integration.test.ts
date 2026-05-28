import { randomUUID } from 'crypto';
import { ChallengeDifficulty } from '../../entities';
import {
  adminHeaders,
  createChallengePayload,
  IntegrationTestApp,
  setupIntegrationTestApp,
} from '../../test/integrationTestUtils';

describe('admin challenge routes integration', () => {
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

  it('rejects missing or invalid admin API key', async () => {
    const missingKeyResponse = await testApp.request
      .post('/api/admin/challenges')
      .send(createChallengePayload());
    const invalidKeyResponse = await testApp.request
      .post('/api/admin/challenges')
      .set('x-admin-api-key', 'wrong-key')
      .send(createChallengePayload());

    expect(missingKeyResponse.status).toBe(403);
    expect(missingKeyResponse.body).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        traceId: expect.any(String),
      },
    });
    expect(invalidKeyResponse.status).toBe(403);
  });

  it('creates a persisted challenge', async () => {
    const response = await testApp.request
      .post('/api/admin/challenges')
      .set(adminHeaders())
      .send(createChallengePayload());

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject(createChallengePayload());
    expect(response.body.data.id).toEqual(expect.any(String));
    expect(response.body.data.createdAt).toEqual(expect.any(String));
    expect(response.body.data.updatedAt).toEqual(expect.any(String));

    const savedChallenges = await testApp.db.query('SELECT title, artist FROM challenges');
    expect(savedChallenges).toEqual([
      {
        title: 'All Night',
        artist: 'Camo & Krooked',
      },
    ]);
  });

  it.each([
    ['required fields', { title: 'All Night' }],
    ['extra fields', { ...createChallengePayload(), unexpected: true }],
  ])('validates create request %s', async (_caseName, payload) => {
    const response = await testApp.request
      .post('/api/admin/challenges')
      .set(adminHeaders())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });
  });

  it('lists paginated challenges with filters', async () => {
    await createChallenge();
    await createChallenge({
      title: 'New Forms',
      difficulty: ChallengeDifficulty.Medium,
    });

    const response = await testApp.request
      .get('/api/admin/challenges?page=1&limit=1&difficulty=easy&isActive=true')
      .set(adminHeaders());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [expect.objectContaining({ title: 'All Night', difficulty: ChallengeDifficulty.Easy })],
      meta: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('gets challenge by id or returns 404 for a missing challenge', async () => {
    const challenge = await createChallenge();

    const foundResponse = await testApp.request
      .get(`/api/admin/challenges/${challenge.id}`)
      .set(adminHeaders());
    const missingResponse = await testApp.request
      .get(`/api/admin/challenges/${randomUUID()}`)
      .set(adminHeaders());

    expect(foundResponse.status).toBe(200);
    expect(foundResponse.body.data).toMatchObject({
      id: challenge.id,
      title: 'All Night',
    });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual({
      error: {
        code: 'CHALLENGE_NOT_FOUND',
        message: 'Challenge not found',
        traceId: expect.any(String),
      },
    });
  });

  it('patches allowed challenge fields', async () => {
    const challenge = await createChallenge();

    const response = await testApp.request
      .patch(`/api/admin/challenges/${challenge.id}`)
      .set(adminHeaders())
      .send({
        title: 'Updated title',
        description: 'Updated description',
        points: 200,
        isActive: false,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: challenge.id,
      title: 'Updated title',
      description: 'Updated description',
      points: 200,
      isActive: false,
      artist: 'Camo & Krooked',
      durationSeconds: 219,
      difficulty: ChallengeDifficulty.Easy,
    });
  });

  it.each([
    ['artist', { artist: 'New Artist' }],
    ['durationSeconds', { durationSeconds: 300 }],
    ['difficulty', { difficulty: ChallengeDifficulty.Hard }],
    ['empty body', {}],
  ])('rejects invalid patch field %s', async (_caseName, payload) => {
    const challenge = await createChallenge();

    const response = await testApp.request
      .patch(`/api/admin/challenges/${challenge.id}`)
      .set(adminHeaders())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: expect.any(String),
      },
    });
  });

  it('soft-deactivates challenge on delete', async () => {
    const challenge = await createChallenge();

    const deleteResponse = await testApp.request
      .delete(`/api/admin/challenges/${challenge.id}`)
      .set(adminHeaders());

    expect(deleteResponse.status).toBe(204);

    const getResponse = await testApp.request
      .get(`/api/admin/challenges/${challenge.id}`)
      .set(adminHeaders());

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data).toMatchObject({
      id: challenge.id,
      isActive: false,
    });
  });

  const createChallenge = async (overrides = {}) => {
    const response = await testApp.request
      .post('/api/admin/challenges')
      .set(adminHeaders())
      .send({
        ...createChallengePayload(),
        ...overrides,
      });

    expect(response.status).toBe(201);
    return response.body.data;
  };
});
