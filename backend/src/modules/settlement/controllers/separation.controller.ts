import { Request, Response, NextFunction } from 'express';
import { SeparationService } from '../services/separation.service';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';

export class SeparationController {
  public static async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        employeeId,
        separationType,
        noticeDate,
        lastWorkingDay,
        contractualNoticeDays,
        actualNoticeDays,
        reason,
        repatriationRequired,
        destinationCountry,
        hasNewUaeEmployment,
        clearanceDetails,
      } = req.body;

      if (!employeeId || !separationType || !noticeDate || !lastWorkingDay) {
        throw AppError.badRequest(
          'employeeId, separationType, noticeDate, and lastWorkingDay are required',
        );
      }

      const separation = await SeparationService.initiateSeparation(
        {
          employeeId,
          separationType,
          noticeDate,
          lastWorkingDay,
          contractualNoticeDays,
          actualNoticeDays,
          reason,
          repatriationRequired,
          destinationCountry,
          hasNewUaeEmployment,
          clearanceDetails,
        },
        req.user?.id,
        req.ip,
        req.headers['user-agent'],
        req.headers['x-correlation-id'] as string,
      );

      sendSuccess(req, res, separation, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateClearance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { clearanceDetails, clearanceStatus, reason } = req.body;

      const updated = await SeparationService.updateClearance(
        id,
        { clearanceDetails, clearanceStatus, reason },
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

  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, employeeId } = req.query;
      const list = await SeparationService.listSeparations({
        status: status ? String(status) : undefined,
        employeeId: employeeId ? String(employeeId) : undefined,
      });

      sendSuccess(req, res, list);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const sep = await SeparationService.getById(id);
      sendSuccess(req, res, sep);
    } catch (err) {
      next(err);
    }
  }
}
