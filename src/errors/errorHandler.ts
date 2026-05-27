import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './AppError';

export const errorHandler = (
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const traceId = request.id;

  if (error instanceof AppError) {
    request.log.warn({ err: error, traceId }, 'Application error');

    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        traceId,
      },
    });
  }

  if ('validation' in error && error.validation) {
    request.log.debug({ err: error, traceId }, 'Request validation error');

    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId,
      },
    });
  }

  request.log.error(
    {
      err: error,
      traceId,
      method: request.method,
      url: request.url,
    },
    'Unhandled request error',
  );

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      traceId,
    },
  });
};
