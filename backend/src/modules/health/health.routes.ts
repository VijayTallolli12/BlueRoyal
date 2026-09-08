import { Router } from 'express';
import { HealthController } from './health.controller';

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: System liveness and component health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: System components healthy
 *       503:
 *         description: One or more components degraded or unhealthy
 */
healthRouter.get('/health', HealthController.getHealth);
