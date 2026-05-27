import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { ChallengeCompletion, RewardRedemption, User } from '../entities';
import { UserService } from './UserService';

class FakeUserRepository {
  async save(user: User): Promise<User> {
    return user;
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
    const values = this.rows.filter((row) => row.userId === where.userId).map((row) => Number(row[this.sumColumn]));

    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  }
}

const buildDataSource = (
  userRepository: FakeUserRepository,
  completionRepository: FakeAggregateRepository<ChallengeCompletion>,
  redemptionRepository: FakeAggregateRepository<RewardRedemption>,
) =>
  ({
    getRepository: (entity: unknown) => {
      if (entity === User) {
        return userRepository;
      }

      if (entity === ChallengeCompletion) {
        return completionRepository;
      }

      if (entity === RewardRedemption) {
        return redemptionRepository;
      }

      throw new Error('Unexpected repository requested');
    },
  }) as unknown as DataSource;

const buildUser = (input: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: randomUUID(),
    email: 'fan@example.com',
    displayName: 'Belong Fan',
    passwordHash: 'hashed-password',
    totalPoints: 325,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  });

describe('UserService', () => {
  it('returns a sanitized profile', () => {
    const service = new UserService(
      buildDataSource(
        new FakeUserRepository(),
        new FakeAggregateRepository<ChallengeCompletion>('pointsEarned'),
        new FakeAggregateRepository<RewardRedemption>('pointsSpent'),
      ),
    );
    const user = buildUser();

    const profile = service.getProfile(user);

    expect(profile).toEqual({
      id: user.id,
      email: 'fan@example.com',
      displayName: 'Belong Fan',
      totalPoints: 325,
    });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('createdAt');
    expect(profile).not.toHaveProperty('updatedAt');
  });

  it('trims and updates displayName', async () => {
    const service = new UserService(
      buildDataSource(
        new FakeUserRepository(),
        new FakeAggregateRepository<ChallengeCompletion>('pointsEarned'),
        new FakeAggregateRepository<RewardRedemption>('pointsSpent'),
      ),
    );
    const user = buildUser();

    const profile = await service.updateProfile(user, {
      displayName: ' Updated Fan ',
    });

    expect(profile.displayName).toBe('Updated Fan');
    expect(user.displayName).toBe('Updated Fan');
  });

  it('returns completion and redemption stats', async () => {
    const completionRepository = new FakeAggregateRepository<ChallengeCompletion>('pointsEarned');
    const redemptionRepository = new FakeAggregateRepository<RewardRedemption>('pointsSpent');
    const user = buildUser();
    completionRepository.rows.push(
      { userId: user.id, pointsEarned: 100 } as ChallengeCompletion,
      { userId: user.id, pointsEarned: 50 } as ChallengeCompletion,
      { userId: randomUUID(), pointsEarned: 999 } as ChallengeCompletion,
    );
    redemptionRepository.rows.push(
      { userId: user.id, pointsSpent: 40 } as RewardRedemption,
      { userId: user.id, pointsSpent: 20 } as RewardRedemption,
    );
    const service = new UserService(buildDataSource(new FakeUserRepository(), completionRepository, redemptionRepository));

    await expect(service.getStats(user)).resolves.toEqual({
      totalPoints: 325,
      completionsCount: 2,
      redemptionsCount: 2,
      pointsEarned: 150,
      pointsSpent: 60,
    });
  });
});
