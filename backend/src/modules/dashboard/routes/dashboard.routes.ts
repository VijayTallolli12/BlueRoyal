import { Router } from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

/**
 * @openapi
 * /dashboard/summary:
 *   get:
 *     summary: Get consolidated Enterprise HRMS Dashboard summary
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Consolidated dashboard statistics and metrics
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', authenticate, DashboardController.getSummary);

export default router;
