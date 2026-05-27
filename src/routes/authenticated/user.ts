import { FastifyInstance } from 'fastify';
import { BEARER_AUTH_SECURITY, SWAGGER_TAGS } from '../../constants/swagger';
import { createDataResponseSchema, ErrorResponseSchema } from '../../schemas/common';
import {
  UpdateProfileBody,
  UpdateProfileBodySchema,
  UserProfileResponseSchema,
  UserStatsResponseSchema,
} from '../../schemas/user';
import { UserService } from '../../services/UserService';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/me',
    {
      schema: {
        tags: [SWAGGER_TAGS.Users],
        security: BEARER_AUTH_SECURITY,
        response: {
          200: createDataResponseSchema(UserProfileResponseSchema),
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userService = new UserService(fastify.db);

      return reply.status(200).send({
        data: userService.getProfile(request.user!),
      });
    },
  );

  fastify.patch<{ Body: UpdateProfileBody }>(
    '/me',
    {
      schema: {
        tags: [SWAGGER_TAGS.Users],
        security: BEARER_AUTH_SECURITY,
        body: UpdateProfileBodySchema,
        response: {
          200: createDataResponseSchema(UserProfileResponseSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userService = new UserService(fastify.db);
      const profile = await userService.updateProfile(request.user!, request.body);

      return reply.status(200).send({
        data: profile,
      });
    },
  );

  fastify.get(
    '/me/stats',
    {
      schema: {
        tags: [SWAGGER_TAGS.Users],
        security: BEARER_AUTH_SECURITY,
        response: {
          200: createDataResponseSchema(UserStatsResponseSchema),
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const userService = new UserService(fastify.db);
      const stats = await userService.getStats(request.user!);

      return reply.status(200).send({
        data: stats,
      });
    },
  );
}
