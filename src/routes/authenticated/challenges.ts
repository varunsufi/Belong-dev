import { FastifyInstance } from 'fastify';
import { BEARER_AUTH_SECURITY, SWAGGER_TAGS } from '../../constants/swagger';
import {
  ChallengeCompletionResponseSchema,
  ChallengeIdParams,
  ChallengeIdParamsSchema,
  ChallengeResponseSchema,
  CompleteChallengeBody,
  CompleteChallengeBodySchema,
  ListChallengesQuery,
  ListChallengesQuerySchema,
} from '../../schemas/challenge';
import { createDataResponseSchema, createPaginatedResponseSchema, ErrorResponseSchema } from '../../schemas/common';
import { ChallengeService } from '../../services/ChallengeService';

export default async function challengeRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ListChallengesQuery }>(
    '/',
    {
      schema: {
        tags: [SWAGGER_TAGS.Challenges],
        security: BEARER_AUTH_SECURITY,
        querystring: ListChallengesQuerySchema,
        response: {
          200: createPaginatedResponseSchema(ChallengeResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeService = new ChallengeService(fastify.db);
      const result = await challengeService.listChallenges({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
        difficulty: request.query.difficulty,
      });

      return reply.status(200).send(result);
    },
  );

  fastify.get<{ Params: ChallengeIdParams }>(
    '/:id',
    {
      schema: {
        tags: [SWAGGER_TAGS.Challenges],
        security: BEARER_AUTH_SECURITY,
        params: ChallengeIdParamsSchema,
        response: {
          200: createDataResponseSchema(ChallengeResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeService = new ChallengeService(fastify.db);
      const challenge = await challengeService.getChallengeById(request.params.id);

      return reply.status(200).send({
        data: challenge,
      });
    },
  );

  fastify.post<{ Params: ChallengeIdParams; Body: CompleteChallengeBody }>(
    '/:id/complete',
    {
      schema: {
        tags: [SWAGGER_TAGS.Challenges],
        security: BEARER_AUTH_SECURITY,
        params: ChallengeIdParamsSchema,
        body: CompleteChallengeBodySchema,
        response: {
          201: createDataResponseSchema(ChallengeCompletionResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeService = new ChallengeService(fastify.db);
      const completion = await challengeService.completeChallenge(request.user!, request.params.id, request.body);

      return reply.status(201).send({
        data: completion,
      });
    },
  );
}
