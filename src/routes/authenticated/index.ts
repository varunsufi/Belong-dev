import { FastifyInstance } from 'fastify';
import { authenticateUser } from '../../middleware/auth';
import challengeRoutes from './challenges';
import leaderboardRoutes from './leaderboard';
import rewardRoutes from './rewards';
import userRoutes from './user';

export default async function authenticatedRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticateUser);

  await fastify.register(userRoutes, { prefix: '/users' });
  await fastify.register(challengeRoutes, { prefix: '/challenges' });
  await fastify.register(rewardRoutes, { prefix: '/rewards' });
  await fastify.register(leaderboardRoutes, { prefix: '/leaderboard' });
}
