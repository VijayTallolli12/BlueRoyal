import { Request, Response, NextFunction } from 'express';
import { PayrollPeriodService } from '../services/payroll-period.service';
import { AppError } from '../../../core/errors/app-error';
import { Employee } from '../../masters/models/employee.model';

export class PayrollController {
  public static async listPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const periods = await PayrollPeriodService.listPeriods();
      res.json({ success: true, data: periods });
    } catch (err) {
      next(err);
    }
  }

  public static async getPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = await PayrollPeriodService.getPeriodById(req.params.id as string);
      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const period = await PayrollPeriodService.createPeriod(req.body, actorId, actorIp, actorUserAgent);
      res.status(201).json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async calculatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const period = await PayrollPeriodService.calculatePeriod(req.params.id as string, actorId, actorIp, actorUserAgent);
      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async getPeriodItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, remunerationBasis, search } = req.query as {
        status?: string;
        remunerationBasis?: string;
        search?: string;
      };

      const items = await PayrollPeriodService.getPeriodItems(req.params.id as string, {
        status,
        remunerationBasis,
        search,
      });

      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  public static async getItemDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await PayrollPeriodService.getItemDetail(req.params.id as string, req.params.itemId as string);
      res.json({ success: true, data: detail });
    } catch (err) {
      next(err);
    }
  }

  public static async addAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const line = await PayrollPeriodService.addManualAdjustment(
        req.params.id as string,
        req.params.itemId as string,
        req.body,
        actorId,
        actorIp,
        actorUserAgent,
      );

      res.status(201).json({ success: true, data: line });
    } catch (err) {
      next(err);
    }
  }

  public static async deleteAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      await PayrollPeriodService.deleteManualAdjustment(
        req.params.id as string,
        req.params.itemId as string,
        req.params.lineId as string,
        actorId,
        actorIp,
        actorUserAgent,
      );

      res.json({ success: true, message: 'Adjustment successfully removed' });
    } catch (err) {
      next(err);
    }
  }

  public static async reviewPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const period = await PayrollPeriodService.reviewPeriod(req.params.id as string, actorId, actorIp, actorUserAgent);
      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async finalizePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const period = await PayrollPeriodService.finalizePeriod(req.params.id as string, actorId, actorIp, actorUserAgent);
      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async unlockPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = (req as any).user?.id;
      const actorIp = req.ip || req.socket.remoteAddress;
      const actorUserAgent = req.headers['user-agent'];

      const period = await PayrollPeriodService.unlockPeriod(
        req.params.id as string,
        req.body,
        actorId,
        actorIp,
        actorUserAgent,
      );

      res.json({ success: true, data: period });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const employee = await Employee.findOne({ where: { userId } });
      if (!employee) {
        throw AppError.notFound('No employee profile associated with authenticated user.');
      }

      const history = await PayrollPeriodService.getEmployeePayrollHistory(employee.id);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyPayslip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const employee = await Employee.findOne({ where: { userId } });
      if (!employee) {
        throw AppError.notFound('No employee profile associated with authenticated user.');
      }

      const payslip = await PayrollPeriodService.getEmployeePayslip(employee.id, req.params.periodId as string);
      res.json({ success: true, data: payslip });
    } catch (err) {
      next(err);
    }
  }
}
