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
        status,
      } = req.body;

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
        status: status || 'probation',
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
        status,
      } = req.body;

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
        status,
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
      await emp.destroy();
      sendSuccess(req, res, { message: 'Employee deactivated successfully' });
    } catch (err) {
      next(err);
    }
  }
}
