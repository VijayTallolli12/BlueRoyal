import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { sendSuccess } from '../../../core/utils/response.util';

export class DashboardController {
  /**
   * Get consolidated HRMS dashboard summary.
   */
  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await DashboardService.getSummary();
      sendSuccess(req, res, summary);
    } catch (err) {
      next(err);
    }
  }
}
