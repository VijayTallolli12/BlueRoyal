import { Op, Transaction } from 'sequelize';
import { LeaveRequest } from '../models/leave-request.model';
import { LeaveType } from '../models/leave-type.model';
import { Employee } from '../../masters/models/employee.model';
import { User } from '../../auth/models/user.model';
import { LeaveCalculationService } from './leave-calculation.service';
import { LeaveBalanceService } from './leave-balance.service';
import { AttendanceLeaveSyncService } from './attendance-leave-sync.service';
import {
  CreateLeaveRequestDto,
  LeaveRequestQueryDto,
  MyLeaveOverviewDto,
} from '@blue-royal/contracts';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { runInTransaction } from '../../../core/database/transactions';

export class LeaveRequestService {
  /**
   * Generates a sequential, collision-resistant request number: LR-YYYYMM-0001
   */
  private static async generateRequestNumber(
    workDate: string,
    transaction?: Transaction,
  ): Promise<string> {
    const yyyymm = workDate.replace(/-/g, '').slice(0, 6);
    const prefix = `LR-${yyyymm}-`;

    const latest = await LeaveRequest.findOne({
      where: {
        requestNumber: {
          [Op.like]: `${prefix}%`,
        },
      },
      order: [['requestNumber', 'DESC']],
      transaction,
    });

    let nextSeq = 1;
    if (latest && latest.requestNumber) {
      const parts = latest.requestNumber.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextSeq = parsed + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  public static async listRequests(query: LeaveRequestQueryDto): Promise<{
    items: LeaveRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
    if (query.status) where.status = query.status;

    if (query.year) {
      const startOfYear = `${query.year}-01-01`;
      const endOfYear = `${query.year}-12-31`;
      where.startDate = { [Op.lte]: endOfYear };
      where.endDate = { [Op.gte]: startOfYear };
    }

    if (query.startDate && query.endDate) {
      where.startDate = { [Op.lte]: query.endDate };
      where.endDate = { [Op.gte]: query.startDate };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const { rows, count } = await LeaveRequest.findAndCountAll({
      where,
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employeeCode', 'firstName', 'lastName', 'status'],
        },
        { model: LeaveType, as: 'leaveType' },
        { model: User, as: 'approver', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: User, as: 'rejector', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: User, as: 'canceller', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows,
      total: count,
      page,
      limit,
    };
  }

  public static async getRequestById(id: string): Promise<LeaveRequest> {
    const req = await LeaveRequest.findByPk(id, {
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employeeCode', 'firstName', 'lastName', 'status'],
        },
        { model: LeaveType, as: 'leaveType' },
        { model: User, as: 'approver', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: User, as: 'rejector', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: User, as: 'canceller', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
    });

    if (!req) {
      throw new AppError(`Leave request with id "${id}" not found`, 404);
    }
    return req;
  }

  public static async submitRequest(
    dto: CreateLeaveRequestDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveRequest> {
    if (!dto.employeeId) {
      throw new AppError('Employee ID is required', 422);
    }

    const employee = await Employee.findByPk(dto.employeeId);
    if (!employee) {
      throw new AppError(`Employee with id "${dto.employeeId}" not found`, 404);
    }

    const leaveType = await LeaveType.findByPk(dto.leaveTypeId);
    if (!leaveType) {
      throw new AppError(`Leave type with id "${dto.leaveTypeId}" not found`, 404);
    }

    if (!leaveType.isActive) {
      throw new AppError(`Leave type "${leaveType.name}" is deactivated`, 422);
    }

    return runInTransaction(async (transaction) => {
      // 1. Eligibility & Overlap Check
      await LeaveCalculationService.validateEligibilityAndOverlap({
        employee,
        leaveType,
        startDate: dto.startDate,
        endDate: dto.endDate,
        transaction,
      });

      // 2. Compute Days
      const calc = await LeaveCalculationService.calculateLeaveDays(
        dto.startDate,
        dto.endDate,
        leaveType,
        transaction,
      );

      if (calc.totalDays <= 0) {
        throw new AppError(
          'Selected date range contains 0 deductible leave days (all days are weekly offs or public holidays)',
          422,
        );
      }

      // 3. Balance Verification & Pending Increment
      const year = parseInt(dto.startDate.slice(0, 4), 10);
      const balance = await LeaveBalanceService.getOrCreateBalance(
        employee.id,
        leaveType.id,
        year,
        transaction,
      );

      if (leaveType.isPaid || leaveType.defaultDaysPerYear > 0) {
        if (balance.remainingDays < calc.totalDays) {
          throw new AppError(
            `Insufficient leave balance. Requested: ${calc.totalDays} day(s), Available: ${balance.remainingDays} day(s)`,
            422,
          );
        }
      }

      // Increment pendingDays on balance
      balance.pendingDays = Number((Number(balance.pendingDays || 0) + calc.totalDays).toFixed(2));
      await balance.save({ transaction });

      // 4. Create Leave Request
      const requestNumber = await this.generateRequestNumber(dto.startDate, transaction);
      const leaveRequest = await LeaveRequest.create(
        {
          requestNumber,
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays: calc.totalDays,
          reason: dto.reason.trim(),
          status: 'PENDING',
          attachmentUrl: dto.attachmentUrl || null,
        },
        { transaction },
      );

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_REQUEST_SUBMITTED',
        resourceType: 'leave_request',
        resourceId: leaveRequest.id,
        newValues: leaveRequest.toJSON(),
      });

      return leaveRequest;
    });
  }

  public static async approveRequest(
    id: string,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveRequest> {
    const leaveRequest = await this.getRequestById(id);

    if (leaveRequest.status !== 'PENDING') {
      throw new AppError(
        `Only PENDING leave requests can be approved (current status: ${leaveRequest.status})`,
        422,
      );
    }

    return runInTransaction(async (transaction) => {
      const oldValues = leaveRequest.toJSON();

      // 1. Update Request State
      leaveRequest.status = 'APPROVED';
      leaveRequest.approvedBy = actorId;
      leaveRequest.approvedAt = new Date();
      await leaveRequest.save({ transaction });

      // 2. Update Employee Balance: decrement pendingDays, increment usedDays
      const year = parseInt(leaveRequest.startDate.slice(0, 4), 10);
      const balance = await LeaveBalanceService.getOrCreateBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveTypeId,
        year,
        transaction,
      );

      const totalDays = Number(leaveRequest.totalDays);
      balance.pendingDays = Math.max(0, Number((Number(balance.pendingDays || 0) - totalDays).toFixed(2)));
      balance.usedDays = Number((Number(balance.usedDays || 0) + totalDays).toFixed(2));
      await balance.save({ transaction });

      // 3. Live Attendance Synchronization
      await AttendanceLeaveSyncService.syncApprovedLeave(leaveRequest, actorId, transaction);

      // 4. Audit Log
      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_REQUEST_APPROVED',
        resourceType: 'leave_request',
        resourceId: leaveRequest.id,
        oldValues,
        newValues: leaveRequest.toJSON(),
      });

      return leaveRequest;
    });
  }

  public static async rejectRequest(
    id: string,
    reason: string,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveRequest> {
    if (!reason || reason.trim().length < 5) {
      throw new AppError('A valid rejection reason (minimum 5 characters) is mandatory', 422);
    }

    const leaveRequest = await this.getRequestById(id);

    if (leaveRequest.status !== 'PENDING') {
      throw new AppError(
        `Only PENDING leave requests can be rejected (current status: ${leaveRequest.status})`,
        422,
      );
    }

    return runInTransaction(async (transaction) => {
      const oldValues = leaveRequest.toJSON();

      leaveRequest.status = 'REJECTED';
      leaveRequest.rejectedBy = actorId;
      leaveRequest.rejectedAt = new Date();
      leaveRequest.rejectionReason = reason.trim();
      await leaveRequest.save({ transaction });

      // Restore balance: decrement pendingDays
      const year = parseInt(leaveRequest.startDate.slice(0, 4), 10);
      const balance = await LeaveBalanceService.getOrCreateBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveTypeId,
        year,
        transaction,
      );

      const totalDays = Number(leaveRequest.totalDays);
      balance.pendingDays = Math.max(0, Number((Number(balance.pendingDays || 0) - totalDays).toFixed(2)));
      await balance.save({ transaction });

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_REQUEST_REJECTED',
        resourceType: 'leave_request',
        resourceId: leaveRequest.id,
        oldValues,
        newValues: leaveRequest.toJSON(),
      });

      return leaveRequest;
    });
  }

  public static async cancelRequest(
    id: string,
    reason: string | undefined,
    actorId: string,
    isSelfCancel: boolean,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<LeaveRequest> {
    const leaveRequest = await this.getRequestById(id);

    if (isSelfCancel && leaveRequest.status !== 'PENDING') {
      throw new AppError(
        `Employees can only cancel PENDING requests (current status: ${leaveRequest.status}). ` +
          `Contact HR Admin to cancel an approved leave.`,
        422,
      );
    }

    if (!isSelfCancel && leaveRequest.status === 'APPROVED' && (!reason || reason.trim().length < 5)) {
      throw new AppError('A cancellation reason is mandatory when revoking an approved leave', 422);
    }

    if (leaveRequest.status === 'REJECTED' || leaveRequest.status === 'CANCELLED') {
      throw new AppError(`Cannot cancel a request that is already ${leaveRequest.status}`, 422);
    }

    return runInTransaction(async (transaction) => {
      const oldValues = leaveRequest.toJSON();
      const prevStatus = leaveRequest.status;
      const totalDays = Number(leaveRequest.totalDays);

      leaveRequest.status = 'CANCELLED';
      leaveRequest.cancelledBy = actorId;
      leaveRequest.cancelledAt = new Date();
      leaveRequest.cancellationReason = reason?.trim() || (isSelfCancel ? 'Cancelled by employee' : null);
      await leaveRequest.save({ transaction });

      const year = parseInt(leaveRequest.startDate.slice(0, 4), 10);
      const balance = await LeaveBalanceService.getOrCreateBalance(
        leaveRequest.employeeId,
        leaveRequest.leaveTypeId,
        year,
        transaction,
      );

      if (prevStatus === 'PENDING') {
        balance.pendingDays = Math.max(0, Number((Number(balance.pendingDays || 0) - totalDays).toFixed(2)));
        await balance.save({ transaction });
      } else if (prevStatus === 'APPROVED') {
        balance.usedDays = Math.max(0, Number((Number(balance.usedDays || 0) - totalDays).toFixed(2)));
        await balance.save({ transaction });

        // Revert attendance sync
        await AttendanceLeaveSyncService.revertApprovedLeave(
          leaveRequest,
          actorId,
          reason || 'Administrative cancellation',
          transaction,
        );
      }

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_REQUEST_CANCELLED',
        resourceType: 'leave_request',
        resourceId: leaveRequest.id,
        oldValues,
        newValues: leaveRequest.toJSON(),
      });

      return leaveRequest;
    });
  }

  public static async getMyLeaveOverview(
    userId: string,
    targetYear?: number,
  ): Promise<MyLeaveOverviewDto> {
    const employee = await Employee.findOne({ where: { userId } });
    if (!employee) {
      throw new AppError('No employee profile linked to your user account', 404);
    }

    const currentYear = targetYear || new Date().getUTCFullYear();

    // Get active leave types
    const leaveTypes = await LeaveType.findAll({ where: { isActive: true } });

    // Ensure balance exists for each active leave type
    const balances = [];
    for (const lt of leaveTypes) {
      const b = await LeaveBalanceService.getOrCreateBalance(employee.id, lt.id, currentYear);
      balances.push(b);
    }

    // Get requests for this employee
    const requests = await LeaveRequest.findAll({
      where: { employeeId: employee.id },
      include: [
        { model: LeaveType, as: 'leaveType' },
        { model: User, as: 'approver', attributes: ['id', 'email', 'firstName', 'lastName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
      year: currentYear,
      balances: balances.map((b) => ({
        id: b.id,
        employeeId: b.employeeId,
        leaveTypeId: b.leaveTypeId,
        year: b.year,
        allocatedDays: Number(b.allocatedDays),
        usedDays: Number(b.usedDays),
        pendingDays: Number(b.pendingDays),
        carriedForward: Number(b.carriedForward),
        remainingDays: b.remainingDays,
        notes: b.notes,
        leaveType: b.leaveType
          ? {
              id: b.leaveType.id,
              code: b.leaveType.code,
              name: b.leaveType.name,
              isPaid: b.leaveType.isPaid,
              defaultDaysPerYear: Number(b.leaveType.defaultDaysPerYear),
              requiresAttachment: b.leaveType.requiresAttachment,
              deductWorkingDaysOnly: b.leaveType.deductWorkingDaysOnly,
              allowDuringProbation: b.leaveType.allowDuringProbation,
              isActive: b.leaveType.isActive,
              createdAt: b.leaveType.createdAt.toISOString(),
              updatedAt: b.leaveType.updatedAt.toISOString(),
            }
          : undefined,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
      requests: requests.map((r) => ({
        id: r.id,
        requestNumber: r.requestNumber,
        employeeId: r.employeeId,
        leaveTypeId: r.leaveTypeId,
        startDate: r.startDate,
        endDate: r.endDate,
        totalDays: Number(r.totalDays),
        reason: r.reason,
        status: r.status,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
        rejectedBy: r.rejectedBy,
        rejectedAt: r.rejectedAt ? r.rejectedAt.toISOString() : null,
        rejectionReason: r.rejectionReason,
        cancelledBy: r.cancelledBy,
        cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
        cancellationReason: r.cancellationReason,
        attachmentUrl: r.attachmentUrl,
        leaveType: r.leaveType
          ? {
              id: r.leaveType.id,
              code: r.leaveType.code,
              name: r.leaveType.name,
              isPaid: r.leaveType.isPaid,
              defaultDaysPerYear: Number(r.leaveType.defaultDaysPerYear),
              requiresAttachment: r.leaveType.requiresAttachment,
              deductWorkingDaysOnly: r.leaveType.deductWorkingDaysOnly,
              allowDuringProbation: r.leaveType.allowDuringProbation,
              isActive: r.leaveType.isActive,
              createdAt: r.leaveType.createdAt.toISOString(),
              updatedAt: r.leaveType.updatedAt.toISOString(),
            }
          : undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }
}
