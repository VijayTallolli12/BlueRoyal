import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { AttendancePeriodService } from '../services/attendance-period.service';
import { AttendanceImportService } from '../services/attendance-import.service';
import {
  createPeriodSchema,
  batchUpdateSchema,
  unlockPeriodSchema,
  getGridQuerySchema,
} from '../validators/attendance.validator';

export class AttendanceController {
  public static async listPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periods = await AttendancePeriodService.listPeriods();
      sendSuccess(req, res, periods);
    } catch (err) {
      next(err);
    }
  }

  public static async getPeriodById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const period = await AttendancePeriodService.getPeriodById(id);
      sendSuccess(req, res, period);
    } catch (err) {
      next(err);
    }
  }

  public static async createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createPeriodSchema.parse(req.body);
      const actorId = req.user?.id;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const period = await AttendancePeriodService.createPeriod(parsed, actorId, ip, userAgent);
      sendSuccess(req, res, period, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async getGrid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const query = getGridQuerySchema.parse(req.query);

      const gridData = await AttendancePeriodService.getGrid(periodId, {
        clientId: query.clientId,
        projectId: query.projectId,
        employeeId: query.employeeId,
        hasAnomaly: query.hasAnomaly,
      });

      sendSuccess(req, res, gridData);
    } catch (err) {
      next(err);
    }
  }

  public static async batchUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const parsed = batchUpdateSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AttendancePeriodService.batchUpdateRecords(
        periodId,
        parsed,
        actorId,
        ip,
        userAgent,
      );

      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }

  public static async submitPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const period = await AttendancePeriodService.submitPeriod(periodId, actorId, ip, userAgent);
      sendSuccess(req, res, period);
    } catch (err) {
      next(err);
    }
  }

  public static async approvePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const period = await AttendancePeriodService.approvePeriod(periodId, actorId, ip, userAgent);
      sendSuccess(req, res, period);
    } catch (err) {
      next(err);
    }
  }

  public static async lockPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const period = await AttendancePeriodService.lockPeriod(periodId, actorId, ip, userAgent);
      sendSuccess(req, res, period);
    } catch (err) {
      next(err);
    }
  }

  public static async unlockPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const parsed = unlockPeriodSchema.parse(req.body);
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const period = await AttendancePeriodService.unlockPeriod(
        periodId,
        parsed.reason,
        actorId,
        ip,
        userAgent,
      );
      sendSuccess(req, res, period);
    } catch (err) {
      next(err);
    }
  }

  public static async getRecordAuditLogs(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const recordId = String(req.params.recordId);
      const logs = await AttendancePeriodService.getRecordAuditLogs(recordId);
      sendSuccess(req, res, logs);
    } catch (err) {
      next(err);
    }
  }

  public static async downloadTemplate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const periodId = String(req.params.id);
      const buffer = await AttendanceImportService.generateTemplate(periodId);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-template-${periodId}.xlsx"`,
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  public static async importExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periodId = String(req.params.id);
      if (!req.file) {
        throw AppError.badRequest('Please upload an Excel (.xlsx or .xls) file');
      }

      const dryRun = req.query.dryRun === 'true' || req.body.dryRun === 'true' || req.body.dryRun === true;
      const actorId = req.user?.id;
      if (!actorId) throw AppError.unauthorized('User identity not resolved');

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AttendanceImportService.processImport(
        periodId,
        req.file.buffer,
        dryRun,
        actorId,
        ip,
        userAgent,
      );

      sendSuccess(req, res, result);
    } catch (err) {
      next(err);
    }
  }

  public static async getMyAttendance(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) throw AppError.unauthorized('User identity not resolved');

      const periodCode = req.query.periodCode ? String(req.query.periodCode) : undefined;
      const data = await AttendancePeriodService.getEmployeeSelfAttendance(userId, periodCode);

      sendSuccess(req, res, data);
    } catch (err) {
      next(err);
    }
  }
}
