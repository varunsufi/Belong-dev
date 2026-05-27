import { DataSource } from 'typeorm';
import { Challenge, ChallengeDifficulty, Reward } from './entities';
import { dataSource } from './plugins/db';

const SEED_CHALLENGES = [
  {
    title: 'All Night',
    artist: 'Camo & Krooked',
    description: 'Listen to this drum & bass classic to earn points',
    points: 150,
    durationSeconds: 219,
    difficulty: ChallengeDifficulty.Easy,
    isActive: true,
  },
  {
    title: 'New Forms',
    artist: 'Roni Size',
    description: 'Complete this legendary track for bonus points',
    points: 300,
    durationSeconds: 464,
    difficulty: ChallengeDifficulty.Medium,
    isActive: true,
  },
  {
    title: 'Extended Session',
    artist: 'Camo & Krooked',
    description: 'A longer listening challenge for dedicated fans',
    points: 500,
    durationSeconds: 600,
    difficulty: ChallengeDifficulty.Hard,
    isActive: true,
  },
];

const SEED_REWARDS = [
  {
    name: 'Early Access Pass',
    description: 'Get early access to new features',
    pointsCost: 200,
    isAvailable: true,
  },
  {
    name: 'Exclusive Playlist',
    description: 'Unlock a curated artist playlist',
    pointsCost: 500,
    isAvailable: true,
  },
  {
    name: 'VIP Fan Badge',
    description: 'Show off your dedication with a VIP badge',
    pointsCost: 1000,
    isAvailable: true,
  },
  {
    name: 'Concert Ticket Raffle',
    description: 'Enter a raffle for concert tickets',
    pointsCost: 2500,
    isAvailable: true,
  },
];

const seedDatabase = async (db: DataSource) => {
  await db.getRepository(Challenge).upsert(SEED_CHALLENGES, ['title', 'artist']);
  await db.getRepository(Reward).upsert(SEED_REWARDS, ['name']);

  return {
    challenges: SEED_CHALLENGES.length,
    rewards: SEED_REWARDS.length,
  };
};

const runSeed = async () => {
  try {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const result = await seedDatabase(dataSource);

    console.log(`Seeded ${result.challenges} challenges and ${result.rewards} rewards`);
  } catch (error) {
    console.error('Failed to seed database', error);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
};

if (require.main === module) {
  runSeed();
}

export { SEED_CHALLENGES, SEED_REWARDS, seedDatabase };
