import { DataSource } from 'typeorm';
import { ChallengeCompletion, RewardRedemption, User } from '../entities';
import { UserMapper } from '../mappers/UserMapper';
import { UpdateProfileBody, UserProfileResponse, UserStatsResponse } from '../schemas/user';

export class UserService {
  constructor(private readonly db: DataSource) {
  }

  getProfile(user: User): UserProfileResponse {
    return UserMapper.toProfileResponse(user);
  }

  async updateProfile(user: User, input: UpdateProfileBody): Promise<UserProfileResponse> {
    const userRepository = this.db.getRepository(User);

    user.displayName = input.displayName.trim();
    const savedUser = await userRepository.save(user);

    return UserMapper.toProfileResponse(savedUser);
  }

  async getStats(user: User): Promise<UserStatsResponse> {
    const completionRepository = this.db.getRepository(ChallengeCompletion);
    const redemptionRepository = this.db.getRepository(RewardRedemption);
    const [completionsCount, redemptionsCount, pointsEarned, pointsSpent] = await Promise.all([
      completionRepository.countBy({ userId: user.id }),
      redemptionRepository.countBy({ userId: user.id }),
      completionRepository.sum('pointsEarned', { userId: user.id }),
      redemptionRepository.sum('pointsSpent', { userId: user.id }),
    ]);

    return {
      totalPoints: user.totalPoints,
      completionsCount,
      redemptionsCount,
      pointsEarned: pointsEarned ?? 0,
      pointsSpent: pointsSpent ?? 0,
    };
  }
}
