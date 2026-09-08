import { createApp } from './app';
import { env } from './config/env';
import { logger } from './core/logger/logger';
import { connectDatabase, closeDatabase } from './core/database/sequelize';

async function bootstrap(): Promise<void> {
  try {
    // 1. Establish database connection via Sequelize pool
    await connectDatabase();

    // 2. Initialize application
    const app = createApp();

    // 3. Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`Blue Royal HRMS Backend running at http://localhost:${env.PORT}`);
      logger.info(`Health check available at http://localhost:${env.PORT}${env.API_PREFIX}/health`);
      logger.info(`API Documentation available at http://localhost:${env.PORT}/api/docs`);
    });

    // 4. Graceful Shutdown Hooks
    const handleShutdown = async (signal: string) => {
      logger.info(`${signal} received: initiating graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await closeDatabase();
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start application server:', { error });
    process.exit(1);
  }
}

bootstrap();
