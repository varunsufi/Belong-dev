import { DataSource } from 'typeorm';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config';
import { Challenge, ChallengeCompletion, Reward, RewardRedemption, User, UserTokenEntity,} from '../entities';

const dataSource = new DataSource({
    type: 'postgres',
    host: config.db.host,
    port: config.db.port,
    username: config.db.username,
    password: config.db.password,
    database: config.db.database,
    entities: [User, Challenge, ChallengeCompletion, Reward, RewardRedemption, UserTokenEntity],
    migrations: [`${__dirname}/../migrations/*{.ts,.js}`],
    synchronize: false, // Use migrations instead
    logging: false,
});

const dbPlugin: FastifyPluginAsync = async (fastify) => {
    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }

    fastify.decorate('db', dataSource);

    fastify.addHook('onClose', async () => {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });
};

export { dataSource };
export default fp(dbPlugin, {
    name: 'db',
});
