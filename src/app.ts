import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config';
import { errorHandler } from './errors/errorHandler';
import dbPlugin from './plugins/db';
import { registerSwaggerDocs } from './plugins/swagger';
import { registerRequestTrace, TRACE_ID_HEADER } from './plugins/requestTrace';
import healthRoutes from "./routes/public/health";
import authRoutes from "./routes/public/auth";
import { registerRequestLogging } from "./plugins/requestLogging";

const buildApp = async () => {
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
    requestIdHeader: TRACE_ID_HEADER,
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  });

  app.setErrorHandler(errorHandler);
  await registerRequestTrace(app);
  await registerRequestLogging(app);

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await registerSwaggerDocs(app);
  await app.register(dbPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
};

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

export { buildApp };
