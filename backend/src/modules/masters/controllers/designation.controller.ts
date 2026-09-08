import { Request, Response, NextFunction } from 'express';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';

export class DesignationController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const designations = await Designation.findAll({
        order: [['title', 'ASC']],
      });
      sendSuccess(req, res, designations);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, title, description, isActive } = req.body;
      const existing = await Designation.findOne({ where: { code } });
      if (existing) {
        throw AppError.conflict(`Designation code ${code} already exists`);
      }
      const item = await Designation.create({
        code,
        title,
        description,
        isActive: isActive !== undefined ? isActive : true,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'DESIGNATION_CREATED',
        resourceType: 'Designation',
        resourceId: item.id,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, item, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      const { code, title, description, isActive } = req.body;
      if (code && code !== item.code) {
        const existing = await Designation.findOne({ where: { code } });
        if (existing) {
          throw AppError.conflict(`Designation code ${code} already exists`);
        }
      }
      const oldValues = item.toJSON();
      await item.update({ code, title, description, isActive });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'DESIGNATION_UPDATED',
        resourceType: 'Designation',
        resourceId: item.id,
        oldValues,
        newValues: item.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await Designation.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Designation with ID ${id} not found`);
      }
      const oldValues = item.toJSON();
      await item.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'DESIGNATION_DELETED',
        resourceType: 'Designation',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: 'Designation deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
