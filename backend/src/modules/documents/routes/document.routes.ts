import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../../core/middleware/auth.middleware';
import { requirePermission } from '../../../core/middleware/rbac.middleware';
import { DocumentTypeController } from '../controllers/document-type.controller';
import { DocumentController } from '../controllers/document.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB ceiling
});

const router = Router();

// ==========================================
// Document Types
// ==========================================
router.get(
  '/document-types',
  authenticate,
  requirePermission('document_types:read'),
  DocumentTypeController.list,
);

router.get(
  '/document-types/:id',
  authenticate,
  requirePermission('document_types:read'),
  DocumentTypeController.getById,
);

router.post(
  '/document-types',
  authenticate,
  requirePermission('document_types:manage'),
  DocumentTypeController.create,
);

router.put(
  '/document-types/:id',
  authenticate,
  requirePermission('document_types:manage'),
  DocumentTypeController.update,
);

// ==========================================
// Documents
// ==========================================
// Stats
router.get(
  '/documents/stats',
  authenticate,
  requirePermission('documents:read'),
  DocumentController.stats,
);

// ESS My Documents
router.get(
  '/documents/my-documents',
  authenticate,
  requirePermission('documents:self_read'),
  DocumentController.myDocuments,
);

// Document download
router.get(
  '/documents/:id/download',
  authenticate,
  DocumentController.download,
);

// Get by ID
router.get(
  '/documents/:id',
  authenticate,
  DocumentController.getById,
);

// List with filters
router.get(
  '/documents',
  authenticate,
  DocumentController.list,
);

// Upload
router.post(
  '/documents',
  authenticate,
  upload.single('file'),
  DocumentController.upload,
);

// Verify or Reject
router.post(
  '/documents/:id/verify',
  authenticate,
  requirePermission('documents:verify'),
  DocumentController.verify,
);

export default router;
