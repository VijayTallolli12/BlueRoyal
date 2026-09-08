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
      sendSuccess(req, res, assignments);
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

        return EmployeeAssignment.create(
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
      await item.update({ effectiveTo, remarks });
      sendSuccess(req, res, item);
    } catch (err) {
      next(err);
    }
  }
}
