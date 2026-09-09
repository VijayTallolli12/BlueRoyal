import { FinalSettlement } from '../models/final-settlement.model';
import { SettlementItemLine } from '../models/settlement-item-line.model';
import { EmployeeSeparation } from '../models/employee-separation.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';
import { SettlementCalculationService } from './settlement-calculation.service';
import { AuditService } from '../../../core/audit/audit.service';
import { AppError } from '../../../core/errors/app-error';
import { round2 } from '../../../core/utils/math.util';
import {
  FinalSettlementDto,
  SettlementItemLineDto,
  CalculateSettlementDto,
  AddSettlementLineDto,
  UnlockSettlementDto,
  SettlementStatsDto,
} from '@blue-royal/contracts';
import { Op } from 'sequelize';

export class SettlementService {
  /**
   * Convert FinalSettlement model to DTO
   */
  public static toDto(settlement: FinalSettlement): FinalSettlementDto {
    const json = settlement.toJSON() as any;
    const emp = settlement.employee || json.employee;
    const rawLines = settlement.lines || json.lines || [];

    const lines: SettlementItemLineDto[] = rawLines.map((l: any) => ({
      id: l.id,
      settlementId: l.settlementId || l.settlement_id,
      category: l.category,
      code: l.code,
      description: l.description,
      isManual: Boolean(l.isManual !== undefined ? l.isManual : l.is_manual),
      adjustmentType: l.adjustmentType || l.adjustment_type,
      quantity: l.quantity !== null && l.quantity !== undefined ? Number(l.quantity) : null,
      rate: l.rate !== null && l.rate !== undefined ? Number(l.rate) : null,
      amount: Number(l.amount || 0),
      calculationNotes: l.calculationNotes || l.calculation_notes || null,
      createdBy: l.createdBy || l.created_by || null,
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : undefined,
    }));

    return {
      id: json.id,
      settlementCode: json.settlementCode,
      separationId: json.separationId,
      employeeId: json.employeeId,
      employeeCode: emp?.employeeCode,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : undefined,
      department: emp?.department,
      designationTitle: emp?.designation?.title,
      serviceStartDate: json.serviceStartDate,
      lastWorkingDay: json.lastWorkingDay,
      totalServiceCalendarDays: Number(json.totalServiceCalendarDays || 0),
      unpaidLeaveDays: Number(json.unpaidLeaveDays || 0),
      netServiceDays: Number(json.netServiceDays || 0),
      serviceYears: Number(json.serviceYears || 0),
      remunerationBasis: json.remunerationBasis,
      lastBasicSalary: Number(json.lastBasicSalary || 0),
      dailyBasicWage: Number(json.dailyBasicWage || 0),
      dailyGrossWage: json.dailyGrossWage !== null && json.dailyGrossWage !== undefined ? Number(json.dailyGrossWage) : undefined,
      gratuityAmount: Number(json.gratuityAmount || 0),
      gratuityWithheld: Boolean(json.gratuityWithheld),
      gratuityWithholdReason: json.gratuityWithholdReason,
      leaveBalanceDays: Number(json.leaveBalanceDays || 0),
      leaveSalaryAmount: Number(json.leaveSalaryAmount || 0),
      airTicketAmount: Number(json.airTicketAmount || 0),
      finalWagesAmount: Number(json.finalWagesAmount || 0),
      noticeShortfallAmount: Number(json.noticeShortfallAmount || 0),
      grossAdditions: Number(json.grossAdditions || 0),
      totalDeductions: Number(json.totalDeductions || 0),
      netSettlementAmount: Number(json.netSettlementAmount || 0),
      status: json.status,
      reviewedBy: json.reviewedBy,
      reviewedAt: json.reviewedAt ? new Date(json.reviewedAt).toISOString() : null,
      approvedBy: json.approvedBy,
      approvedAt: json.approvedAt ? new Date(json.approvedAt).toISOString() : null,
      finalizedBy: json.finalizedBy,
      finalizedAt: json.finalizedAt ? new Date(json.finalizedAt).toISOString() : null,
      notes: json.notes,
      lines,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Preview settlement calculation without saving
   */
  public static async calculatePreview(dto: CalculateSettlementDto) {
    return SettlementCalculationService.calculateFullSettlement(dto);
  }

  /**
   * Create Draft Settlement Voucher
   */
  public static async createSettlement(
    dto: CalculateSettlementDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const existing = await FinalSettlement.findOne({
      where: { separationId: dto.separationId },
    });

    if (existing) {
      throw AppError.conflict(
        'A settlement voucher already exists for this separation. Please view or update the existing draft.',
      );
    }

    const calc = await SettlementCalculationService.calculateFullSettlement(dto);

    // Generate settlement code: SET-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await FinalSettlement.count();
    const sequence = String(count + 1).padStart(4, '0');
    const settlementCode = `SET-${currentYear}-${sequence}`;

    const settlement = await FinalSettlement.create({
      settlementCode,
      separationId: dto.separationId,
      employeeId: calc.employeeId,
      serviceStartDate: calc.serviceStartDate,
      lastWorkingDay: calc.lastWorkingDay,
      totalServiceCalendarDays: calc.totalServiceCalendarDays,
      unpaidLeaveDays: calc.unpaidLeaveDays,
      netServiceDays: calc.netServiceDays,
      serviceYears: calc.serviceYears,
      remunerationBasis: calc.remunerationBasis,
      lastBasicSalary: calc.lastBasicSalary,
      dailyBasicWage: calc.dailyBasicWage,
      dailyGrossWage: calc.dailyGrossWage,
      gratuityAmount: calc.gratuityAmount,
      gratuityWithheld: calc.gratuityWithheld,
      gratuityWithholdReason: calc.gratuityWithholdReason || null,
      leaveBalanceDays: calc.leaveBalanceDays,
      leaveSalaryAmount: calc.leaveSalaryAmount,
      airTicketAmount: calc.airTicketAmount,
      finalWagesAmount: calc.finalWagesAmount,
      noticeShortfallAmount: calc.noticeShortfallAmount,
      grossAdditions: calc.grossAdditions,
      totalDeductions: calc.totalDeductions,
      netSettlementAmount: calc.netSettlementAmount,
      status: 'draft',
      notes: dto.notes || null,
    });

    // Create itemized lines
    for (const l of calc.lines) {
      await SettlementItemLine.create({
        settlementId: settlement.id,
        category: l.category,
        code: l.code,
        description: l.description,
        isManual: l.isManual,
        adjustmentType: l.adjustmentType,
        quantity: l.quantity || null,
        rate: l.rate || null,
        amount: l.amount,
        calculationNotes: l.calculationNotes || null,
        createdBy: actorId || null,
      });
    }

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_CREATED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      newValues: settlement.toJSON(),
      correlationId,
    });

    return this.getSettlementById(settlement.id);
  }

