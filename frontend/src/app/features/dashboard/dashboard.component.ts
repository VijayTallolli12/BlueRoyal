import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse, HealthCheckResponse } from '@blue-royal/contracts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-shell">
      <header class="app-header">
        <div class="brand">
          <h1>Blue Royal HRMS</h1>
          <span class="badge">Phase 0 Foundation</span>
        </div>
        <div class="user-meta">
          @if (authService.currentUser(); as user) {
            <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
            <span class="user-role">{{ user.roles.join(', ') }}</span>
          }
          <button (click)="onLogout()" class="btn-logout">Sign Out</button>
        </div>
      </header>

      <main class="dashboard-content">
        <div class="card">
          <h2>Welcome to Blue Royal HRMS Foundation</h2>
          <p class="desc">
            The core architecture, database connection, migration engine, and authentication
            foundation are active.
          </p>

          <div class="grid">
            <div class="info-tile">
              <h3>Authenticated User</h3>
              @if (authService.currentUser(); as user) {
                <p><strong>Email:</strong> {{ user.email }}</p>
                <p><strong>Status:</strong> {{ user.isActive ? 'Active' : 'Inactive' }}</p>
                <p><strong>Roles:</strong> {{ user.roles.join(', ') }}</p>
                <p><strong>Permissions:</strong> {{ user.permissions.length }} assigned</p>
              }
            </div>

            <div class="info-tile">
              <h3>Backend & Database Health</h3>
              @if (healthData(); as health) {
                <p>
                  <strong>Status:</strong>
                  <span class="status-indicator status-{{ health.status }}">{{
                    health.status | uppercase
                  }}</span>
                </p>
                <p><strong>Uptime:</strong> {{ health.uptimeSeconds }}s</p>
                <p><strong>PostgreSQL Status:</strong> {{ health.components.database.status }}</p>
                <p><strong>DB Latency:</strong> {{ health.components.database.latencyMs }}ms</p>
              } @else {
                <p>Checking system health...</p>
              }
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .dashboard-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .app-header {
        background: #1e3a8a;
        color: #ffffff;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .brand h1 {
        font-size: 1.25rem;
        font-weight: 700;
      }
      .badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
      }
      .user-meta {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .user-name {
        font-weight: 600;
        font-size: 0.875rem;
      }
      .user-role {
        font-size: 0.75rem;
        color: #cbd5e1;
      }
      .btn-logout {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.4rem 0.8rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .btn-logout:hover {
        background: rgba(255, 255, 255, 0.3);
      }
      .dashboard-content {
        padding: 2rem;
        flex: 1;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 2rem;
      }
      .card h2 {
        font-size: 1.5rem;
        color: #0f172a;
        margin-bottom: 0.5rem;
      }
      .desc {
        color: #64748b;
        margin-bottom: 2rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
      }
      .info-tile {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 1.5rem;
      }
      .info-tile h3 {
        font-size: 1.1rem;
        color: #1e3a8a;
        margin-bottom: 1rem;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 0.5rem;
      }
      .info-tile p {
        font-size: 0.875rem;
        color: #334155;
        margin-bottom: 0.5rem;
      }
      .status-indicator {
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
      }
      .status-healthy {
        background: #dcfce7;
        color: #166534;
      }
      .status-degraded {
        background: #fef9c3;
        color: #854d0e;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  public healthData = signal<HealthCheckResponse | null>(null);

  constructor(
    public authService: AuthService,
    private http: HttpClient,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.fetchHealth();
  }

  public fetchHealth(): void {
    this.http
      .get<ApiSuccessResponse<HealthCheckResponse>>(`${environment.apiUrl}/health`)
      .subscribe({
        next: (res) => this.healthData.set(res.data),
        error: (err) => console.error('Failed to fetch system health:', err),
      });
  }

  public onLogout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
