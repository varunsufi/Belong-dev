import { DataSource } from 'typeorm';
import { User } from '../entities';
import { Meta } from '../schemas/common';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: Meta;
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
