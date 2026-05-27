import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SWAGGER_TAGS } from '../../constants/swagger';
import {
  AdminChallengeResponseSchema,
  AdminListChallengesQuery,
  AdminListChallengesQuerySchema,
  ChallengeIdParams,
  ChallengeIdParamsSchema,
  CreateChallengeBody,
  CreateChallengeBodySchema,
  UpdateChallengeBody,
  UpdateChallengeBodySchema,
} from '../../schemas/challenge';
import { createDataResponseSchema, createPaginatedResponseSchema, ErrorResponseSchema } from '../../schemas/common';
import { ChallengeAdminService } from '../../services/ChallengeAdminService';

export default async function adminChallengeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: CreateChallengeBody }>(
    '/',
    {
      schema: {
        tags: [SWAGGER_TAGS.AdminChallenges],
        body: CreateChallengeBodySchema,
        response: {
          201: createDataResponseSchema(AdminChallengeResponseSchema),
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeAdminService = new ChallengeAdminService(fastify.db);
      const challenge = await challengeAdminService.createChallenge(request.body);

      return reply.status(201).send({
        data: challenge,
      });
    },
  );

  fastify.get<{ Querystring: AdminListChallengesQuery }>(
    '/',
    {
      schema: {
        tags: [SWAGGER_TAGS.AdminChallenges],
        querystring: AdminListChallengesQuerySchema,
        response: {
          200: createPaginatedResponseSchema(AdminChallengeResponseSchema),
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeAdminService = new ChallengeAdminService(fastify.db);
      const result = await challengeAdminService.listChallenges({
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
        difficulty: request.query.difficulty,
        isActive: request.query.isActive,
      });

      return reply.status(200).send(result);
    },
  );

  fastify.get<{ Params: ChallengeIdParams }>(
    '/:id',
    {
      schema: {
        tags: [SWAGGER_TAGS.AdminChallenges],
        params: ChallengeIdParamsSchema,
        response: {
          200: createDataResponseSchema(AdminChallengeResponseSchema),
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeAdminService = new ChallengeAdminService(fastify.db);
      const challenge = await challengeAdminService.getChallengeById(request.params.id);

      return reply.status(200).send({
        data: challenge,
      });
    },
  );

  fastify.patch<{ Params: ChallengeIdParams; Body: UpdateChallengeBody }>(
    '/:id',
    {
      schema: {
        tags: [SWAGGER_TAGS.AdminChallenges],
        params: ChallengeIdParamsSchema,
        body: UpdateChallengeBodySchema,
        response: {
          200: createDataResponseSchema(AdminChallengeResponseSchema),
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeAdminService = new ChallengeAdminService(fastify.db);
      const challenge = await challengeAdminService.updateChallenge(request.params.id, request.body);

      return reply.status(200).send({
        data: challenge,
      });
    },
  );

  fastify.delete<{ Params: ChallengeIdParams }>(
    '/:id',
    {
      schema: {
        tags: [SWAGGER_TAGS.AdminChallenges],
        params: ChallengeIdParamsSchema,
        response: {
          204: Type.Null(),
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const challengeAdminService = new ChallengeAdminService(fastify.db);
      await challengeAdminService.deleteChallenge(request.params.id);

      return reply.status(204).send();
    },
  );
}
