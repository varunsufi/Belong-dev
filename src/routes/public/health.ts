import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SWAGGER_TAGS } from '../../constants/swagger';

const HealthOkResponseSchema = Type.Object({
  status: Type.Literal('ok'),
  database: Type.Literal('ok'),
});

const HealthUnavailableResponseSchema = Type.Object({
  status: Type.Literal('unavailable'),
  database: Type.Literal('unavailable'),
});

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      schema: {
        tags: [SWAGGER_TAGS.System],
        response: {
          200: HealthOkResponseSchema,
          503: HealthUnavailableResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const unavailableResponse = {
        status: 'unavailable' as const,
        database: 'unavailable' as const,
      };

      if (!fastify.db.isInitialized) {
        request.log.error({ traceId: request.id }, 'Health check database unavailable');
        return reply.status(503).send(unavailableResponse);
      }

      try {
        await fastify.db.query('SELECT 1');
      } catch (error) {
        request.log.error({ err: error, traceId: request.id }, 'Health check database unavailable');
        return reply.status(503).send(unavailableResponse);
      }

      return reply.status(200).send({
        status: 'ok',
        database: 'ok',
      });
    },
  );
}
