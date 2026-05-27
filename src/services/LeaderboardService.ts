import { DataSource } from 'typeorm';
import { User } from '../entities';
import { LeaderboardEntry } from '../schemas/leaderboard';
import { PaginatedResult, PaginationOptions } from '../types';

export class LeaderboardService {
  constructor(private readonly db: DataSource) {
  }

  async getTopFans(input: PaginationOptions): Promise<PaginatedResult<LeaderboardEntry>> {
    const page = Math.max(input.page, 1);
    const limit = Math.min(Math.max(input.limit, 1), 100);
    const entries = await this.getRankedEntries();
    const total = entries.length;

    return {
      data: entries.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserRank(user: User): Promise<LeaderboardEntry> {
    const entries = await this.getRankedEntries();
    const entry = entries.find((rankedEntry) => rankedEntry.userId === user.id);

    return (
      entry ?? {
        rank: entries.length + 1,
        userId: user.id,
        displayName: user.displayName,
        totalPoints: user.totalPoints,
      }
    );
  }

  private async getRankedEntries(): Promise<LeaderboardEntry[]> {
    const userRepository = this.db.getRepository(User);
    const users = await userRepository.find({
      order: {
        totalPoints: 'DESC',
        displayName: 'ASC',
        email: 'ASC',
        id: 'ASC',
      },
    });

    let currentRank = 0;
    let previousPoints: number | null = null;

    return users.map((user) => {
      if (previousPoints === null || user.totalPoints !== previousPoints) {
        currentRank += 1;
        previousPoints = user.totalPoints;
      }

      return {
        rank: currentRank,
        userId: user.id,
        displayName: user.displayName,
        totalPoints: user.totalPoints,
      };
    });
  }
}
