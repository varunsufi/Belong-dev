import { DataSource } from 'typeorm';
import { Reward, RewardRedemption, RewardRedemptionStatus, User } from '../entities';
import { AppError } from '../errors/AppError';
import { RewardRedemptionResponse, RewardResponse } from '../schemas/reward';
import { PaginatedResult, PaginationOptions } from '../types';

export class RewardService {
  constructor(private readonly db: DataSource) {
  }

  async listAvailableRewards(input: PaginationOptions): Promise<PaginatedResult<RewardResponse>> {
    const rewardRepository = this.db.getRepository(Reward);
    const page = Math.max(input.page, 1);
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const [rewards, total] = await rewardRepository.findAndCount({
      where: {
        isAvailable: true,
      },
      order: {
        pointsCost: 'ASC',
        name: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rewards.map(toRewardResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async redeemReward(user: User, rewardId: string): Promise<RewardRedemptionResponse> {
    return this.db.transaction('READ COMMITTED', async (manager) => {
      const userRepository = manager.getRepository(User);
      const rewardRepository = manager.getRepository(Reward);
      const redemptionRepository = manager.getRepository(RewardRedemption);
      const lockedUser = await userRepository.findOne({
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedUser) {
        throw new AppError('INVALID_ACCESS_TOKEN');
      }

      const reward = await rewardRepository.findOneBy({
        id: rewardId,
        isAvailable: true,
      });

      if (!reward) {
        throw new AppError('REWARD_NOT_FOUND');
      }

      if (lockedUser.totalPoints < reward.pointsCost) {
        throw new AppError('INSUFFICIENT_POINTS');
      }

      lockedUser.totalPoints -= reward.pointsCost;
      await userRepository.save(lockedUser);

      const redemption = redemptionRepository.create({
        userId: lockedUser.id,
        user: lockedUser,
        rewardId: reward.id,
        reward,
        pointsSpent: reward.pointsCost,
        status: RewardRedemptionStatus.Pending,
      });
      const savedRedemption = await redemptionRepository.save(redemption);

      return {
        ...toRewardRedemptionResponse(savedRedemption),
        totalPoints: lockedUser.totalPoints,
      };
    });
  }

  async getRedemptionHistory(user: User, input: PaginationOptions): Promise<PaginatedResult<RewardRedemptionResponse>> {
    const redemptionRepository = this.db.getRepository(RewardRedemption);
    const page = Math.max(input.page, 1);
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const [redemptions, total] = await redemptionRepository.findAndCount({
      where: {
        userId: user.id,
      },
      order: {
        createdAt: 'DESC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: redemptions.map(toRewardRedemptionResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

const toRewardResponse = (reward: Reward): RewardResponse => ({
  id: reward.id,
  name: reward.name,
  description: reward.description,
  pointsCost: reward.pointsCost,
});

const toRewardRedemptionResponse = (redemption: RewardRedemption): RewardRedemptionResponse => ({
  id: redemption.id,
  rewardId: redemption.rewardId,
  pointsSpent: redemption.pointsSpent,
  status: redemption.status,
});
