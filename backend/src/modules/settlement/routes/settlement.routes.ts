import { Router } from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { SeparationController } from '../controllers/separation.controller';
import { SettlementController } from '../controllers/settlement.controller';
import { AirTicketPolicyController } from '../controllers/air-ticket-policy.controller';

const router = Router();

// ==========================================
// Air Ticket Policies
// ==========================================
router.get(
  '/air-ticket-policies',
  authenticate,
  requirePermission('air_ticket_policies:read'),
  AirTicketPolicyController.list,
);

router.post(
  '/air-ticket-policies',
  authenticate,
  requirePermission('air_ticket_policies:manage'),
  AirTicketPolicyController.create,
);

router.put(
  '/air-ticket-policies/:id',
  authenticate,
  requirePermission('air_ticket_policies:manage'),
  AirTicketPolicyController.update,
);

// ==========================================
// Employee Separations
// ==========================================
router.get(
  '/separations',
  authenticate,
  requirePermission('separations:read'),
  SeparationController.list,
);

router.get(
  '/separations/:id',
  authenticate,
  requirePermission('separations:read'),
  SeparationController.getById,
);

router.post(
  '/separations',
  authenticate,
  requirePermission('separations:create'),
  SeparationController.initiate,
);

router.put(
  '/separations/:id/clearance',
  authenticate,
  requirePermission('separations:update'),
  SeparationController.updateClearance,
);

// ==========================================
// Final Settlements
// ==========================================
// High-level Stats
router.get(
  '/settlements/stats',
  authenticate,
  requirePermission('settlements:read'),
  SettlementController.stats,
);

// Employee Self-Service (ESS)
router.get(
  '/settlements/my-settlement',
  authenticate,
  requirePermission('settlements:self_read'),
  SettlementController.mySettlement,
);

// Real-time Preview Calculation
router.post(
  '/settlements/calculate',
  authenticate,
  requirePermission('settlements:create'),
  SettlementController.calculatePreview,
);

// Create Draft Settlement
router.post(
  '/settlements',
  authenticate,
  requirePermission('settlements:create'),
  SettlementController.create,
);

// List Settlements
router.get(
  '/settlements',
  authenticate,
  requirePermission('settlements:read'),
  SettlementController.list,
);

// Get Settlement Voucher by ID
router.get(
  '/settlements/:id',
  authenticate,
  requirePermission('settlements:read'),
  SettlementController.getById,
);

// Add Manual Adjustment Line
router.post(
  '/settlements/:id/lines',
  authenticate,
  requirePermission('settlements:update'),
  SettlementController.addLine,
);

// Remove Manual Adjustment Line
router.delete(
  '/settlements/:id/lines/:lineId',
  authenticate,
  requirePermission('settlements:update'),
  SettlementController.removeLine,
);

// Review
router.post(
  '/settlements/:id/review',
  authenticate,
  requirePermission('settlements:review'),
  SettlementController.review,
);

// Approve
router.post(
  '/settlements/:id/approve',
  authenticate,
  requirePermission('settlements:approve'),
  SettlementController.approve,
);

// Finalize
router.post(
  '/settlements/:id/finalize',
  authenticate,
  requirePermission('settlements:finalize'),
  SettlementController.finalize,
);

// Unlock (Super Admin Only)
router.post(
  '/settlements/:id/unlock',
  authenticate,
  requirePermission('settlements:unlock'),
  SettlementController.unlock,
);

export default router;
