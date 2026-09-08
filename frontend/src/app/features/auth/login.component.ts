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
    <div class="login-container">
      <div class="login-card">
        <div class="header">
          <h2>Blue Royal HRMS</h2>
          <p class="subtitle">Enterprise Portal Sign-In</p>
        </div>

        @if (errorMessage()) {
          <div class="alert alert-danger">{{ errorMessage() }}</div>
        }

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              name="email"
              placeholder="admin@blueroyal.com"
              required
              [disabled]="isLoading()"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••"
              required
              [disabled]="isLoading()"
            />
          </div>

          <button type="submit" class="btn-submit" [disabled]="isLoading()">
            @if (isLoading()) {
              <span>Signing In...</span>
            } @else {
              <span>Sign In</span>
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: #f1f5f9;
        padding: 1rem;
      }
      .login-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 2.5rem;
        width: 100%;
        max-width: 420px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      }
      .header {
        margin-bottom: 2rem;
        text-align: center;
      }
      .header h2 {
        color: #1e3a8a;
        font-size: 1.5rem;
        font-weight: 700;
      }
      .subtitle {
        color: #64748b;
        font-size: 0.875rem;
        margin-top: 0.25rem;
      }
      .form-group {
        margin-bottom: 1.25rem;
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #334155;
      }
      input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 0.875rem;
        outline: none;
      }
      input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .btn-submit {
        width: 100%;
        padding: 0.75rem;
        background: #1e3a8a;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        margin-top: 0.5rem;
      }
      .btn-submit:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .btn-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .alert {
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
      .alert-danger {
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
      }
    `,
  ],
})
export class LoginComponent {
  public email = '';
  public password = '';
  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  public onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage.set('Please enter both email and password.');
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
          err.error?.error?.message || 'Login failed. Please check your credentials.',
        );
      },
    });
  }
}
