import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, HealthCheckResponse } from '@blue-royal/contracts';
import { MastersHubComponent } from '../masters/masters-hub.component';
import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MastersHubComponent, AppShellComponent],
  template: `
    <app-shell>
      <div class="dashboard-workspace">
        <!-- Page Title & Overview -->
        <div class="page-header">
          <div>
            <div class="breadcrumb">WORKSPACE / DASHBOARD</div>
            <h1 class="page-title">Executive Overview & Workspaces</h1>
            <p class="page-desc">
              Operational status, real-time node health, and role-authorized management hubs.
            </p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" (click)="fetchHealth()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh Node</span>
            </button>
          </div>
        </div>

        <!-- Health & Status KPI Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Current Role Profile</span>
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
            <span class="kpi-label">Security & RBAC</span>
            <span class="kpi-value text-success">LOCKED</span>
            <span class="kpi-sub">Strict Scope Boundaries</span>
          </div>
        </div>

        <!-- Role Workspace Specific Entrypoints -->
        @if (authService.hasPermission('designations:read')) {
          <div class="admin-masters-container">
            <app-masters-hub></app-masters-hub>
          </div>
        } @else if (authService.hasPermission('attendance:self_read')) {
          <!-- Employee Quick Actions Hub -->
          <div class="employee-portal-card">
            <div class="portal-header">
              <h3>Employee Self-Service Navigation</h3>
              <p>Quick access to your official workforce records, attendance timesheets, and remuneration</p>
            </div>
            <div class="portal-grid">
              <a routerLink="/attendance/my-attendance" class="portal-action-tile">
                <div class="tile-icon">
                  <span class="material-symbols-outlined">schedule</span>
                </div>
                <div class="tile-info">
                  <span class="tile-title">Monthly Timesheet</span>
                  <span class="tile-desc">Inspect regular hours, overtime, and work shifts</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>

              <a routerLink="/leave/my-leave" class="portal-action-tile">
                <div class="tile-icon">
                  <span class="material-symbols-outlined">beach_access</span>
                </div>
                <div class="tile-info">
                  <span class="tile-title">Leave Entitlements</span>
                  <span class="tile-desc">Review allocated balances and submit leave requests</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>

              <a routerLink="/payroll/my-payroll" class="portal-action-tile">
                <div class="tile-icon">
                  <span class="material-symbols-outlined">receipt_long</span>
                </div>
                <div class="tile-info">
                  <span class="tile-title">Remuneration Payslips</span>
                  <span class="tile-desc">Access published payslips with printable breakdown</span>
                </div>
                <span class="material-symbols-outlined tile-arrow">arrow_forward</span>
              </a>
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
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border-default);
      padding-bottom: 1.25rem;
    }

    .breadcrumb {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .page-title {
      font-size: 1.375rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.25rem;
    }

    .page-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .kpi-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0.25rem 0;
    }

    .kpi-metric-aux {
      font-size: 0.8125rem;
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--text-muted);
    }

    .text-success {
      color: #16a34a !important;
    }

    .admin-masters-container {
      margin-top: 0.5rem;
    }

    .employee-portal-card {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      box-shadow: var(--shadow-sm);
    }

    .portal-header {
      margin-bottom: 1.25rem;
    }

    .portal-header h3 {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .portal-header p {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .portal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .portal-action-tile {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.125rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .portal-action-tile:hover {
      background: #ffffff;
      border-color: var(--brand-500);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .tile-icon {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-md);
      background: var(--brand-50);
      color: var(--brand-700);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .portal-action-tile:hover .tile-icon {
      background: var(--brand-700);
      color: #ffffff;
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
      font-size: 20px;
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .portal-action-tile:hover .tile-arrow {
      color: var(--brand-600);
      transform: translateX(3px);
    }
  `]
})
export class DashboardComponent implements OnInit {
  public healthData = signal<HealthCheckResponse | null>(null);

  constructor(
    public authService: AuthService,
    private http: HttpClient,
  ) {}

  public ngOnInit(): void {
    this.fetchHealth();
  }

  public fetchHealth(): void {
    this.http
      .get<ApiSuccessResponse<HealthCheckResponse>>(`${environment.apiUrl}/health`)
      .subscribe({
        next: (res) => this.healthData.set(res.data),
        error: (err) => console.error('Health check failure:', err),
      });
  }
}
