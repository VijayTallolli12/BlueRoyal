import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-brand">
            <div class="brand-badge">BR</div>
            <div class="brand-info">
              <h1>BLUE ROYAL</h1>
              <span class="subtext">ENTERPRISE HRMS SUITE</span>
            </div>
          </div>
          <p class="auth-desc">Sign in to your corporate administrative or employee account</p>
        </div>

        @if (errorMessage()) {
          <div class="alert alert-danger" role="alert">
            <span>{{ errorMessage() }}</span>
            <button type="button" class="alert-close" (click)="errorMessage.set(null)">×</button>
          </div>
        }

        <form (ngSubmit)="onSubmit()" class="auth-form" novalidate>
          <div class="form-group">
            <label for="email">Work Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="e.g. hradmin@blueroyal.local"
              required
              autocomplete="email"
              [disabled]="isLoading()"
            />
          </div>

          <div class="form-group">
            <div class="label-row">
              <label for="password">Password</label>
            </div>
            <div class="password-input-wrapper">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                [(ngModel)]="password"
                name="password"
                placeholder="Enter account credentials"
                required
                autocomplete="current-password"
                [disabled]="isLoading()"
              />
              <button
                type="button"
                class="btn-toggle-pwd"
                (click)="showPassword.set(!showPassword())"
                tabindex="-1"
                aria-label="Toggle password visibility"
              >
                <span class="material-symbols-outlined icon-sm">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-submit" [disabled]="isLoading() || !email || !password">
            @if (isLoading()) {
              <span class="spinner-inline"></span>
              <span>Authenticating...</span>
            } @else {
              <span class="material-symbols-outlined icon-sm">login</span>
              <span>Sign In to System</span>
            }
          </button>
        </form>

        <div class="auth-footer">
          <div class="system-security-note">
            <span class="material-symbols-outlined icon-sm">lock</span>
            <span>Enterprise Grade Session Management • Role-Based Access</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%);
      padding: 1.5rem;
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 2.25rem 2.5rem;
      display: flex;
      flex-direction: column;
    }

    .auth-header {
      margin-bottom: 1.75rem;
    }

    .auth-brand {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .brand-badge {
      width: 38px;
      height: 38px;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-900));
      color: #ffffff;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.9375rem;
      letter-spacing: -0.05em;
    }

    .brand-info h1 {
      font-size: 1.125rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.1;
    }

    .brand-info .subtext {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: var(--text-muted);
    }

    .auth-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-input-wrapper input {
      padding-right: 3.5rem;
    }

    .btn-toggle-pwd {
      position: absolute;
      right: 0.5rem;
      background: transparent;
      border: none;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.25rem 0.5rem;
    }

    .btn-toggle-pwd:hover {
      color: var(--text-primary);
    }

    .btn-submit {
      width: 100%;
      padding: 0.625rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
    }

    .spinner-inline {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .auth-footer {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--border-default);
      text-align: center;
    }

    .system-security-note {
      font-size: 0.6875rem;
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
    }
  `]
})
export class LoginComponent {
  public email = '';
  public password = '';
  public isLoading = signal(false);
  public showPassword = signal(false);
  public errorMessage = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  public onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please provide both work email and password.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err.error?.error?.message || 'Authentication failed. Please verify credentials.',
        );
      },
    });
  }
}
