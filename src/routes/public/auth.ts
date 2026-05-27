import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SWAGGER_TAGS } from '../../constants/swagger';
import {
  LoginBody,
  LoginBodySchema,
  RefreshTokenBody,
  RefreshTokenBodySchema,
  RegisterBody,
  RegisterBodySchema,
  RegisteredUserResponseSchema,
  TokenPairSchema,
} from '../../schemas/auth';
import { createDataResponseSchema, ErrorResponseSchema } from '../../schemas/common';
import { AuthService } from '../../services/AuthService';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        tags: [SWAGGER_TAGS.PublicAuth],
        body: RegisterBodySchema,
        response: {
          201: createDataResponseSchema(RegisteredUserResponseSchema),
          400: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const authService = new AuthService(fastify.db);
      const registeredUser = await authService.register(request.body);

      return reply.status(201).send({
        data: registeredUser,
      });
    },
  );

  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        tags: [SWAGGER_TAGS.PublicAuth],
        body: LoginBodySchema,
        response: {
          200: createDataResponseSchema(TokenPairSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const authService = new AuthService(fastify.db);
      const tokens = await authService.login(request.body);

      return reply.status(200).send({
        data: tokens,
      });
    },
  );

  fastify.post<{ Body: RefreshTokenBody }>(
    '/refresh',
    {
      schema: {
        tags: [SWAGGER_TAGS.PublicAuth],
        body: RefreshTokenBodySchema,
        response: {
          200: createDataResponseSchema(TokenPairSchema),
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const authService = new AuthService(fastify.db);
      const tokens = await authService.refresh(request.body);

      return reply.status(200).send({
        data: tokens,
      });
    },
  );

  fastify.post<{ Body: RefreshTokenBody }>(
    '/logout',
    {
      schema: {
        tags: [SWAGGER_TAGS.PublicAuth],
        body: RefreshTokenBodySchema,
        response: {
          204: Type.Null(),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const authService = new AuthService(fastify.db);
      await authService.logout(request.body);

      return reply.status(204).send();
    },
  );
}
