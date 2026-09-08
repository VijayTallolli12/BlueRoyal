import { Op } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { PayrollPeriod } from '../models/payroll-period.model';
import { PayrollItem } from '../models/payroll-item.model';
import { PayrollItemLine } from '../models/payroll-item-line.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { Employee } from '../../masters/models/employee.model';
import { Designation } from '../../masters/models/designation.model';
import { SalaryComponent } from '../../masters/models/salary-component.model';
import { User } from '../../auth/models/user.model';
import { PayrollCalculationService } from './payroll-calculation.service';
import {
  CreatePayrollPeriodDto,
  AddPayrollAdjustmentDto,
  UnlockPayrollPeriodDto,
  EmployeePayslipDto,
} from '@blue-royal/contracts';

export class PayrollPeriodService {
  /**
   * List all payroll periods with status and summary metrics.
   */
  public static async listPeriods(): Promise<PayrollPeriod[]> {
    return PayrollPeriod.findAll({
      order: [['startDate', 'DESC']],
      include: [
        { model: AttendancePeriod, as: 'attendancePeriod', attributes: ['id', 'periodCode', 'status'] },
        { model: User, as: 'calculatedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'reviewedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'finalizedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });
  }

  /**
   * Get single period by ID with all relations.
   */
  public static async getPeriodById(id: string): Promise<PayrollPeriod> {
    const period = await PayrollPeriod.findByPk(id, {
      include: [
        { model: AttendancePeriod, as: 'attendancePeriod' },
        { model: User, as: 'calculatedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'reviewedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: User, as: 'finalizedByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });
    if (!period) {
      throw AppError.notFound(`Payroll period with ID ${id} not found`);
    }
    return period;
  }

  /**
   * Create a new payroll period in DRAFT status linked to a LOCKED attendance period.
   */
  public static async createPeriod(
    dto: CreatePayrollPeriodDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollPeriod> {
    const attendancePeriod = await AttendancePeriod.findByPk(dto.attendancePeriodId);
    if (!attendancePeriod) {
      throw AppError.notFound(`Attendance period with ID ${dto.attendancePeriodId} not found`);
    }

    if (attendancePeriod.status !== 'locked') {
      throw AppError.badRequest(
        `Cannot create payroll period. Linked attendance period ${attendancePeriod.periodCode} is in status '${attendancePeriod.status}'. Attendance must be strictly LOCKED before payroll creation.`,
      );
    }

    const periodCode = dto.periodCode || attendancePeriod.periodCode;
    const name = dto.name || `${attendancePeriod.name} Payroll`;
    const startDate = dto.startDate || attendancePeriod.startDate;
    const endDate = dto.endDate || attendancePeriod.endDate;

    // Check unique constraints
    const existingCode = await PayrollPeriod.findOne({ where: { periodCode } });
    if (existingCode) {
      throw AppError.conflict(`Payroll period code '${periodCode}' already exists.`);
    }

    const existingAtt = await PayrollPeriod.findOne({ where: { attendancePeriodId: dto.attendancePeriodId } });
    if (existingAtt) {
      throw AppError.conflict(`Attendance period '${attendancePeriod.periodCode}' has already been linked to a payroll period.`);
    }

    return sequelize.transaction(async (t) => {
      const period = await PayrollPeriod.create(
        {
          periodCode,
          name,
          startDate,
          endDate,
          attendancePeriodId: dto.attendancePeriodId,
          status: 'draft',
          totalGrossPay: 0,
          totalDeductions: 0,
          totalNetPay: 0,
          employeeCount: 0,
          blockingIssuesCount: 0,
        },
        { transaction: t },
      );

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYROLL_PERIOD_CREATED',
        resourceType: 'PayrollPeriod',
        resourceId: period.id,
        newValues: {
          periodCode: period.periodCode,
          name: period.name,
          attendancePeriodId: period.attendancePeriodId,
          status: period.status,
        },
        transaction: t,
      });

      return period;
    });
  }

  /**
   * Run or recalculate the payroll calculation engine for the period.
   */
  public static async calculatePeriod(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollPeriod> {
    const period = await PayrollCalculationService.calculatePeriod(id, actorId);

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'PAYROLL_CALCULATED',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      newValues: {
        status: period.status,
        totalGrossPay: period.totalGrossPay,
        totalDeductions: period.totalDeductions,
        totalNetPay: period.totalNetPay,
        employeeCount: period.employeeCount,
        blockingIssuesCount: period.blockingIssuesCount,
      },
    });

    return period;
  }

  /**
   * Get employee payroll items for a period.
   */
  public static async getPeriodItems(
    periodId: string,
    filter?: { status?: string; remunerationBasis?: string; search?: string },
  ): Promise<PayrollItem[]> {
    const whereClause: any = { payrollPeriodId: periodId };

    if (filter?.status === 'blocked') {
      whereClause.hasBlockingIssue = true;
    } else if (filter?.status === 'valid') {
      whereClause.hasBlockingIssue = false;
    }

    if (filter?.remunerationBasis) {
      whereClause.remunerationBasis = filter.remunerationBasis;
    }

    const employeeWhere: any = {};
    if (filter?.search) {
      const s = `%${filter.search}%`;
      employeeWhere[Op.or] = [
        { employeeCode: { [Op.iLike]: s } },
        { firstName: { [Op.iLike]: s } },
        { lastName: { [Op.iLike]: s } },
      ];
    }

    return PayrollItem.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'employee',
          where: Object.keys(employeeWhere).length > 0 ? employeeWhere : undefined,
          attributes: ['id', 'employeeCode', 'firstName', 'lastName', 'remunerationBasis'],
        },
        { model: Designation, as: 'designation', attributes: ['id', 'code', 'title'] },
      ],
      order: [
        ['hasBlockingIssue', 'DESC'],
        [{ model: Employee, as: 'employee' }, 'employeeCode', 'ASC'],
      ],
    });
  }

  /**
   * Get detailed employee payroll item with all lines.
   */
  public static async getItemDetail(periodId: string, itemId: string): Promise<any> {
    const item = await PayrollItem.findOne({
      where: { id: itemId, payrollPeriodId: periodId },
      include: [
        { model: Employee, as: 'employee' },
        { model: Designation, as: 'designation' },
        {
          model: PayrollItemLine,
          as: 'lines',
          include: [
            { model: SalaryComponent, as: 'salaryComponent' },
            { model: User, as: 'createdByUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
          ],
        },
      ],
      order: [
        [{ model: PayrollItemLine, as: 'lines' }, 'isManual', 'ASC'],
        [{ model: PayrollItemLine, as: 'lines' }, 'workDate', 'ASC'],
        [{ model: PayrollItemLine, as: 'lines' }, 'createdAt', 'ASC'],
      ],
    });

    if (!item) {
      throw AppError.notFound(`Payroll item with ID ${itemId} in period ${periodId} not found`);
    }

    return item;
  }

  /**
   * Add manual payroll adjustment (addition or deduction).
   */
  public static async addManualAdjustment(
    periodId: string,
    itemId: string,
    dto: AddPayrollAdjustmentDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollItemLine> {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw AppError.notFound(`Payroll period ${periodId} not found`);

    if (period.status === 'finalized') {
      throw AppError.badRequest('Cannot add manual adjustments to a finalized payroll period. Finalized records are permanently immutable.');
    }

    const item = await PayrollItem.findOne({
      where: { id: itemId, payrollPeriodId: periodId },
    });
    if (!item) throw AppError.notFound(`Payroll item ${itemId} not found`);

    if (dto.amount <= 0) {
      throw AppError.badRequest('Adjustment amount must be strictly greater than 0.');
    }

    if (!dto.description || dto.description.trim().length < 5) {
      throw AppError.badRequest('Adjustment description must be at least 5 characters long detailing the business justification.');
    }

    return sequelize.transaction(async (t) => {
      const line = await PayrollItemLine.create(
        {
          payrollItemId: item.id,
          category: 'adjustment',
          isManual: true,
          adjustmentType: dto.adjustmentType,
          code: 'MANUAL_ADJUSTMENT',
          description: dto.description.trim(),
          amount: PayrollCalculationService.round2(dto.amount),
          createdBy: actorId || null,
        },
        { transaction: t },
      );

      // Update employee item totals
      if (dto.adjustmentType === 'addition') {
        item.grossPay = PayrollCalculationService.round2(item.grossPay + line.amount);
      } else {
        item.totalDeductions = PayrollCalculationService.round2(item.totalDeductions + line.amount);
      }
      item.netPay = PayrollCalculationService.round2(item.grossPay - item.totalDeductions);
      await item.save({ transaction: t });

      // Update period totals
      if (dto.adjustmentType === 'addition') {
        period.totalGrossPay = PayrollCalculationService.round2(period.totalGrossPay + line.amount);
      } else {
        period.totalDeductions = PayrollCalculationService.round2(period.totalDeductions + line.amount);
      }
      period.totalNetPay = PayrollCalculationService.round2(period.totalGrossPay - period.totalDeductions);
      await period.save({ transaction: t });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYROLL_ADJUSTMENT_CREATED',
        resourceType: 'PayrollItemLine',
        resourceId: line.id,
        newValues: {
          payrollPeriodId: period.id,
          employeeId: item.employeeId,
          adjustmentType: line.adjustmentType,
          amount: line.amount,
          description: line.description,
        },
        transaction: t,
      });

      return line;
    });
  }

  /**
   * Delete manual adjustment line prior to finalization.
   */
  public static async deleteManualAdjustment(
    periodId: string,
    itemId: string,
    lineId: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<void> {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period) throw AppError.notFound(`Payroll period ${periodId} not found`);

    if (period.status === 'finalized') {
      throw AppError.badRequest('Cannot delete manual adjustments from a finalized payroll period.');
    }

    const item = await PayrollItem.findOne({
      where: { id: itemId, payrollPeriodId: periodId },
    });
    if (!item) throw AppError.notFound(`Payroll item ${itemId} not found`);

    const line = await PayrollItemLine.findOne({
      where: { id: lineId, payrollItemId: item.id, isManual: true },
    });
    if (!line) throw AppError.notFound(`Manual adjustment line ${lineId} not found`);

    await sequelize.transaction(async (t) => {
      const adjAmount = Number(line.amount);
      const adjType = line.adjustmentType;

      await line.destroy({ transaction: t });

      // Re-sum employee item
      if (adjType === 'addition') {
        item.grossPay = PayrollCalculationService.round2(item.grossPay - adjAmount);
      } else {
        item.totalDeductions = PayrollCalculationService.round2(item.totalDeductions - adjAmount);
      }
      item.netPay = PayrollCalculationService.round2(item.grossPay - item.totalDeductions);
      await item.save({ transaction: t });

      // Re-sum period totals
      if (adjType === 'addition') {
        period.totalGrossPay = PayrollCalculationService.round2(period.totalGrossPay - adjAmount);
      } else {
        period.totalDeductions = PayrollCalculationService.round2(period.totalDeductions - adjAmount);
      }
      period.totalNetPay = PayrollCalculationService.round2(period.totalGrossPay - period.totalDeductions);
      await period.save({ transaction: t });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'PAYROLL_ADJUSTMENT_DELETED',
        resourceType: 'PayrollItemLine',
        resourceId: lineId,
        oldValues: {
          payrollPeriodId: period.id,
          employeeId: item.employeeId,
          adjustmentType: adjType,
          amount: adjAmount,
          description: line.description,
        },
        transaction: t,
      });
    });
  }

