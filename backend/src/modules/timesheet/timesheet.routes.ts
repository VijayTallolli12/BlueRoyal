import { Router } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requirePermission } from '../../core/middleware/rbac.middleware';
import { TimesheetController } from './timesheet.controller';

const router = Router();

router.get(
  '/projects/:projectId/supervisors',
  authenticate,
  requirePermission('attendance:read'),
  TimesheetController.getProjectSupervisors
);

router.get(
  '/projects/:projectId/designations',
  authenticate,
  requirePermission('attendance:read'),
  TimesheetController.getProjectDesignations
);

router.get(
  '/projects/:projectId/employees',
  authenticate,
  requirePermission('attendance:read'),
  TimesheetController.getProjectEmployees
);

router.post(
  '/fill-standard',
  authenticate,
  requirePermission('attendance:create'),
  TimesheetController.fillStandardHours
);

router.post(
  '/projects/:projectId/assign-worker',
  authenticate,
  requirePermission('assignments:create'),
  TimesheetController.assignWorker
);

export default router;
