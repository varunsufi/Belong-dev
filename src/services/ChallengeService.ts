import { DataSource, EntityManager } from 'typeorm';
import { Challenge, ChallengeCompletion, ChallengeDifficulty, User } from '../entities';
import { AppError } from '../errors/AppError';
import { PaginatedResult, PaginationOptions } from '../types';
import { ChallengeCompletionResponse, ChallengeResponse, CompleteChallengeBody } from '../schemas/challenge';

export interface ListChallengesInput extends PaginationOptions {
  difficulty?: ChallengeDifficulty;
}

export class ChallengeService {
  constructor(private readonly db: DataSource) {
  }

  async listChallenges(input: ListChallengesInput): Promise<PaginatedResult<ChallengeResponse>> {
    const challengeRepository = this.db.getRepository(Challenge);
    const page = Math.max(input.page, 1);
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const where = {
      isActive: true,
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
    };
    const [challenges, total] = await challengeRepository.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: challenges.map(toChallengeResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getChallengeById(id: string): Promise<ChallengeResponse> {
    const challenge = await this.findActiveChallenge(id);

    return toChallengeResponse(challenge);
  }

  async completeChallenge(
    user: User,
    challengeId: string,
    input: CompleteChallengeBody,
  ): Promise<ChallengeCompletionResponse> {
    return this.db.transaction('READ COMMITTED', async (manager) => {
      const lockedUser = await this.findUserForUpdate(manager, user.id);
      const challenge = await this.findActiveChallenge(challengeId, manager);
      const completionRepository = manager.getRepository(ChallengeCompletion);
      const pointsEarned = calculatePointsEarned(challenge.points, input.listenPercentage);
      const completion = completionRepository.create({
        userId: lockedUser.id,
        user: lockedUser,
        challengeId: challenge.id,
        challenge,
        pointsEarned,
        listenPercentage: input.listenPercentage,
      });

      lockedUser.totalPoints += pointsEarned;
      await manager.getRepository(User).save(lockedUser);
      const savedCompletion = await completionRepository.save(completion);

      return {
        id: savedCompletion.id,
        challengeId: savedCompletion.challengeId,
        pointsEarned: savedCompletion.pointsEarned,
        listenPercentage: savedCompletion.listenPercentage,
        totalPoints: lockedUser.totalPoints,
      };
    });
  }

  private async findActiveChallenge(id: string, manager: EntityManager | DataSource = this.db): Promise<Challenge> {
    const challengeRepository = manager.getRepository(Challenge);
    const challenge = await challengeRepository.findOneBy({ id, isActive: true });

    if (!challenge) {
      throw new AppError('CHALLENGE_NOT_FOUND');
    }

    return challenge;
  }

  private async findUserForUpdate(manager: EntityManager, userId: string): Promise<User> {
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!user) {
      throw new AppError('INVALID_ACCESS_TOKEN');
    }

    return user;
  }
}

const calculatePointsEarned = (challengePoints: number, listenPercentage: number): number => {
  if (listenPercentage >= 80) {
    return challengePoints;
  }

  return Math.floor((challengePoints * listenPercentage) / 100);
};

const toChallengeResponse = (challenge: Challenge): ChallengeResponse => ({
  id: challenge.id,
  title: challenge.title,
  artist: challenge.artist,
  description: challenge.description,
  points: challenge.points,
  durationSeconds: challenge.durationSeconds,
  difficulty: challenge.difficulty,
});
