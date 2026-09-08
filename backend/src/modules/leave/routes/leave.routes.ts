import { Router } from 'express';
import { LeaveController } from '../controllers/leave.controller';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// ==========================================
// Employee Self-Service Routes (/leave/my-leave)
// ==========================================
router.get(
  '/my-leave',
  requirePermission('leave:self_read'),
  LeaveController.getMyLeaveOverview,
);

router.post(
  '/my-leave',
  requirePermission('leave:self_create'),
  LeaveController.submitMyLeave,
);

router.post(
  '/my-leave/:id/cancel',
  requirePermission('leave:self_cancel'),
  LeaveController.cancelMyLeave,
);

// ==========================================
// Leave Types Catalog
// ==========================================
router.get(
  '/types',
  requirePermission('leave_types:read'),
  LeaveController.listTypes,
);

router.post(
  '/types',
  requirePermission('leave_types:create'),
  LeaveController.createType,
);

router.put(
  '/types/:id',
  requirePermission('leave_types:update'),
  LeaveController.updateType,
);

router.delete(
  '/types/:id',
  requirePermission('leave_types:delete'),
  LeaveController.deleteType,
);

// ==========================================
// Employee Leave Balances
// ==========================================
router.get(
  '/balances',
  requirePermission('leave_balances:read'),
  LeaveController.listBalances,
);

router.post(
  '/balances/allocate',
  requirePermission('leave_balances:manage'),
  LeaveController.allocateBalance,
);

// ==========================================
// Administrative Leave Requests
// ==========================================
router.get(
  '/requests',
  requirePermission('leave:read'),
  LeaveController.listRequests,
);

router.get(
  '/requests/:id',
  requirePermission('leave:read'),
  LeaveController.getRequestById,
);

router.post(
  '/requests',
  requirePermission('leave:create'),
  LeaveController.createRequest,
);

router.post(
  '/requests/:id/approve',
  requirePermission('leave:approve'),
  LeaveController.approveRequest,
);

router.post(
  '/requests/:id/reject',
  requirePermission('leave:reject'),
  LeaveController.rejectRequest,
);

router.post(
  '/requests/:id/cancel',
  requirePermission('leave:cancel'),
  LeaveController.cancelRequest,
);

export default router;
