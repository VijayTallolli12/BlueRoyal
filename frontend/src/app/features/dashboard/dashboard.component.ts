import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardSummaryDto } from '@blue-royal/contracts';
import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="dashboard-workspace">
        <!-- HEADER -->
        <header class="dashboard-header">
          <div>
            <div class="breadcrumb">WORKSPACE / DASHBOARD</div>
            <h1 class="page-title">Enterprise HRMS Dashboard</h1>
            <p class="page-desc">Overview of your organization's workforce, attendance, leave and payroll.</p>
          </div>
          <div class="header-actions">
            @if (lastUpdated()) {
              <span class="last-sync-badge">
                <span class="material-symbols-outlined icon-xs text-muted">schedule</span>
                <span>Updated {{ lastUpdated() }}</span>
              </span>
            }
            <button class="btn btn-secondary" (click)="loadDashboardData()" [disabled]="isLoading()">
              <span class="material-symbols-outlined icon-sm" [class.spin]="isLoading()">sync</span>
              <span>{{ isLoading() ? 'Refreshing...' : 'Refresh Data' }}</span>
            </button>
          </div>
        </header>

        <!-- ERROR STATE -->
        @if (errorMessage() && !isLoading()) {
          <div class="alert-banner">
            <span class="material-symbols-outlined icon-md text-danger">error</span>
            <div class="alert-body">
              <strong>Unable to load dashboard data</strong>
              <p>{{ errorMessage() }}</p>
            </div>
            <button class="btn btn-sm btn-outline-danger" (click)="loadDashboardData()">Retry</button>
          </div>
        }

        <!-- LOADING SKELETON -->
        @if (isLoading() && !dashboardData()) {
          <div class="skeleton-layout">
            <div class="kpi-grid">
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <div class="kpi-card skeleton-card">
                  <div class="skeleton-line w-40"></div>
                  <div class="skeleton-line h-lg w-60"></div>
                  <div class="skeleton-line w-80"></div>
                </div>
              }
            </div>
            <div class="split-section">
              <div class="dashboard-card skeleton-card h-320 flex-1"></div>
              <div class="dashboard-card skeleton-card h-320 flex-1"></div>
            </div>
          </div>
        }

        <!-- MAIN DASHBOARD CONTENT -->
        @if (dashboardData(); as data) {
          <!-- EMPLOYEE SELF-SERVICE CALLOUT (If employee role without full admin access) -->
          @if (isEmployeeSelfServiceOnly()) {
            <section class="ess-banner">
              <div class="ess-info">
                <span class="ess-pill">EMPLOYEE PORTAL</span>
                <h2>Welcome back, {{ currentUserName() }}</h2>
                <p>Access your timesheets, submit leave applications, review payslips, and check documents.</p>
              </div>
              <div class="ess-actions">
                <a routerLink="/attendance/my-attendance" class="ess-btn">
                  <span class="material-symbols-outlined">schedule</span>
                  <span>My Attendance</span>
                </a>
                <a routerLink="/leave/my-leave" class="ess-btn">
                  <span class="material-symbols-outlined">event_available</span>
                  <span>My Leave</span>
                </a>
                <a routerLink="/payroll/my-payroll" class="ess-btn">
                  <span class="material-symbols-outlined">payments</span>
                  <span>My Payslips</span>
                </a>
                <a routerLink="/documents/my-documents" class="ess-btn">
                  <span class="material-symbols-outlined">description</span>
                  <span>My Documents</span>
                </a>
              </div>
            </section>
          }

          <!-- SECTION 1: PRIMARY HR KPIS (6 CARDS) -->
          <section class="kpi-section">
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-header">
                  <span class="kpi-label">TOTAL EMPLOYEES</span>
                  <div class="pill bg-blue"><span class="material-symbols-outlined">badge</span></div>
                </div>
                <div class="kpi-value">{{ data.kpis.totalEmployees }}</div>
                <div class="kpi-subtext">Across all workforce records</div>
              </div>

              <div class="kpi-card">
                <div class="kpi-header">
                  <span class="kpi-label">ACTIVE EMPLOYEES</span>
                  <div class="pill bg-green"><span class="material-symbols-outlined">person_check</span></div>
                </div>
                <div class="kpi-value text-success">{{ data.kpis.activeEmployees }}</div>
                <div class="kpi-subtext">Currently active</div>
              </div>

              <div class="kpi-card">
                <div class="kpi-header">
                  <span class="kpi-label">PRESENT TODAY</span>
                  <div class="pill bg-emerald"><span class="material-symbols-outlined">how_to_reg</span></div>
                </div>
                <div class="kpi-value">{{ data.kpis.presentToday }}</div>
                <div class="kpi-subtext">
                  {{ data.attendance.today.hasRecords ? "Today's attendance" : 'Latest recorded period' }}
                </div>
              </div>

              <div class="kpi-card">
                <div class="kpi-header">
                  <span class="kpi-label">ON LEAVE TODAY</span>
                  <div class="pill bg-cyan"><span class="material-symbols-outlined">beach_access</span></div>
                </div>
                <div class="kpi-value">{{ data.kpis.onLeaveToday }}</div>
                <div class="kpi-subtext">Approved leave today</div>
              </div>

              <div class="kpi-card" [class.highlight-warning]="data.kpis.pendingLeaves > 0">
                <div class="kpi-header">
                  <span class="kpi-label">PENDING LEAVE REQUESTS</span>
                  <div class="pill bg-amber"><span class="material-symbols-outlined">pending_actions</span></div>
                </div>
                <div class="kpi-value" [class.text-amber]="data.kpis.pendingLeaves > 0">
                  {{ data.kpis.pendingLeaves }}
                </div>
                <div class="kpi-subtext">Awaiting approval</div>
              </div>

              <div class="kpi-card">
                <div class="kpi-header">
                  <span class="kpi-label">NEW JOINERS</span>
                  <div class="pill bg-indigo"><span class="material-symbols-outlined">person_add</span></div>
                </div>
                <div class="kpi-value">{{ data.kpis.newJoinersThisMonth }}</div>
                <div class="kpi-subtext">This month</div>
              </div>
            </div>
          </section>

          <!-- SECTION 2: ATTENDANCE OVERVIEW -->
          <section class="attendance-section">
            <div class="dashboard-card">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-blue"><span class="material-symbols-outlined">schedule</span></div>
                  <div>
                    <h2 class="card-title">Attendance Overview</h2>
                    <span class="card-subtitle">Daily workforce presence, point-in-time shifts, and 7-day attendance trends</span>
                  </div>
                </div>
                <a routerLink="/attendance" class="link-action">
                  <span>Open Attendance Sheet</span>
                  <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                </a>
              </div>

              <div class="attendance-layout">
                <div class="chart-container">
                  <div class="chart-header">
                    <span class="chart-legend-title">7-Day Attendance Trend</span>
                    <div class="chart-legend">
                      <span class="legend-item"><span class="legend-dot bg-present"></span> Present</span>
                      <span class="legend-item"><span class="legend-dot bg-absent"></span> Absent</span>
                      <span class="legend-item"><span class="legend-dot bg-leave"></span> Leave</span>
                    </div>
                  </div>

                  @if (data.attendance.trend.length > 0) {
                    <div class="trend-chart-wrapper">
                      <svg class="trend-svg" viewBox="0 0 540 180" preserveAspectRatio="none">
                        <line x1="20" y1="30" x2="520" y2="30" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="80" x2="520" y2="80" stroke="#f1f5f9" stroke-width="1" />
                        <line x1="20" y1="130" x2="520" y2="130" stroke="#e2e8f0" stroke-width="1" />

                        @for (day of data.attendance.trend; track day.date; let idx = $index) {
                          <g [attr.transform]="'translate(' + (35 + idx * 70) + ', 0)'" class="chart-group">
                            <rect x="0" y="25" width="34" height="105" rx="4" fill="#f8fafc" />
                            <rect
                              x="0"
                              [attr.y]="getBarY(day.attendanceRate)"
                              width="34"
                              [attr.height]="getBarHeight(day.attendanceRate)"
                              rx="4"
                              fill="#3b82f6"
                              class="svg-bar"
                            />
                            <text x="17" [attr.y]="getBarY(day.attendanceRate) - 6" text-anchor="middle" class="svg-metric-text">
                              {{ day.attendanceRate }}%
                            </text>
                            <text x="17" y="152" text-anchor="middle" class="svg-day-text">{{ day.dayLabel }}</text>
                            <text x="17" y="168" text-anchor="middle" class="svg-sub-text">{{ day.present }} pres</text>
                          </g>
                        }
                      </svg>
                    </div>
                  } @else {
                    <div class="empty-state-box">
                      <span class="material-symbols-outlined icon-lg text-muted">query_stats</span>
                      <p>No historical attendance records available for trend evaluation.</p>
                    </div>
                  }
                </div>

                <div class="attendance-summary-box">
                  <div class="rate-gauge-card">
                    <div class="rate-number">{{ data.attendance.today.attendanceRate }}%</div>
                    <div class="rate-label">Attendance Rate</div>
                    <div class="bar-track mt-2">
                      <div
                        class="bar-fill"
                        [style.width.%]="data.attendance.today.attendanceRate"
                        [class.rate-high]="data.attendance.today.attendanceRate >= 90"
                        [class.rate-mid]="data.attendance.today.attendanceRate >= 75 && data.attendance.today.attendanceRate < 90"
                        [class.rate-low]="data.attendance.today.attendanceRate < 75"
                      ></div>
                    </div>
                  </div>

                  <div class="att-grid">
                    <div class="att-tile">
                      <span class="tile-lbl">Present</span>
                      <span class="tile-val text-success">{{ data.attendance.today.present }}</span>
                    </div>
                    <div class="att-tile">
                      <span class="tile-lbl">Absent</span>
                      <span class="tile-val text-danger">{{ data.attendance.today.absent }}</span>
                    </div>
                    <div class="att-tile">
                      <span class="tile-lbl">Late / Anomalies</span>
                      <span class="tile-val text-amber">{{ data.attendance.today.late }}</span>
                    </div>
                    <div class="att-tile">
                      <span class="tile-lbl">On Leave</span>
                      <span class="tile-val text-info">{{ data.attendance.today.onLeave }}</span>
                    </div>
                  </div>

                  @if (data.attendance.periodCode) {
                    <div class="att-period-info">
                      <span class="material-symbols-outlined icon-xs">info</span>
                      <span>Active Period: {{ data.attendance.periodName || data.attendance.periodCode }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- SECTION 3 & SECTION 5: LEAVE OVERVIEW & EMPLOYEE OVERVIEW (2-COLUMN) -->
          <div class="split-section">
            <!-- SECTION 3: LEAVE OVERVIEW -->
            <div class="dashboard-card flex-1">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-cyan"><span class="material-symbols-outlined">event_available</span></div>
                  <div>
                    <h2 class="card-title">Leave Overview</h2>
                    <span class="card-subtitle">Annual allocations, request queues, and approved leaves</span>
                  </div>
                </div>
                <a routerLink="/leave" class="link-action">
                  <span>Review Requests</span>
                  <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                </a>
              </div>

              <div class="metrics-row-4">
                <div class="metric-box" [class.box-highlight]="data.leave.pendingCount > 0">
                  <span class="box-val" [class.text-amber]="data.leave.pendingCount > 0">{{ data.leave.pendingCount }}</span>
                  <span class="box-lbl">Pending Requests</span>
                </div>
                <div class="metric-box">
                  <span class="box-val text-success">{{ data.leave.approvedCount }}</span>
                  <span class="box-lbl">Approved</span>
                </div>
                <div class="metric-box">
                  <span class="box-val text-muted">{{ data.leave.rejectedCount }}</span>
                  <span class="box-lbl">Rejected</span>
                </div>
                <div class="metric-box">
                  <span class="box-val text-primary">{{ data.leave.totalDaysTaken }}</span>
                  <span class="box-lbl">Days Taken (YTD)</span>
                </div>
              </div>

              <div class="sub-block">
                <div class="section-sub-title">Leave Breakdown by Type</div>
                @if (data.leave.byType.length > 0) {
                  <div class="bar-rows-list">
                    @for (lt of data.leave.byType; track lt.leaveTypeId) {
                      <div class="bar-row">
                        <div class="bar-row-labels">
                          <span class="row-main">{{ lt.name }}</span>
                          <span class="row-aux">{{ lt.daysTaken }} days ({{ lt.requestCount }} approved)</span>
                        </div>
                        <div class="bar-track">
                          <div class="bar-fill bg-cyan-fill" [style.width.%]="getLeaveTypePercentage(lt.daysTaken, data.leave.totalDaysTaken)"></div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-inline-state">No leave type allocations configured.</div>
                }
              </div>
            </div>

            <!-- SECTION 5: EMPLOYEE OVERVIEW / WORKFORCE DISTRIBUTION -->
            <div class="dashboard-card flex-1">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-indigo"><span class="material-symbols-outlined">groups</span></div>
                  <div>
                    <h2 class="card-title">Employee Overview</h2>
                    <span class="card-subtitle">Workforce distribution by job designation and contract basis</span>
                  </div>
                </div>
                <a routerLink="/employees" class="link-action">
                  <span>Directory</span>
                  <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                </a>
              </div>

              <div class="sub-block">
                <div class="section-sub-title">Workforce by Designation</div>
                @if (data.workforce.byDesignation.length > 0) {
                  <div class="bar-rows-list">
                    @for (item of data.workforce.byDesignation; track item.designationId) {
                      <div class="bar-row">
                        <div class="bar-row-labels">
                          <span class="row-main">{{ item.title }}</span>
                          <span class="row-aux">{{ item.count }} ({{ item.percentage }}%)</span>
                        </div>
                        <div class="bar-track">
                          <div class="bar-fill bg-indigo-fill" [style.width.%]="item.percentage"></div>
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="empty-inline-state">No designations configured in database.</div>
                }
              </div>

              <div class="sub-block">
                <div class="section-sub-title">Employment Basis</div>
                <div class="chips-row">
                  @for (et of data.workforce.byEmploymentType; track et.type) {
                    <div class="chip">
                      <span class="material-symbols-outlined icon-xs">contract</span>
                      <span>{{ et.label }}: <strong>{{ et.count }} ({{ et.percentage }}%)</strong></span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION 4: PAYROLL OVERVIEW -->
          <section class="payroll-section">
            <div class="dashboard-card">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-emerald"><span class="material-symbols-outlined">payments</span></div>
                  <div>
                    <h2 class="card-title">Payroll Overview</h2>
                    <span class="card-subtitle">Compensation calculations, WPS wage protection, and payroll finalization</span>
                  </div>
                </div>
                <a routerLink="/payroll" class="link-action">
                  <span>Inspect Payroll Hub</span>
                  <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                </a>
              </div>

              @if (data.payroll.hasData) {
                <div class="payroll-grid">
                  <div class="p-block">
                    <span class="p-label">CURRENT PAYROLL PERIOD</span>
                    <div class="p-val-row">
                      <span class="p-name">{{ data.payroll.periodName || data.payroll.periodCode }}</span>
                      <span class="status-badge status-{{ data.payroll.status?.toLowerCase() }}">
                        {{ formatStatus(data.payroll.status) }}
                      </span>
                    </div>
                    <span class="p-sub">{{ data.payroll.startDate }} to {{ data.payroll.endDate }}</span>
                  </div>

                  <div class="p-block">
                    <span class="p-label">EMPLOYEES PROCESSED</span>
                    <div class="p-metric">{{ data.payroll.employeesProcessed }} / {{ data.payroll.totalEmployees }}</div>
                    <div class="bar-track mt-1">
                      <div
                        class="bar-fill bg-blue-fill"
                        [style.width.%]="getProcessedPercentage(data.payroll.employeesProcessed, data.payroll.totalEmployees)"
                      ></div>
                    </div>
                  </div>

                  <div class="p-block">
                    <span class="p-label">GROSS PAYROLL</span>
                    <div class="p-currency">{{ data.payroll.currency }} {{ data.payroll.totalGrossPay | number:'1.2-2' }}</div>
                    <span class="p-sub">Total gross salary & overtime earnings</span>
                  </div>

                  <div class="p-block">
                    <span class="p-label">PENDING ACTIONS</span>
                    @if (data.payroll.pendingActions && data.payroll.pendingActions > 0) {
                      <div class="p-alert text-danger">
                        <span class="material-symbols-outlined icon-sm">warning</span>
                        <span>{{ data.payroll.pendingActions }} Action(s) Pending</span>
                      </div>
                      <span class="p-sub">Variance checks or period review required</span>
                    } @else {
                      <div class="p-alert text-success">
                        <span class="material-symbols-outlined icon-sm">check_circle</span>
                        <span>Ready & Balanced</span>
                      </div>
                      <span class="p-sub">All calculations verified</span>
                    }
                  </div>
                </div>
              } @else {
                <div class="empty-state-banner">
                  <span class="material-symbols-outlined icon-lg text-muted">receipt_long</span>
                  <div>
                    <h4>Payroll data is not available for the current period</h4>
                    <p>Initialize a new monthly payroll period from the Payroll Hub to calculate remuneration.</p>
                  </div>
                  <a routerLink="/payroll" class="btn btn-secondary btn-sm">Open Payroll Hub</a>
                </div>
              }
            </div>
          </section>

          <!-- SECTION 6 & SECTION 7: ACTION REQUIRED & RECENT ACTIVITY (2-COLUMN) -->
          <div class="split-section">
            <!-- SECTION 6: ACTION REQUIRED -->
            <div class="dashboard-card flex-1">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-amber"><span class="material-symbols-outlined">notification_important</span></div>
                  <div>
                    <h2 class="card-title">Action Required</h2>
                    <span class="card-subtitle">Compliance gates and queues requiring administrative action</span>
                  </div>
                </div>
                @if (data.actionRequired.length > 0) {
                  <span class="count-badge">{{ data.actionRequired.length }} PENDING</span>
                }
              </div>

              @if (data.actionRequired.length > 0) {
                <div class="action-list">
                  @for (action of data.actionRequired; track action.id) {
                    <div class="action-item sev-{{ action.severity }}">
                      <div class="action-info">
                        <div class="action-head">
                          <span class="material-symbols-outlined act-icon">{{ getActionIcon(action.type) }}</span>
                          <span class="act-title">{{ action.title }}</span>
                        </div>
                        <p class="act-desc">{{ action.description }}</p>
                      </div>
                      <a [routerLink]="action.actionUrl" class="btn btn-xs btn-outline-primary">
                        <span>{{ action.actionLabel }}</span>
                        <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                      </a>
                    </div>
                  }
                </div>
              } @else {
                <div class="caught-up-box">
                  <span class="material-symbols-outlined check-icon">check_circle</span>
                  <div>
                    <h4>You're all caught up</h4>
                    <p>There are no urgent leave approvals, expiring statutory documents, or pending onboarding gates.</p>
                  </div>
                </div>
              }
            </div>

            <!-- SECTION 7: RECENT ACTIVITY -->
            <div class="dashboard-card flex-1">
              <div class="card-header">
                <div class="card-title-group">
                  <div class="pill bg-indigo"><span class="material-symbols-outlined">history</span></div>
                  <div>
                    <h2 class="card-title">Recent Activity</h2>
                    <span class="card-subtitle">Real-time organizational events and regulatory audit trail</span>
                  </div>
                </div>
              </div>

              @if (data.recentActivity.length > 0) {
                <div class="timeline">
                  @for (act of data.recentActivity; track act.id) {
                    <div class="timeline-row">
                      <div class="dot-col">
                        <span class="t-dot"></span>
                        <span class="t-line"></span>
                      </div>
                      <div class="timeline-text">
                        <div class="timeline-top">
                          <span class="t-desc">{{ act.description }}</span>
                          <span class="t-time">{{ act.relativeTime }}</span>
                        </div>
                        <span class="t-sub">{{ act.resourceType }} &bull; {{ act.actorName }}</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="empty-state-box">
                  <span class="material-symbols-outlined icon-lg text-muted">history_toggle_off</span>
                  <p>No recent activity recorded in the regulatory audit trail.</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </app-shell>
  `,
  styles: [`
    .dashboard-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding-bottom: 2rem;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .breadcrumb {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
      letter-spacing: -0.02em;
    }

    .page-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .last-sync-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--bg-surface-subtle);
      padding: 0.35rem 0.6rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-default);
    }

    .spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .alert-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.875rem 1.25rem;
      border-radius: var(--radius-md);
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }

    .alert-body { flex: 1; }
    .alert-body p { margin: 0.125rem 0 0; font-size: 0.8125rem; color: #b91c1c; }

    .ess-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: #fff;
      padding: 1.25rem 1.5rem;
      border-radius: var(--radius-lg);
      gap: 1rem;
      flex-wrap: wrap;
    }

    .ess-pill {
      font-size: 0.6875rem;
      font-weight: 700;
      background: rgba(255,255,255,0.2);
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
    }

    .ess-info h2 { font-size: 1.125rem; font-weight: 700; margin: 0.25rem 0 0.125rem; }
    .ess-info p { margin: 0; font-size: 0.8125rem; opacity: 0.9; }

    .ess-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .ess-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: rgba(255,255,255,0.15);
      color: #fff;
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-md);
      font-size: 0.75rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .ess-btn:hover { background: rgba(255,255,255,0.25); }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 1rem;
    }

    .kpi-card, .dashboard-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .kpi-card {
      padding: 1rem 1.125rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.375rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .kpi-card:hover { box-shadow: var(--shadow-md); }
    .kpi-card.highlight-warning { border-color: #fde68a; background: #fffdf5; }

    .kpi-header { display: flex; justify-content: space-between; align-items: center; }
    .kpi-label { font-size: 0.6875rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; }

    .pill {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
    }
    .bg-blue { background: #eff6ff; color: #1d4ed8; }
    .bg-green { background: #f0fdf4; color: #15803d; }
    .bg-emerald { background: #ecfdf5; color: #047857; }
    .bg-cyan { background: #ecfeff; color: #0e7490; }
    .bg-amber { background: #fffbeb; color: #b45309; }
    .bg-indigo { background: #e0e7ff; color: #4338ca; }

    .kpi-value {
      font-size: 1.625rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }
    .kpi-subtext { font-size: 0.75rem; color: var(--text-muted); }

    .dashboard-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.75rem;
    }

    .card-title-group { display: flex; align-items: center; gap: 0.75rem; }
    .card-title { font-size: 0.9375rem; font-weight: 700; color: var(--text-primary); margin: 0; }
    .card-subtitle { font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.125rem; }

    .link-action {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--brand-600);
      text-decoration: none;
      white-space: nowrap;
    }
    .link-action:hover { color: var(--brand-800); text-decoration: underline; }

    .count-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      color: #b45309;
      background: #fef3c7;
      border: 1px solid #fde68a;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-full);
    }

    .split-section { display: flex; gap: 1.25rem; }
    .flex-1 { flex: 1; min-width: 0; }
    @media (max-width: 960px) { .split-section { flex-direction: column; } }

    .attendance-layout { display: flex; gap: 1.25rem; }
    @media (max-width: 860px) { .attendance-layout { flex-direction: column; } }

    .chart-container { flex: 3; display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
    .chart-header { display: flex; justify-content: space-between; font-size: 0.8125rem; }
    .chart-legend-title { font-weight: 600; color: var(--text-secondary); }
    .chart-legend { display: flex; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted); }
    .legend-item { display: flex; align-items: center; gap: 0.25rem; }
    .legend-dot { width: 8px; height: 8px; border-radius: 2px; }
    .bg-present { background: #3b82f6; }
    .bg-absent { background: #ef4444; }
    .bg-leave { background: #06b6d4; }

    .trend-chart-wrapper {
      width: 100%;
      height: 180px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.25rem;
      background: #fff;
    }
    .trend-svg { width: 100%; height: 100%; }
    .svg-bar { transition: height 0.3s ease; }
    .svg-bar:hover { fill: #1d4ed8; }
    .svg-metric-text { font-size: 9px; font-weight: 700; fill: #1e3a8a; }
    .svg-day-text { font-size: 9px; font-weight: 600; fill: #475569; }
    .svg-sub-text { font-size: 8px; fill: #94a3b8; }

    .attendance-summary-box {
      flex: 2;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .rate-gauge-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: #fff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.875rem;
    }
    .rate-number { font-size: 1.875rem; font-weight: 700; color: var(--text-primary); line-height: 1; }
    .rate-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 0.25rem; }

    .bar-track { width: 100%; height: 6px; background: #e2e8f0; border-radius: var(--radius-full); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.3s ease; }
    .rate-high { background: #16a34a; }
    .rate-mid { background: #d97706; }
    .rate-low { background: #dc2626; }
    .bg-cyan-fill { background: #0ea5e9; }
    .bg-indigo-fill { background: #6366f1; }
    .bg-blue-fill { background: var(--brand-600); }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }

    .att-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
    .att-tile {
      background: #fff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.625rem;
      display: flex;
      flex-direction: column;
    }
    .tile-lbl { font-size: 0.6875rem; color: var(--text-muted); font-weight: 600; }
    .tile-val { font-size: 1.125rem; font-weight: 700; }
    .att-period-info { display: flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--text-muted); }

    .metrics-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
    @media (max-width: 600px) { .metrics-row-4 { grid-template-columns: repeat(2, 1fr); } }

    .metric-box {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      padding: 0.625rem;
      text-align: center;
      display: flex;
      flex-direction: column;
    }
    .metric-box.box-highlight { background: #fffdf5; border-color: #fde68a; }
    .box-val { font-size: 1.25rem; font-weight: 700; }
    .box-lbl { font-size: 0.6875rem; color: var(--text-muted); font-weight: 600; }

    .sub-block { display: flex; flex-direction: column; gap: 0.5rem; }
    .section-sub-title { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .bar-rows-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .bar-row { display: flex; flex-direction: column; gap: 0.25rem; }
    .bar-row-labels { display: flex; justify-content: space-between; font-size: 0.8125rem; }
    .row-main { font-weight: 600; color: var(--text-primary); }
    .row-aux { font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); }

    .chips-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      padding: 0.3rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .payroll-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .p-block {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.875rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.375rem;
    }
    .p-label { font-size: 0.6875rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; }
    .p-val-row { display: flex; align-items: center; justify-content: space-between; }
    .p-name { font-size: 1rem; font-weight: 700; color: var(--text-primary); }
    .p-metric { font-size: 1.125rem; font-weight: 700; }
    .p-currency { font-size: 1.25rem; font-weight: 700; color: #047857; }
    .p-alert { display: flex; align-items: center; gap: 0.25rem; font-weight: 700; font-size: 0.875rem; }
    .p-sub { font-size: 0.75rem; color: var(--text-muted); }

    .empty-state-banner {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg-surface-subtle);
      border-radius: var(--radius-md);
      flex-wrap: wrap;
    }
    .empty-state-banner h4 { margin: 0 0 0.125rem; font-size: 0.875rem; }
    .empty-state-banner p { margin: 0; font-size: 0.8125rem; color: var(--text-secondary); }

    .action-list { display: flex; flex-direction: column; gap: 0.625rem; }
    .action-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0.875rem;
      border-radius: var(--radius-md);
      border-left: 4px solid #cbd5e1;
      background: var(--bg-surface-subtle);
    }
    .action-item.sev-warning { border-left-color: #f59e0b; background: #fffdf5; }
    .action-item.sev-danger { border-left-color: #ef4444; background: #fef2f2; }
    .action-item.sev-info { border-left-color: #3b82f6; background: #eff6ff; }

    .action-info { flex: 1; min-width: 0; }
    .action-head { display: flex; align-items: center; gap: 0.375rem; }
    .act-icon { font-size: 1rem; }
    .sev-warning .act-icon { color: #d97706; }
    .sev-danger .act-icon { color: #dc2626; }
    .sev-info .act-icon { color: #2563eb; }
    .act-title { font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); }
    .act-desc { font-size: 0.75rem; color: var(--text-secondary); margin: 0.125rem 0 0 1.375rem; }

    .caught-up-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: var(--radius-md);
    }
    .check-icon { font-size: 2rem; color: #16a34a; }
    .caught-up-box h4 { margin: 0 0 0.125rem; font-size: 0.875rem; color: #15803d; }
    .caught-up-box p { margin: 0; font-size: 0.75rem; color: #166534; }

    .timeline { display: flex; flex-direction: column; gap: 0.625rem; }
    .timeline-row { display: flex; gap: 0.625rem; align-items: flex-start; }
    .dot-col { display: flex; flex-direction: column; align-items: center; padding-top: 0.25rem; }
    .t-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--brand-500); }
    .t-line { width: 1px; height: 22px; background: var(--border-default); margin-top: 0.25rem; }
    .timeline-row:last-child .t-line { display: none; }
    .timeline-text { flex: 1; display: flex; flex-direction: column; gap: 0.125rem; }
    .timeline-top { display: flex; justify-content: space-between; gap: 0.5rem; }
    .t-desc { font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); }
    .t-time { font-size: 0.6875rem; color: var(--text-muted); white-space: nowrap; }
    .t-sub { font-size: 0.6875rem; color: var(--text-muted); }

    .empty-state-box, .empty-inline-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 1.25rem;
      color: var(--text-muted);
      font-size: 0.8125rem;
      text-align: center;
    }

    .skeleton-layout { display: flex; flex-direction: column; gap: 1rem; }
    .skeleton-card { background: #fff; padding: 1rem; animation: pulse 1.5s ease-in-out infinite; }
    .skeleton-line { height: 10px; background: #e2e8f0; border-radius: var(--radius-sm); margin-bottom: 0.5rem; }
    .h-lg { height: 24px; }
    .h-320 { height: 260px; }
    .w-40 { width: 40%; }
    .w-60 { width: 60%; }
    .w-80 { width: 80%; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .text-success { color: #16a34a !important; }
    .text-danger { color: #dc2626 !important; }
    .text-amber { color: #d97706 !important; }
    .text-info { color: #0284c7 !important; }

    .status-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-full);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .status-draft { background: var(--status-draft-bg); color: var(--status-draft-text); border: 1px solid var(--status-draft-border); }
    .status-calculated { background: var(--status-pending-bg); color: var(--status-pending-text); border: 1px solid var(--status-pending-border); }
    .status-approved { background: var(--status-approved-bg); color: var(--status-approved-text); border: 1px solid var(--status-approved-border); }
    .status-finalized { background: var(--status-locked-bg); color: var(--status-locked-text); border: 1px solid var(--status-locked-border); }
  `]
})
export class DashboardComponent implements OnInit {
  public isLoading = signal<boolean>(true);
  public errorMessage = signal<string | null>(null);
  public dashboardData = signal<DashboardSummaryDto | null>(null);
  public lastUpdated = signal<string>('');

  public currentUserName = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return 'Colleague';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
  });

  public isEmployeeSelfServiceOnly = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    const isEmp = user.roles?.includes('employee');
    const hasAdminRead = this.authService.hasPermission('employees:read');
    return Boolean(isEmp && !hasAdminRead);
  });

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService,
  ) {}

  public ngOnInit(): void {
    this.loadDashboardData();
  }

  public loadDashboardData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.dashboardService.getSummary().subscribe({
      next: (res) => {
        this.dashboardData.set(res.data);
        this.isLoading.set(false);
        const now = new Date();
        this.lastUpdated.set(
          now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      },
      error: (err) => {
        this.isLoading.set(false);
        const message = err.error?.error?.message || 'Unable to connect to the HRMS backend service.';
        this.errorMessage.set(message);
      },
    });
  }

  public getBarHeight(rate: number): number {
    const clamped = Math.max(0, Math.min(100, rate));
    return Math.max(4, Math.round((clamped / 100) * 95));
  }

  public getBarY(rate: number): number {
    const height = this.getBarHeight(rate);
    return 125 - height;
  }

  public getLeaveTypePercentage(days: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.min(100, Math.round((days / total) * 100));
  }

  public getProcessedPercentage(processed?: number, total?: number): number {
    if (!processed || !total || total <= 0) return 0;
    return Math.min(100, Math.round((processed / total) * 100));
  }

  public formatStatus(status?: string): string {
    if (!status) return 'Unknown';
    switch (status.toLowerCase()) {
      case 'draft': return 'Draft';
      case 'calculated': return 'Calculated';
      case 'approved': return 'Approved';
      case 'finalized': return 'Finalized';
      default: return status.toUpperCase();
    }
  }

  public getActionIcon(type: string): string {
    switch (type) {
      case 'leave': return 'event_busy';
      case 'document': return 'warning';
      case 'onboarding': return 'person_alert';
      case 'payroll': return 'error';
      default: return 'notifications';
    }
  }
}
