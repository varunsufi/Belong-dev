import Fastify, { FastifyInstance } from 'fastify';
import { registerRequestLogging } from './requestLogging';
import { registerRequestTrace, TRACE_ID_HEADER } from './requestTrace';

const createApp = async (logWrite: jest.Mock): Promise<FastifyInstance> => {
  const app = Fastify({
    requestIdHeader: TRACE_ID_HEADER,
    logger: {
      level: 'info',
      stream: {
        write: logWrite,
      },
    },
  });

  await registerRequestTrace(app);
  await registerRequestLogging(app);

  return app;
};

const parseCompletedRequestLogs = (logWrite: jest.Mock) =>
  logWrite.mock.calls
    .map(([line]) => JSON.parse(line))
    .filter((entry) => entry.msg === 'Request completed');

describe('request logging', () => {
  it('logs successful requests at info', async () => {
    const logWrite = jest.fn();
    const app = await createApp(logWrite);
    app.get('/ok', async () => ({ ok: true }));
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/ok',
      headers: {
        [TRACE_ID_HEADER]: 'trace-info-123',
      },
    });

    const [log] = parseCompletedRequestLogs(logWrite);
    expect(log).toMatchObject({
      level: 30,
      traceId: 'trace-info-123',
      method: 'GET',
      url: '/ok',
      statusCode: 200,
    });
    expect(log.durationMs).toEqual(expect.any(Number));

    await app.close();
  });

  it('logs 4xx responses at warn', async () => {
    const logWrite = jest.fn();
    const app = await createApp(logWrite);
    app.get('/bad-request', async (_request, reply) => reply.status(400).send({ ok: false }));
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/bad-request',
      headers: {
        [TRACE_ID_HEADER]: 'trace-warn-123',
      },
    });

    const [log] = parseCompletedRequestLogs(logWrite);
    expect(log).toMatchObject({
      level: 40,
      traceId: 'trace-warn-123',
      method: 'GET',
      url: '/bad-request',
      statusCode: 400,
    });
    expect(log.durationMs).toEqual(expect.any(Number));

    await app.close();
  });

  it('logs 5xx responses at error', async () => {
    const logWrite = jest.fn();
    const app = await createApp(logWrite);
    app.get('/server-error', async (_request, reply) => reply.status(500).send({ ok: false }));
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/server-error',
      headers: {
        [TRACE_ID_HEADER]: 'trace-error-123',
      },
    });

    const [log] = parseCompletedRequestLogs(logWrite);
    expect(log).toMatchObject({
      level: 50,
      traceId: 'trace-error-123',
      method: 'GET',
      url: '/server-error',
      statusCode: 500,
    });
    expect(log.durationMs).toEqual(expect.any(Number));

    await app.close();
  });

  it('includes user ID when request user is available', async () => {
    const logWrite = jest.fn();
    const app = await createApp(logWrite);
    app.get('/me', async (request) => {
      request.user = { id: 'user-123' } as typeof request.user;
      return { ok: true };
    });
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        [TRACE_ID_HEADER]: 'trace-user-123',
      },
    });

    const [log] = parseCompletedRequestLogs(logWrite);
    expect(log).toMatchObject({
      traceId: 'trace-user-123',
      method: 'GET',
      url: '/me',
      statusCode: 200,
      userId: 'user-123',
    });

    await app.close();
  });

  it('does not log sensitive headers, cookies, bodies, or tokens', async () => {
    const logWrite = jest.fn();
    const app = await createApp(logWrite);
    app.post('/sensitive', async () => ({ ok: true }));
    await app.ready();

    await app.inject({
      method: 'POST',
      url: '/sensitive',
      headers: {
        authorization: 'Bearer secret-access-token',
        cookie: 'session=secret-cookie',
        'x-admin-api-key': 'secret-admin-key',
        [TRACE_ID_HEADER]: 'trace-sensitive-123',
      },
      payload: {
        password: 'secret-password',
        refreshToken: 'secret-refresh-token',
      },
    });

    const completedLogs = parseCompletedRequestLogs(logWrite);
    expect(completedLogs).toHaveLength(1);

    const serializedLogs = JSON.stringify(completedLogs);
    expect(serializedLogs).not.toContain('authorization');
    expect(serializedLogs).not.toContain('cookie');
    expect(serializedLogs).not.toContain('secret-access-token');
    expect(serializedLogs).not.toContain('secret-refresh-token');
    expect(serializedLogs).not.toContain('secret-admin-key');
    expect(serializedLogs).not.toContain('secret-password');

    await app.close();
  });
});
