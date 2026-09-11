import { Request, Response, NextFunction } from 'express';
import { SalaryComponent, EmployeeSalaryStructure } from '../models/salary-component.model';
import { Employee } from '../models/employee.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { runInTransaction } from '../../../core/database/transactions';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrollItemLine } from '../../payroll/models/payroll-item-line.model';

export class SalaryController {
  // 1. Salary Component Masters
  public static async listComponents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const components = await SalaryComponent.findAll({
        include: [{ model: SalaryComponent, as: 'percentageBasisComponent' }],
        order: [['name', 'ASC']],
      });
      sendSuccess(req, res, components);
    } catch (err) {
      next(err);
    }
  }

  public static async createComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        code,
        name,
        type,
        calculationType,
        percentageBasisComponentId,
        isRecurring,
        isWpsBasic,
        isWpsHousing,
        isActive,
      } = req.body;

      if (!code || !name || !type || !calculationType) {
        throw AppError.badRequest('Code, Component Name, Type, and Calculation Type are required');
      }

      const cleanCode = String(code).trim().toUpperCase();
      const existing = await SalaryComponent.findOne({ where: { code: cleanCode } });
      if (existing) throw AppError.conflict(`Salary component code ${cleanCode} already exists`);

      if (percentageBasisComponentId) {
        const basis = await SalaryComponent.findByPk(String(percentageBasisComponentId));
        if (!basis) throw AppError.badRequest('Referenced percentage basis component not found');
      }

      const comp = await SalaryComponent.create({
        code: cleanCode,
        name: String(name).trim(),
        type,
        calculationType,
        percentageBasisComponentId: calculationType === 'percentage' ? (percentageBasisComponentId || null) : null,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : true,
        isWpsBasic: isWpsBasic ? Boolean(isWpsBasic) : false,
        isWpsHousing: isWpsHousing ? Boolean(isWpsHousing) : false,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'SALARY_COMPONENT_CREATED',
        resourceType: 'SalaryComponent',
        resourceId: comp.id,
        newValues: comp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      const createdWithIncludes = await SalaryComponent.findByPk(comp.id, {
        include: [{ model: SalaryComponent, as: 'percentageBasisComponent' }],
      });

      sendSuccess(req, res, createdWithIncludes || comp, 201);
    } catch (err) {
      next(err);
    }
  }

  public static async updateComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const comp = await SalaryComponent.findByPk(id);
      if (!comp) {
        throw AppError.notFound(`Salary component with ID ${id} not found`);
      }

      const {
        code,
        name,
        type,
        calculationType,
        percentageBasisComponentId,
        isRecurring,
        isWpsBasic,
        isWpsHousing,
        isActive,
      } = req.body;

      if (code) {
        const cleanCode = String(code).trim().toUpperCase();
        if (cleanCode !== comp.code) {
          const existing = await SalaryComponent.findOne({ where: { code: cleanCode } });
          if (existing && existing.id !== comp.id) {
            throw AppError.conflict(`Salary component code ${cleanCode} already exists`);
          }
        }
      }

      if (percentageBasisComponentId) {
        if (percentageBasisComponentId === id) {
          throw AppError.badRequest('A component cannot reference itself as a percentage basis');
        }
        const basis = await SalaryComponent.findByPk(String(percentageBasisComponentId));
        if (!basis) {
          throw AppError.badRequest('Referenced percentage basis component not found');
        }
      }

      const oldValues = comp.toJSON();
      await comp.update({
        code: code !== undefined ? String(code).trim().toUpperCase() : comp.code,
        name: name !== undefined ? String(name).trim() : comp.name,
        type: type !== undefined ? type : comp.type,
        calculationType: calculationType !== undefined ? calculationType : comp.calculationType,
        percentageBasisComponentId:
          calculationType === 'fixed_amount'
            ? null
            : percentageBasisComponentId !== undefined
              ? (percentageBasisComponentId || null)
              : comp.percentageBasisComponentId,
        isRecurring: isRecurring !== undefined ? Boolean(isRecurring) : comp.isRecurring,
        isWpsBasic: isWpsBasic !== undefined ? Boolean(isWpsBasic) : comp.isWpsBasic,
        isWpsHousing: isWpsHousing !== undefined ? Boolean(isWpsHousing) : comp.isWpsHousing,
        isActive: isActive !== undefined ? Boolean(isActive) : comp.isActive,
      });

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'SALARY_COMPONENT_UPDATED',
        resourceType: 'SalaryComponent',
        resourceId: comp.id,
        oldValues,
        newValues: comp.toJSON(),
        correlationId: req.headers['x-correlation-id'] as string,
      });

      const updated = await SalaryComponent.findByPk(comp.id, {
        include: [{ model: SalaryComponent, as: 'percentageBasisComponent' }],
      });

      sendSuccess(req, res, updated);
    } catch (err) {
      next(err);
    }
  }

  public static async deleteComponent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const comp = await SalaryComponent.findByPk(id);
      if (!comp) {
        throw AppError.notFound(`Salary component with ID ${id} not found`);
      }

      // 1. Check if assigned to employee salary structures
      const structureCount = await EmployeeSalaryStructure.count({ where: { componentId: id } });
      if (structureCount > 0) {
        throw AppError.conflict(
          `Cannot delete salary package "${comp.name}" (${comp.code}) because it is currently assigned to ${structureCount} employee structure(s). Deactivate it instead.`
        );
      }

      // 2. Check if referenced in historical payroll lines
      const payrollCount = await PayrollItemLine.count({ where: { salaryComponentId: id } });
      if (payrollCount > 0) {
        throw AppError.conflict(
          `Cannot delete salary package "${comp.name}" (${comp.code}) because it is referenced in ${payrollCount} payroll calculation record(s). Deactivate it instead.`
        );
      }

      // 3. Check if used as a percentage basis by another component
      const basisCount = await SalaryComponent.count({ where: { percentageBasisComponentId: id } });
      if (basisCount > 0) {
        throw AppError.conflict(
          `Cannot delete salary package "${comp.name}" (${comp.code}) because it is used as the calculation basis for ${basisCount} other component(s).`
        );
      }

      const oldValues = comp.toJSON();
      await comp.destroy();

      await AuditService.recordEvent({
        actorId: req.user?.id,
        actorIp: req.ip || req.socket.remoteAddress,
        actorUserAgent: req.headers['user-agent'],
        action: 'SALARY_COMPONENT_DELETED',
        resourceType: 'SalaryComponent',
        resourceId: id,
        oldValues,
        correlationId: req.headers['x-correlation-id'] as string,
      });

      sendSuccess(req, res, { message: `Salary package "${comp.name}" deleted successfully.` });
    } catch (err) {
      next(err);
    }
  }

  // 2. Employee Monthly Salary Packages (Effective-Dated)
  public static async listStructures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.employeeId) where.employeeId = String(req.query.employeeId);

      const structures = await EmployeeSalaryStructure.findAll({
        where,
        include: [
          { model: Employee, as: 'employee' },
          { model: SalaryComponent, as: 'component' },
        ],
        order: [['effectiveFrom', 'DESC']],
      });
      sendSuccess(req, res, structures);
    } catch (err) {
      next(err);
    }
  }

  public static async createStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId, componentId, amountOrPercentage, effectiveFrom, effectiveTo } = req.body;
      const [emp, comp] = await Promise.all([
        Employee.findByPk(String(employeeId)),
        SalaryComponent.findByPk(String(componentId)),
      ]);
      if (!emp) throw AppError.badRequest(`Employee ${employeeId} not found`);
      if (!comp) throw AppError.badRequest(`Salary component ${componentId} not found`);

      const result = await runInTransaction(async (t) => {
        await EffectiveDateService.validateAndPrepareInterval(
          EmployeeSalaryStructure,
          { employeeId, componentId },
          effectiveFrom,
          effectiveTo || null,
          true,
          t,
        );

        const struct = await EmployeeSalaryStructure.create(
          {
            employeeId,
            componentId,
            amountOrPercentage,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
          },
          { transaction: t },
        );

        await AuditService.recordEvent({
          actorId: req.user?.id,
          actorIp: req.ip || req.socket.remoteAddress,
          actorUserAgent: req.headers['user-agent'],
          action: 'SALARY_STRUCTURE_CONFIGURED',
          resourceType: 'EmployeeSalaryStructure',
          resourceId: struct.id,
          newValues: struct.toJSON(),
          correlationId: req.headers['x-correlation-id'] as string,
          transaction: t,
        });

        return struct;
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}
