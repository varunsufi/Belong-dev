import { randomUUID } from 'crypto';
import { RewardRedemption, RewardRedemptionStatus } from '../../entities';
import { authHeaders, buildFakeRepositories, buildReward, buildTestApp, buildUser } from './testUtil';

describe('authenticated reward routes', () => {
  it('lists only available rewards with pagination', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser();
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(
      buildReward({ name: 'Early Access Pass', pointsCost: 200 }),
      buildReward({ name: 'VIP Fan Badge', pointsCost: 1000, isAvailable: false }),
    );
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/rewards?page=1&limit=20',
      headers: authHeaders(repositories, user),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [expect.objectContaining({ name: 'Early Access Pass', pointsCost: 200 })],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(response.json().data[0]).not.toHaveProperty('isAvailable');

    await app.close();
  });

  it('redeems a reward using READ COMMITTED and a pessimistic user lock', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser({ totalPoints: 500 });
    const reward = buildReward({ pointsCost: 200 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(reward);
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'POST',
      url: `/api/rewards/${reward.id}/redeem`,
      headers: authHeaders(repositories, user),
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      data: {
        id: expect.any(String),
        rewardId: reward.id,
        pointsSpent: 200,
        status: RewardRedemptionStatus.Pending,
        totalPoints: 300,
      },
    });
    expect(user.totalPoints).toBe(300);
    expect(repositories.redemptionRepository.redemptions).toHaveLength(1);
    expect(repositories.transactionIsolationLevels).toEqual(['READ COMMITTED']);
    expect(repositories.userRepository.locks).toContainEqual({ mode: 'pessimistic_write' });

    await app.close();
  });

  it('prevents two simulated same-user redemptions from spending the same starting balance', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser({ totalPoints: 300 });
    const firstReward = buildReward({ pointsCost: 200 });
    const secondReward = buildReward({ pointsCost: 200 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(firstReward, secondReward);
    const app = buildTestApp(repositories);
    const headers = authHeaders(repositories, user);

    const firstResponse = await app.inject({
      method: 'POST',
      url: `/api/rewards/${firstReward.id}/redeem`,
      headers,
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: `/api/rewards/${secondReward.id}/redeem`,
      headers,
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(422);
    expect(secondResponse.json().error.code).toBe('INSUFFICIENT_POINTS');
    expect(user.totalPoints).toBe(100);
    expect(repositories.redemptionRepository.redemptions).toHaveLength(1);

    await app.close();
  });

  it('rejects missing, unavailable, and unaffordable reward redemptions', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser({ totalPoints: 50 });
    const unavailableReward = buildReward({ isAvailable: false, pointsCost: 25 });
    const expensiveReward = buildReward({ isAvailable: true, pointsCost: 100 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(unavailableReward, expensiveReward);
    const app = buildTestApp(repositories);
    const headers = authHeaders(repositories, user);

    const unavailableResponse = await app.inject({
      method: 'POST',
      url: `/api/rewards/${unavailableReward.id}/redeem`,
      headers,
    });
    const missingResponse = await app.inject({
      method: 'POST',
      url: `/api/rewards/${randomUUID()}/redeem`,
      headers,
    });
    const insufficientResponse = await app.inject({
      method: 'POST',
      url: `/api/rewards/${expensiveReward.id}/redeem`,
      headers,
    });

    expect(unavailableResponse.statusCode).toBe(404);
    expect(unavailableResponse.json().error.code).toBe('REWARD_NOT_FOUND');
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json().error.code).toBe('REWARD_NOT_FOUND');
    expect(insufficientResponse.statusCode).toBe(422);
    expect(insufficientResponse.json().error.code).toBe('INSUFFICIENT_POINTS');

    await app.close();
  });

  it('returns current user redemption history newest first', async () => {
    const repositories = buildFakeRepositories();
    const user = buildUser();
    const otherUser = buildUser();
    const reward = buildReward();
    repositories.userRepository.users.push(user, otherUser);
    repositories.rewardRepository.rewards.push(reward);
    repositories.redemptionRepository.redemptions.push(
      Object.assign(new RewardRedemption(), {
        id: randomUUID(),
        userId: user.id,
        rewardId: reward.id,
        pointsSpent: 100,
        status: RewardRedemptionStatus.Pending,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      Object.assign(new RewardRedemption(), {
        id: randomUUID(),
        userId: user.id,
        rewardId: reward.id,
        pointsSpent: 200,
        status: RewardRedemptionStatus.Fulfilled,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
      Object.assign(new RewardRedemption(), {
        id: randomUUID(),
        userId: otherUser.id,
        rewardId: reward.id,
        pointsSpent: 999,
        status: RewardRedemptionStatus.Pending,
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      }),
    );
    const app = buildTestApp(repositories);

    const response = await app.inject({
      method: 'GET',
      url: '/api/rewards/history?page=1&limit=10',
      headers: authHeaders(repositories, user),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        expect.objectContaining({ pointsSpent: 200 }),
        expect.objectContaining({ pointsSpent: 100 }),
      ],
      meta: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    });

    await app.close();
  });
});
