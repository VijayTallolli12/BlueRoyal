import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission, requireAnyPermission } from '../../../core/middleware/rbac.middleware';
import { AttendanceController } from '../controllers/attendance.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = Router();

// Employee self-attendance
router.get(
  '/my-attendance',
  authenticate,
  requirePermission('attendance:self_read'),
  AttendanceController.getMyAttendance,
);

// Attendance Periods
router.get(
  '/periods',
  authenticate,
  requireAnyPermission('attendance:read', 'attendance:self_read'),
  AttendanceController.listPeriods,
);

router.post(
  '/periods',
  authenticate,
  requirePermission('attendance:create'),
  AttendanceController.createPeriod,
);

router.get(
  '/periods/:id',
  authenticate,
  requirePermission('attendance:read'),
  AttendanceController.getPeriodById,
);

router.get(
  '/periods/:id/grid',
  authenticate,
  requirePermission('attendance:read'),
  AttendanceController.getGrid,
);

router.put(
  '/periods/:id/records',
  authenticate,
  requirePermission('attendance:create'),
  AttendanceController.batchUpdate,
);

// Lifecycle transitions
router.post(
  '/periods/:id/submit',
  authenticate,
  requirePermission('attendance:submit'),
  AttendanceController.submitPeriod,
);

router.post(
  '/periods/:id/approve',
  authenticate,
  requirePermission('attendance:approve'),
  AttendanceController.approvePeriod,
);

router.post(
  '/periods/:id/lock',
  authenticate,
  requirePermission('attendance:lock'),
  AttendanceController.lockPeriod,
);

router.post(
  '/periods/:id/unlock',
  authenticate,
  requirePermission('attendance:unlock'),
  AttendanceController.unlockPeriod,
);

// Excel Template & Import
router.get(
  '/periods/:id/template',
  authenticate,
  requirePermission('attendance:read'),
  AttendanceController.downloadTemplate,
);

router.post(
  '/periods/:id/import',
  authenticate,
  requirePermission('attendance:import'),
  upload.single('file'),
  AttendanceController.importExcel,
);

// Cell-level audit logs
router.get(
  '/records/:recordId/audit',
  authenticate,
  requirePermission('attendance:read'),
  AttendanceController.getRecordAuditLogs,
);

export default router;
