import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Challenge, ChallengeDifficulty } from '../entities';
import { ChallengeAdminService } from './ChallengeAdminService';

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
    const filtered = this.challenges.filter((challenge) =>
      Object.entries(options.where).every(([key, value]) => challenge[key as keyof Challenge] === value),
    );

    return [filtered.slice(options.skip, options.skip + options.take), filtered.length];
  }

  async findOneBy(where: { id: string }): Promise<Challenge | null> {
    return this.challenges.find((challenge) => challenge.id === where.id) ?? null;
  }
}

const buildDataSource = (repository: FakeChallengeRepository) =>
  ({
    getRepository: (entity: unknown) => {
      if (entity === Challenge) {
        return repository;
      }

      throw new Error('Unexpected repository requested');
    },
  }) as unknown as DataSource;

const createInput = () => ({
  title: 'All Night',
  artist: 'Camo & Krooked',
  description: 'Listen to this drum & bass classic to earn points',
  points: 150,
  durationSeconds: 219,
  difficulty: ChallengeDifficulty.Easy,
});

describe('ChallengeAdminService', () => {
  it('creates challenges with isActive defaulting to true', async () => {
    const repository = new FakeChallengeRepository();
    const service = new ChallengeAdminService(buildDataSource(repository));

    const challenge = await service.createChallenge(createInput());

    expect(challenge).toMatchObject({
      ...createInput(),
      isActive: true,
    });
    expect(repository.challenges).toHaveLength(1);
  });

  it('lists challenges with filters and pagination', async () => {
    const repository = new FakeChallengeRepository();
    await repository.save(repository.create(createInput()));
    await repository.save(repository.create({ ...createInput(), difficulty: ChallengeDifficulty.Medium }));
    const service = new ChallengeAdminService(buildDataSource(repository));

    const result = await service.listChallenges({
      page: 1,
      limit: 1,
      difficulty: ChallengeDifficulty.Easy,
    });

    expect(result).toMatchObject({
      data: [expect.objectContaining({ difficulty: ChallengeDifficulty.Easy })],
      meta: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it('updates and deactivates an existing challenge', async () => {
    const repository = new FakeChallengeRepository();
    const challenge = await repository.save(repository.create(createInput()));
    const service = new ChallengeAdminService(buildDataSource(repository));

    const updatedChallenge = await service.updateChallenge(challenge.id, {
      title: 'Updated title',
      points: 200,
    });
    await service.deleteChallenge(challenge.id);

    expect(updatedChallenge).toMatchObject({
      title: 'Updated title',
      points: 200,
    });
    expect(repository.challenges[0].isActive).toBe(false);
  });

  it('throws CHALLENGE_NOT_FOUND for a missing challenge', async () => {
    const service = new ChallengeAdminService(buildDataSource(new FakeChallengeRepository()));

    await expect(service.getChallengeById(randomUUID())).rejects.toMatchObject({
      code: 'CHALLENGE_NOT_FOUND',
      statusCode: 404,
    });
  });
});
