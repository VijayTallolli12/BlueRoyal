import { Request, Response, NextFunction } from 'express';
import { SettlementService } from '../services/settlement.service';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class SettlementController {
  public static async calculatePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { separationId, withholdGratuityArticle44, withholdReason, airTicketAllowanceOverride, notes } =
        req.body;

      if (!separationId) {
        throw AppError.badRequest('separationId is required');
      }

      const preview = await SettlementService.calculatePreview({
        separationId,
        withholdGratuityArticle44,
        withholdReason,
        airTicketAllowanceOverride,
        notes,
      });

      sendSuccess(req, res, preview);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { separationId, withholdGratuityArticle44, withholdReason, airTicketAllowanceOverride, notes } =
        req.body;

      if (!separationId) {
        throw AppError.badRequest('separationId is required');
      }

      const settlement = await SettlementService.createSettlement(
        {
          separationId,
          withholdGratuityArticle44,
          withholdReason,
          airTicketAllowanceOverride,
          notes,
        },
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );

      sendSuccess(req, res, settlement, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const settlement = await SettlementService.getSettlementById(id);
      sendSuccess(req, res, settlement);
    } catch (err) {
      next(err);
    }
  }

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, employeeId } = req.query;
      const settlements = await SettlementService.listSettlements({
        status: status ? String(status) : undefined,
        employeeId: employeeId ? String(employeeId) : undefined,
      });

      sendSuccess(req, res, settlements);
    } catch (err) {
      next(err);
    }
  }

  public static async addLine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settlementId = String(req.params.id);
      const { category, code, description, adjustmentType, quantity, rate, amount, calculationNotes } =
        req.body;

      if (!category || !code || !description || !adjustmentType || amount === undefined) {
        throw AppError.badRequest('category, code, description, adjustmentType, and amount are required');
      }

      const updated = await SettlementService.addLine(
        settlementId,
        { category, code, description, adjustmentType, quantity, rate, amount, calculationNotes },
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );

      sendSuccess(req, res, updated, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async removeLine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settlementId = String(req.params.id);
      const lineId = String(req.params.lineId);

      const updated = await SettlementService.removeLine(
        settlementId,
        lineId,
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

  public static async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await SettlementService.reviewSettlement(
        id,
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

  public static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await SettlementService.approveSettlement(
        id,
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

  public static async finalize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await SettlementService.finalizeSettlement(
        id,
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

  public static async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;

      const updated = await SettlementService.unlockSettlement(
        id,
        { reason },
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

  public static async mySettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw AppError.unauthorized('User not authenticated');
      }

      const settlement = await SettlementService.getMySettlement(req.user.id);
      sendSuccess(req, res, settlement);
    } catch (err) {
      next(err);
    }
  }

  public static async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await SettlementService.getStats();
      sendSuccess(req, res, stats);
    } catch (err) {
      next(err);
    }
  }
}
