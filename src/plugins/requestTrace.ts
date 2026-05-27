import { FastifyInstance } from 'fastify';

const TRACE_ID_HEADER = 'x-trace-id';

const registerRequestTrace = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    reply.header(TRACE_ID_HEADER, request.id);
  });
};

export { TRACE_ID_HEADER, registerRequestTrace };
