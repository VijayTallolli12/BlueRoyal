import { Request, Response, NextFunction } from 'express';
import { checkDatabaseHealth } from '../../core/database/sequelize';
import { sendSuccess } from '../../core/utils/response.util';
import { HealthCheckResponse } from '@blue-royal/contracts';

export class HealthController {
  public static async getHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbHealth = await checkDatabaseHealth();
      const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

      const healthData: HealthCheckResponse = {
        status: overallStatus,
        version: '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: dbHealth.status,
            latencyMs: dbHealth.latencyMs,
            message: dbHealth.message,
          },
        },
      };

      const httpStatusCode = overallStatus === 'healthy' ? 200 : 503;
      sendSuccess(req, res, healthData, httpStatusCode);
    } catch (error) {
      next(error);
    }
  }
}
