import { FastifyInstance } from 'fastify';
import { requireAdminApiKey } from '../../middleware/adminAuth';
import adminChallengeRoutes from './challenges';

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdminApiKey);

  await fastify.register(adminChallengeRoutes, { prefix: '/challenges' });
}
