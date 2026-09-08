import { LeaveType } from '../models/leave-type.model';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from '@blue-royal/contracts';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { runInTransaction } from '../../../core/database/transactions';

export class LeaveTypeService {
  public static async listTypes(includeInactive = false): Promise<LeaveType[]> {
    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    return LeaveType.findAll({
      where,
      order: [['name', 'ASC']],
    });
  }

  public static async getTypeById(id: string): Promise<LeaveType> {
    const lt = await LeaveType.findByPk(id);
    if (!lt) {
      throw new AppError(`Leave type with id "${id}" not found`, 404);
    }
    return lt;
  }

  public static async createType(
    dto: CreateLeaveTypeDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveType> {
    const code = dto.code.trim().toUpperCase();
    const existing = await LeaveType.findOne({ where: { code } });
    if (existing) {
      throw new AppError(`Leave type with code "${code}" already exists`, 409);
    }

    return runInTransaction(async (transaction) => {
      const created = await LeaveType.create(
        {
          code,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isPaid: dto.isPaid !== undefined ? dto.isPaid : true,
          defaultDaysPerYear: dto.defaultDaysPerYear !== undefined ? dto.defaultDaysPerYear : 30.0,
          requiresAttachment: dto.requiresAttachment || false,
          deductWorkingDaysOnly:
            dto.deductWorkingDaysOnly !== undefined ? dto.deductWorkingDaysOnly : true,
          allowDuringProbation: dto.allowDuringProbation || false,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        },
        { transaction },
      );

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_TYPE_CREATED',
        resourceType: 'leave_type',
        resourceId: created.id,
        newValues: created.toJSON(),
      });

      return created;
    });
  }

  public static async updateType(
    id: string,
    dto: UpdateLeaveTypeDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveType> {
    const lt = await this.getTypeById(id);
    const oldValues = lt.toJSON();

    return runInTransaction(async (transaction) => {
      if (dto.name !== undefined) lt.name = dto.name.trim();
      if (dto.description !== undefined) lt.description = dto.description.trim() || null;
      if (dto.isPaid !== undefined) lt.isPaid = dto.isPaid;
      if (dto.defaultDaysPerYear !== undefined) lt.defaultDaysPerYear = dto.defaultDaysPerYear;
      if (dto.requiresAttachment !== undefined) lt.requiresAttachment = dto.requiresAttachment;
      if (dto.deductWorkingDaysOnly !== undefined)
        lt.deductWorkingDaysOnly = dto.deductWorkingDaysOnly;
      if (dto.allowDuringProbation !== undefined)
        lt.allowDuringProbation = dto.allowDuringProbation;
      if (dto.isActive !== undefined) lt.isActive = dto.isActive;

      await lt.save({ transaction });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_TYPE_UPDATED',
        resourceType: 'leave_type',
        resourceId: lt.id,
        oldValues,
        newValues: lt.toJSON(),
      });

      return lt;
    });
  }

  public static async deleteType(
    id: string,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<void> {
    const lt = await this.getTypeById(id);
    const oldValues = lt.toJSON();

    await runInTransaction(async (transaction) => {
      await lt.destroy({ transaction });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_TYPE_DELETED',
        resourceType: 'leave_type',
        resourceId: id,
        oldValues,
      });
    });
  }
}
