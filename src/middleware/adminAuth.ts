import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { AppError } from '../errors/AppError';

const ADMIN_API_KEY_HEADER = 'x-admin-api-key';

const requireAdminApiKey = async (request: FastifyRequest, _reply: FastifyReply) => {
  const apiKey = request.headers[ADMIN_API_KEY_HEADER];

  if (apiKey !== config.admin.apiKey) {
    throw new AppError('FORBIDDEN');
  }
};

export { ADMIN_API_KEY_HEADER, requireAdminApiKey };
