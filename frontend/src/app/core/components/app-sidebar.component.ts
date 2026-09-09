import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

interface NavItem {
  label: string;
  path: string;
  permission?: string;
  icon: string;
  group?: string;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.expanded]="expanded()">
      <div class="sidebar-brand">
        @if (expanded()) {
          <span class="brand-text">Blue Royal</span>
        }
        <button class="brand-toggle" (click)="toggleExpanded()" aria-label="Toggle sidebar">
          <span class="toggle-icon">{{ expanded() ? '‹' : '›' }}</span>
        </button>
      </div>
      <nav class="sidebar-nav">
        @for (group of navGroups; track group.name) {
          <div class="nav-group">
            @if (expanded()) {
              <div class="nav-group-label">{{ group.name }}</div>
            }
            @for (item of group.items; track item.path) {
              @if (authService.hasPermission(item.permission || '') || !item.permission) {
                <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item" [title]="expanded() ? item.label : item.label">
                  <span class="nav-icon">{{ item.icon }}</span>
                  @if (expanded()) {
                    <span class="nav-label">{{ item.label }}</span>
                  }
                </a>
              }
            }
          </div>
        }
      </nav>
      <div class="sidebar-footer" *ngIf="expanded() && isEmployee()">
        <div class="nav-group">
          <div class="nav-group-label">Self Service</div>
          <a routerLink="/attendance/my-attendance" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">📅</span>
            <span class="nav-label">My Attendance</span>
          </a>
          <a routerLink="/leave/my-leave" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">🌴</span>
            <span class="nav-label">My Leave</span>
          </a>
          <a routerLink="/payroll/my-payroll" routerLinkActive="active" class="nav-item">
            <span class="nav-icon">💵</span>
            <span class="nav-label">My Payroll</span>
          </a>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      position: fixed; left: 0; top: 0; bottom: 0;
      width: var(--sidebar-width);
      background: var(--color-primary);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      z-index: 100;
      transition: width var(--transition-normal);
      overflow: hidden;
      box-shadow: var(--shadow-sidebar);
    }
    .sidebar.expanded { width: var(--sidebar-expanded-width); }
    .sidebar-brand {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-3) var(--space-3);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      min-height: var(--header-height);
    }
    .brand-text {
      font-size: 1.05rem; font-weight: 700; color: #ffffff;
      letter-spacing: -0.02em; white-space: nowrap;
    }
    .brand-toggle {
      background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.6);
      cursor: pointer; width: 28px; height: 28px; border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; font-weight: 700; transition: all var(--transition-fast);
      flex-shrink: 0;
    }
    .brand-toggle:hover { background: rgba(255,255,255,0.15); color: #ffffff; }
    .toggle-icon { line-height: 1; }
    .sidebar-nav { flex: 1; overflow-y: auto; padding: var(--space-2) 0; }
    .nav-group { margin-bottom: var(--space-1); }
    .nav-group-label {
      font-size: 0.625rem; font-weight: 600; color: rgba(255,255,255,0.35);
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: var(--space-3) var(--space-4) var(--space-1);
      white-space: nowrap;
    }
    .nav-item {
      display: flex; align-items: center; gap: var(--space-3);
      padding: 8px var(--space-3); color: rgba(255,255,255,0.7);
      text-decoration: none; font-size: var(--font-size-base); font-weight: var(--font-weight-medium);
      transition: all var(--transition-fast); white-space: nowrap;
      border-left: 3px solid transparent; margin: 1px var(--space-2);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }
    .nav-icon { font-size: 1.1rem; min-width: 22px; text-align: center; line-height: 1; }
    .nav-label { font-size: var(--font-size-base); font-weight: var(--font-weight-medium); }
    .nav-item:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
    .nav-item.active { background: rgba(255,255,255,0.12); color: #ffffff; border-left-color: #f59e0b; font-weight: var(--font-weight-semibold); }
    .sidebar-footer { padding: var(--space-2) 0; border-top: 1px solid rgba(255,255,255,0.08); }
  `],
})
export class AppSidebarComponent {
  public expanded = signal(true);
  public toggleExpanded(): void { this.expanded.set(!this.expanded()); }
  public isEmployee(): boolean {
    const user = this.authService.currentUser();
    return !!(user && user.roles.includes('employee'));
  }
  public readonly navGroups: NavGroup[] = [
    {
      name: 'Main',
      items: [
        { label: 'Dashboard', path: '/dashboard', permission: '', icon: '◆', group: 'Main' },
        { label: 'Masters', path: '/masters', permission: 'designations:read', icon: '◎', group: 'Main' },
      ],
    },
    {
      name: 'Operations',
      items: [
        { label: 'Attendance', path: '/attendance', permission: 'attendance:read', icon: '⏱', group: 'Operations' },
        { label: 'Leave', path: '/leave', permission: 'leave:read', icon: '✈', group: 'Operations' },
        { label: 'Payroll', path: '/payroll', permission: 'payroll:read', icon: '◈', group: 'Operations' },
      ],
    },
  ];
  constructor(public authService: AuthService) {}
}
