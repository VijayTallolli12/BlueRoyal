import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LeaveService } from '../../core/services/leave.service';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { PayrollService } from '../../core/services/payroll.service';
import { DocumentService } from '../../core/services/document.service';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, HealthCheckResponse, LeaveRequestDto, DocumentStatsDto } from '@blue-royal/contracts';
import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="dashboard-workspace">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <div class="breadcrumb">WORKSPACE / DASHBOARD</div>
            <h1 class="page-title">Operational Command Center</h1>
            <p class="page-desc">
              High-priority workforce actions, live compliance pulse, and role-authorized operational pipelines.
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="refreshAll()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh Pulse</span>
            </button>
          </div>
        </div>

        <!-- SECTION 1: HIGH-PRIORITY OPERATIONAL ACTION QUEUE -->
        @if (authService.hasPermission('attendance:read') || authService.hasPermission('leave:read') || authService.hasPermission('payroll:read')) {
          <div class="action-queue-section">
            <div class="section-heading">
              <span class="material-symbols-outlined icon-sm text-accent">notifications_active</span>
              <h2>Items Requiring Immediate Action</h2>
            </div>

            <div class="action-queue-grid">
              <!-- Action 1: Pending Leave Approvals -->
              @if (authService.hasPermission('leave:approve')) {
                <div class="action-card" [class.highlight]="pendingLeavesCount() > 0">
                  <div class="action-card-top">
                    <div class="action-icon-pill leave">
                      <span class="material-symbols-outlined">event_available</span>
                    </div>
                    <span class="action-badge" [class.badge-alert]="pendingLeavesCount() > 0">
                      {{ pendingLeavesCount() > 0 ? pendingLeavesCount() + ' PENDING' : 'CLEAR' }}
                    </span>
                  </div>
                  <div class="action-card-body">
                    <h3>Employee Leave Approvals</h3>
                    <p>
                      {{ pendingLeavesCount() > 0 ? pendingLeavesCount() + ' leave application(s) awaiting managerial decision' : 'All leave applications are currently processed' }}
                    </p>
                  </div>
                  <a routerLink="/leave" class="action-link">
                    <span>Review Queue</span>
                    <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                  </a>
                </div>
              }

              <!-- Action 2: Attendance Review & Locking -->
              @if (authService.hasPermission('attendance:approve')) {
                <div class="action-card">
                  <div class="action-card-top">
                    <div class="action-icon-pill attendance">
                      <span class="material-symbols-outlined">schedule</span>
                    </div>
                    <span class="action-badge">ACTIVE PERIOD</span>
                  </div>
                  <div class="action-card-body">
                    <h3>Attendance & Overtime Review</h3>
                    <p>Monthly point-in-time shifts, overtime calculations, and anomaly resolution.</p>
                  </div>
                  <a routerLink="/attendance" class="action-link">
                    <span>Open Attendance Sheet</span>
                    <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                  </a>
                </div>
              }

              <!-- Action 3: Payroll Finalization Gate -->
              @if (authService.hasPermission('payroll:calculate')) {
                <div class="action-card">
                  <div class="action-card-top">
                    <div class="action-icon-pill payroll">
                      <span class="material-symbols-outlined">payments</span>
                    </div>
                    <span class="action-badge">ZERO-VARIANCE</span>
                  </div>
                  <div class="action-card-body">
                    <h3>Payroll Processing Cycle</h3>
                    <p>Execute calculations directly from locked attendance with immutable financial records.</p>
                  </div>
                  <a routerLink="/payroll" class="action-link">
                    <span>Inspect Payroll Hub</span>
                    <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                  </a>
                </div>
              }

              <!-- Action 4: Document Expiry Compliance Alert -->
              @if (authService.hasPermission('documents:read')) {
                <div class="action-card" [class.highlight]="criticalDocsCount() > 0">
                  <div class="action-card-top">
                    <div class="action-icon-pill" style="background:#fee2e2; color:#b91c1c;">
                      <span class="material-symbols-outlined">warning</span>
                    </div>
                    <span class="action-badge" [class.badge-alert]="criticalDocsCount() > 0">
                      {{ criticalDocsCount() > 0 ? criticalDocsCount() + ' EXPIRING/EXPIRED' : 'COMPLIANT' }}
                    </span>
                  </div>
                  <div class="action-card-body">
                    <h3>Document Expiry Alerts</h3>
                    <p>
                      {{ criticalDocsCount() > 0 ? criticalDocsCount() + ' employee document(s) expired or expiring within 30 days' : 'All workforce statutory records are currently valid' }}
                    </p>
                  </div>
                  <a routerLink="/documents" class="action-link">
                    <span>Inspect Documents</span>
                    <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                  </a>
                </div>
              }

              <!-- Action 5: Onboarding Pipelines -->
              @if (authService.hasPermission('onboarding:read')) {
                <div class="action-card">
                  <div class="action-card-top">
                    <div class="action-icon-pill" style="background:#e0e7ff; color:#3730a3;">
                      <span class="material-symbols-outlined">person_add_alt</span>
                    </div>
                    <span class="action-badge">READINESS</span>
                  </div>
                  <div class="action-card-body">
                    <h3>Onboarding Gate & Activations</h3>
                    <p>Enforce statutory 5-pillar verification before active workforce assignment.</p>
                  </div>
                  <a routerLink="/onboarding" class="action-link">
                    <span>Open Onboarding Hub</span>
                    <span class="material-symbols-outlined icon-xs">arrow_forward</span>
                  </a>
                </div>
              }
            </div>
          </div>
        }

        <!-- SECTION 2: OPERATIONAL WORKSPACES HUB -->
        @if (authService.hasPermission('designations:read')) {
          <div class="workspaces-section">
            <div class="section-heading">
              <span class="material-symbols-outlined icon-sm text-secondary">hub</span>
              <h2>Operational Modules & Catalogs</h2>
            </div>

            <div class="workspaces-grid">
              <a routerLink="/employees" class="workspace-card">
                <div class="ws-icon"><span class="material-symbols-outlined">badge</span></div>
                <div class="ws-content">
                  <h4>Employee Directory</h4>
                  <p>Biographical rosters, employment contracts, and profile management</p>
                </div>
                <span class="material-symbols-outlined ws-arrow">arrow_forward</span>
              </a>

              <a routerLink="/attendance" class="workspace-card">
                <div class="ws-icon"><span class="material-symbols-outlined">schedule</span></div>
                <div class="ws-content">
                  <h4>Attendance & Timesheets</h4>
                  <p>Monthly shift matrices, overtime tracking, and Excel template imports</p>
                </div>
                <span class="material-symbols-outlined ws-arrow">arrow_forward</span>
              </a>

              <a routerLink="/leave" class="workspace-card">
                <div class="ws-icon"><span class="material-symbols-outlined">beach_access</span></div>
                <div class="ws-content">
                  <h4>Leave Management</h4>
                  <p>Statutory quotas, annual entitlement tracking, and manager approvals</p>
                </div>
                <span class="material-symbols-outlined ws-arrow">arrow_forward</span>
              </a>

              <a routerLink="/payroll" class="workspace-card">
                <div class="ws-icon"><span class="material-symbols-outlined">receipt_long</span></div>
                <div class="ws-content">
                  <h4>Payroll Processing</h4>
                  <p>Multi-tier calculations, manual adjustments, and immutable finalization</p>
                </div>
                <span class="material-symbols-outlined ws-arrow">arrow_forward</span>
              </a>

              <a routerLink="/masters" class="workspace-card">
                <div class="ws-icon"><span class="material-symbols-outlined">dataset</span></div>
                <div class="ws-content">
                  <h4>Master Catalogs</h4>
                  <p>Designations, clients, projects, shifts, holidays, and salary packages</p>
                </div>
                <span class="material-symbols-outlined ws-arrow">arrow_forward</span>
              </a>
            </div>
          </div>
        }

        <!-- SECTION 3: EMPLOYEE SELF-SERVICE TILES (FOR EMPLOYEE ROLE) -->
        @if (authService.currentUser()?.roles?.includes('employee') && !authService.hasPermission('designations:read')) {
          <div class="employee-portal-card">
            <div class="portal-header">
              <h2>Employee Self-Service Navigation</h2>
              <p>Direct access to your official personnel records, attendance timesheets, and compensation</p>
            </div>
            <div class="portal-grid">
              <a routerLink="/attendance/my-attendance" class="portal-action-tile">
                <div class="tile-icon"><span class="material-symbols-outlined">schedule</span></div>
                <div class="tile-info">
                  <span class="tile-title">Monthly Timesheet</span>
                  <span class="tile-desc">Inspect regular hours, overtime, and work shifts</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>

              <a routerLink="/leave/my-leave" class="portal-action-tile">
                <div class="tile-icon"><span class="material-symbols-outlined">beach_access</span></div>
                <div class="tile-info">
                  <span class="tile-title">Leave Entitlements</span>
                  <span class="tile-desc">Review allocated balances and submit leave requests</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>

              <a routerLink="/payroll/my-payroll" class="portal-action-tile">
                <div class="tile-icon"><span class="material-symbols-outlined">receipt_long</span></div>
                <div class="tile-info">
                  <span class="tile-title">Remuneration Payslips</span>
                  <span class="tile-desc">Access published payslips with itemized printable view</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>
            </div>
          </div>
        }

        <!-- SECTION 4: SYSTEM GOVERNANCE & NODE HEALTH -->
        <div class="system-health-section">
          <div class="section-heading">
            <span class="material-symbols-outlined icon-sm text-secondary">shield</span>
            <h2>System Governance & Node Telemetry</h2>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Active Role Profile</span>
              @if (authService.currentUser(); as user) {
                <span class="kpi-value">{{ user.roles[0] | uppercase }}</span>
                <span class="kpi-sub">{{ user.permissions.length }} Active Permissions</span>
              }
            </div>

            <div class="kpi-card">
              <span class="kpi-label">PostgreSQL Database</span>
              @if (healthData(); as health) {
                <div class="kpi-row">
                  <span class="status-badge status-{{ health.components.database.status }}">
                    {{ health.components.database.status | uppercase }}
                  </span>
                  <span class="kpi-metric-aux">{{ health.components.database.latencyMs }}ms</span>
                </div>
                <span class="kpi-sub">Connection pool healthy</span>
              } @else {
                <span class="kpi-sub">Checking database...</span>
              }
            </div>

            <div class="kpi-card">
              <span class="kpi-label">API Gateway Node</span>
              @if (healthData(); as health) {
                <div class="kpi-row">
                  <span class="status-badge status-{{ health.status }}">
                    {{ health.status | uppercase }}
                  </span>
                  <span class="kpi-metric-aux">Up {{ health.uptimeSeconds }}s</span>
                </div>
                <span class="kpi-sub">Node.js Express Engine</span>
              } @else {
                <span class="kpi-sub">Connecting...</span>
              }
            </div>

            <div class="kpi-card">
              <span class="kpi-label">Audit Engine & Security</span>
              <span class="kpi-value text-success">ENFORCED</span>
              <span class="kpi-sub">Immutable Regulatory Logs</span>
            </div>
          </div>
        </div>
      </div>
    </app-shell>
  `,
  styles: [`
    .dashboard-workspace {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
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

    .section-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .section-heading h2 {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: -0.01em;
    }

    /* Action Queue Cards */
    .action-queue-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .action-card {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
      transition: all 0.2s ease;
    }

    .action-card:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }

    .action-card.highlight {
      border-color: #fde68a;
      background: linear-gradient(180deg, #ffffff 0%, #fffdf7 100%);
    }

    .action-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .action-icon-pill {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .action-icon-pill.leave {
      background: var(--brand-50);
      color: var(--brand-700);
    }

    .action-icon-pill.attendance {
      background: #f0fdf4;
      color: #15803d;
    }

    .action-icon-pill.payroll {
      background: #fefce8;
      color: #b45309;
    }

    .action-badge {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: var(--bg-surface-subtle);
      color: var(--text-secondary);
    }

    .action-badge.badge-alert {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .action-card-body h3 {
      font-size: 0.9375rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.375rem;
    }

    .action-card-body p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.45;
      margin: 0;
    }

    .action-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--brand-700);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .action-link:hover {
      color: var(--brand-900);
    }

    /* Workspaces Grid */
    .workspaces-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .workspace-card {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.25rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .workspace-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--brand-500);
    }

    .ws-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--bg-surface-subtle);
      color: var(--brand-700);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ws-content {
      flex: 1;
    }

    .ws-content h4 {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
    }

    .ws-content p {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0;
      line-height: 1.35;
    }

    .ws-arrow {
      color: var(--text-muted);
      font-size: 1.125rem;
      opacity: 0;
      transition: all 0.15s ease;
    }

    .workspace-card:hover .ws-arrow {
      opacity: 1;
      transform: translateX(2px);
      color: var(--brand-700);
    }

    /* Employee Portal Card */
    .employee-portal-card {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: 1.5rem;
    }

    .portal-header {
      margin-bottom: 1.25rem;
    }

    .portal-header h2 {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
    }

    .portal-header p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .portal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }

    .portal-action-tile {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      background: var(--bg-surface-subtle);
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .portal-action-tile:hover {
      background: #ffffff;
      border-color: var(--brand-500);
      box-shadow: var(--shadow-sm);
      transform: translateY(-1px);
    }

    .tile-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--brand-50);
      color: var(--brand-700);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .tile-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .tile-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .tile-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .tile-arrow {
      color: var(--text-muted);
      font-size: 1.125rem;
    }

    .kpi-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .kpi-metric-aux {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      color: var(--text-muted);
    }
  `]
})
export class DashboardComponent implements OnInit {
  public healthData = signal<HealthCheckResponse | null>(null);
  public pendingLeavesCount = signal<number>(0);
  public criticalDocsCount = signal<number>(0);

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private leaveService: LeaveService,
    private attendanceService: AttendanceApiService,
    private payrollService: PayrollService,
    private documentService: DocumentService,
  ) {}

  public ngOnInit(): void {
    this.refreshAll();
  }

  public refreshAll(): void {
    this.fetchHealth();
    if (this.authService.hasPermission('leave:read')) {
      this.leaveService.listRequests().subscribe({
        next: (res: ApiSuccessResponse<LeaveRequestDto[]>) => {
          const pending = res.data.filter((r: LeaveRequestDto) => r.status === 'PENDING').length;
          this.pendingLeavesCount.set(pending);
        },
        error: () => {}
      });
    }

    if (this.authService.hasPermission('documents:read')) {
      this.documentService.getDocumentStats().subscribe({
        next: (res: ApiSuccessResponse<DocumentStatsDto>) => {
          const totalUrgent = (res.data.criticalExpiryCount || 0) + (res.data.expiredCount || 0);
          this.criticalDocsCount.set(totalUrgent);
        },
        error: () => {}
      });
    }
  }

  public fetchHealth(): void {
    this.http
      .get<ApiSuccessResponse<HealthCheckResponse>>(`${environment.apiUrl}/health`)
      .subscribe({
        next: (res) => this.healthData.set(res.data),
        error: (err) => console.error('Failed to fetch node telemetry', err),
      });
  }
}
