import { EmployeeSeparation } from '../models/employee-separation.model';
import { Employee } from '../../masters/models/employee.model';
import { FinalSettlement } from '../models/final-settlement.model';
import { AuditService } from '../../../core/audit/audit.service';
import { AppError } from '../../../core/errors/app-error';
import {
  EmployeeSeparationDto,
  InitiateSeparationDto,
  UpdateClearanceDto,
  ClearanceDetails,
  ClearanceStatus,
} from '@blue-royal/contracts';

export class SeparationService {
  /**
   * Convert model to DTO
   */
  public static toDto(sep: EmployeeSeparation): EmployeeSeparationDto {
    const json = sep.toJSON() as any;
    const emp = sep.employee || json.employee;
    const settlement = (sep as any).settlement || json.settlement;
    const noticeShortfallDays = Math.max(
      0,
      Number(json.contractualNoticeDays || 30) - Number(json.actualNoticeDays || 0),
    );

    return {
      id: json.id,
      employeeId: json.employeeId,
      employeeCode: emp?.employeeCode,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : undefined,
      department: emp?.department,
      designationTitle: emp?.designation?.title,
      separationType: json.separationType,
      noticeDate: json.noticeDate,
      lastWorkingDay: json.lastWorkingDay,
      contractualNoticeDays: Number(json.contractualNoticeDays || 30),
      actualNoticeDays: Number(json.actualNoticeDays || 0),
      noticeShortfallDays,
      reason: json.reason,
      repatriationRequired: Boolean(json.repatriationRequired),
      destinationCountry: json.destinationCountry,
      hasNewUaeEmployment: Boolean(json.hasNewUaeEmployment),
      clearanceStatus: json.clearanceStatus as ClearanceStatus,
      clearanceDetails: json.clearanceDetails as ClearanceDetails,
      status: json.status,
      settlementId: settlement?.id || null,
      createdBy: json.createdBy,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
  }

  /**
   * Initiate employee separation record
   */
  public static async initiateSeparation(
    dto: InitiateSeparationDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeSeparationDto> {
    const employee = await Employee.findByPk(dto.employeeId);
    if (!employee) {
      throw AppError.notFound(`Employee ${dto.employeeId} not found`);
    }

    // Check if an open/pending separation already exists
    const existing = await EmployeeSeparation.findOne({
      where: {
        employeeId: dto.employeeId,
        status: ['pending', 'cleared'],
      },
    });

    if (existing) {
      throw AppError.conflict(
        `An active separation record already exists for employee ${employee.employeeCode}`,
      );
    }

    const contractualNoticeDays = dto.contractualNoticeDays || 30;
    const actualNoticeDays =
      dto.actualNoticeDays !== undefined
        ? dto.actualNoticeDays
        : Math.floor(
            (new Date(dto.lastWorkingDay).getTime() - new Date(dto.noticeDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );

    const clearanceDetails: ClearanceDetails = {
      itAssetsReturned: dto.clearanceDetails?.itAssetsReturned || false,
      accessCardsReturned: dto.clearanceDetails?.accessCardsReturned || false,
      loansReconciled: dto.clearanceDetails?.loansReconciled || false,
      visaCancellationInitiated: dto.clearanceDetails?.visaCancellationInitiated || false,
      simCardReturned: dto.clearanceDetails?.simCardReturned || false,
      uniformReturned: dto.clearanceDetails?.uniformReturned || false,
      remarks: dto.clearanceDetails?.remarks || '',
    };

    const separation = await EmployeeSeparation.create({
      employeeId: dto.employeeId,
      separationType: dto.separationType,
      noticeDate: dto.noticeDate,
      lastWorkingDay: dto.lastWorkingDay,
      contractualNoticeDays,
      actualNoticeDays: Math.max(0, actualNoticeDays),
      reason: dto.reason || null,
      repatriationRequired: dto.repatriationRequired !== false,
      destinationCountry: dto.destinationCountry || employee.nationality || null,
      hasNewUaeEmployment: Boolean(dto.hasNewUaeEmployment),
      clearanceStatus: 'pending',
      clearanceDetails,
      status: 'pending',
      createdBy: actorId || null,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'SEPARATION_INITIATED',
      resourceType: 'EmployeeSeparation',
      resourceId: separation.id,
      newValues: separation.toJSON(),
      correlationId,
    });

    const reloaded = await EmployeeSeparation.findByPk(separation.id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    return this.toDto(reloaded!);
  }

  /**
   * Update departmental clearance checklist
   */
  public static async updateClearance(
    id: string,
    dto: UpdateClearanceDto,
    actorId?: string,
    actorIp?: string,
    actorUserAgent?: string,
    correlationId?: string,
  ): Promise<EmployeeSeparationDto> {
    const separation = await EmployeeSeparation.findByPk(id, {
      include: [{ model: Employee, as: 'employee' }],
    });
    if (!separation) {
      throw AppError.notFound(`Separation record ${id} not found`);
    }

    if (separation.status === 'settled' || separation.status === 'cancelled') {
      throw AppError.badRequest(
        `Cannot modify clearance on separation in ${separation.status} status`,
      );
    }

    const mergedDetails = { ...separation.clearanceDetails, ...dto.clearanceDetails };

    // Determine clearance status
    let clearanceStatus = dto.clearanceStatus || separation.clearanceStatus;
    const isAllChecked =
      mergedDetails.itAssetsReturned &&
      mergedDetails.accessCardsReturned &&
      mergedDetails.loansReconciled &&
      mergedDetails.visaCancellationInitiated;

    if (isAllChecked) {
      clearanceStatus = 'fully_cleared';
    } else if (
      mergedDetails.itAssetsReturned ||
      mergedDetails.accessCardsReturned ||
      mergedDetails.loansReconciled ||
      mergedDetails.visaCancellationInitiated
    ) {
      clearanceStatus = 'partially_cleared';
    }

    const oldValues = separation.toJSON();

    await separation.update({
      clearanceDetails: mergedDetails,
      clearanceStatus,
      status: clearanceStatus === 'fully_cleared' ? 'cleared' : separation.status,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp,
      actorUserAgent,
      action: 'CLEARANCE_UPDATED',
      resourceType: 'EmployeeSeparation',
      resourceId: separation.id,
      oldValues,
      newValues: separation.toJSON(),
      correlationId,
    });

    return this.toDto(separation);
  }

  /**
   * List separation records
   */
  public static async listSeparations(filter: {
    status?: string;
    employeeId?: string;
  }): Promise<EmployeeSeparationDto[]> {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.employeeId) where.employeeId = filter.employeeId;

    const list = await EmployeeSeparation.findAll({
      where,
      include: [
        { model: Employee, as: 'employee' },
        { model: FinalSettlement, as: 'settlement' },
      ],
      order: [['createdAt', 'DESC']],
    });

    return list.map((item) => this.toDto(item));
  }

  /**
   * Get separation by ID
   */
  public static async getById(id: string): Promise<EmployeeSeparationDto> {
    const sep = await EmployeeSeparation.findByPk(id, {
      include: [
        { model: Employee, as: 'employee' },
        { model: FinalSettlement, as: 'settlement' },
      ],
    });
    if (!sep) {
      throw AppError.notFound(`Separation record ${id} not found`);
    }
    return this.toDto(sep);
  }
}
