import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="header-left">
        <span class="page-context">Blue Royal HRMS</span>
      </div>
      <div class="header-right">
        <span class="role-badge">{{ currentRole() }}</span>
        <div class="user-info">
          <span class="user-name">{{ userName() }}</span>
        </div>
        <button class="btn-logout" (click)="onLogout()">Sign Out</button>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      position: fixed; top: 0; left: var(--sidebar-expanded-width); right: 0;
      height: var(--header-height); background: var(--color-surface);
      border-bottom: var(--border-thin);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 var(--space-6); z-index: 90;
      transition: left var(--transition-normal);
    }
    .header-left { display: flex; align-items: center; gap: var(--space-4); }
    .page-context { font-size: var(--font-size-sm); color: var(--color-text-muted); font-weight: var(--font-weight-medium); }
    .header-right { display: flex; align-items: center; gap: var(--space-4); }
    .role-badge {
      font-size: var(--font-size-xs); font-weight: 600; color: var(--color-info);
      background: var(--color-info-bg); padding: 3px var(--space-2);
      border-radius: var(--radius-sm); text-transform: uppercase; letter-spacing: 0.04em;
    }
    .user-info { display: flex; align-items: center; gap: var(--space-2); }
    .user-name { font-weight: var(--font-weight-semibold); font-size: var(--font-size-base); color: var(--color-text-primary); }
    .btn-logout {
      background: none; border: var(--border-thin); border-color: var(--color-border);
      color: var(--color-text-secondary); padding: 5px var(--space-3);
      border-radius: var(--radius-md); font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium); cursor: pointer;
      transition: all var(--transition-fast);
    }
    .btn-logout:hover { background: var(--color-danger-bg); border-color: var(--color-danger); color: var(--color-danger); }
  `],
})
export class AppHeaderComponent {
  constructor(public authService: AuthService) {}
  public currentRole(): string {
    const user = this.authService.currentUser();
    return user && user.roles.length ? user.roles[0].replace('_', ' ') : '';
  }
  public userName(): string {
    const user = this.authService.currentUser();
    return user ? `${user.firstName} ${user.lastName}` : '';
  }
  public onLogout(): void {
    this.authService.logout().subscribe({
      next: () => { window.location.href = '/login'; },
      error: () => { window.location.href = '/login'; },
    });
  }
}