  /**
   * Mark calculated period as reviewed.
   */
  public static async reviewPeriod(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollPeriod> {
    const period = await PayrollPeriod.findByPk(id);
    if (!period) throw AppError.notFound(`Payroll period ${id} not found`);

    if (period.status !== 'calculated') {
      throw AppError.badRequest(`Cannot review payroll period with status '${period.status}'. Period must be in 'calculated' status.`);
    }

    if (period.blockingIssuesCount > 0) {
      throw AppError.badRequest(
        `Cannot review payroll period. There are ${period.blockingIssuesCount} unresolved blocking issues. Resolve all issues before review.`,
      );
    }

    await period.update({
      status: 'reviewed',
      reviewedBy: actorId || null,
      reviewedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'PAYROLL_REVIEWED',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      newValues: { status: 'reviewed', reviewedBy: actorId },
    });

    return period;
  }

  /**
   * Finalize and permanently lock payroll period.
   */
  public static async finalizePeriod(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollPeriod> {
    const period = await PayrollPeriod.findByPk(id);
    if (!period) throw AppError.notFound(`Payroll period ${id} not found`);

    if (period.status !== 'reviewed') {
      throw AppError.badRequest(`Cannot finalize payroll period with status '${period.status}'. Period must be in 'reviewed' status.`);
    }

    if (period.blockingIssuesCount > 0) {
      throw AppError.badRequest(`Cannot finalize payroll period with unresolved blocking issues.`);
    }

    await period.update({
      status: 'finalized',
      finalizedBy: actorId || null,
      finalizedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'PAYROLL_FINALIZED',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      newValues: {
        status: 'finalized',
        totalNetPay: period.totalNetPay,
        employeeCount: period.employeeCount,
        finalizedBy: actorId,
      },
    });

    return period;
  }

  /**
   * Super Admin controlled unlock with audit reason.
   */
  public static async unlockPeriod(
    id: string,
    dto: UnlockPayrollPeriodDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<PayrollPeriod> {
    const period = await PayrollPeriod.findByPk(id);
    if (!period) throw AppError.notFound(`Payroll period ${id} not found`);

    if (period.status !== 'finalized') {
      throw AppError.badRequest(`Cannot unlock payroll period with status '${period.status}'. Only 'finalized' periods can be unlocked.`);
    }

    if (!dto.reason || dto.reason.trim().length < 15) {
      throw AppError.badRequest('Unlock reason must be at least 15 characters long detailing the audit justification.');
    }

    await period.update({
      status: 'draft',
      finalizedAt: null,
      finalizedBy: null,
      unlockReason: dto.reason.trim(),
      unlockedBy: actorId || null,
      unlockedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'PAYROLL_UNLOCKED',
      resourceType: 'PayrollPeriod',
      resourceId: period.id,
      newValues: {
        status: 'draft',
        unlockReason: dto.reason.trim(),
        unlockedBy: actorId,
      },
    });

    return period;
  }

  /**
   * Employee Self-Service: List finalized payroll runs for authenticated employee.
   */
  public static async getEmployeePayrollHistory(employeeId: string): Promise<any[]> {
    const items = await PayrollItem.findAll({
      where: { employeeId },
      include: [
        {
          model: PayrollPeriod,
          as: 'payrollPeriod',
          where: { status: 'finalized' },
          attributes: ['id', 'periodCode', 'name', 'startDate', 'endDate', 'status', 'finalizedAt'],
        },
      ],
      order: [[{ model: PayrollPeriod, as: 'payrollPeriod' }, 'startDate', 'DESC']],
    });

    return items;
  }

  /**
   * Employee Self-Service: Get detailed payslip for authenticated employee.
   */
  public static async getEmployeePayslip(employeeId: string, periodId: string): Promise<EmployeePayslipDto> {
    const period = await PayrollPeriod.findByPk(periodId);
    if (!period || period.status !== 'finalized') {
      throw AppError.notFound('Payslip not found or payroll period is not finalized.');
    }

    const item = await PayrollItem.findOne({
      where: { employeeId, payrollPeriodId: periodId },
      include: [
        { model: Employee, as: 'employee' },
        { model: Designation, as: 'designation' },
        {
          model: PayrollItemLine,
          as: 'lines',
          include: [{ model: SalaryComponent, as: 'salaryComponent' }],
        },
      ],
    });

    if (!item) {
      throw AppError.notFound('Payroll record not found for this period.');
    }

    const lines = ((item as any).lines as PayrollItemLine[]) || [];
    const earnings = lines.filter((l: PayrollItemLine) => l.category === 'earning');
    const deductions = lines.filter((l: PayrollItemLine) => l.category === 'deduction');
    const adjustments = lines.filter((l: PayrollItemLine) => l.category === 'adjustment');

    return {
      period: {
        id: period.id,
        periodCode: period.periodCode,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
      },
      employee: {
        id: item.employee!.id,
        employeeCode: item.employee!.employeeCode,
        name: `${item.employee!.firstName} ${item.employee!.lastName}`,
        designation: item.designation?.title || null,
        remunerationBasis: item.remunerationBasis,
      },
      attendanceSummary: {
        daysWorked: item.daysInPeriod - item.totalAbsenceDays,
        regularHours: Number(item.totalRegularHours),
        otHours: Number(item.totalOtHours),
        absenceDays: item.totalAbsenceDays,
        leaveDays: Number(item.totalLeaveDays),
      },
      earnings: earnings.map((e: PayrollItemLine) => ({
        id: e.id,
        payrollItemId: e.payrollItemId,
        category: e.category,
        isManual: e.isManual,
        code: e.code,
        description: e.description,
        rate: e.rate,
        quantity: e.quantity,
        amount: Number(e.amount),
        salaryComponentId: e.salaryComponentId,
        workDate: e.workDate,
        createdAt: e.createdAt.toISOString(),
      })),
      deductions: deductions.map((d: PayrollItemLine) => ({
        id: d.id,
        payrollItemId: d.payrollItemId,
        category: d.category,
        isManual: d.isManual,
        code: d.code,
        description: d.description,
        rate: d.rate,
        quantity: d.quantity,
        amount: Number(d.amount),
        salaryComponentId: d.salaryComponentId,
        workDate: d.workDate,
        createdAt: d.createdAt.toISOString(),
      })),
      adjustments: adjustments.map((a: PayrollItemLine) => ({
        id: a.id,
        payrollItemId: a.payrollItemId,
        category: a.category,
        isManual: a.isManual,
        adjustmentType: a.adjustmentType,
        code: a.code,
        description: a.description,
        rate: a.rate,
        quantity: a.quantity,
        amount: Number(a.amount),
        createdAt: a.createdAt.toISOString(),
      })),
      grossPay: Number(item.grossPay),
      totalDeductions: Number(item.totalDeductions),
      netPay: Number(item.netPay),
    };
  }
}
