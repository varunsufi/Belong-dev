import { FastifyInstance } from 'fastify';
import { BEARER_AUTH_SECURITY, SWAGGER_TAGS } from '../../constants/swagger';
import {
  createDataResponseSchema,
  createPaginatedResponseSchema,
  ErrorResponseSchema,
  PaginationQuery,
  PaginationQuerySchema,
} from '../../schemas/common';
import { LeaderboardEntrySchema } from '../../schemas/leaderboard';
import { LeaderboardService } from '../../services/LeaderboardService';

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: PaginationQuery }>(
    '/',
    {
      schema: {
        tags: [SWAGGER_TAGS.Leaderboard],
        security: BEARER_AUTH_SECURITY,
        querystring: PaginationQuerySchema,
        response: {
          200: createPaginatedResponseSchema(LeaderboardEntrySchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const leaderboardService = new LeaderboardService(fastify.db);
      const result = await leaderboardService.getTopFans({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      });

      return reply.status(200).send(result);
    },
  );

  fastify.get(
    '/me',
    {
      schema: {
        tags: [SWAGGER_TAGS.Leaderboard],
        security: BEARER_AUTH_SECURITY,
        response: {
          200: createDataResponseSchema(LeaderboardEntrySchema),
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const leaderboardService = new LeaderboardService(fastify.db);
      const entry = await leaderboardService.getUserRank(request.user!);

      return reply.status(200).send({
        data: entry,
      });
    },
  );
}
