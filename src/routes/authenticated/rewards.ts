import { FastifyInstance } from 'fastify';
import { BEARER_AUTH_SECURITY, SWAGGER_TAGS } from '../../constants/swagger';
import {
  createDataResponseSchema,
  createPaginatedResponseSchema,
  ErrorResponseSchema,
  PaginationQuery,
  PaginationQuerySchema,
} from '../../schemas/common';
import {
  RewardIdParams,
  RewardIdParamsSchema,
  RewardRedemptionResponseSchema,
  RewardResponseSchema,
} from '../../schemas/reward';
import { RewardService } from '../../services/RewardService';

export default async function rewardRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: PaginationQuery }>(
    '/',
    {
      schema: {
        tags: [SWAGGER_TAGS.Rewards],
        security: BEARER_AUTH_SECURITY,
        querystring: PaginationQuerySchema,
        response: {
          200: createPaginatedResponseSchema(RewardResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rewardService = new RewardService(fastify.db);
      const result = await rewardService.listAvailableRewards({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      });

      return reply.status(200).send(result);
    },
  );

  fastify.get<{ Querystring: PaginationQuery }>(
    '/history',
    {
      schema: {
        tags: [SWAGGER_TAGS.Rewards],
        security: BEARER_AUTH_SECURITY,
        querystring: PaginationQuerySchema,
        response: {
          200: createPaginatedResponseSchema(RewardRedemptionResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rewardService = new RewardService(fastify.db);
      const result = await rewardService.getRedemptionHistory(request.user!, {
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      });

      return reply.status(200).send(result);
    },
  );

  fastify.post<{ Params: RewardIdParams }>(
    '/:id/redeem',
    {
      schema: {
        tags: [SWAGGER_TAGS.Rewards],
        security: BEARER_AUTH_SECURITY,
        params: RewardIdParamsSchema,
        response: {
          201: createDataResponseSchema(RewardRedemptionResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          422: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const rewardService = new RewardService(fastify.db);
      const redemption = await rewardService.redeemReward(request.user!, request.params.id);

      return reply.status(201).send({
        data: redemption,
      });
    },
  );
}
