import { Request, Response, NextFunction } from 'express';
import { Employee } from '../models/employee.model';
import { EmployeeAssignment } from '../models/employee-assignment.model';
import { Client } from '../models/client.model';
import { Project } from '../models/project.model';
import { Designation } from '../models/designation.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { EmployeeHourlyRate } from '../models/employee-hourly-rate.model';
import { EmployeeSalaryStructure } from '../models/salary-component.model';
import { SalaryComponent } from '../models/salary-component.model';
import { AuditService } from '../../../core/audit/audit.service';

export class EmployeeController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const employees = await Employee.findAll({
        order: [['createdAt', 'DESC']],
      });

      // Enrich with current active designation and assignment
      const enriched = await Promise.all(
        employees.map(async (emp) => {
          const currentAssignment = await EffectiveDateService.resolveAtDate(
            EmployeeAssignment,
            { employeeId: emp.id },
            today,
          );

          let currentDesignation = null;
          let assignmentSummary = null;

          if (currentAssignment) {
            const des = await Designation.findByPk(currentAssignment.designationId);
            const client = await Client.findByPk(currentAssignment.clientId);
            const project = await Project.findByPk(currentAssignment.projectId);

            if (des) {
              currentDesignation = {
                id: des.id,
                code: des.code,
                title: des.title,
              };
            }

            assignmentSummary = {
              id: currentAssignment.id,
              clientId: currentAssignment.clientId,
              projectId: currentAssignment.projectId,
              clientName: client?.name,
              projectName: project?.name,
              designationId: currentAssignment.designationId,
              designationTitle: des?.title,
              effectiveFrom: currentAssignment.effectiveFrom,
              effectiveTo: currentAssignment.effectiveTo,
            };
          }

          return {
            ...emp.toJSON(),
            currentDesignation,
            currentAssignment: assignmentSummary,
          };
        }),
      );

      sendSuccess(req, res, enriched);
    } catch (err) {
      next(err);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const today = new Date().toISOString().slice(0, 10);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }

      const currentAssignment = await EffectiveDateService.resolveAtDate(
        EmployeeAssignment,
        { employeeId: emp.id },
        today,
      );

      let currentDesignation = null;
      let assignmentSummary = null;

      if (currentAssignment) {
        const des = await Designation.findByPk(currentAssignment.designationId);
        const client = await Client.findByPk(currentAssignment.clientId);
        const project = await Project.findByPk(currentAssignment.projectId);

        if (des) {
          currentDesignation = {
            id: des.id,
            code: des.code,
            title: des.title,
          };
        }

        assignmentSummary = {
          id: currentAssignment.id,
          clientId: currentAssignment.clientId,
          projectId: currentAssignment.projectId,
          clientName: client?.name,
          projectName: project?.name,
          designationId: currentAssignment.designationId,
          designationTitle: des?.title,
          effectiveFrom: currentAssignment.effectiveFrom,
          effectiveTo: currentAssignment.effectiveTo,
        };
      }

      // Fetch active hourly rate and salary structure
      const currentHourlyRate = await EffectiveDateService.resolveAtDate(
        EmployeeHourlyRate,
        { employeeId: emp.id },
        today,
      );

      const salaryStructures = await EmployeeSalaryStructure.findAll({
        where: { employeeId: emp.id },
        include: [{ model: SalaryComponent, as: 'component' }],
        order: [['effectiveFrom', 'DESC']],
      });

      sendSuccess(req, res, {
        ...emp.toJSON(),
        currentDesignation,
        currentAssignment: assignmentSummary,
        currentHourlyRate,
        salaryStructures,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        employeeCode,
        userId,
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email,
        phoneNumber,
        dateOfJoining,
        probationEndDate,
        employmentType,
        contractEndDate,
        status,
      } = req.body;

      const finalEmploymentType = employmentType || 'full_time';
      if (finalEmploymentType === 'contract' && !contractEndDate) {
        throw AppError.badRequest('Contract end date is mandatory for contract employees');
      }

      const existing = await Employee.findOne({ where: { employeeCode } });
      if (existing) {
        throw AppError.conflict(`Employee code ${employeeCode} already exists`);
      }

      const emp = await Employee.create({
        employeeCode,
        userId: userId || null,
        firstName,
        middleName: middleName || null,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email: email || null,
        phoneNumber: phoneNumber || null,
        dateOfJoining,
        probationEndDate: probationEndDate || null,
        employmentType: finalEmploymentType,
        contractEndDate: contractEndDate || null,
        status: status || 'probation',
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_CREATED',
        resourceType: 'Employee',
        resourceId: emp.id,
        newValues: emp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, emp, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }

      const {
        userId,
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email,
        phoneNumber,
        dateOfJoining,
        probationEndDate,
        employmentType,
        contractEndDate,
        status,
      } = req.body;

      const finalEmploymentType = employmentType !== undefined ? employmentType : emp.employmentType;
      const finalContractEndDate = contractEndDate !== undefined ? contractEndDate : emp.contractEndDate;

      if (finalEmploymentType === 'contract' && !finalContractEndDate) {
        throw AppError.badRequest('Contract end date is mandatory for contract employees');
      }

      const oldValues = emp.toJSON();
      await emp.update({
        userId,
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        nationality,
        email,
        phoneNumber,
        dateOfJoining,
        probationEndDate,
        employmentType: finalEmploymentType,
        contractEndDate: finalContractEndDate,
        status,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_UPDATED',
        resourceType: 'Employee',
        resourceId: emp.id,
        oldValues,
        newValues: emp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, emp);
    } catch (err) {
      next(err);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const emp = await Employee.findByPk(id);
      if (!emp) {
        throw AppError.notFound(`Employee with ID ${id} not found`);
      }
      const oldValues = emp.toJSON();
      await emp.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'EMPLOYEE_DEACTIVATED',
        resourceType: 'Employee',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: 'Employee deactivated successfully' });
    } catch (err) {
      next(err);
    }
  }
}
