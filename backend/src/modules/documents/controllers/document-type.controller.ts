import { Request, Response, NextFunction } from 'express';
import { DocumentType } from '../models/document-type.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';

export class DocumentTypeController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const types = await DocumentType.findAll({
        order: [['name', 'ASC']],
      });
      sendSuccess(req, res, types);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const docType = await DocumentType.findByPk(id);
      if (!docType) {
        throw AppError.notFound(`Document type ${id} not found`);
      }
      sendSuccess(req, res, docType);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        code,
        name,
        description,
        isMandatory,
        hasExpiry,
        expiryAlertDays,
        allowedMimeTypes,
        maxSizeBytes,
        isActive,
      } = req.body;

      const existing = await DocumentType.findOne({ where: { code } });
      if (existing) {
        throw AppError.conflict(`Document type with code "${code}" already exists`);
      }

      const docType = await DocumentType.create({
        code,
        name,
        description: description || null,
        isMandatory: isMandatory ?? false,
        hasExpiry: hasExpiry ?? false,
        expiryAlertDays: expiryAlertDays ?? 30,
        allowedMimeTypes: allowedMimeTypes || ['application/pdf', 'image/jpeg', 'image/png'],
        maxSizeBytes: maxSizeBytes ?? 10485760,
        isActive: isActive ?? true,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip,
        actorUserAgent: req.headers['user-agent'],
        action: 'DOCUMENT_TYPE_CREATED',
        resourceType: 'DocumentType',
        resourceId: docType.id,
        newValues: docType.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, docType, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const docType = await DocumentType.findByPk(id);
      if (!docType) {
        throw AppError.notFound(`Document type ${id} not found`);
      }

      const oldValues = docType.toJSON();
      await docType.update(req.body);

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip,
        actorUserAgent: req.headers['user-agent'],
        action: 'DOCUMENT_TYPE_UPDATED',
        resourceType: 'DocumentType',
        resourceId: docType.id,
        oldValues,
        newValues: docType.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, docType);
    } catch (err) {
      next(err);
    }
  }
}
