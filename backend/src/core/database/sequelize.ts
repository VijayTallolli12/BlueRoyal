import { Sequelize } from 'sequelize';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

const isSsl = env.DB_SSL || (env.DATABASE_URL && env.DATABASE_URL.includes('sslmode=require'));
const dialectOptions = isSsl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : {};

export const sequelize = env.DATABASE_URL
  ? new Sequelize(env.DATABASE_URL, {
      dialect: 'postgres',
      logging: env.DB_LOGGING ? (msg) => logger.debug(msg) : false,
      dialectOptions,
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
    })
  : new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
      host: env.DB_HOST,
      port: env.DB_PORT,
      dialect: 'postgres',
      logging: env.DB_LOGGING ? (msg) => logger.debug(msg) : false,
      dialectOptions,
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
      host: env.DATABASE_URL ? '[DATABASE_URL_CONFIGURED]' : env.DB_HOST,
      port: env.DATABASE_URL ? '[DATABASE_URL_PORT]' : env.DB_PORT,
      database: env.DATABASE_URL ? '[DATABASE_URL_DB]' : env.DB_NAME,
      ssl: isSsl,
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
  diagnostics?: any;
}> {
  const start = Date.now();
  try {
    await sequelize.query('SELECT 1;');

    // Inspect database metadata and table counts
    let diagnostics: any = {};
    try {
      const [dbInfo] = await sequelize.query(`
        SELECT current_database() as db_name, current_user as user_name, inet_server_addr() as server_ip, inet_server_port() as server_port;
      `);
      const [counts] = await sequelize.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM employees) as employees,
          (SELECT COUNT(*) FROM clients) as clients,
          (SELECT COUNT(*) FROM projects) as projects,
          (SELECT COUNT(*) FROM employee_assignments) as assignments,
          (SELECT COUNT(*) FROM attendance_records) as attendance,
          (SELECT COUNT(*) FROM leave_requests) as leaves,
          (SELECT COUNT(*) FROM payroll_periods) as payroll_periods,
          (SELECT COUNT(*) FROM payroll_items) as payroll_items,
          (SELECT COUNT(*) FROM client_invoices) as invoices,
          (SELECT COUNT(*) FROM client_payments) as payments;
      `);
      diagnostics = {
        connection: dbInfo[0],
        counts: counts[0],
        configuredHost: sequelize.config.host,
        configuredDatabase: sequelize.config.database,
      };
    } catch (e: any) {
      diagnostics = { queryError: e.message };
    }

    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
      diagnostics,
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: error.message || 'Database ping failed',
    };
  }
}
