import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { User } from '../entities';
import { LeaderboardService } from './LeaderboardService';

class FakeUserRepository {
  readonly users: User[] = [];

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
}

const buildDataSource = (repository: FakeUserRepository) =>
  ({
    getRepository: (entity: unknown) => {
      if (entity === User) {
        return repository;
      }

      throw new Error('Unexpected repository requested');
    },
  }) as unknown as DataSource;

const buildUser = (input: Partial<User> = {}) =>
  Object.assign(new User(), {
    id: randomUUID(),
    email: `${randomUUID()}@example.com`,
    displayName: 'Belong Fan',
    passwordHash: 'hashed-password',
    totalPoints: 0,
    ...input,
  });

describe('LeaderboardService', () => {
  it('returns paginated dense-ranked top fans', async () => {
    const repository = new FakeUserRepository();
    const currentUser = buildUser({ displayName: 'Current Fan', totalPoints: 250 });
    repository.users.push(
      buildUser({ displayName: 'Top Fan', totalPoints: 500 }),
      buildUser({ displayName: 'Tied Fan', totalPoints: 500 }),
      currentUser,
      buildUser({ displayName: 'Lower Fan', totalPoints: 100 }),
    );
    const service = new LeaderboardService(buildDataSource(repository));

    const result = await service.getTopFans({ page: 1, limit: 10 });

    expect(result).toMatchObject({
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
  });

  it('returns the current user rank or fallback rank for a missing user', async () => {
    const repository = new FakeUserRepository();
    const currentUser = buildUser({ displayName: 'Current Fan', totalPoints: 250 });
    const missingUser = buildUser({ displayName: 'Missing Fan', totalPoints: 10 });
    repository.users.push(buildUser({ totalPoints: 500 }), currentUser);
    const service = new LeaderboardService(buildDataSource(repository));

    await expect(service.getUserRank(currentUser)).resolves.toMatchObject({
      rank: 2,
      userId: currentUser.id,
      totalPoints: 250,
    });
    await expect(service.getUserRank(missingUser)).resolves.toEqual({
      rank: 3,
      userId: missingUser.id,
      displayName: 'Missing Fan',
      totalPoints: 10,
    });
  });
});
