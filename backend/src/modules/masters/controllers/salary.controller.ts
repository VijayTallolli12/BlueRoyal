import { Request, Response, NextFunction } from 'express';
import { SalaryComponent, EmployeeSalaryStructure } from '../models/salary-component.model';
import { Employee } from '../models/employee.model';
import { sendSuccess } from '../../../core/utils/response.util';
import { AppError } from '../../../core/errors/app-error';
import { EffectiveDateService } from '../../../core/services/effective-date.service';
import { runInTransaction } from '../../../core/database/transactions';

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

      const existing = await SalaryComponent.findOne({ where: { code } });
      if (existing) throw AppError.conflict(`Salary component ${code} already exists`);

      if (percentageBasisComponentId) {
        const basis = await SalaryComponent.findByPk(String(percentageBasisComponentId));
        if (!basis) throw AppError.badRequest('Referenced percentage basis component not found');
      }

      const comp = await SalaryComponent.create({
        code,
        name,
        type,
        calculationType,
        percentageBasisComponentId: percentageBasisComponentId || null,
        isRecurring: isRecurring !== undefined ? isRecurring : true,
        isWpsBasic: isWpsBasic || false,
        isWpsHousing: isWpsHousing || false,
        isActive: isActive !== undefined ? isActive : true,
      });
      sendSuccess(req, res, comp, 201);
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

        return EmployeeSalaryStructure.create(
          {
            employeeId,
            componentId,
            amountOrPercentage,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
          },
          { transaction: t },
        );
      });

      sendSuccess(req, res, result, 201);
    } catch (err) {
      next(err);
    }
  }
}
