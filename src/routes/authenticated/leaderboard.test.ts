import { authHeaders, buildFakeRepositories, buildTestApp, buildUser } from './testUtil';

describe('authenticated leaderboard routes', () => {
  it('returns dense-ranked leaderboard pages and current user rank', async () => {
    const repositories = buildFakeRepositories();
    const currentUser = buildUser({ displayName: 'Current Fan', totalPoints: 250 });
    const topUser = buildUser({ displayName: 'Top Fan', totalPoints: 500 });
    const tiedUser = buildUser({ displayName: 'Tied Fan', totalPoints: 500 });
    const lowerUser = buildUser({ displayName: 'Lower Fan', totalPoints: 100 });
    repositories.userRepository.users.push(currentUser, topUser, tiedUser, lowerUser);
    const app = buildTestApp(repositories);
    const headers = authHeaders(repositories, currentUser);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/leaderboard?page=1&limit=10',
      headers,
    });
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/leaderboard/me',
      headers,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      data: [
        expect.objectContaining({ rank: 1, totalPoints: 500 }),
        expect.objectContaining({ rank: 1, totalPoints: 500 }),
        expect.objectContaining({ rank: 2, userId: currentUser.id, totalPoints: 250 }),
        expect.objectContaining({ rank: 3, totalPoints: 100 }),
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 4,
        totalPages: 1,
      },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({
      data: {
        rank: 2,
        userId: currentUser.id,
        displayName: 'Current Fan',
        totalPoints: 250,
      },
    });

    await app.close();
  });
});
