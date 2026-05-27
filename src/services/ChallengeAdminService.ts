import { DataSource } from 'typeorm';
import { Challenge, ChallengeDifficulty } from '../entities';
import { AppError } from '../errors/AppError';
import { CreateChallengeBody, UpdateChallengeBody } from '../schemas/challenge';
import { PaginatedResult, PaginationOptions } from '../types';

export interface ListChallengesInput extends PaginationOptions {
  difficulty?: ChallengeDifficulty;
  isActive?: boolean;
}

export class ChallengeAdminService {
  constructor(private readonly db: DataSource) {
  }

  async createChallenge(input: CreateChallengeBody): Promise<Challenge> {
    const challengeRepository = this.db.getRepository(Challenge);
    const challenge = challengeRepository.create({
      ...input,
      isActive: input.isActive ?? true,
    });

    return challengeRepository.save(challenge);
  }

  async listChallenges(input: ListChallengesInput): Promise<PaginatedResult<Challenge>> {
    const challengeRepository = this.db.getRepository(Challenge);
    const page = Math.max(input.page, 1);
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const where = {
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
      ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {}),
    };
    const [data, total] = await challengeRepository.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getChallengeById(id: string): Promise<Challenge> {
    const challengeRepository = this.db.getRepository(Challenge);
    const challenge = await challengeRepository.findOneBy({ id });

    if (!challenge) {
      throw new AppError('CHALLENGE_NOT_FOUND');
    }

    return challenge;
  }

  async updateChallenge(id: string, input: UpdateChallengeBody): Promise<Challenge> {
    const challengeRepository = this.db.getRepository(Challenge);
    const challenge = await this.getChallengeById(id);

    Object.assign(challenge, input);

    return challengeRepository.save(challenge);
  }

  async deleteChallenge(id: string): Promise<void> {
    const challengeRepository = this.db.getRepository(Challenge);
    const challenge = await this.getChallengeById(id);

    challenge.isActive = false;
    await challengeRepository.save(challenge);
  }
}
