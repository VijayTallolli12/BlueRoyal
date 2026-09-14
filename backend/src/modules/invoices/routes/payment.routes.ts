import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { validate } from '../../../core/middleware/validate.middleware';
import { recordPaymentSchema, reversePaymentSchema } from '../validators/payment.validator';

export const paymentRouter = Router();
export const receivablesRouter = Router();

// ==========================================
// PAYMENT ROUTES (/api/v1/payments)
// ==========================================
paymentRouter.use(authenticate);

paymentRouter.post(
  '/',
  requirePermission('payments:create'),
  validate({ body: recordPaymentSchema }),
  PaymentController.recordPayment,
);

paymentRouter.get(
  '/',
  requirePermission('payments:read'),
  PaymentController.listPayments,
);

paymentRouter.get(
  '/invoices/:invoiceId/summary',
  requirePermission('payments:read'),
  PaymentController.getInvoicePaymentSummary,
);

paymentRouter.get(
  '/:id',
  requirePermission('payments:read'),
  PaymentController.getPayment,
);

paymentRouter.post(
  '/:id/reverse',
  requirePermission('payments:reverse'),
  validate({ body: reversePaymentSchema }),
  PaymentController.reversePayment,
);

// ==========================================
// RECEIVABLES ROUTES (/api/v1/receivables)
// ==========================================
receivablesRouter.use(authenticate);

receivablesRouter.get(
  '/',
  requirePermission('receivables:read'),
  PaymentController.listReceivables,
);

receivablesRouter.get(
  '/clients/:clientId/summary',
  requirePermission('receivables:read'),
  PaymentController.getClientFinancialSummary,
);
