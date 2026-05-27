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

export enum ChallengeDifficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

@Entity('challenges')
@Check('"points" > 0')
@Check('"duration_seconds" > 0')
@Index('IDX_challenges_title_artist_unique', ['title', 'artist'], { unique: true })
export class Challenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 160 })
  artist!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'int' })
  points!: number;

  @Column({ name: 'duration_seconds', type: 'int' })
  durationSeconds!: number;

  @Index()
  @Column({ type: 'enum', enum: ChallengeDifficulty, enumName: 'challenge_difficulty_enum' })
  difficulty!: ChallengeDifficulty;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => ChallengeCompletion, (completion) => completion.challenge)
  completions!: ChallengeCompletion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
