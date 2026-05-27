import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { config } from '../../config';
import {
  Challenge,
  ChallengeCompletion,
  ChallengeDifficulty,
  Reward,
  RewardRedemption,
  User,
  UserTokenEntity,
} from '../../entities';
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
  app.decorate('db', buildDataSource(repositories));
  app.register(authenticatedRoutes, { prefix: '/api' });

  return app;
};

const buildDataSource = (repositories: FakeRepositories) =>
  ({
    getRepository: (entity: unknown) => getRepository(entity, repositories),
    transaction: async (isolationLevel: string, runInTransaction: (manager: FakeEntityManager) => Promise<unknown>) => {
      repositories.transactionIsolationLevels.push(isolationLevel);
      return runInTransaction(new FakeEntityManager(repositories));
    },
  }) as unknown as DataSource;

const getRepository = (entity: unknown, repositories: FakeRepositories): unknown => {
  if (entity === User) {
    return repositories.userRepository;
  }

  if (entity === UserTokenEntity) {
    return repositories.userTokenRepository;
  }

  if (entity === Challenge) {
    return repositories.challengeRepository;
  }

  if (entity === ChallengeCompletion) {
    return repositories.completionRepository;
  }

  if (entity === Reward) {
    return repositories.rewardRepository;
  }

  if (entity === RewardRedemption) {
    return repositories.redemptionRepository;
  }

  throw new Error('Unexpected repository requested');
};

class FakeEntityManager {
  constructor(private readonly repositories: FakeRepositories) {
  }

  getRepository(entity: unknown): unknown {
    return getRepository(entity, this.repositories);
  }
}

class FakeUserRepository {
  readonly users: User[] = [];
  readonly locks: unknown[] = [];

  async findOneBy(where: { id?: string }): Promise<User | null> {
    if (where.id) {
      return this.users.find((user) => user.id === where.id) ?? null;
    }

    return null;
  }

  async findOne(options: { where: { id: string }; lock?: unknown }): Promise<User | null> {
    if (options.lock) {
      this.locks.push(options.lock);
    }

    return this.findOneBy(options.where);
  }

  async find(): Promise<User[]> {
    return [...this.users].sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      return `${left.displayName ?? ''}${left.email}${left.id}`.localeCompare(
        `${right.displayName ?? ''}${right.email}${right.id}`,
      );
    });
  }

  async save(user: User): Promise<User> {
    const index = this.users.findIndex((existingUser) => existingUser.id === user.id);

    if (index >= 0) {
      this.users[index] = user;
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

class FakeChallengeRepository {
  readonly challenges: Challenge[] = [];

  async findAndCount(options: {
    where: Partial<Challenge>;
    skip: number;
    take: number;
  }): Promise<[Challenge[], number]> {
    const filtered = this.challenges.filter((challenge) => matchesWhere(challenge, options.where));

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: Partial<Challenge>): Promise<Challenge | null> {
    return this.challenges.find((challenge) => matchesWhere(challenge, where)) ?? null;
  }
}

class FakeChallengeCompletionRepository {
  readonly completions: ChallengeCompletion[] = [];

  create(input: Partial<ChallengeCompletion>): ChallengeCompletion {
    return Object.assign(new ChallengeCompletion(), input);
  }

  async save(completion: ChallengeCompletion): Promise<ChallengeCompletion> {
    completion.id = completion.id ?? randomUUID();
    completion.createdAt = completion.createdAt ?? new Date();
    this.completions.push(completion);
    return completion;
  }

  async countBy(where: { userId: string }): Promise<number> {
    return this.completions.filter((completion) => completion.userId === where.userId).length;
  }

  async sum(_column: string, where: { userId: string }): Promise<number | null> {
    const values = this.completions
      .filter((completion) => completion.userId === where.userId)
      .map((completion) => completion.pointsEarned);

    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  }
}

class FakeRewardRepository {
  readonly rewards: Reward[] = [];

  async findAndCount(options: { where: Partial<Reward>; skip: number; take: number }): Promise<[Reward[], number]> {
    const filtered = this.rewards
      .filter((reward) => matchesWhere(reward, options.where))
      .sort((left, right) => left.pointsCost - right.pointsCost || left.name.localeCompare(right.name));

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: Partial<Reward>): Promise<Reward | null> {
    return this.rewards.find((reward) => matchesWhere(reward, where)) ?? null;
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
      .filter((redemption) => matchesWhere(redemption, options.where))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async countBy(where: { userId: string }): Promise<number> {
    return this.redemptions.filter((redemption) => redemption.userId === where.userId).length;
  }

  async sum(_column: string, where: { userId: string }): Promise<number | null> {
    const values = this.redemptions
      .filter((redemption) => redemption.userId === where.userId)
      .map((redemption) => redemption.pointsSpent);

    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  }
}

interface FakeRepositories {
  userRepository: FakeUserRepository;
  userTokenRepository: FakeUserTokenRepository;
  challengeRepository: FakeChallengeRepository;
  completionRepository: FakeChallengeCompletionRepository;
  rewardRepository: FakeRewardRepository;
  redemptionRepository: FakeRewardRedemptionRepository;
  transactionIsolationLevels: string[];
}

const matchesWhere = <T extends object>(record: T, where: Partial<T>): boolean =>
  Object.entries(where).every(([key, value]) => record[key as keyof T] === value);

const buildFakeRepositories = (): FakeRepositories => ({
  userRepository: new FakeUserRepository(),
  userTokenRepository: new FakeUserTokenRepository(),
  challengeRepository: new FakeChallengeRepository(),
  completionRepository: new FakeChallengeCompletionRepository(),
  rewardRepository: new FakeRewardRepository(),
  redemptionRepository: new FakeRewardRedemptionRepository(),
  transactionIsolationLevels: [],
});

const buildUser = (input: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    displayName: 'Belong Fan',
    passwordHash: 'hashed-password',
    totalPoints: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  });

const buildChallenge = (input: Partial<Challenge> = {}) =>
  Object.assign(new Challenge(), {
    id: randomUUID(),
    title: 'All Night',
    artist: 'Camo & Krooked',
    description: 'Listen to this drum & bass classic to earn points',
    points: 150,
    durationSeconds: 219,
    difficulty: ChallengeDifficulty.Easy,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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

const createAccessToken = (userId: string) =>
  jwt.sign({ sub: userId, type: 'access', jti: randomUUID() }, config.jwt.accessSecret, {
    expiresIn: '15m' as SignOptions['expiresIn'],
  });

const addTokenRow = (repository: FakeUserTokenRepository, userId: string, accessToken: string) => {
  const token = new UserTokenEntity();
  token.id = randomUUID();
  token.userId = userId;
  token.accessTokenHash = UserTokenMapper.hashToken(accessToken);
  token.refreshTokenHash = UserTokenMapper.hashToken(`refresh-${randomUUID()}`);
  token.accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  token.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  token.revokedAt = null;
  token.createdAt = new Date();
  token.updatedAt = new Date();
  repository.tokens.push(token);
};

const authHeaders = (repositories: FakeRepositories, user: User) => {
  const accessToken = createAccessToken(user.id);
  addTokenRow(repositories.userTokenRepository, user.id, accessToken);

  return {
    authorization: `Bearer ${accessToken}`,
  };
};

export {
  authHeaders,
  buildChallenge,
  buildFakeRepositories,
  buildReward,
  buildTestApp,
  buildUser,
  FakeRepositories,
};
