export interface DashboardKpiSummaryDto {
  totalEmployees: number;
  activeEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  pendingLeaves: number;
  newJoinersThisMonth: number;
}

export interface AttendanceDayTrendDto {
  date: string;
  dayLabel: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  attendanceRate: number;
}

export interface AttendanceTodayDto {
  date: string;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  attendanceRate: number;
  hasRecords: boolean;
}

export interface AttendanceOverviewDto {
  today: AttendanceTodayDto;
  trend: AttendanceDayTrendDto[];
  periodCode?: string;
  periodName?: string;
}

export interface LeaveTypeStatDto {
  leaveTypeId: string;
  code: string;
  name: string;
  daysTaken: number;
  requestCount: number;
}

export interface LeaveOverviewDto {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalDaysTaken: number;
  byType: LeaveTypeStatDto[];
}

export interface PayrollOverviewDto {
  hasData: boolean;
  periodCode?: string;
  periodName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  employeesProcessed?: number;
  totalEmployees?: number;
  totalGrossPay?: number;
  totalNetPay?: number;
  totalDeductions?: number;
  currency?: string;
  pendingActions?: number;
}

export interface DesignationDistributionItemDto {
  designationId: string;
  code: string;
  title: string;
  count: number;
  percentage: number;
}

export interface EmploymentTypeDistributionItemDto {
  type: string;
  label: string;
  count: number;
  percentage: number;
}

export interface RegionDistributionItemDto {
  country: string;
  count: number;
  percentage: number;
}

export interface WorkforceDistributionDto {
  byDesignation: DesignationDistributionItemDto[];
  byEmploymentType: EmploymentTypeDistributionItemDto[];
  byRegion: RegionDistributionItemDto[];
}

export interface ActionRequiredItemDto {
  id: string;
  type: 'leave' | 'document' | 'onboarding' | 'payroll';
  title: string;
  count: number;
  description: string;
  actionUrl: string;
  actionLabel: string;
  severity: 'warning' | 'info' | 'danger';
}

export interface RecentActivityItemDto {
  id: string;
  action: string;
  description: string;
  actorName?: string;
  timestamp: string;
  relativeTime: string;
  resourceType: string;
}

export interface DashboardSummaryDto {
  kpis: DashboardKpiSummaryDto;
  attendance: AttendanceOverviewDto;
  leave: LeaveOverviewDto;
  payroll: PayrollOverviewDto;
  workforce: WorkforceDistributionDto;
  actionRequired: ActionRequiredItemDto[];
  recentActivity: RecentActivityItemDto[];
}
