import { Op } from 'sequelize';
import { sequelize } from '../../../core/database/sequelize';
import { AppError } from '../../../core/errors/app-error';
import { AuditService } from '../../../core/audit/audit.service';
import {
  AttendancePeriod,
  AttendancePeriodStatus,
} from '../models/attendance-period.model';
import { AttendanceRecord, DayType } from '../models/attendance-record.model';
import { AttendanceAuditLog } from '../models/attendance-audit-log.model';
import { Employee } from '../../masters/models/employee.model';
import { Client } from '../../masters/models/client.model';
import { Project } from '../../masters/models/project.model';
import { Designation } from '../../masters/models/designation.model';
import { Shift } from '../../masters/models/shift.model';
import { LeaveRequest } from '../../leave/models/leave-request.model';
import {
  AttendanceCalculationService,
  EmployeeEligibilityContext,
} from './attendance-calculation.service';
import {
  AttendanceGridResponseDto,
  AttendanceGridRowDto,
  AttendanceSummaryCardsDto,
  BatchUpdateAttendanceRecordsDto,
  CreateAttendancePeriodDto,
} from '@blue-royal/contracts';

export class AttendancePeriodService {
  /**
   * Helper: Generate an array of dates ('YYYY-MM-DD') between startDate and endDate inclusive.
   */
  private static generateDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  /**
   * List all attendance periods with summary counts.
   */
  public static async listPeriods(): Promise<AttendancePeriod[]> {
    return AttendancePeriod.findAll({
      order: [['periodCode', 'DESC']],
    });
  }

  /**
   * Get single period by ID.
   */
  public static async getPeriodById(id: string): Promise<AttendancePeriod> {
    const period = await AttendancePeriod.findByPk(id);
    if (!period) {
      throw AppError.notFound(`Attendance period ${id} not found`);
    }
    return period;
  }

