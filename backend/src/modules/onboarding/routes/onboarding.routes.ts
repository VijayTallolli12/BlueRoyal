import { Router } from 'express';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { OnboardingController } from '../controllers/onboarding.controller';

const router = Router();

router.get(
  '/onboarding',
  authenticate,
  requirePermission('onboarding:read'),
  OnboardingController.list,
);

router.get(
  '/onboarding/employee/:employeeId',
  authenticate,
  requirePermission('onboarding:read'),
  OnboardingController.getByEmployeeId,
);

router.get(
  '/onboarding/:id',
  authenticate,
  requirePermission('onboarding:read'),
  OnboardingController.getById,
);

router.post(
  '/onboarding',
  authenticate,
  requirePermission('onboarding:create'),
  OnboardingController.start,
);

router.post(
  '/onboarding/:id/refresh',
  authenticate,
  requirePermission('onboarding:update'),
  OnboardingController.refreshReadiness,
);

router.put(
  '/onboarding/:id',
  authenticate,
  requirePermission('onboarding:update'),
  OnboardingController.updateProgress,
);

router.post(
  '/onboarding/:id/complete',
  authenticate,
  requirePermission('onboarding:complete'),
  OnboardingController.complete,
);

export default router;
