import { Request, Response, NextFunction } from 'express';
import { EmployeeHourlyRate } from '../models/employee-hourly-rate.model';
import { ClientBillingRate } from '../models/client-billing-rate.model';
import { Employee } from '../models/employee.model';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { BillingRateResolutionService } from '../services/billing-rate-resolution.service';
import { runInTransaction } from '../../../core/database/transactions';
import { AuditService } from '../../../core/audit/audit.service';

export class RateController {
  // 1. Employee Hourly Pay Rates (Labor Cost)
  public static async listEmployeeRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.employeeId) where.employeeId = String(req.query.employeeId);

      const rates = await EmployeeHourlyRate.findAll({
        where,
        include: [{ model: Employee, as: 'employee' }],
        order: [['effectiveFrom', 'DESC']],
      });
      sendSuccess(req, res, rates);
    } catch (err) {
      next(err);
    }
  }

  public static async createEmployeeRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, normalHourlyRate, otHourlyRate, effectiveFrom, effectiveTo, changeReason } = req.body;
      const emp = await Employee.findByPk(String(employeeId));
      if (!emp) throw AppError.badRequest(`Employee ${employeeId} not found`);

      const result = await runInTransaction(async (t) => {
        await EffectiveDateService.validateAndPrepareInterval(
          EmployeeHourlyRate,
          { employeeId },
          effectiveFrom,
          effectiveTo || null,
          true,
          t,
        );

        const rate = await EmployeeHourlyRate.create(
          {
            employeeId,
            normalHourlyRate,
            otHourlyRate,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
            changeReason: changeReason || null,
          },
          { transaction: t },
        );

        await AuditService.recordEvent({
          actorId: req.user?.id,
          actorIp: req.ip || req.socket.remoteAddress,
          actorUserAgent: req.headers['user-agent'],
          action: 'EMPLOYEE_HOURLY_RATE_CONFIGURED',
          resourceType: 'EmployeeHourlyRate',
          resourceId: rate.id,
          newValues: rate.toJSON(),
          correlationId: req.headers['x-correlation-id'] as string,
          transaction: t,
        });

        return rate;
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  // 2. Client Billing Rates (Commercial Invoicing Revenue)
  public static async listClientRates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.clientId) where.clientId = String(req.query.clientId);
      if (req.query.projectId) where.projectId = String(req.query.projectId);
      if (req.query.designationId) where.designationId = String(req.query.designationId);

      const rates = await ClientBillingRate.findAll({
        where,
        include: [
          { model: Client, as: 'client' },
          { model: Project, as: 'project' },
          { model: Designation, as: 'designation' },
        ],
        order: [['effectiveFrom', 'DESC']],
      });
      sendSuccess(req, res, rates);
    } catch (err) {
      next(err);
    }
  }

  public static async createClientRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clientId, projectId, designationId, normalBillingRate, otBillingRate, effectiveFrom, effectiveTo } =
        req.body;

      const [client, des] = await Promise.all([
        Client.findByPk(String(clientId)),
        Designation.findByPk(String(designationId)),
      ]);
      if (!client) throw AppError.badRequest(`Client ${clientId} not found`);
      if (!des) throw AppError.badRequest(`Designation ${designationId} not found`);

      if (projectId) {
        const project = await Project.findByPk(String(projectId));
        if (!project) throw AppError.badRequest(`Project ${projectId} not found`);
        if (project.clientId !== clientId) {
          throw AppError.badRequest(`Project ${projectId} does not belong to Client ${clientId}`);
        }
      }

      const filterCriteria = {
        clientId,
        projectId: projectId || null,
        designationId,
      };

      const result = await runInTransaction(async (t) => {
        await EffectiveDateService.validateAndPrepareInterval(
          ClientBillingRate,
          filterCriteria,
          effectiveFrom,
          effectiveTo || null,
          true,
          t,
        );

        const rate = await ClientBillingRate.create(
          {
            clientId,
            projectId: projectId || null,
            designationId,
            normalBillingRate,
            otBillingRate,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
          },
          { transaction: t },
        );

        await AuditService.recordEvent({
          actorId: req.user?.id,
          actorIp: req.ip || req.socket.remoteAddress,
          actorUserAgent: req.headers['user-agent'],
          action: 'CLIENT_BILLING_RATE_CONFIGURED',
          resourceType: 'ClientBillingRate',
          resourceId: rate.id,
          newValues: rate.toJSON(),
          correlationId: req.headers['x-correlation-id'] as string,
          transaction: t,
        });

        return rate;
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  // 3. Point-in-Time Resolution Service for Future Billing/Reports
  public static async resolveBillingRate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, workDate } = req.query;
      if (!employeeId || !workDate) {
        throw AppError.badRequest('Both employeeId and workDate query parameters are required');
      }

      const resolved = await BillingRateResolutionService.resolveBillingRate(
        String(employeeId),
        String(workDate),
      );
      sendSuccess(req, res, resolved);
    } catch (err) {
      next(err);
    }
  }
}
