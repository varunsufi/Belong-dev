import Fastify from 'fastify';
import { DataSource } from 'typeorm';
import { errorHandler } from './errors/errorHandler';
import { registerRequestTrace, TRACE_ID_HEADER } from './plugins/requestTrace';
import healthRoutes from './routes/public/health';

const buildHealthApp = async (db: Pick<DataSource, 'isInitialized' | 'query'>) => {
  const app = Fastify({ requestIdHeader: TRACE_ID_HEADER });
  app.decorate('db', db as DataSource);
  await app.register(healthRoutes);
  await app.ready();

  return app;
};

describe('request trace IDs', () => {
  it('adds a generated trace ID response header when none is provided', async () => {
    const app = Fastify({ requestIdHeader: TRACE_ID_HEADER });
    await registerRequestTrace(app);
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.headers[TRACE_ID_HEADER]).toEqual(expect.any(String));

    await app.close();
  });

  it('echoes an incoming trace ID response header', async () => {
    const app = Fastify({ requestIdHeader: TRACE_ID_HEADER });
    await registerRequestTrace(app);
    app.get('/health', async () => ({ status: 'ok' }));
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        [TRACE_ID_HEADER]: 'mobile-login-123',
      },
    });

    expect(response.headers[TRACE_ID_HEADER]).toBe('mobile-login-123');

    await app.close();
  });

  it('adds matching trace ID to validation error responses', async () => {
    const app = Fastify({ requestIdHeader: TRACE_ID_HEADER });
    app.setErrorHandler(errorHandler);
    await registerRequestTrace(app);
    app.post(
      '/validated',
      {
        schema: {
          body: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string' },
            },
          },
        },
      },
      async () => ({ ok: true }),
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/validated',
      headers: {
        [TRACE_ID_HEADER]: 'validation-trace-123',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers[TRACE_ID_HEADER]).toBe('validation-trace-123');
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        traceId: 'validation-trace-123',
      },
    });

    await app.close();
  });

  it('logs unexpected errors with trace ID', async () => {
    const logWrite = jest.fn();
    const app = Fastify({
      requestIdHeader: TRACE_ID_HEADER,
      logger: {
        level: 'error',
        stream: {
          write: logWrite,
        },
      },
    });
    app.setErrorHandler(errorHandler);
    await registerRequestTrace(app);
    app.get('/explode', async () => {
      throw new Error('boom');
    });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/explode',
      headers: {
        [TRACE_ID_HEADER]: 'error-trace-123',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        traceId: 'error-trace-123',
      },
    });
    expect(logWrite).toHaveBeenCalledWith(expect.stringContaining('Unhandled request error'));
    expect(logWrite).toHaveBeenCalledWith(expect.stringContaining('error-trace-123'));

    await app.close();
  });
});

describe('health check', () => {
  it('returns ok when database is initialized and query succeeds', async () => {
    const query = jest.fn().mockResolvedValue([{ result: 1 }]);
    const app = await buildHealthApp({
      isInitialized: true,
      query,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      database: 'ok',
    });
    expect(query).toHaveBeenCalledWith('SELECT 1');

    await app.close();
  });

  it('returns unavailable when database is not initialized', async () => {
    const query = jest.fn();
    const app = await buildHealthApp({
      isInitialized: false,
      query,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'unavailable',
      database: 'unavailable',
    });
    expect(query).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns unavailable when database query fails', async () => {
    const query = jest.fn().mockRejectedValue(new Error('database unavailable'));
    const app = await buildHealthApp({
      isInitialized: true,
      query,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'unavailable',
      database: 'unavailable',
    });

    await app.close();
  });

  it('is public and does not require authorization', async () => {
    const app = await buildHealthApp({
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ result: 1 }]),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
