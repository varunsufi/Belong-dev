import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Challenge, ChallengeCompletion, ChallengeDifficulty, User } from '../entities';
import { ChallengeService } from './ChallengeService';

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

class FakeChallengeRepository {
  readonly challenges: Challenge[] = [];

  async findAndCount(options: {
    where: Partial<Challenge>;
    skip: number;
    take: number;
  }): Promise<[Challenge[], number]> {
    const filtered = this.challenges.filter((challenge) =>
      Object.entries(options.where).every(([key, value]) => challenge[key as keyof Challenge] === value),
    );

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: Partial<Challenge>): Promise<Challenge | null> {
    return this.challenges.find((challenge) =>
      Object.entries(where).every(([key, value]) => challenge[key as keyof Challenge] === value),
    ) ?? null;
  }
}

class FakeCompletionRepository {
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
}

interface FakeRepositories {
  userRepository: FakeUserRepository;
  challengeRepository: FakeChallengeRepository;
  completionRepository: FakeCompletionRepository;
  transactionIsolationLevels: string[];
}

class FakeEntityManager {
  constructor(private readonly repositories: FakeRepositories) {}

  getRepository(entity: unknown): unknown {
    return getRepository(entity, this.repositories);
  }
}

const getRepository = (entity: unknown, repositories: FakeRepositories): unknown => {
  if (entity === User) {
    return repositories.userRepository;
  }

  if (entity === Challenge) {
    return repositories.challengeRepository;
  }

  if (entity === ChallengeCompletion) {
    return repositories.completionRepository;
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
  challengeRepository: new FakeChallengeRepository(),
  completionRepository: new FakeCompletionRepository(),
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

describe('ChallengeService', () => {
  it('lists only active challenges and maps public fields', async () => {
    const repositories = buildRepositories();
    repositories.challengeRepository.challenges.push(
      buildChallenge({ title: 'Active Easy', difficulty: ChallengeDifficulty.Easy }),
      buildChallenge({ title: 'Inactive Easy', difficulty: ChallengeDifficulty.Easy, isActive: false }),
    );
    const service = new ChallengeService(buildDataSource(repositories));

    const result = await service.listChallenges({
      page: 1,
      limit: 20,
      difficulty: ChallengeDifficulty.Easy,
    });

    expect(result).toMatchObject({
      data: [expect.objectContaining({ title: 'Active Easy' })],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
    expect(result.data[0]).not.toHaveProperty('isActive');
    expect(result.data[0]).not.toHaveProperty('createdAt');
  });

  it('gets an active challenge or throws CHALLENGE_NOT_FOUND', async () => {
    const repositories = buildRepositories();
    const challenge = buildChallenge();
    repositories.challengeRepository.challenges.push(challenge);
    const service = new ChallengeService(buildDataSource(repositories));

    await expect(service.getChallengeById(challenge.id)).resolves.toMatchObject({ id: challenge.id });
    await expect(service.getChallengeById(randomUUID())).rejects.toMatchObject({
      code: 'CHALLENGE_NOT_FOUND',
    });
  });

  it('completes a challenge using READ COMMITTED and a pessimistic user lock', async () => {
    const repositories = buildRepositories();
    const user = buildUser({ totalPoints: 10 });
    const challenge = buildChallenge({ points: 151 });
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(challenge);
    const service = new ChallengeService(buildDataSource(repositories));

    const completion = await service.completeChallenge(user, challenge.id, {
      listenPercentage: 50,
    });

    expect(completion).toEqual({
      id: expect.any(String),
      challengeId: challenge.id,
      pointsEarned: 75,
      listenPercentage: 50,
      totalPoints: 85,
    });
    expect(user.totalPoints).toBe(85);
    expect(repositories.transactionIsolationLevels).toEqual(['READ COMMITTED']);
    expect(repositories.userRepository.locks).toContainEqual({ mode: 'pessimistic_write' });
  });

  it('awards full points at 80 percent listen', async () => {
    const repositories = buildRepositories();
    const user = buildUser();
    const challenge = buildChallenge({ points: 150 });
    repositories.userRepository.users.push(user);
    repositories.challengeRepository.challenges.push(challenge);
    const service = new ChallengeService(buildDataSource(repositories));

    await expect(
      service.completeChallenge(user, challenge.id, {
        listenPercentage: 80,
      }),
    ).resolves.toMatchObject({
      pointsEarned: 150,
      totalPoints: 150,
    });
  });
});
