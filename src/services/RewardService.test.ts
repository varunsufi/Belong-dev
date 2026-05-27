import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Reward, RewardRedemption, RewardRedemptionStatus, User } from '../entities';
import { RewardService } from './RewardService';

class FakeUserRepository {
  readonly users: User[] = [];
  readonly locks: unknown[] = [];

  async findOne(options: { where: { id: string }; lock?: unknown }): Promise<User | null> {
    if (options.lock) {
      this.locks.push(options.lock);
    }

    return this.users.find((user) => user.id === options.where.id) ?? null;
  }

  async save(user: User): Promise<User> {
    return user;
  }
}

class FakeRewardRepository {
  readonly rewards: Reward[] = [];

  async findAndCount(options: { where: Partial<Reward>; skip: number; take: number }): Promise<[Reward[], number]> {
    const filtered = this.rewards
      .filter((reward) => Object.entries(options.where).every(([key, value]) => reward[key as keyof Reward] === value))
      .sort((left, right) => left.pointsCost - right.pointsCost || left.name.localeCompare(right.name));

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: Partial<Reward>): Promise<Reward | null> {
    return this.rewards.find((reward) =>
      Object.entries(where).every(([key, value]) => reward[key as keyof Reward] === value),
    ) ?? null;
  }
}

class FakeRewardRedemptionRepository {
  readonly redemptions: RewardRedemption[] = [];

  create(input: Partial<RewardRedemption>): RewardRedemption {
    return Object.assign(new RewardRedemption(), input);
  }

  async save(redemption: RewardRedemption): Promise<RewardRedemption> {
    redemption.id = redemption.id ?? randomUUID();
    redemption.createdAt = redemption.createdAt ?? new Date();
    this.redemptions.push(redemption);
    return redemption;
  }

  async findAndCount(options: {
    where: Partial<RewardRedemption>;
    skip: number;
    take: number;
  }): Promise<[RewardRedemption[], number]> {
    const filtered = this.redemptions
      .filter((redemption) =>
        Object.entries(options.where).every(([key, value]) => redemption[key as keyof RewardRedemption] === value),
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }
}

interface FakeRepositories {
  userRepository: FakeUserRepository;
  rewardRepository: FakeRewardRepository;
  redemptionRepository: FakeRewardRedemptionRepository;
  transactionIsolationLevels: string[];
}

class FakeEntityManager {
  constructor(private readonly repositories: FakeRepositories) {
  }

  getRepository(entity: unknown): unknown {
    return getRepository(entity, this.repositories);
  }
}

const getRepository = (entity: unknown, repositories: FakeRepositories): unknown => {
  if (entity === User) {
    return repositories.userRepository;
  }

  if (entity === Reward) {
    return repositories.rewardRepository;
  }

  if (entity === RewardRedemption) {
    return repositories.redemptionRepository;
  }

  throw new Error('Unexpected repository requested');
};

const buildDataSource = (repositories: FakeRepositories) =>
  ({
    getRepository: (entity: unknown) => getRepository(entity, repositories),
    transaction: async (isolationLevel: string, runInTransaction: (manager: FakeEntityManager) => Promise<unknown>) => {
      repositories.transactionIsolationLevels.push(isolationLevel);
      return runInTransaction(new FakeEntityManager(repositories));
    },
  }) as unknown as DataSource;

const buildRepositories = (): FakeRepositories => ({
  userRepository: new FakeUserRepository(),
  rewardRepository: new FakeRewardRepository(),
  redemptionRepository: new FakeRewardRedemptionRepository(),
  transactionIsolationLevels: [],
});

const buildUser = (input: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: randomUUID(),
    email: 'fan@example.com',
    displayName: 'Belong Fan',
    passwordHash: 'hashed-password',
    totalPoints: 0,
    ...input,
  });

const buildReward = (input: Partial<Reward> = {}) =>
  Object.assign(new Reward(), {
    id: randomUUID(),
    name: 'Early Access Pass',
    description: 'Get early access to new features',
    pointsCost: 200,
    isAvailable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  });

