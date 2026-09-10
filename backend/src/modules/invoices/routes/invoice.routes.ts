import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { validate } from '../../../core/middleware/validate.middleware';
import { generateInvoiceSchema } from '../validators/invoice.validator';

const router = Router();

// Require authentication for all invoice routes
router.use(authenticate);

router.get('/', requirePermission('invoices:read'), InvoiceController.listInvoices);
router.get('/:id', requirePermission('invoices:read'), InvoiceController.getInvoice);

router.post(
  '/preview',
  requirePermission('invoices:create'),
  validate({ body: generateInvoiceSchema }),
  InvoiceController.previewInvoice,
);

router.post(
  '/generate',
  requirePermission('invoices:create'),
  validate({ body: generateInvoiceSchema }),
  InvoiceController.generateInvoice,
);

router.post(
  '/:id/issue',
  requirePermission('invoices:issue'),
  InvoiceController.issueInvoice,
);

export default router;
