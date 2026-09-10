import { Op, fn, col } from 'sequelize';
import {
  DashboardSummaryDto,
  DashboardKpiSummaryDto,
  AttendanceOverviewDto,
  AttendanceDayTrendDto,
  LeaveOverviewDto,
  PayrollOverviewDto,
  WorkforceDistributionDto,
  ActionRequiredItemDto,
  RecentActivityItemDto,
} from '@blue-royal/contracts';
import { Employee } from '../../masters/models/employee.model';
import { Designation } from '../../masters/models/designation.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';
import { AttendanceRecord } from '../../attendance/models/attendance-record.model';
import { AttendancePeriod } from '../../attendance/models/attendance-period.model';
import { LeaveRequest } from '../../leave/models/leave-request.model';
import { LeaveType } from '../../leave/models/leave-type.model';
import { PayrollPeriod } from '../../payroll/models/payroll-period.model';
import { DocumentService } from '../../documents/services/document.service';
import { EmployeeOnboarding } from '../../onboarding/models/employee-onboarding.model';
import { AuditLog } from '../../auth/models/audit-log.model';
import { User } from '../../auth/models/user.model';

export class DashboardService {
  /**
   * Aggregate complete dashboard summary from real business models.
   */
  public static async getSummary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${currentYear}-${currentMonth}-01`;
    const lastDayOfMonth = new Date(currentYear, now.getMonth() + 1, 0).getDate();
    const endOfMonth = `${currentYear}-${currentMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Run parallel database queries for optimal performance
    const [
      totalEmployees,
      activeEmployees,
      newJoinersThisMonth,
      pendingLeavesCount,
      approvedLeavesCount,
      rejectedLeavesCount,
      approvedLeavesThisYear,
      leaveTypes,
      activeApprovedLeaveToday,
      latestPayrollPeriod,
      documentStats,
      incompleteOnboardingsCount,
      designations,
      employmentTypesGroup,
      latestAttendancePeriod,
      recentAuditLogs,
    ] = await Promise.all([
      // 1. Employee counts
      Employee.count({ where: { deletedAt: null } }),
      Employee.count({ where: { status: 'active', deletedAt: null } }),
      Employee.count({
        where: {
          dateOfJoining: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
          deletedAt: null,
        },
      }),

      // 2. Leave requests
      LeaveRequest.count({ where: { status: 'PENDING' } }),
      LeaveRequest.count({ where: { status: 'APPROVED' } }),
      LeaveRequest.count({ where: { status: 'REJECTED' } }),
      LeaveRequest.findAll({
        where: {
          status: 'APPROVED',
          startDate: { [Op.gte]: `${currentYear}-01-01` },
        },
        attributes: ['totalDays', 'leaveTypeId'],
      }),
      LeaveType.findAll({ where: { isActive: true }, order: [['name', 'ASC']] }),
      LeaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { [Op.lte]: todayStr },
          endDate: { [Op.gte]: todayStr },
        },
      }),

      // 3. Payroll
      PayrollPeriod.findOne({
        order: [['startDate', 'DESC'], ['createdAt', 'DESC']],
      }),

      // 4. Documents
      DocumentService.getDocumentStats().catch(() => ({
        totalDocuments: 0,
        verifiedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        validCount: 0,
        approachingExpiryCount: 0,
        criticalExpiryCount: 0,
        expiredCount: 0,
      })),

      // 5. Onboarding
      EmployeeOnboarding.count({
        where: {
          status: { [Op.in]: ['draft', 'in_progress', 'blocked'] },
        },
      }),

      // 6. Designations
      Designation.findAll({ where: { isActive: true }, order: [['title', 'ASC']] }),

