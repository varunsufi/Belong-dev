import { ChallengeDifficulty } from '../../entities';
import { authHeaders, buildChallenge, buildFakeRepositories, buildTestApp, buildUser } from './testUtil';

describe('authenticated challenge routes', () => {
  it('rejects missing authorization', async () => {
    const app = buildTestApp(buildFakeRepositories());

    const response = await app.inject({
      method: 'GET',
      url: '/api/challenges',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('INVALID_ACCESS_TOKEN');

    await app.close();
  });

  it('lists active challenges with pagination and difficulty filtering', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser();
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(
      buildChallenge({ title: 'All Night', difficulty: ChallengeDifficulty.Easy }),
      buildChallenge({ title: 'New Forms', difficulty: ChallengeDifficulty.Medium }),
      buildChallenge({ title: 'Inactive Easy', difficulty: ChallengeDifficulty.Easy, isActive: false }),
    );
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/challenges?page=1&limit=10&difficulty=easy',
      headers: authHeaders(repositories, user),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [expect.objectContaining({ title: 'All Night', difficulty: ChallengeDifficulty.Easy })],
      meta: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(response.json().data[0]).not.toHaveProperty('isActive');
    expect(response.json().data[0]).not.toHaveProperty('createdAt');

    await app.close();
  });

  it('returns challenge detail only for active challenges', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser();
    const activeChallenge = buildChallenge();
    const inactiveChallenge = buildChallenge({ isActive: false });
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(activeChallenge, inactiveChallenge);
    const app = buildTestApp(repositories);
    const headers = authHeaders(repositories, user);

    const foundResponse = await app.inject({
      method: 'GET',
      url: `/api/challenges/${activeChallenge.id}`,
      headers,
    });
    const inactiveResponse = await app.inject({
      method: 'GET',
      url: `/api/challenges/${inactiveChallenge.id}`,
      headers,
    });

    expect(foundResponse.statusCode).toBe(200);
    expect(foundResponse.json().data).toMatchObject({ id: activeChallenge.id });
    expect(inactiveResponse.statusCode).toBe(404);
    expect(inactiveResponse.json().error.code).toBe('CHALLENGE_NOT_FOUND');

    await app.close();
  });

  it('completes a challenge, floors partial points, and updates total points', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser({ totalPoints: 10 });
    const challenge = buildChallenge({ points: 151 });
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(challenge);
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'POST',
      url: `/api/challenges/${challenge.id}/complete`,
      headers: authHeaders(repositories, user),
      payload: {
        listenPercentage: 50,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      data: {
        id: expect.any(String),
        challengeId: challenge.id,
        pointsEarned: 75,
        listenPercentage: 50,
        totalPoints: 85,
      },
    });
    expect(user.totalPoints).toBe(85);
    expect(repositories.transactionIsolationLevels).toContain('READ COMMITTED');

    await app.close();
  });

  it('awards full challenge points at 80 percent listen', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser({ totalPoints: 0 });
    const challenge = buildChallenge({ points: 150 });
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(challenge);
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'POST',
      url: `/api/challenges/${challenge.id}/complete`,
      headers: authHeaders(repositories, user),
      payload: {
        listenPercentage: 80,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.pointsEarned).toBe(150);
    expect(user.totalPoints).toBe(150);

    await app.close();
  });
});
