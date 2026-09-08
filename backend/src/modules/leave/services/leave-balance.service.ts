import { Transaction } from 'sequelize';
import { EmployeeLeaveBalance } from '../models/employee-leave-balance.model';
import { LeaveType } from '../models/leave-type.model';
import { Employee } from '../../masters/models/employee.model';
import { AllocateLeaveBalanceDto, LeaveBalanceQueryDto } from '@blue-royal/contracts';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import { runInTransaction } from '../../../core/database/transactions';

export class LeaveBalanceService {
  public static async listBalances(query: LeaveBalanceQueryDto): Promise<EmployeeLeaveBalance[]> {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
    if (query.year) where.year = query.year;

    return EmployeeLeaveBalance.findAll({
      where,
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employeeCode', 'firstName', 'lastName', 'status'],
        },
        { model: LeaveType, as: 'leaveType' },
      ],
      order: [
        ['year', 'DESC'],
        [{ model: Employee, as: 'employee' }, 'employeeCode', 'ASC'],
      ],
    });
  }

  public static async getOrCreateBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    transaction?: Transaction,
  ): Promise<EmployeeLeaveBalance> {
    let balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId, leaveTypeId, year },
      include: [{ model: LeaveType, as: 'leaveType' }],
      transaction,
    });

    if (!balance) {
      const leaveType = await LeaveType.findByPk(leaveTypeId, { transaction });
      if (!leaveType) {
        throw new AppError(`Leave type with id "${leaveTypeId}" not found`, 404);
      }

      // Default balance uses default_days_per_year from leave_type
      balance = await EmployeeLeaveBalance.create(
        {
          employeeId,
          leaveTypeId,
          year,
          allocatedDays: leaveType.defaultDaysPerYear,
          usedDays: 0,
          pendingDays: 0,
          carriedForward: 0,
        },
        { transaction },
      );
      balance.leaveType = leaveType;
    }

    return balance;
  }

  public static async allocateBalance(
    dto: AllocateLeaveBalanceDto,
    actorId: string,
    actorIp?: string,
    actorUserAgent?: string,
  ): Promise<EmployeeLeaveBalance> {
    const employee = await Employee.findByPk(dto.employeeId);
    if (!employee) {
      throw new AppError(`Employee with id "${dto.employeeId}" not found`, 404);
    }

    const leaveType = await LeaveType.findByPk(dto.leaveTypeId);
    if (!leaveType) {
      throw new AppError(`Leave type with id "${dto.leaveTypeId}" not found`, 404);
    }

    if (dto.allocatedDays < 0) {
      throw new AppError('Allocated days cannot be negative', 422);
    }

    return runInTransaction(async (transaction) => {
      let balance = await EmployeeLeaveBalance.findOne({
        where: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
        },
        transaction,
      });

      let oldValues: any = null;

      if (balance) {
        oldValues = balance.toJSON();
        balance.allocatedDays = dto.allocatedDays;
        if (dto.carriedForward !== undefined) {
          balance.carriedForward = dto.carriedForward;
        }
        if (dto.notes !== undefined) {
          balance.notes = dto.notes;
        }
        await balance.save({ transaction });
      } else {
        balance = await EmployeeLeaveBalance.create(
          {
            employeeId: dto.employeeId,
            leaveTypeId: dto.leaveTypeId,
            year: dto.year,
            allocatedDays: dto.allocatedDays,
            usedDays: 0,
            pendingDays: 0,
            carriedForward: dto.carriedForward || 0,
            notes: dto.notes || null,
          },
          { transaction },
        );
      }

      await AuditService.recordEvent({
        actorId,
        actorIp,
        actorUserAgent,
        action: 'LEAVE_BALANCE_ALLOCATED',
        resourceType: 'employee_leave_balance',
        resourceId: balance.id,
        oldValues,
        newValues: balance.toJSON(),
      });

      return balance;
    });
  }
}
