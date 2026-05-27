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
import { RewardRedemption } from './RewardRedemption';

@Entity('rewards')
@Check('"points_cost" > 0')
export class Reward {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'points_cost', type: 'int' })
  pointsCost!: number;

  @Index()
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable!: boolean;

  @OneToMany(() => RewardRedemption, (redemption) => redemption.reward)
  redemptions!: RewardRedemption[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