  /**
   * Get Settlement by ID
   */
  public static async getSettlementById(id: string): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(id, {
      include: [
        { model: Employee, as: 'employee' },
        { model: SettlementItemLine, as: 'lines' },
      ],
    });
    if (!settlement) {
      throw AppError.notFound(`Settlement ${id} not found`);
    }
    return this.toDto(settlement);
  }

  /**
   * List Settlements
   */
  public static async listSettlements(filter: {
    status?: string;
    employeeId?: string;
  }): Promise<FinalSettlementDto[]> {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.employeeId) where.employeeId = filter.employeeId;

    const list = await FinalSettlement.findAll({
      where,
      include: [
        { model: Employee, as: 'employee' },
        { model: SettlementItemLine, as: 'lines' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return list.map((s) => this.toDto(s));
  }

  /**
   * Add Manual Adjustment Line (earning or deduction)
   * Enforces BR-07: strictly blocks visa/recruitment clawback & enforces 50% non-statutory deduction limit.
   */
  public static async addLine(
    settlementId: string,
    dto: AddSettlementLineDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(settlementId, {
      include: [{ model: SettlementItemLine, as: 'lines' }],
    });
    if (!settlement) {
      throw AppError.notFound(`Settlement ${settlementId} not found`);
    }

    if (settlement.status === 'finalized') {
      throw AppError.badRequest('Cannot add adjustments to a finalized settlement voucher');
    }

    // BR-07 Validation: Block visa/recruitment clawback
    SettlementCalculationService.validateAdjustmentLine(dto);

    // BR-07: Enforce 50% deduction limit on non-statutory deductions
    if (dto.adjustmentType === 'deduction') {
      const currentGross = Number(settlement.grossAdditions || 0);
      const currentDeductions = Number(settlement.totalDeductions || 0);
      const proposedDeductions = currentDeductions + Number(dto.amount);
      const maxAllowedDeductions = round2(currentGross * 0.5);

      if (proposedDeductions > maxAllowedDeductions && maxAllowedDeductions > 0) {
        throw AppError.badRequest(
          `Total deductions (AED ${proposedDeductions.toFixed(2)}) would exceed the statutory 50% ceiling (AED ${maxAllowedDeductions.toFixed(2)}) of gross settlement additions (BR-07)`,
        );
      }
    }

    const newLine = await SettlementItemLine.create({
      settlementId,
      category: dto.category,
      code: dto.code,
      description: dto.description,
      isManual: true,
      adjustmentType: dto.adjustmentType,
      quantity: dto.quantity || null,
      rate: dto.rate || null,
      amount: round2(dto.amount),
      calculationNotes: dto.calculationNotes || 'Manual line adjustment',
      createdBy: actorId || null,
    });

    // Recompute totals
    const allLines = await SettlementItemLine.findAll({ where: { settlementId } });
    let grossAdditions = 0.0;
    let totalDeductions = 0.0;

    for (const l of allLines) {
      if (l.adjustmentType === 'addition') {
        grossAdditions += Number(l.amount);
      } else {
        totalDeductions += Number(l.amount);
      }
    }

    grossAdditions = round2(grossAdditions);
    totalDeductions = round2(totalDeductions);
    const netSettlementAmount = round2(Math.max(0, grossAdditions - totalDeductions));

    await settlement.update({
      grossAdditions,
      totalDeductions,
      netSettlementAmount,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_ADJUSTMENT_ADDED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      newValues: newLine.toJSON(),
      correlationId,
    });

    return this.getSettlementById(settlementId);
  }

  /**
   * Remove Manual Adjustment Line
   */
  public static async removeLine(
    settlementId: string,
    lineId: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(settlementId);
    if (!settlement) {
      throw AppError.notFound(`Settlement ${settlementId} not found`);
    }

    if (settlement.status === 'finalized') {
      throw AppError.badRequest('Cannot remove adjustments from a finalized settlement voucher');
    }

    const line = await SettlementItemLine.findOne({
      where: { id: lineId, settlementId },
    });
    if (!line) {
      throw AppError.notFound(`Adjustment line ${lineId} not found on settlement ${settlementId}`);
    }

    const oldValues = line.toJSON();
    await line.destroy();

    // Recompute totals
    const allLines = await SettlementItemLine.findAll({ where: { settlementId } });
    let grossAdditions = 0.0;
    let totalDeductions = 0.0;

    for (const l of allLines) {
      if (l.adjustmentType === 'addition') {
        grossAdditions += Number(l.amount);
      } else {
        totalDeductions += Number(l.amount);
      }
    }

    grossAdditions = round2(grossAdditions);
    totalDeductions = round2(totalDeductions);
    const netSettlementAmount = round2(Math.max(0, grossAdditions - totalDeductions));

    await settlement.update({
      grossAdditions,
      totalDeductions,
      netSettlementAmount,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_ADJUSTMENT_REMOVED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      oldValues,
      correlationId,
    });

    return this.getSettlementById(settlementId);
  }

  /**
   * Submit for Internal Review (draft -> in_review)
   */
  public static async reviewSettlement(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(id);
    if (!settlement) {
      throw AppError.notFound(`Settlement ${id} not found`);
    }

    if (settlement.status !== 'draft') {
      throw AppError.badRequest(`Cannot submit settlement in ${settlement.status} status for review`);
    }

    await settlement.update({
      status: 'in_review',
      reviewedBy: actorId || null,
      reviewedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_REVIEWED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      newValues: settlement.toJSON(),
      correlationId,
    });

    return this.getSettlementById(id);
  }

  /**
   * Approve Settlement Voucher (in_review -> approved)
   */
  public static async approveSettlement(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(id);
    if (!settlement) {
      throw AppError.notFound(`Settlement ${id} not found`);
    }

    if (settlement.status !== 'in_review' && settlement.status !== 'draft') {
      throw AppError.badRequest(`Cannot approve settlement in ${settlement.status} status`);
    }

    await settlement.update({
      status: 'approved',
      approvedBy: actorId || null,
      approvedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_APPROVED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      newValues: settlement.toJSON(),
      correlationId,
    });

    return this.getSettlementById(id);
  }

  /**
   * Finalize & Freeze Settlement Voucher
   * - Locks calculations permanently
   * - Transitions employee status to 'terminated'
   * - Deactivates user portal login (isActive: false)
   * - Closes active employee assignments (effectiveTo = lastWorkingDay)
   * - Sets separation status to 'settled'
   */
  public static async finalizeSettlement(
    id: string,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    const settlement = await FinalSettlement.findByPk(id, {
      include: [
        { model: Employee, as: 'employee' },
        { model: EmployeeSeparation, as: 'separation' },
      ],
    });
    if (!settlement) {
      throw AppError.notFound(`Settlement ${id} not found`);
    }

    if (settlement.status === 'finalized') {
      throw AppError.badRequest('Settlement is already finalized and locked');
    }

    const employee = settlement.employee;
    const separation = settlement.separation;

    // 1. Finalize settlement voucher
    await settlement.update({
      status: 'finalized',
      finalizedBy: actorId || null,
      finalizedAt: new Date(),
    });

    // 2. Transition Separation status to settled
    if (separation) {
      await separation.update({ status: 'settled' });
    }

    // 3. Transition Employee status to terminated
    if (employee) {
      await employee.update({ status: 'terminated' });

      // 4. Deactivate User Account
      if (employee.userId) {
        const user = await User.findByPk(employee.userId);
        if (user) {
          await user.update({ isActive: false });
        }
      }

      // 5. Close active project assignments
      await EmployeeAssignment.update(
        { effectiveTo: settlement.lastWorkingDay },
        {
          where: {
            employeeId: employee.id,
            [Op.or]: [{ effectiveTo: null }, { effectiveTo: { [Op.gt]: settlement.lastWorkingDay } }],
          },
        },
      );
    }

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_FINALIZED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      newValues: settlement.toJSON(),
      correlationId,
    });

    return this.getSettlementById(id);
  }

  /**
   * Super Admin Exclusive: Unlock Finalized Settlement Voucher
   * Requires mandatory justification (>= 15 chars)
   */
  public static async unlockSettlement(
    id: string,
    dto: UnlockSettlementDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<FinalSettlementDto> {
    if (!dto.reason || dto.reason.trim().length < 15) {
      throw AppError.badRequest(
        'A detailed justification reason of at least 15 characters is mandatory to unlock a finalized settlement voucher.',
      );
    }

    const settlement = await FinalSettlement.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!settlement) {
      throw AppError.notFound(`Settlement ${id} not found`);
    }

    if (settlement.status !== 'finalized') {
      throw AppError.badRequest(`Cannot unlock settlement that is in ${settlement.status} status`);
    }

    const oldValues = settlement.toJSON();

    await settlement.update({
      status: 'draft',
      notes: settlement.notes
        ? `${settlement.notes}\n[UNLOCKED by ${actorId}: ${dto.reason}]`
        : `[UNLOCKED by ${actorId}: ${dto.reason}]`,
    });

    // Reactivate employee and user if previously terminated
    if (settlement.employee) {
      await settlement.employee.update({ status: 'active' });
      if (settlement.employee.userId) {
        const user = await User.findByPk(settlement.employee.userId);
        if (user) {
          await user.update({ isActive: true });
        }
      }
    }

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SETTLEMENT_UNLOCKED',
      resourceType: 'FinalSettlement',
      resourceId: settlement.id,
      oldValues,
      newValues: { status: 'draft', reason: dto.reason },
      correlationId,
    });

    return this.getSettlementById(id);
  }

  /**
   * Employee Self-Service: Get own finalized settlement statement
   */
  public static async getMySettlement(userId: string): Promise<FinalSettlementDto | null> {
    const emp = await Employee.findOne({ where: { userId } });
    if (!emp) {
      throw AppError.notFound('Employee profile not linked to active user');
    }

    const settlement = await FinalSettlement.findOne({
      where: { employeeId: emp.id, status: 'finalized' },
      include: [
        { model: Employee, as: 'employee' },
        { model: SettlementItemLine, as: 'lines' },
      ],
      order: [['createdAt', 'DESC']],
    });

    if (!settlement) return null;
    return this.toDto(settlement);
  }

  /**
   * High-level metrics for Settlements Hub
   */
  public static async getStats(): Promise<SettlementStatsDto> {
    const pendingSeparations = await EmployeeSeparation.count({
      where: { status: ['pending', 'cleared'] },
    });

    const settlementsInReview = await FinalSettlement.count({
      where: { status: ['draft', 'in_review', 'approved'] },
    });

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const finalizedThisMonthSettlements = await FinalSettlement.findAll({
      where: {
        status: 'finalized',
        finalizedAt: { [Op.gte]: firstOfMonth },
      },
    });

    const finalizedThisMonth = finalizedThisMonthSettlements.length;
    let totalSettledAmountThisMonth = 0;
    for (const s of finalizedThisMonthSettlements) {
      totalSettledAmountThisMonth += Number(s.netSettlementAmount || 0);
    }

    return {
      pendingSeparations,
      settlementsInReview,
      finalizedThisMonth,
      totalSettledAmountThisMonth: round2(totalSettledAmountThisMonth),
    };
  }
}
