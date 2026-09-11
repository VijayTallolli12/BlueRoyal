import { Request, Response, NextFunction } from 'express';
import { EmployeeAssignment } from '../models/employee-assignment.model';
import { Employee } from '../models/employee.model';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { runInTransaction } from '../../../core/database/transactions';
import { AuditService } from '../../../core/audit/audit.service';

export class AssignmentController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
      if (req.query.clientId) where.clientId = String(req.query.clientId);
      if (req.query.projectId) where.projectId = String(req.query.projectId);

      const assignments = await EmployeeAssignment.findAll({
        where,
        include: [
          { model: Employee, as: 'employee' },
          { model: Client, as: 'client' },
          { model: Project, as: 'project' },
          { model: Designation, as: 'designation' },
        ],
        order: [['effectiveFrom', 'DESC']],
      });

      const mapped = assignments.map((a) => {
        const json = a.toJSON() as Record<string, unknown>;
        const emp = a.employee;
        const cli = a.client;
        const proj = a.project;
        const desig = a.designation;
        return {
          ...json,
          employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : null,
          employeeCode: emp?.employeeCode ?? null,
          clientName: cli?.name ?? null,
          projectName: proj?.name ?? null,
          designationTitle: desig?.title ?? null,
        };
      });

      sendSuccess(req, res, mapped);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await EmployeeAssignment.findByPk(id, {
        include: [
          { model: Employee, as: 'employee' },
          { model: Client, as: 'client' },
          { model: Project, as: 'project' },
          { model: Designation, as: 'designation' },
        ],
      });
      if (!item) {
        throw AppError.notFound(`Assignment ${id} not found`);
      }
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, clientId, projectId, designationId, effectiveFrom, effectiveTo, remarks } = req.body;

      // Validate references
      const [emp, client, project, des] = await Promise.all([
        Employee.findByPk(String(employeeId)),
        Client.findByPk(String(clientId)),
        Project.findByPk(String(projectId)),
        Designation.findByPk(String(designationId)),
      ]);

      if (!emp) throw AppError.badRequest(`Employee ${employeeId} does not exist`);
      if (!client) throw AppError.badRequest(`Client ${clientId} does not exist`);
      if (!project) throw AppError.badRequest(`Project ${projectId} does not exist`);
      if (!des) throw AppError.badRequest(`Designation ${designationId} does not exist`);

      if (project.clientId !== clientId) {
        throw AppError.badRequest(`Project ${projectId} does not belong to Client ${clientId}`);
      }

      const result = await runInTransaction(async (t) => {
        // Enforce non-overlapping assignment timeline, auto-closing previous assignment if ongoing
        await EffectiveDateService.validateAndPrepareInterval(
          EmployeeAssignment,
          { employeeId },
          effectiveFrom,
          effectiveTo || null,
          true,
          t,
        );

        const assignment = await EmployeeAssignment.create(
          {
            employeeId,
            clientId,
            projectId,
            designationId,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
            remarks: remarks || null,
          },
          { transaction: t },
        );

        await AuditService.recordEvent({
          actorId: req.user?.id,
          actorIp: req.ip || req.socket.remoteAddress,
          actorUserAgent: req.headers['user-agent'],
          action: 'ASSIGNMENT_CREATED',
          resourceType: 'EmployeeAssignment',
          resourceId: assignment.id,
          newValues: assignment.toJSON(),
          correlationId: req.headers['x-correlation-id'] as string,
          transaction: t,
        });

        return assignment;
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const item = await EmployeeAssignment.findByPk(id);
      if (!item) {
        throw AppError.notFound(`Assignment ${id} not found`);
      }
      const { effectiveTo, remarks } = req.body;
      if (effectiveTo && effectiveTo < item.effectiveFrom) {
        throw AppError.badRequest('effectiveTo cannot be earlier than effectiveFrom');
      }
      const oldValues = item.toJSON();
      await item.update({ effectiveTo, remarks });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'ASSIGNMENT_UPDATED',
        resourceType: 'EmployeeAssignment',
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
}
