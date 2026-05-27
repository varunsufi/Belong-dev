import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { SWAGGER_TAG_DEFINITIONS } from '../constants/swagger';

const registerSwaggerDocs = async (app: FastifyInstance) => {
  if (config.nodeEnv === 'production') {
    return;
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'FanRewards API',
        version: '1.0.0',
      },
      tags: SWAGGER_TAG_DEFINITIONS,
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
};

export { registerSwaggerDocs };