  /**
   * Create a new monthly attendance period and automatically pre-generate eligible attendance records.
   */
  public static async createPeriod(
    dto: CreateAttendancePeriodDto,
    actorId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendancePeriod> {
    // 1. Check if periodCode already exists
    const existing = await AttendancePeriod.findOne({
      where: { periodCode: dto.periodCode },
    });
    if (existing) {
      throw AppError.conflict(`Attendance period ${dto.periodCode} already exists`);
    }

    const dateRegex = /^\d{4}-\d{2}$/;
    if (!dateRegex.test(dto.periodCode)) {
      throw AppError.badRequest('periodCode must follow format YYYY-MM (e.g. 2026-05)');
    }

    const [yearStr, monthStr] = dto.periodCode.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12

    // Compute default start/end dates if not provided
    const startDate = dto.startDate || `${dto.periodCode}-01`;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = dto.endDate || `${dto.periodCode}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const defaultName = `${monthNames[month - 1]} ${year}`;
    const name = dto.name || defaultName;

    return sequelize.transaction(async (t) => {
      // Create period in DRAFT
      const period = await AttendancePeriod.create(
        {
          periodCode: dto.periodCode,
          name,
          startDate,
          endDate,
          status: 'draft',
        },
        { transaction: t },
      );

      // Pre-generate records for eligible employees
      const dates = AttendancePeriodService.generateDateRange(startDate, endDate);

      // Find all active employees who joined on or before the period end date
      const employees = await Employee.findAll({
        where: {
          dateOfJoining: { [Op.lte]: endDate },
          status: { [Op.ne]: 'terminated' },
        },
        transaction: t,
      });

      // Fetch approved leaves overlapping this period
      const approvedLeaves = await LeaveRequest.findAll({
        where: {
          status: 'APPROVED',
          startDate: { [Op.lte]: endDate },
          endDate: { [Op.gte]: startDate },
        },
        transaction: t,
      });

      const recordsToCreate: any[] = [];

      for (const emp of employees) {
        const eligibilityContext: EmployeeEligibilityContext = {
          dateOfJoining: emp.dateOfJoining,
          employmentType: emp.employmentType,
          contractEndDate: emp.contractEndDate,
        };

        for (const date of dates) {
          if (!AttendanceCalculationService.isEmployeeEligibleOnDate(eligibilityContext, date)) {
            continue; // Skip dates outside employment window
          }

          const dayType: DayType = await AttendanceCalculationService.resolveDayType(date, t);
          const pitContext = await AttendanceCalculationService.resolvePointInTimeContext(
            emp.id,
            date,
            t,
          );

          const isOnLeave = approvedLeaves.some(
            (l) => l.employeeId === emp.id && date >= l.startDate && date <= l.endDate,
          );

          // Initial calculation for 0 actual hours
          const calc = AttendanceCalculationService.calculateHours({
            actualHours: 0.0,
            dayType,
            shiftWorkHours: pitContext.shiftWorkHours,
            isOnLeave,
          });

          recordsToCreate.push({
            attendancePeriodId: period.id,
            employeeId: emp.id,
            workDate: date,
            clientId: pitContext.clientId,
            projectId: pitContext.projectId,
            designationId: pitContext.designationId,
            shiftId: pitContext.shiftId,
            dayType,
            actualHours: 0.0,
            regularHours: calc.regularHours,
            otHours: calc.otHours,
            isAbsent: calc.isAbsent,
            isOnLeave,
            hasAnomaly: calc.hasAnomaly,
            anomalyReason: calc.anomalyReason,
            remarks: null,
          });
        }
      }

      if (recordsToCreate.length > 0) {
        await AttendanceRecord.bulkCreate(recordsToCreate, { transaction: t });
      }

      await AuditService.recordEvent({
        actorId,
        actorIp: ip,
        actorUserAgent: userAgent,
        action: 'ATTENDANCE_PERIOD_CREATED',
        resourceType: 'AttendancePeriod',
        resourceId: period.id,
        newValues: {
          periodCode: period.periodCode,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          recordsGenerated: recordsToCreate.length,
        },
      });

      return period;
    });
  }

  /**
   * Fetch the comprehensive attendance grid, summary cards, and filters for a period.
   */
  public static async getGrid(
    periodId: string,
    filters?: {
      clientId?: string;
      projectId?: string;
      employeeId?: string;
      hasAnomaly?: boolean;
    },
  ): Promise<AttendanceGridResponseDto> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    const dates = AttendancePeriodService.generateDateRange(period.startDate, period.endDate);

    // Build filter for records
    const recordWhere: any = { attendancePeriodId: periodId };
    if (filters?.clientId) recordWhere.clientId = filters.clientId;
    if (filters?.projectId) recordWhere.projectId = filters.projectId;
    if (filters?.employeeId) recordWhere.employeeId = filters.employeeId;
    if (filters?.hasAnomaly !== undefined) recordWhere.hasAnomaly = filters.hasAnomaly;

    const records = await AttendanceRecord.findAll({
      where: recordWhere,
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'employeeCode', 'firstName', 'lastName', 'employmentType'],
        },
        { model: Client, as: 'client', attributes: ['id', 'name'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: Designation, as: 'designation', attributes: ['id', 'title', 'code'] },
        { model: Shift, as: 'shift', attributes: ['id', 'name', 'workHours', 'code'] },
      ],
      order: [
        ['employeeId', 'ASC'],
        ['workDate', 'ASC'],
      ],
    });

    // Group records by employee
    const employeeMap = new Map<string, { employee: Employee; records: AttendanceRecord[] }>();
    for (const rec of records) {
      if (!rec.employee) continue;
      if (!employeeMap.has(rec.employeeId)) {
        employeeMap.set(rec.employeeId, {
          employee: rec.employee,
          records: [],
        });
      }
      employeeMap.get(rec.employeeId)!.records.push(rec);
    }

    let periodTotalActual = 0;
    let periodTotalRegular = 0;
    let periodTotalOt = 0;
    let periodTotalAbsences = 0;
    let periodTotalAnomalies = 0;

    const rows: AttendanceGridRowDto[] = [];

    for (const [empId, data] of employeeMap.entries()) {
      const empRecords = data.records;
      const recordsByDate: Record<string, any> = {};

      let empActual = 0;
      let empRegular = 0;
      let empOt = 0;
      let empAbsences = 0;
      let empAnomalies = 0;

      let latestDesignation = 'Unassigned';
      let latestProject = 'Unassigned';
      let latestClient = 'Unassigned';
      let latestShift = 'No Shift';
      let latestShiftHours = 0;

      for (const rec of empRecords) {
        const actual = Number(rec.actualHours);
        const regular = Number(rec.regularHours);
        const ot = Number(rec.otHours);

        empActual += actual;
        empRegular += regular;
        empOt += ot;
        if (rec.isAbsent) empAbsences++;
        if (rec.hasAnomaly) empAnomalies++;

        if (rec.designation?.title) latestDesignation = rec.designation.title;
        if (rec.project?.name) latestProject = rec.project.name;
        if (rec.client?.name) latestClient = rec.client.name;
        if (rec.shift?.name) {
          latestShift = rec.shift.name;
          latestShiftHours = Number(rec.shift.workHours);
        }

        recordsByDate[rec.workDate] = {
          id: rec.id,
          attendancePeriodId: rec.attendancePeriodId,
          employeeId: rec.employeeId,
          workDate: rec.workDate,
          clientId: rec.clientId,
          projectId: rec.projectId,
          designationId: rec.designationId,
          shiftId: rec.shiftId,
          dayType: rec.dayType,
          actualHours: actual,
          regularHours: regular,
          otHours: ot,
          isAbsent: rec.isAbsent,
          isOnLeave: rec.isOnLeave,
          hasAnomaly: rec.hasAnomaly,
          anomalyReason: rec.anomalyReason,
          remarks: rec.remarks,
        };
      }

      periodTotalActual += empActual;
      periodTotalRegular += empRegular;
      periodTotalOt += empOt;
      periodTotalAbsences += empAbsences;
      periodTotalAnomalies += empAnomalies;

      rows.push({
        employeeId: empId,
        employeeCode: data.employee.employeeCode,
        employeeName: `${data.employee.firstName} ${data.employee.lastName}`,
        designationTitle: latestDesignation,
        projectName: latestProject,
        clientName: latestClient,
        shiftName: latestShift,
        shiftWorkHours: latestShiftHours,
        records: recordsByDate,
        summary: {
          totalActualHours: Number(empActual.toFixed(2)),
          totalRegularHours: Number(empRegular.toFixed(2)),
          totalOtHours: Number(empOt.toFixed(2)),
          totalAbsences: empAbsences,
          anomalyCount: empAnomalies,
        },
      });
    }

    const summary: AttendanceSummaryCardsDto = {
      totalEmployees: rows.length,
      totalActualHours: Number(periodTotalActual.toFixed(2)),
      totalRegularHours: Number(periodTotalRegular.toFixed(2)),
      totalOtHours: Number(periodTotalOt.toFixed(2)),
      totalAbsences: periodTotalAbsences,
      totalAnomalies: periodTotalAnomalies,
    };

    return {
      period: {
        id: period.id,
        periodCode: period.periodCode,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        submittedBy: period.submittedBy,
        submittedAt: period.submittedAt ? period.submittedAt.toISOString() : null,
        approvedBy: period.approvedBy,
        approvedAt: period.approvedAt ? period.approvedAt.toISOString() : null,
        lockedBy: period.lockedBy,
        lockedAt: period.lockedAt ? period.lockedAt.toISOString() : null,
        unlockedBy: period.unlockedBy,
        unlockedAt: period.unlockedAt ? period.unlockedAt.toISOString() : null,
        unlockReason: period.unlockReason,
        createdAt: (period as any).createdAt ? (period as any).createdAt.toISOString() : new Date().toISOString(),
        updatedAt: (period as any).updatedAt ? (period as any).updatedAt.toISOString() : new Date().toISOString(),
      },
      dates,
      rows,
      summary,
    };
  }

  /**
   * Batch update attendance cell records.
   * If period was submitted or approved, invalidates status back to 'draft'.
   */
  public static async batchUpdateRecords(
    periodId: string,
    dto: BatchUpdateAttendanceRecordsDto,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ updatedCount: number; newPeriodStatus: AttendancePeriodStatus }> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status === 'locked') {
      throw AppError.badRequest(
        'Attendance period is locked. Modifications are strictly forbidden until explicitly unlocked.',
      );
    }

    if (!dto.records || dto.records.length === 0) {
      return { updatedCount: 0, newPeriodStatus: period.status };
    }

    return sequelize.transaction(async (t) => {
      let updatedCount = 0;
      let statusInvalidated = false;

      for (const item of dto.records) {
        const record = await AttendanceRecord.findOne({
          where: { id: item.recordId, attendancePeriodId: periodId },
          include: [{ model: Shift, as: 'shift' }],
          transaction: t,
        });

        if (!record) {
          throw AppError.notFound(`Attendance record ${item.recordId} not found in this period`);
        }

        const oldActual = Number(record.actualHours);
        const oldLeave = record.isOnLeave;
        const oldRemarks = record.remarks || '';

        const newActual = item.actualHours !== undefined ? Number(item.actualHours) : oldActual;
        const newLeave = item.isOnLeave !== undefined ? item.isOnLeave : oldLeave;
        const newRemarks = item.remarks !== undefined ? item.remarks : oldRemarks;

        if (newActual < 0 || newActual > 24) {
          throw AppError.badRequest(`Actual hours must be between 0.00 and 24.00 (got ${newActual})`);
        }

        const isChanged =
          newActual !== oldActual || newLeave !== oldLeave || newRemarks !== oldRemarks;

        if (isChanged) {
          const reason = item.changeReason || dto.batchReason;
          if (!reason || reason.trim().length < 3) {
            throw AppError.badRequest(
              `Change reason (minimum 3 characters) is required when updating record for date ${record.workDate}`,
            );
          }

          // Recalculate hours
          const shiftHours = record.shift ? Number(record.shift.workHours) : null;
          const calc = AttendanceCalculationService.calculateHours({
            actualHours: newActual,
            dayType: record.dayType,
            shiftWorkHours: shiftHours,
            isOnLeave: newLeave,
          });

          // Insert cell audit logs
          if (newActual !== oldActual) {
            await AttendanceAuditLog.create(
              {
                attendanceRecordId: record.id,
                employeeId: record.employeeId,
                workDate: record.workDate,
                fieldName: 'actual_hours',
                oldValue: oldActual.toFixed(2),
                newValue: newActual.toFixed(2),
                changeReason: reason.trim(),
                actorId,
              },
              { transaction: t },
            );
          }

          if (newLeave !== oldLeave) {
            await AttendanceAuditLog.create(
              {
                attendanceRecordId: record.id,
                employeeId: record.employeeId,
                workDate: record.workDate,
                fieldName: 'is_on_leave',
                oldValue: String(oldLeave),
                newValue: String(newLeave),
                changeReason: reason.trim(),
                actorId,
              },
              { transaction: t },
            );
          }

          await record.update(
            {
              actualHours: newActual,
              regularHours: calc.regularHours,
              otHours: calc.otHours,
              isAbsent: calc.isAbsent,
              isOnLeave: newLeave,
              hasAnomaly: calc.hasAnomaly,
              anomalyReason: calc.anomalyReason,
              remarks: newRemarks,
            },
            { transaction: t },
          );

          updatedCount++;
        }
      }

      // If period was submitted or approved, revert to draft
      let newPeriodStatus: AttendancePeriodStatus = period.status;
      if (updatedCount > 0 && (period.status === 'submitted' || period.status === 'approved')) {
        await period.update(
          {
            status: 'draft',
            submittedBy: null,
            submittedAt: null,
            approvedBy: null,
            approvedAt: null,
          },
          { transaction: t },
        );
        newPeriodStatus = 'draft';
        statusInvalidated = true;
      }

      await AuditService.recordEvent({
        actorId,
        actorIp: ip,
        actorUserAgent: userAgent,
        action: 'ATTENDANCE_RECORDS_UPDATED',
        resourceType: 'AttendancePeriod',
        resourceId: period.id,
        newValues: {
          updatedRecordsCount: updatedCount,
          statusInvalidatedToDraft: statusInvalidated,
        },
      });

      return { updatedCount, newPeriodStatus };
    });
  }

  /**
   * Submit draft period for approval.
   * STRICT: Blocks if any anomalies exist.
   */
  public static async submitPeriod(
    periodId: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendancePeriod> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status !== 'draft') {
      throw AppError.badRequest(
        `Only periods in 'draft' status can be submitted (current status: '${period.status}')`,
      );
    }

    // Check for unresolved anomalies
    const anomalyCount = await AttendanceRecord.count({
      where: { attendancePeriodId: periodId, hasAnomaly: true },
    });
    if (anomalyCount > 0) {
      throw AppError.badRequest(
        `Cannot submit attendance period. There are ${anomalyCount} unresolved anomalies (e.g. missing shift assignments).`,
      );
    }

    const recordCount = await AttendanceRecord.count({
      where: { attendancePeriodId: periodId },
    });
    if (recordCount === 0) {
      throw AppError.badRequest('Cannot submit an empty attendance period without any records.');
    }

    await period.update({
      status: 'submitted',
      submittedBy: actorId,
      submittedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp: ip,
      actorUserAgent: userAgent,
      action: 'ATTENDANCE_PERIOD_SUBMITTED',
      resourceType: 'AttendancePeriod',
      resourceId: period.id,
      newValues: { status: 'submitted', submittedAt: period.submittedAt },
    });

    return period;
  }

  /**
   * Approve submitted period.
   * STRICT: Blocks if any anomalies exist.
   */
  public static async approvePeriod(
    periodId: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendancePeriod> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status !== 'submitted') {
      throw AppError.badRequest(
        `Only periods in 'submitted' status can be approved (current status: '${period.status}')`,
      );
    }

    // Check for unresolved anomalies
    const anomalyCount = await AttendanceRecord.count({
      where: { attendancePeriodId: periodId, hasAnomaly: true },
    });
    if (anomalyCount > 0) {
      throw AppError.badRequest(
        `Cannot approve attendance period. There are ${anomalyCount} unresolved anomalies.`,
      );
    }

    await period.update({
      status: 'approved',
      approvedBy: actorId,
      approvedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp: ip,
      actorUserAgent: userAgent,
      action: 'ATTENDANCE_PERIOD_APPROVED',
      resourceType: 'AttendancePeriod',
      resourceId: period.id,
      newValues: { status: 'approved', approvedAt: period.approvedAt },
    });

    return period;
  }

  /**
   * Lock approved period for payroll processing.
   * STRICT: Blocks if any anomalies exist or if status is not 'approved'.
   */
  public static async lockPeriod(
    periodId: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendancePeriod> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status !== 'approved') {
      throw AppError.badRequest(
        `Only periods in 'approved' status can be locked (current status: '${period.status}')`,
      );
    }

    // Check for unresolved anomalies
    const anomalyCount = await AttendanceRecord.count({
      where: { attendancePeriodId: periodId, hasAnomaly: true },
    });
    if (anomalyCount > 0) {
      throw AppError.badRequest(
        `Cannot lock attendance period. There are ${anomalyCount} unresolved anomalies.`,
      );
    }

    await period.update({
      status: 'locked',
      lockedBy: actorId,
      lockedAt: new Date(),
    });

    await AuditService.recordEvent({
      actorId,
      actorIp: ip,
      actorUserAgent: userAgent,
      action: 'ATTENDANCE_PERIOD_LOCKED',
      resourceType: 'AttendancePeriod',
      resourceId: period.id,
      newValues: { status: 'locked', lockedAt: period.lockedAt },
    });

    return period;
  }

  /**
   * Controlled unlock of a locked period.
   * Requires a detailed justification reason (>= 15 chars).
   * Reverts status to 'draft', requiring full resubmission and reapproval.
   */
  public static async unlockPeriod(
    periodId: string,
    reason: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<AttendancePeriod> {
    const period = await AttendancePeriod.findByPk(periodId);
    if (!period) {
      throw AppError.notFound(`Attendance period ${periodId} not found`);
    }

    if (period.status !== 'locked') {
      throw AppError.badRequest(
        `Only periods in 'locked' status can be unlocked (current status: '${period.status}')`,
      );
    }

    if (!reason || reason.trim().length < 15) {
      throw AppError.badRequest(
        'A comprehensive unlock reason (minimum 15 characters) must be provided.',
      );
    }

    await period.update({
      status: 'draft',
      unlockedBy: actorId,
      unlockedAt: new Date(),
      unlockReason: reason.trim(),
      approvedBy: null,
      approvedAt: null,
      lockedBy: null,
      lockedAt: null,
    });

    await AuditService.recordEvent({
      actorId,
      actorIp: ip,
      actorUserAgent: userAgent,
      action: 'ATTENDANCE_PERIOD_UNLOCKED',
      resourceType: 'AttendancePeriod',
      resourceId: period.id,
      newValues: {
        status: 'draft',
        unlockReason: reason.trim(),
        unlockedAt: period.unlockedAt,
      },
    });

    return period;
  }

  /**
   * Get detailed cell-level audit logs for a record.
   */
  public static async getRecordAuditLogs(recordId: string): Promise<AttendanceAuditLog[]> {
    return AttendanceAuditLog.findAll({
      where: { attendanceRecordId: recordId },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get self-view attendance for logged-in employee.
   */
  public static async getEmployeeSelfAttendance(
    userId: string,
    periodCode?: string,
  ): Promise<{ period: AttendancePeriod | null; records: AttendanceRecord[]; summary: any }> {
    const employee = await Employee.findOne({ where: { userId } });
    if (!employee) {
      throw AppError.notFound('No employee profile linked to your user account.');
    }

    let period: AttendancePeriod | null = null;
    if (periodCode) {
      period = await AttendancePeriod.findOne({ where: { periodCode } });
    } else {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const currentMonthCode = now.toISOString().slice(0, 7);

      period = await AttendancePeriod.findOne({
        where: {
          startDate: { [Op.lte]: today },
          endDate: { [Op.gte]: today },
        },
      });

      if (!period) {
        period = await AttendancePeriod.findOne({ where: { periodCode: currentMonthCode } });
      }

      if (!period) {
        period = await AttendancePeriod.findOne({
          where: { startDate: { [Op.lte]: today } },
          order: [['startDate', 'DESC']],
        });
      }
    }

    if (!period) {
      return { period: null, records: [], summary: null };
    }

    const records = await AttendanceRecord.findAll({
      where: {
        attendancePeriodId: period.id,
        employeeId: employee.id,
      },
      include: [
        { model: Shift, as: 'shift', attributes: ['name', 'workHours'] },
        { model: Project, as: 'project', attributes: ['name'] },
        { model: Client, as: 'client', attributes: ['name'] },
      ],
      order: [['workDate', 'ASC']],
    });

    let totalActual = 0;
    let totalRegular = 0;
    let totalOt = 0;
    let totalAbsences = 0;

    for (const r of records) {
      totalActual += Number(r.actualHours);
      totalRegular += Number(r.regularHours);
      totalOt += Number(r.otHours);
      if (r.isAbsent) totalAbsences++;
    }

    return {
      period,
      records,
      summary: {
        totalDays: records.length,
        totalActualHours: Number(totalActual.toFixed(2)),
        totalRegularHours: Number(totalRegular.toFixed(2)),
        totalOtHours: Number(totalOt.toFixed(2)),
        totalAbsences,
      },
    };
  }
}
