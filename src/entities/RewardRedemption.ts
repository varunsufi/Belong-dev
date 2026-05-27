import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reward } from './Reward';
import { User } from './User';

export enum RewardRedemptionStatus {
  Pending = 'pending',
  Fulfilled = 'fulfilled',
  Cancelled = 'cancelled',
}

@Entity('reward_redemptions')
@Check('"points_spent" > 0')
export class RewardRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'reward_id', type: 'uuid' })
  rewardId!: string;

  @Column({ name: 'points_spent', type: 'int' })
  pointsSpent!: number;

  @Index()
  @Column({
    type: 'enum',
    enum: RewardRedemptionStatus,
    enumName: 'reward_redemption_status_enum',
    default: RewardRedemptionStatus.Pending,
  })
  status!: RewardRedemptionStatus;

  @ManyToOne(() => User, (user) => user.redemptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Reward, (reward) => reward.redemptions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reward_id' })
  reward!: Reward;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
