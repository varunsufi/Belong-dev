import { DataSource } from 'typeorm';
import { User } from '../entities';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  totalPoints: number;
}

// Extend Fastify's request type with authenticated user
declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
  }

  interface FastifyRequest {
    user?: User;
  }
}
