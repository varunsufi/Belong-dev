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
import { Challenge } from './Challenge';
import { User } from './User';

@Entity('challenge_completions')
@Check('"points_earned" >= 0')
@Check('"listen_percentage" >= 0 AND "listen_percentage" <= 100')
export class ChallengeCompletion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'challenge_id', type: 'uuid' })
  challengeId!: string;

  @Column({ name: 'points_earned', type: 'int' })
  pointsEarned!: number;

  @Column({ name: 'listen_percentage', type: 'real' })
  listenPercentage!: number;

  @ManyToOne(() => User, (user) => user.completions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Challenge, (challenge) => challenge.completions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challenge_id' })
  challenge!: Challenge;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