      // 7. Employment types breakdown
      Employee.findAll({
        where: { deletedAt: null },
        attributes: [
          'employmentType',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['employmentType'],
        raw: true,
      }) as unknown as Promise<Array<{ employmentType: string; count: string | number }>>,

      // 8. Active Attendance Period (covers today, current month, or latest past period)
      AttendancePeriod.findOne({
        where: {
          startDate: { [Op.lte]: todayStr },
          endDate: { [Op.gte]: todayStr },
        },
      }).then(async (period) => {
        if (period) return period;
        const currentMonthCode = `${currentYear}-${currentMonth}`;
        const byMonth = await AttendancePeriod.findOne({ where: { periodCode: currentMonthCode } });
        if (byMonth) return byMonth;
        return AttendancePeriod.findOne({
          where: { startDate: { [Op.lte]: todayStr } },
          order: [['startDate', 'DESC']],
        });
      }),

      // 9. Recent Audit Logs
      AuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 8,
      }),
    ]);

    // =========================================================================
    // ATTENDANCE CALCULATION (Real DB data: Today or latest recorded work date)
    // =========================================================================
    let targetDate = todayStr;
    let recordsForDate = await AttendanceRecord.findAll({
      where: { workDate: targetDate },
    });
    const hasRecordsForToday = recordsForDate.length > 0;

    if (!hasRecordsForToday) {
      const latestRecord = await AttendanceRecord.findOne({
        order: [['workDate', 'DESC']],
      });
      if (latestRecord) {
        targetDate = latestRecord.workDate;
        recordsForDate = await AttendanceRecord.findAll({
          where: { workDate: targetDate },
        });
      }
    }

    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    let onLeaveTodayCalc = 0;

    for (const rec of recordsForDate) {
      if (rec.isOnLeave) {
        onLeaveTodayCalc++;
      } else if (rec.isAbsent) {
        absentToday++;
      } else if (Number(rec.actualHours || 0) > 0 || Number(rec.regularHours || 0) > 0) {
        presentToday++;
      }
      if (rec.hasAnomaly) {
        lateToday++;
      }
    }

    const totalEvaluated = presentToday + absentToday + onLeaveTodayCalc;
    const attendanceRate = totalEvaluated > 0
      ? Math.round((presentToday / totalEvaluated) * 1000) / 10
      : 0;

    // Trend: Fetch last 7 distinct recorded work dates
    const distinctDates = await AttendanceRecord.findAll({
      attributes: [[fn('DISTINCT', col('work_date')), 'workDate']],
      where: { workDate: { [Op.lte]: targetDate } },
      order: [[col('workDate'), 'DESC']],
      limit: 7,
      raw: true,
    }) as unknown as Array<{ workDate: string }>;

    const datesAsc = distinctDates.map((d) => d.workDate).reverse();
    const trend: AttendanceDayTrendDto[] = [];

    for (const d of datesAsc) {
      const dayRecords = await AttendanceRecord.findAll({ where: { workDate: d } });
      let dPresent = 0;
      let dAbsent = 0;
      let dLate = 0;
      let dLeave = 0;

      for (const r of dayRecords) {
        if (r.isOnLeave) dLeave++;
        else if (r.isAbsent) dAbsent++;
        else if (Number(r.actualHours || 0) > 0 || Number(r.regularHours || 0) > 0) dPresent++;
        if (r.hasAnomaly) dLate++;
      }

      const dTotal = dPresent + dAbsent + dLeave;
      const dRate = dTotal > 0 ? Math.round((dPresent / dTotal) * 1000) / 10 : 0;

      const dateObj = new Date(`${d}T00:00:00Z`);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const dayNum = dateObj.getUTCDate();
      const monthNum = dateObj.getUTCMonth() + 1;

      trend.push({
        date: d,
        dayLabel: `${dayName} ${dayNum}/${monthNum}`,
        present: dPresent,
        absent: dAbsent,
        late: dLate,
        onLeave: dLeave,
        attendanceRate: dRate,
      });
    }

    const onLeaveFinal = activeApprovedLeaveToday > 0 ? activeApprovedLeaveToday : onLeaveTodayCalc;

    const attendance: AttendanceOverviewDto = {
      today: {
        date: targetDate,
        present: presentToday,
        absent: absentToday,
        late: lateToday,
        onLeave: onLeaveFinal,
        attendanceRate,
        hasRecords: recordsForDate.length > 0,
      },
      trend,
      periodCode: latestAttendancePeriod?.periodCode,
      periodName: latestAttendancePeriod?.name,
    };

    // =========================================================================
    // LEAVE OVERVIEW
    // =========================================================================
    let totalDaysTaken = 0;
    const leaveTypeDaysMap = new Map<string, { days: number; count: number }>();

    for (const lr of approvedLeavesThisYear) {
      const days = Number(lr.totalDays) || 0;
      totalDaysTaken += days;
      const curr = leaveTypeDaysMap.get(lr.leaveTypeId) || { days: 0, count: 0 };
      curr.days += days;
      curr.count += 1;
      leaveTypeDaysMap.set(lr.leaveTypeId, curr);
    }

    const byType = leaveTypes.map((lt) => {
      const stat = leaveTypeDaysMap.get(lt.id) || { days: 0, count: 0 };
      return {
        leaveTypeId: lt.id,
        code: lt.code,
        name: lt.name,
        daysTaken: Math.round(stat.days * 100) / 100,
        requestCount: stat.count,
      };
    });

    const leave: LeaveOverviewDto = {
      pendingCount: pendingLeavesCount,
      approvedCount: approvedLeavesCount,
      rejectedCount: rejectedLeavesCount,
      totalDaysTaken: Math.round(totalDaysTaken * 100) / 100,
      byType,
    };

    // =========================================================================
    // PAYROLL OVERVIEW
    // =========================================================================
    let payroll: PayrollOverviewDto;
    if (latestPayrollPeriod) {
      payroll = {
        hasData: true,
        periodCode: latestPayrollPeriod.periodCode,
        periodName: latestPayrollPeriod.name,
        status: latestPayrollPeriod.status,
        startDate: latestPayrollPeriod.startDate,
        endDate: latestPayrollPeriod.endDate,
        employeesProcessed: latestPayrollPeriod.employeeCount || 0,
        totalEmployees: activeEmployees,
        totalGrossPay: Number(latestPayrollPeriod.totalGrossPay) || 0,
        totalNetPay: Number(latestPayrollPeriod.totalNetPay) || 0,
        currency: 'AED',
        pendingActions:
          (latestPayrollPeriod.blockingIssuesCount || 0) +
          (['draft', 'calculated'].includes(latestPayrollPeriod.status) ? 1 : 0),
      };
    } else {
      payroll = {
        hasData: false,
      };
    }

    // =========================================================================
    // WORKFORCE DISTRIBUTION
    // =========================================================================
    // 1. Designation counts from active assignments
    const activeAssignments = await EmployeeAssignment.findAll({
      where: {
        effectiveFrom: { [Op.lte]: todayStr },
        [Op.or]: [
          { effectiveTo: null },
          { effectiveTo: { [Op.gte]: todayStr } },
        ],
      },
      attributes: ['designationId', 'employeeId'],
    });

    const designationCountMap = new Map<string, number>();
    for (const assign of activeAssignments) {
      if (assign.designationId) {
        designationCountMap.set(
          assign.designationId,
          (designationCountMap.get(assign.designationId) || 0) + 1,
        );
      }
    }

    const assignedCountTotal = Array.from(designationCountMap.values()).reduce((a, b) => a + b, 0);
    const denominator = assignedCountTotal > 0 ? assignedCountTotal : (activeEmployees > 0 ? activeEmployees : 1);

    const byDesignation = designations
      .map((d) => {
        const count = designationCountMap.get(d.id) || 0;
        return {
          designationId: d.id,
          code: d.code,
          title: d.title,
          count,
          percentage: Math.round((count / denominator) * 1000) / 10,
        };
      })
      .filter((d) => d.count > 0 || designations.length <= 6)
      .sort((a, b) => b.count - a.count);

    // 2. Employment type counts
    const byEmploymentType = employmentTypesGroup.map((item) => {
      const count = Number(item.count) || 0;
      const label = item.employmentType === 'full_time' ? 'Full Time' : 'Contract';
      return {
        type: item.employmentType,
        label,
        count,
        percentage: totalEmployees > 0 ? Math.round((count / totalEmployees) * 1000) / 10 : 0,
      };
    });

    const workforce: WorkforceDistributionDto = {
      byDesignation,
      byEmploymentType,
    };

    // =========================================================================
    // ACTION REQUIRED
    // =========================================================================
    const actionRequired: ActionRequiredItemDto[] = [];

    if (pendingLeavesCount > 0) {
      actionRequired.push({
        id: 'action-pending-leaves',
        type: 'leave',
        title: `${pendingLeavesCount} Leave Request${pendingLeavesCount > 1 ? 's' : ''} Pending Approval`,
        count: pendingLeavesCount,
        description: 'Employee leave applications awaiting manager decision',
        actionUrl: '/leave',
        actionLabel: 'Review Requests',
        severity: 'warning',
      });
    }

    const criticalOrExpiredDocs =
      (documentStats.criticalExpiryCount || 0) + (documentStats.expiredCount || 0);
    if (criticalOrExpiredDocs > 0) {
      actionRequired.push({
        id: 'action-expiring-docs',
        type: 'document',
        title: `${criticalOrExpiredDocs} Employee Document${criticalOrExpiredDocs > 1 ? 's' : ''} Expired or Expiring Soon`,
        count: criticalOrExpiredDocs,
        description: 'Statutory compliance documents expired or within 30-day window',
        actionUrl: '/documents',
        actionLabel: 'Inspect Documents',
        severity: 'danger',
      });
    }

    if (incompleteOnboardingsCount > 0) {
      actionRequired.push({
        id: 'action-incomplete-onboarding',
        type: 'onboarding',
        title: `${incompleteOnboardingsCount} Onboarding Profile${incompleteOnboardingsCount > 1 ? 's' : ''} Incomplete`,
        count: incompleteOnboardingsCount,
        description: 'Workforce candidates pending 5-pillar verification and activations',
        actionUrl: '/onboarding',
        actionLabel: 'Open Onboarding Hub',
        severity: 'info',
      });
    }

    if (latestPayrollPeriod && (latestPayrollPeriod.blockingIssuesCount || 0) > 0) {
      actionRequired.push({
        id: 'action-payroll-blocking',
        type: 'payroll',
        title: `${latestPayrollPeriod.blockingIssuesCount} Blocking Issue${latestPayrollPeriod.blockingIssuesCount > 1 ? 's' : ''} in Payroll`,
        count: latestPayrollPeriod.blockingIssuesCount,
        description: `Period ${latestPayrollPeriod.periodCode} has unresolved calculation variances`,
        actionUrl: '/payroll',
        actionLabel: 'Inspect Payroll Hub',
        severity: 'danger',
      });
    }

    // =========================================================================
    // RECENT ACTIVITY (Real Audit Logs)
    // =========================================================================
    // Fetch actor user names for recent audit logs
    const actorIds = recentAuditLogs
      .map((l) => l.actorId)
      .filter((id): id is string => Boolean(id));

    const uniqueActorIds = Array.from(new Set(actorIds));
    const actors = uniqueActorIds.length > 0
      ? await User.findAll({
          where: { id: { [Op.in]: uniqueActorIds } },
          attributes: ['id', 'firstName', 'lastName', 'email'],
        })
      : [];

    const actorMap = new Map<string, string>();
    for (const u of actors) {
      const name = `${u.firstName} ${u.lastName}`.trim();
      actorMap.set(u.id, name || u.email);
    }

    const recentActivity: RecentActivityItemDto[] = recentAuditLogs.map((log) => {
      const actorName = (log.actorId && actorMap.get(log.actorId)) || 'System Admin';
      const createdDate = new Date(log.createdAt);
      return {
        id: log.id,
        action: log.action,
        description: DashboardService.formatAuditDescription(log.action, log.resourceType, actorName),
        actorName,
        timestamp: createdDate.toISOString(),
        relativeTime: DashboardService.getRelativeTime(createdDate, now),
        resourceType: log.resourceType,
      };
    });

    // =========================================================================
    // PRIMARY KPIS
    // =========================================================================
    const kpis: DashboardKpiSummaryDto = {
      totalEmployees,
      activeEmployees,
      presentToday,
      onLeaveToday: onLeaveFinal,
      pendingLeaves: pendingLeavesCount,
      newJoinersThisMonth,
    };

    return {
      kpis,
      attendance,
      leave,
      payroll,
      workforce,
      actionRequired,
      recentActivity,
    };
  }

  /**
   * Helper: Format audit log actions into human-readable descriptions.
   */
  private static formatAuditDescription(action: string, resourceType: string, actorName: string): string {
    switch (action) {
      case 'EMPLOYEE_CREATED':
        return `${actorName} added a new employee to directory`;
      case 'EMPLOYEE_UPDATED':
        return `${actorName} updated employee profile details`;
      case 'LEAVE_REQUEST_SUBMITTED':
        return `${actorName} submitted a leave application`;
      case 'LEAVE_REQUEST_APPROVED':
        return `Leave application approved by ${actorName}`;
      case 'LEAVE_REQUEST_REJECTED':
        return `Leave application rejected by ${actorName}`;
      case 'LEAVE_REQUEST_CANCELLED':
        return `Leave request cancelled by ${actorName}`;
      case 'DOCUMENT_UPLOADED':
        return `${actorName} uploaded an employee statutory document`;
      case 'DOCUMENT_VERIFIED':
        return `Document compliance verified by ${actorName}`;
      case 'PAYROLL_PERIOD_CREATED':
        return `New payroll cycle initialized by ${actorName}`;
      case 'PAYROLL_CALCULATED':
        return `Payroll calculation executed by ${actorName}`;
      case 'PAYROLL_FINALIZED':
        return `Monthly payroll cycle finalized by ${actorName}`;
      case 'ATTENDANCE_PERIOD_CREATED':
        return `Attendance period created by ${actorName}`;
      case 'ATTENDANCE_PERIOD_LOCKED':
        return `Attendance period locked by ${actorName}`;
      case 'ATTENDANCE_PERIOD_APPROVED':
        return `Attendance period approved by ${actorName}`;
      default: {
        const readable = action.replace(/_/g, ' ').toLowerCase();
        return `${readable.charAt(0).toUpperCase() + readable.slice(1)} on ${resourceType || 'record'}`;
      }
    }
  }

  /**
   * Helper: Compute friendly relative timestamp.
   */
  private static getRelativeTime(d: Date, now: Date): string {
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toISOString().slice(0, 10);
  }
}
