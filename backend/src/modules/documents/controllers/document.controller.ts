import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { Employee } from '../../masters/models/employee.model';
import { ExpiryStatus, DocumentVerificationStatus } from '@blue-royal/contracts';

export class DocumentController {
  /**
   * Upload a new document
   */
  public static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw AppError.badRequest('File is required for upload');
      }

      const { employeeId, documentTypeId, documentNumber, issueDate, expiryDate, notes } = req.body;

      if (!employeeId || !documentTypeId) {
        throw AppError.badRequest('employeeId and documentTypeId are required');
      }

      // Check self upload permission if not super_admin or hr_admin
      const isSuperOrHr = req.user?.roles.some((r) => ['super_admin', 'hr_admin'].includes(r));
      if (!isSuperOrHr) {
        const emp = await Employee.findOne({ where: { userId: req.user?.id } });
        if (!emp || emp.id !== employeeId) {
          throw AppError.forbidden('You can only upload documents for yourself');
        }
      }

      const document = await DocumentService.uploadDocument({
        employeeId,
        documentTypeId,
        documentNumber,
        issueDate,
        expiryDate,
        file: req.file,
        notes,
        actorId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, document, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * List documents with filters
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, documentTypeId, verificationStatus, expiryStatus } = req.query;

      const filter: any = {};
      if (employeeId) filter.employeeId = String(employeeId);
      if (documentTypeId) filter.documentTypeId = String(documentTypeId);
      if (verificationStatus) filter.verificationStatus = verificationStatus as DocumentVerificationStatus;
      if (expiryStatus) filter.expiryStatus = expiryStatus as ExpiryStatus;

      // Self read enforcement for regular employees
      const isSuperOrHr = req.user?.roles.some((r) => ['super_admin', 'hr_admin'].includes(r));
      if (!isSuperOrHr) {
        const emp = await Employee.findOne({ where: { userId: req.user?.id } });
        if (!emp) {
          sendSuccess(req, res, []);
          return;
        }
        filter.employeeId = emp.id;
      }

      const docs = await DocumentService.listDocuments(filter);
      sendSuccess(req, res, docs);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get employee's own documents (ESS Portal)
   */
  public static async myDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const emp = await Employee.findOne({ where: { userId: req.user?.id } });
      if (!emp) {
        sendSuccess(req, res, []);
        return;
      }

      const docs = await DocumentService.listDocuments({ employeeId: emp.id });
      sendSuccess(req, res, docs);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get document by ID
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const doc = await DocumentService.getDocumentById(id);

      const isSuperOrHr = req.user?.roles.some((r) => ['super_admin', 'hr_admin'].includes(r));
      if (!isSuperOrHr) {
        const emp = await Employee.findOne({ where: { userId: req.user?.id } });
        if (!emp || emp.id !== doc.employeeId) {
          throw AppError.forbidden('You can only view your own documents');
        }
      }

      sendSuccess(req, res, doc);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify or reject a document
   */
  public static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { status, remarks } = req.body;

      if (!status || !['verified', 'rejected'].includes(status)) {
        throw AppError.badRequest('status must be either "verified" or "rejected"');
      }

      const updated = await DocumentService.verifyDocument(
        id,
        status,
        remarks,
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );

      sendSuccess(req, res, updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get document statistics
   */
  public static async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DocumentService.getDocumentStats();
      sendSuccess(req, res, stats);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download physical file
   */
  public static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const fileInfo = await DocumentService.getDownloadInfo(id);

      const isSuperOrHr = req.user?.roles.some((r) => ['super_admin', 'hr_admin'].includes(r));
      if (!isSuperOrHr) {
        const emp = await Employee.findOne({ where: { userId: req.user?.id } });
        if (!emp || emp.id !== fileInfo.employeeId) {
          throw AppError.forbidden('You can only download your own documents');
        }
      }

      res.setHeader('Content-Type', fileInfo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalFileName)}"`);
      res.sendFile(fileInfo.absolutePath);
    } catch (err) {
      next(err);
    }
  }
}
