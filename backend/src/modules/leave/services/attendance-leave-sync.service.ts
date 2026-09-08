import { Op, Transaction } from 'sequelize';
import { LeaveRequest } from '../models/leave-request.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { AttendanceAuditLog } from '../../attendance/models/attendance-audit-log.model';
import { AttendanceCalculationService } from '../../attendance/services/attendance-calculation.service';
import { AppError } from '../../../core/errors/app-error';

export class AttendanceLeaveSyncService {
  /**
   * Synchronizes an approved leave request to active attendance periods.
   * Prohibits modification if any covered attendance period is LOCKED.
   */
  public static async syncApprovedLeave(
    leaveRequest: LeaveRequest,
    actorId: string,
    transaction?: Transaction,
  ): Promise<number> {
    const records = await AttendanceRecord.findAll({
      where: {
        employeeId: leaveRequest.employeeId,
        workDate: {
          [Op.gte]: leaveRequest.startDate,
          [Op.lte]: leaveRequest.endDate,
        },
      },
      include: [{ model: AttendancePeriod, as: 'attendancePeriod' }],
      transaction,
    });

    if (records.length === 0) {
      return 0;
    }

    // 1. Verify no affected period is LOCKED
    for (const rec of records) {
      if (rec.attendancePeriod?.status === 'locked') {
        throw new AppError(
          `Cannot approve leave covering locked attendance period (${rec.attendancePeriod.periodCode}). ` +
            `Unlock period first with regulatory justification.`,
          409,
        );
      }
    }

    // 2. Update records and handle anomalies/reversions
    let syncedCount = 0;
    const periodsToRevert = new Set<AttendancePeriod>();

    for (const rec of records) {
      const oldIsOnLeave = rec.isOnLeave;
      const oldActualHours = Number(rec.actualHours || 0);

      rec.isOnLeave = true;
      rec.isAbsent = false;
      rec.regularHours = 0.0;
      rec.otHours = 0.0;

      if (oldActualHours > 0) {
        rec.hasAnomaly = true;
        rec.anomalyReason = 'CONFLICT_LEAVE_WORK_LOGGED';
      } else {
        rec.hasAnomaly = false;
        rec.anomalyReason = null;
      }

      await rec.save({ transaction });
      syncedCount++;

      // Log cell-level audit trail in attendance_audit_logs
      await AttendanceAuditLog.create(
        {
          attendanceRecordId: rec.id,
          employeeId: rec.employeeId,
          workDate: rec.workDate,
          fieldName: 'is_on_leave',
          oldValue: String(oldIsOnLeave),
          newValue: 'true',
          changeReason: `Approved Leave Request ${leaveRequest.requestNumber}`,
          actorId,
        },
        { transaction },
      );

      if (
        rec.attendancePeriod &&
        (rec.attendancePeriod.status === 'submitted' || rec.attendancePeriod.status === 'approved')
      ) {
        periodsToRevert.add(rec.attendancePeriod);
      }
    }

    // Revert submitted or approved periods back to draft per Phase 2 integrity rule
    for (const p of periodsToRevert) {
      p.status = 'draft';
      await p.save({ transaction });
    }

    return syncedCount;
  }

  /**
   * Reverts attendance records when an approved leave request is cancelled.
   */
  public static async revertApprovedLeave(
    leaveRequest: LeaveRequest,
    actorId: string,
    reason: string,
    transaction?: Transaction,
  ): Promise<number> {
    const records = await AttendanceRecord.findAll({
      where: {
        employeeId: leaveRequest.employeeId,
        workDate: {
          [Op.gte]: leaveRequest.startDate,
          [Op.lte]: leaveRequest.endDate,
        },
      },
      include: [{ model: AttendancePeriod, as: 'attendancePeriod' }],
      transaction,
    });

    if (records.length === 0) {
      return 0;
    }

    // 1. Verify no affected period is LOCKED
    for (const rec of records) {
      if (rec.attendancePeriod?.status === 'locked') {
        throw new AppError(
          `Cannot cancel leave affecting locked attendance period (${rec.attendancePeriod.periodCode}).`,
          409,
        );
      }
    }

    let revertedCount = 0;
    const periodsToRevert = new Set<AttendancePeriod>();

    for (const rec of records) {
      const pit = await AttendanceCalculationService.resolvePointInTimeContext(
        rec.employeeId,
        rec.workDate,
        transaction,
      );

      const calculated = AttendanceCalculationService.calculateHours({
        actualHours: Number(rec.actualHours || 0),
        dayType: rec.dayType,
        shiftWorkHours: pit.shiftWorkHours,
        isOnLeave: false,
      });

      rec.isOnLeave = false;
      rec.regularHours = calculated.regularHours;
      rec.otHours = calculated.otHours;
      rec.isAbsent = calculated.isAbsent;
      rec.hasAnomaly = calculated.hasAnomaly;
      rec.anomalyReason = calculated.anomalyReason;

      await rec.save({ transaction });
      revertedCount++;

      await AttendanceAuditLog.create(
        {
          attendanceRecordId: rec.id,
          employeeId: rec.employeeId,
          workDate: rec.workDate,
          fieldName: 'is_on_leave',
          oldValue: 'true',
          newValue: 'false',
          changeReason: `Cancelled Leave Request ${leaveRequest.requestNumber}: ${reason}`,
          actorId,
        },
        { transaction },
      );

      if (
        rec.attendancePeriod &&
        (rec.attendancePeriod.status === 'submitted' || rec.attendancePeriod.status === 'approved')
      ) {
        periodsToRevert.add(rec.attendancePeriod);
      }
    }

    for (const p of periodsToRevert) {
      p.status = 'draft';
      await p.save({ transaction });
    }

    return revertedCount;
  }
}
