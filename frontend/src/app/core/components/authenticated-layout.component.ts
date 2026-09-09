import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AppSidebarComponent } from './app-sidebar.component';
import { AppHeaderComponent } from './app-header.component';

@Component({
  selector: 'app-authenticated-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppSidebarComponent, AppHeaderComponent],
  template: `
    <div class="auth-layout">
      <app-sidebar></app-sidebar>
      <div class="auth-main">
        <app-header></app-header>
        <main class="auth-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .auth-layout { display: flex; min-height: 100vh; }
    .auth-main { flex: 1; display: flex; flex-direction: column; margin-left: var(--sidebar-expanded-width); transition: margin-left var(--transition-normal); }
    .auth-content { flex: 1; padding: var(--space-5) var(--space-6); background: var(--color-page-bg); overflow-y: auto; }
  `],
})
export class AuthenticatedLayoutComponent {}
