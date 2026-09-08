import { Sequelize } from 'sequelize';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  logging: env.DB_LOGGING ? (msg) => logger.debug(msg) : false,
  pool: {
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    acquire: env.DB_POOL_ACQUIRE_MS,
    idle: env.DB_POOL_IDLE_MS,
  },
  define: {
    underscored: true,
    timestamps: true,
  },
});

export async function connectDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully via Sequelize pool', {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
    });
  } catch (error) {
    logger.error('Unable to connect to PostgreSQL database:', { error });
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await sequelize.close();
    logger.info('Sequelize database connection pool closed gracefully');
  } catch (error) {
    logger.error('Error while closing database pool:', { error });
  }
}

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  message?: string;
}> {
  const start = Date.now();
  try {
    await sequelize.query('SELECT 1;');
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error.message || 'Database ping failed',
    };
  }
}
