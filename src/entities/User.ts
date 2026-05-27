import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChallengeCompletion } from './ChallengeCompletion';
import { RewardRedemption } from './RewardRedemption';
import { UserTokenEntity } from './UserTokenEntity';

@Entity('users')
@Check('"total_points" >= 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'total_points', type: 'int', default: 0 })
  totalPoints!: number;

  @Column({ name: 'display_name', type: 'varchar', length: 120, nullable: true })
  displayName!: string | null;

  @OneToMany(() => ChallengeCompletion, (completion) => completion.user)
  completions!: ChallengeCompletion[];

  @OneToMany(() => RewardRedemption, (redemption) => redemption.user)
  redemptions!: RewardRedemption[];

  @OneToMany(() => UserTokenEntity, (token) => token.user)
  tokens!: UserTokenEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
