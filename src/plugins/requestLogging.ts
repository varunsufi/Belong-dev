import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const requestStartTimes = new WeakMap<FastifyRequest, bigint>();

const registerRequestLogging = async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request) => {
    requestStartTimes.set(request, process.hrtime.bigint());
  });

  app.addHook('onResponse', async (request, reply) => {
    const endTime = process.hrtime.bigint();
    const startTime = requestStartTimes.get(request) ?? endTime;
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const logPayload = buildLogPayload(request, reply, durationMs);

    if (reply.statusCode >= 500) {
      request.log.error(logPayload, 'Request completed');
      requestStartTimes.delete(request);
      return;
    }

    if (reply.statusCode >= 400) {
      request.log.warn(logPayload, 'Request completed');
      requestStartTimes.delete(request);
      return;
    }

    request.log.info(logPayload, 'Request completed');
    requestStartTimes.delete(request);
  });
};

const buildLogPayload = (request: FastifyRequest, reply: FastifyReply, durationMs: number) => ({
  traceId: request.id,
  method: request.method,
  url: request.url,
  statusCode: reply.statusCode,
  durationMs,
  userId: request.user?.id,
});

export { registerRequestLogging };
