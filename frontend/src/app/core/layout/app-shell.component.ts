import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-layout" [class.sidebar-collapsed]="isSidebarCollapsed()">
      <!-- Mobile Backdrop -->
      @if (isMobileOpen()) {
        <div class="mobile-backdrop" (click)="isMobileOpen.set(false)"></div>
      }

      <!-- Sidebar -->
      <aside class="sidebar" [class.mobile-open]="isMobileOpen()">
        <div class="sidebar-brand">
          <div class="brand-logo-icon">BR</div>
          <div class="brand-text">
            <span class="brand-title">BLUE ROYAL</span>
            <span class="brand-subtitle">ENTERPRISE HRMS</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-title">CORE WORKSPACE</div>
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" (click)="closeMobile()">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>

          @if (authService.hasPermission('attendance:read') || authService.hasPermission('leave:read') || authService.hasPermission('payroll:read')) {
            <div class="nav-section-title">OPERATIONS & WORKFORCE</div>
          }

          @if (authService.hasPermission('attendance:read')) {
            <a routerLink="/attendance" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">⏱️</span>
              <span class="nav-label">Attendance & OT</span>
            </a>
          }

          @if (authService.hasPermission('leave:read')) {
            <a routerLink="/leave" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">🌴</span>
              <span class="nav-label">Leave Approvals</span>
            </a>
          }

          @if (authService.hasPermission('payroll:read')) {
            <a routerLink="/payroll" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">💵</span>
              <span class="nav-label">Payroll Processing</span>
            </a>
          }

          @if (authService.hasPermission('attendance:self_read') || authService.hasPermission('leave:self_read') || authService.hasPermission('payroll:self_read')) {
            <div class="nav-section-title">MY SELF-SERVICE</div>
          }

          @if (authService.hasPermission('attendance:self_read')) {
            <a routerLink="/attendance/my-attendance" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">📅</span>
              <span class="nav-label">My Timesheet</span>
            </a>
          }

          @if (authService.hasPermission('leave:self_read')) {
            <a routerLink="/leave/my-leave" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">🏖️</span>
              <span class="nav-label">My Leaves</span>
            </a>
          }

          @if (authService.hasPermission('payroll:self_read')) {
            <a routerLink="/payroll/my-payroll" routerLinkActive="active" class="nav-item" (click)="closeMobile()">
              <span class="nav-icon">📑</span>
              <span class="nav-label">My Payslips</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          @if (authService.currentUser(); as user) {
            <div class="user-profile">
              <div class="user-avatar">{{ user.firstName.charAt(0) }}{{ user.lastName.charAt(0) }}</div>
              <div class="user-details">
                <div class="user-name">{{ user.firstName }} {{ user.lastName }}</div>
                <div class="user-role-badge">{{ user.roles[0] | uppercase }}</div>
              </div>
            </div>
          }
          <button class="btn-sidebar-logout" (click)="logout()" title="Sign Out">
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <!-- Main Shell Content Area -->
      <div class="main-container">
        <!-- Top Navbar -->
        <header class="topbar">
          <div class="topbar-left">
            <button class="mobile-toggle" (click)="toggleMobile()">☰</button>
            <div class="system-status-pill">
              <span class="status-indicator-dot"></span>
              <span>HRMS v1.0.0 Production Node</span>
            </div>
          </div>

          <div class="topbar-right">
            @if (authService.currentUser(); as user) {
              <div class="user-badge-header">
                <span>{{ user.email }}</span>
                <span class="role-tag">{{ user.roles.join(', ') }}</span>
              </div>
            }
          </div>
        </header>

        <!-- Dynamic Content Body -->
        <main class="content-canvas">
          <ng-content></ng-content>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
      background-color: var(--bg-app);
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      background-color: var(--bg-sidebar);
      color: var(--text-inverse);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 50;
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      transition: transform 0.2s ease-in-out;
    }

    .sidebar-brand {
      padding: 1.25rem 1.25rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .brand-logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
      color: #ffffff;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.8125rem;
      letter-spacing: -0.05em;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 0.875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #ffffff;
    }

    .brand-subtitle {
      font-size: 0.625rem;
      font-weight: 600;
      color: var(--text-inverse-muted);
      letter-spacing: 0.08em;
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0.75rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .nav-section-title {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #64748b;
      padding: 0.75rem 0.5rem 0.25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.625rem;
      border-radius: var(--radius-md);
      color: #cbd5e1;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .nav-item:hover {
      background-color: var(--bg-sidebar-hover);
      color: #ffffff;
    }

    .nav-item.active {
      background-color: var(--brand-700);
      color: #ffffff;
      font-weight: 600;
    }

    .nav-icon {
      font-size: 1rem;
      width: 1.25rem;
      text-align: center;
    }

    .sidebar-footer {
      padding: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background-color: #334155;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .user-role-badge {
      font-size: 0.625rem;
      color: #94a3b8;
      font-weight: 600;
    }

    .btn-sidebar-logout {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      padding: 0.4rem;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .btn-sidebar-logout:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.4);
      color: #ffffff;
    }

    /* Main Container & Topbar */
    .main-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .topbar {
      height: 52px;
      background: #ffffff;
      border-bottom: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .mobile-toggle {
      display: none;
      background: transparent;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: var(--text-primary);
    }

    .system-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-secondary);
      background: var(--bg-surface-subtle);
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-default);
    }

    .status-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #16a34a;
    }

    .user-badge-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .role-tag {
      background: var(--brand-50);
      color: var(--brand-700);
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.6875rem;
    }

    .content-canvas {
      flex: 1;
      padding: 1.5rem;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        transform: translateX(-100%);
      }
      .sidebar.mobile-open {
        transform: translateX(0);
      }
      .mobile-toggle {
        display: block;
      }
      .mobile-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        z-index: 45;
      }
      .content-canvas {
        padding: 1rem;
      }
    }
  `]
})
export class AppShellComponent {
  public isSidebarCollapsed = signal(false);
  public isMobileOpen = signal(false);

  constructor(public authService: AuthService, private router: Router) {}

  public toggleMobile(): void {
    this.isMobileOpen.update(v => !v);
  }

  public closeMobile(): void {
    this.isMobileOpen.set(false);
  }

  public logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
