import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { FastifyInstance } from 'fastify';
import request = require('supertest');
import type TestAgent = require('supertest/lib/agent');
import type { DataSource } from 'typeorm';
import { ChallengeDifficulty } from '../entities';

const TEST_ADMIN_API_KEY = 'test-admin-api-key';

interface IntegrationTestApp {
  app: FastifyInstance;
  db: DataSource;
  request: TestAgent<request.Test>;
  resetDatabase: () => Promise<void>;
  stop: () => Promise<void>;
}

const setupIntegrationTestApp = async (): Promise<IntegrationTestApp> => {
  jest.resetModules();

  let container: StartedPostgreSqlContainer | undefined;
  let db: DataSource | undefined;
  let app: FastifyInstance | undefined;

  try {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('fan_rewards_test')
      .withUsername('belong')
      .withPassword('belong_dev')
      .start();

    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = container.getPort().toString();
    process.env.DB_USERNAME = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_DATABASE = container.getDatabase();
    process.env.JWT_ACCESS_SECRET = 'integration-access-secret';
    process.env.JWT_REFRESH_SECRET = 'integration-refresh-secret';
    process.env.ADMIN_API_KEY = TEST_ADMIN_API_KEY;

    const [{ dataSource }, { buildApp }] = await Promise.all([
      import('../plugins/db'),
      import('../app'),
    ]);

    db = dataSource;
    if (!db.isInitialized) {
      await db.initialize();
    }

    await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await db.runMigrations();

    app = await buildApp();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    return {
      app,
      db,
      request: request(address),
      resetDatabase: () => resetDatabase(db as DataSource),
      stop: async () => {
        await stopIntegrationTestApp(app, db, container);
      },
    };
  } catch (error) {
    await stopIntegrationTestApp(app, db, container);
    throw error;
  }
};

const resetDatabase = async (db: DataSource): Promise<void> => {
  await db.query(
    'TRUNCATE TABLE "challenge_completions", "reward_redemptions", "user_tokens", "challenges", "rewards", "users" RESTART IDENTITY CASCADE',
  );
};

const stopIntegrationTestApp = async (
  app?: FastifyInstance,
  db?: DataSource,
  container?: StartedPostgreSqlContainer,
): Promise<void> => {
  if (app) {
    await app.close();
  }

  if (db?.isInitialized) {
    await db.destroy();
  }

  if (container) {
    await container.stop();
  }
};

const adminHeaders = () => ({
  'x-admin-api-key': TEST_ADMIN_API_KEY,
});

const createChallengePayload = () => ({
  title: 'All Night',
  artist: 'Camo & Krooked',
  description: 'Listen to this drum and bass classic to earn points',
  points: 150,
  durationSeconds: 219,
  difficulty: ChallengeDifficulty.Easy,
  isActive: true,
});

export {
  IntegrationTestApp,
  adminHeaders,
  createChallengePayload,
  setupIntegrationTestApp,
};