const buildRedemption = (input: Partial<RewardRedemption> = {}) =>
  Object.assign(new RewardRedemption(), {
    id: randomUUID(),
    userId: randomUUID(),
    rewardId: randomUUID(),
    pointsSpent: 200,
    status: RewardRedemptionStatus.Pending,
    createdAt: new Date(),
    ...input,
  });

describe('RewardService', () => {
  it('lists only available rewards with pagination', async () => {
    const repositories = buildRepositories();
    repositories.rewardRepository.rewards.push(
      buildReward({ name: 'Early Access Pass', pointsCost: 200 }),
      buildReward({ name: 'VIP Fan Badge', pointsCost: 1000, isAvailable: false }),
    );
    const service = new RewardService(buildDataSource(repositories));

    const result = await service.listAvailableRewards({ page: 1, limit: 20 });

    expect(result).toMatchObject({
      data: [expect.objectContaining({ name: 'Early Access Pass', pointsCost: 200 })],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(result.data[0]).not.toHaveProperty('isAvailable');
  });

  it('redeems a reward using READ COMMITTED and a pessimistic user lock', async () => {
    const repositories = buildRepositories();
    const user = buildUser({ totalPoints: 500 });
    const reward = buildReward({ pointsCost: 200 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(reward);
    const service = new RewardService(buildDataSource(repositories));

    const redemption = await service.redeemReward(user, reward.id);

    expect(redemption).toEqual({
      id: expect.any(String),
      rewardId: reward.id,
      pointsSpent: 200,
      status: RewardRedemptionStatus.Pending,
      totalPoints: 300,
    });
    expect(user.totalPoints).toBe(300);
    expect(repositories.redemptionRepository.redemptions).toHaveLength(1);
    expect(repositories.transactionIsolationLevels).toEqual(['READ COMMITTED']);
    expect(repositories.userRepository.locks).toContainEqual({ mode: 'pessimistic_write' });
  });

  it('rejects missing rewards and insufficient points', async () => {
    const repositories = buildRepositories();
    const user = buildUser({ totalPoints: 50 });
    const expensiveReward = buildReward({ pointsCost: 100 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(expensiveReward);
    const service = new RewardService(buildDataSource(repositories));

    await expect(service.redeemReward(user, randomUUID())).rejects.toMatchObject({
      code: 'REWARD_NOT_FOUND',
    });
    await expect(service.redeemReward(user, expensiveReward.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_POINTS',
    });
  });

  it('prevents two stale same-user redemptions from spending the same starting balance', async () => {
    const repositories = buildRepositories();
    const user = buildUser({ totalPoints: 300 });
    const firstReward = buildReward({ pointsCost: 200 });
    const secondReward = buildReward({ pointsCost: 200 });
    repositories.userRepository.users.push(user);
    repositories.rewardRepository.rewards.push(firstReward, secondReward);
    const service = new RewardService(buildDataSource(repositories));

    await expect(service.redeemReward(user, firstReward.id)).resolves.toMatchObject({
      totalPoints: 100,
    });
    await expect(service.redeemReward(user, secondReward.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_POINTS',
    });
    expect(user.totalPoints).toBe(100);
    expect(repositories.redemptionRepository.redemptions).toHaveLength(1);
  });

  it('returns redemption history for the current user newest first', async () => {
    const repositories = buildRepositories();
    const user = buildUser();
    repositories.redemptionRepository.redemptions.push(
      buildRedemption({ userId: user.id, pointsSpent: 100, createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      buildRedemption({ userId: user.id, pointsSpent: 200, createdAt: new Date('2026-01-02T00:00:00.000Z') }),
      buildRedemption({ userId: randomUUID(), pointsSpent: 999, createdAt: new Date('2026-01-03T00:00:00.000Z') }),
    );
    const service = new RewardService(buildDataSource(repositories));

    const result = await service.getRedemptionHistory(user, { page: 1, limit: 20 });

    expect(result).toMatchObject({
      data: [expect.objectContaining({ pointsSpent: 200 }), expect.objectContaining({ pointsSpent: 100 })],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      },
    });
  });
});
