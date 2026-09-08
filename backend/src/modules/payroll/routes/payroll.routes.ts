import { Router } from 'express';
import { PayrollController } from '../controllers/payroll.controller';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { validate } from '../../../core/middleware/validate.middleware';
import {
  createPayrollPeriodSchema,
  addPayrollAdjustmentSchema,
  unlockPayrollPeriodSchema,
} from '../validators/payroll.validator';

const router = Router();

// Apply authentication to all payroll routes
router.use(authenticate);

// Employee self-service
router.get('/my-payroll', requirePermission('payroll:self_read'), PayrollController.getMyPayroll);
router.get(
  '/my-payroll/:periodId',
  requirePermission('payroll:self_read'),
  PayrollController.getMyPayslip,
);
router.get(
  '/my-payroll/:periodId/payslip',
  requirePermission('payroll:self_read'),
  PayrollController.getMyPayslip,
);

// Operational Period Management
router.get('/periods', requirePermission('payroll:read'), PayrollController.listPeriods);
router.post(
  '/periods',
  requirePermission('payroll:create'),
  validate({ body: createPayrollPeriodSchema }),
  PayrollController.createPeriod,
);
router.get('/periods/:id', requirePermission('payroll:read'), PayrollController.getPeriod);
router.post(
  '/periods/:id/calculate',
  requirePermission('payroll:calculate'),
  PayrollController.calculatePeriod,
);
router.get('/periods/:id/items', requirePermission('payroll:read'), PayrollController.getPeriodItems);
router.get(
  '/periods/:id/items/:itemId',
  requirePermission('payroll:read'),
  PayrollController.getItemDetail,
);

// Manual Adjustments
router.post(
  '/periods/:id/items/:itemId/adjustments',
  requirePermission('payroll:calculate'),
  validate({ body: addPayrollAdjustmentSchema }),
  PayrollController.addAdjustment,
);
router.delete(
  '/periods/:id/items/:itemId/adjustments/:lineId',
  requirePermission('payroll:calculate'),
  PayrollController.deleteAdjustment,
);

// Lifecycle Sign-Off & Controlled Unlock
router.post('/periods/:id/review', requirePermission('payroll:review'), PayrollController.reviewPeriod);
router.post(
  '/periods/:id/finalize',
  requirePermission('payroll:finalize'),
  PayrollController.finalizePeriod,
);
router.post(
  '/periods/:id/unlock',
  requirePermission('payroll:unlock'),
  validate({ body: unlockPayrollPeriodSchema }),
  PayrollController.unlockPeriod,
);

export const payrollRoutes = router;
