import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export interface LoginHeroSlide {
  id: number;
  imageUrl: string;
  category: string;
  categoryIcon: string;
  title: string;
  description: string;
  highlights: string[];
}

export const DEFAULT_LOGIN_HERO_SLIDES: LoginHeroSlide[] = [
  {
    id: 1,
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
    category: 'ENTERPRISE WORKFORCE INTELLIGENCE',
    categoryIcon: 'corporate_fare',
    title: 'Unified Human Capital & Governance',
    description: 'Streamline multi-department operations, employee lifecycles, and role-based access management with real-time auditability.',
    highlights: ['Multi-Entity Governance', 'Immutable Audit Trails', 'Continuous Security']
  },
  {
    id: 2,
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
    category: 'ATTENDANCE & ROSTER AUTOMATION',
    categoryIcon: 'schedule',
    title: 'Deterministic Punch Rostering & Biometric Sync',
    description: 'Eliminate manual timesheet disputes through automated grace-period resolution, locked attendance states, and overtime precision.',
    highlights: ['Automated Grace Policies', 'Locked Shift States', 'Biometric Integration']
  },
  {
    id: 3,
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80',
    category: 'STATUTORY COMPLIANCE & LEAVE',
    categoryIcon: 'event_available',
    title: 'Statutory Leave Entitlements & Policy Engine',
    description: 'Enforce deterministic leave accrual, carry-forward limits, and manager approval chains with complete regulatory compliance.',
    highlights: ['Multi-Tier Approvals', 'Statutory Accruals', 'Encashment Calculation']
  },
  {
    id: 4,
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1600&q=80',
    category: 'MULTI-TIER PAYROLL ENGINE',
    categoryIcon: 'payments',
    title: 'Zero-Variance Payroll & Compensation Engine',
    description: 'Execute company-wide payroll runs directly from locked attendance and verified compensation structures with immutable ledger audits.',
    highlights: ['Zero Variance', 'Locked Attendance Source', 'Instant Itemized Slips']
  }
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-split-screen">
      <!-- LEFT PANE: DYNAMIC SLIDER WITH HIGH-CONTRAST OVERLAY -->
      <section class="auth-slider-pane" aria-label="Blue Royal Showcase">
        <!-- Background Image Layers -->
        <div class="slider-image-stack">
          @for (slide of slides; track slide.id; let i = $index) {
            <div
              class="slider-image-layer"
              [class.active]="currentSlide() === i"
              [style.background-image]="'url(' + slide.imageUrl + ')'"
            ></div>
          }
        </div>

        <!-- Multi-layer contrast overlay (Dark gradient + radial vignette) -->
        <div class="slider-overlay"></div>
        <div class="slider-radial-glow"></div>

        <!-- Foreground Content on top of overlay -->
        <div class="slider-content">
          <!-- Top Brand Header -->
          <header class="slider-brand-header">
            <div class="brand-crest">
              <span class="material-symbols-outlined brand-icon">shield_person</span>
            </div>
            <div class="brand-titles">
              <span class="brand-name">BLUE ROYAL</span>
              <span class="brand-badge-pill">ENTERPRISE HRMS</span>
            </div>
          </header>

          <!-- Middle Sliding Text Block -->
          <div class="slider-caption-wrapper">
            @for (slide of slides; track slide.id; let i = $index) {
              @if (currentSlide() === i) {
                <div class="slider-caption-card" [attr.data-slide-index]="i">
                  <div class="caption-tag">
                    <span class="material-symbols-outlined icon-sm">{{ slide.categoryIcon }}</span>
                    <span>{{ slide.category }}</span>
                  </div>

                  <h2 class="caption-title">{{ slide.title }}</h2>

                  <p class="caption-desc">{{ slide.description }}</p>

                  <div class="caption-highlights">
                    @for (highlight of slide.highlights; track highlight) {
                      <div class="highlight-chip">
                        <span class="material-symbols-outlined icon-xs">check_circle</span>
                        <span>{{ highlight }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            }
          </div>

          <!-- Bottom Navigation & Indicators: Unified single system -->
          <footer class="slider-footer">
            <div class="slider-progress-block">
              <span class="slide-counter">0{{ currentSlide() + 1 }} / 0{{ slides.length }}</span>
              <div class="slide-progress-track">
                <div
                  class="slide-progress-bar"
                  [style.width.%]="((currentSlide() + 1) / slides.length) * 100"
                ></div>
              </div>
            </div>

            <div class="slider-nav-arrows">
              <button
                type="button"
                class="slider-arrow-btn"
                (click)="prevSlide()"
                aria-label="Previous slide"
              >
                <span class="material-symbols-outlined icon-sm">chevron_left</span>
              </button>
              <button
                type="button"
                class="slider-arrow-btn"
                (click)="nextSlide()"
                aria-label="Next slide"
              >
                <span class="material-symbols-outlined icon-sm">chevron_right</span>
              </button>
            </div>
          </footer>
        </div>
      </section>

      <!-- RIGHT PANE: ENTERPRISE LOGIN FORM -->
      <section class="auth-form-pane" aria-label="User Authentication Form">
        <div class="auth-card">
          <!-- Mobile Brand Banner (Visible only on smaller screens) -->
          <div class="mobile-brand-banner">
            <div class="brand-crest-sm">
              <span class="material-symbols-outlined">shield_person</span>
            </div>
            <div>
              <h2 class="mobile-brand-title">BLUE ROYAL</h2>
              <span class="mobile-brand-subtitle">ENTERPRISE HRMS</span>
            </div>
          </div>

          <!-- Form Header -->
          <div class="form-header">
            <h1 class="form-title">Welcome back</h1>
            <p class="form-subtitle">Enter your corporate credentials to access the management portal</p>
          </div>

          <!-- Alert Banner -->
          @if (errorMessage()) {
            <div class="alert alert-danger" role="alert">
              <span class="material-symbols-outlined icon-sm">error</span>
              <span class="alert-text">{{ errorMessage() }}</span>
              <button type="button" class="alert-close" (click)="errorMessage.set(null)" aria-label="Dismiss error">×</button>
            </div>
          }

          <!-- Authentication Form -->
          <form (ngSubmit)="onSubmit()" class="auth-form" novalidate>
            <div class="form-group">
              <label for="email">Work Email Address</label>
              <div class="input-with-icon">
                <span class="material-symbols-outlined input-prefix-icon">mail</span>
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
            </div>

            <div class="form-group">
              <div class="label-row">
                <label for="password">Password</label>
              </div>
              <div class="input-with-icon">
                <span class="material-symbols-outlined input-prefix-icon">lock</span>
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="Enter your security credentials"
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
                <span>Authenticating Credentials...</span>
              } @else {
                <span class="material-symbols-outlined icon-sm">login</span>
                <span>Sign In to System</span>
              }
            </button>
          </form>

          <!-- Quick Fill Demo Accounts for convenient review -->
          <div class="demo-accounts-section">
            <div class="demo-accounts-title">Quick Demo Login</div>
            <div class="demo-chips">
              <button
                type="button"
                class="demo-chip"
                (click)="fillDemo('hradmin@blueroyal.local', 'HrAdmin@2026!')"
                title="Fill HR Admin credentials"
              >
                <span class="material-symbols-outlined icon-xs">badge</span>
                HR Admin
              </button>
              <button
                type="button"
                class="demo-chip"
                (click)="fillDemo('superadmin@blueroyal.local', 'SuperAdmin@2026!')"
                title="Fill Super Admin credentials"
              >
                <span class="material-symbols-outlined icon-xs">admin_panel_settings</span>
                Super Admin
              </button>
              <button
                type="button"
                class="demo-chip"
                (click)="fillDemo('employee@blueroyal.local', 'Employee@2026!')"
                title="Fill Employee credentials"
              >
                <span class="material-symbols-outlined icon-xs">person</span>
                Employee
              </button>
            </div>
          </div>

          <!-- Footer Security Notes -->
          <div class="auth-security-footer">
            <span class="material-symbols-outlined icon-sm text-muted">lock</span>
            <span>256-Bit TLS Encryption • Role-Based Access Control • Continuous Audit</span>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    /* ==========================================================================
       SPLIT-SCREEN ROOT CONTAINER
       ========================================================================== */
    .auth-split-screen {
      display: flex;
      min-height: 100vh;
      width: 100vw;
      overflow: hidden;
      background-color: #0f172a;
    }

    /* ==========================================================================
       LEFT PANE: IMAGE SLIDER & HIGH-CONTRAST OVERLAY
       ========================================================================== */
    .auth-slider-pane {
      position: relative;
      flex: 1 1 56%;
      min-height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background-color: #090d16;
    }

    /* Background image layers stacked with Ken Burns & crossfade */
    .slider-image-stack {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    .slider-image-layer {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      opacity: 0;
      transform: scale(1.02);
      transition: opacity 1.4s cubic-bezier(0.4, 0, 0.2, 1), transform 6s cubic-bezier(0.25, 1, 0.5, 1);
      will-change: opacity, transform;
    }

    .slider-image-layer.active {
      opacity: 1;
      transform: scale(1.08);
      z-index: 2;
    }

    /* Multi-layered dark overlay to guarantee 100% WCAG AAA text visibility */
    .slider-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        rgba(15, 23, 42, 0.65) 0%,
        rgba(15, 23, 42, 0.75) 40%,
        rgba(10, 15, 30, 0.94) 100%
      );
      z-index: 3;
      pointer-events: none;
    }

    .slider-radial-glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 20% 30%, rgba(37, 99, 235, 0.28) 0%, transparent 65%),
                  radial-gradient(circle at 80% 80%, rgba(30, 64, 175, 0.22) 0%, transparent 60%);
      z-index: 4;
      pointer-events: none;
    }

    /* Content container on top of overlays */
    .slider-content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      padding: 3.5rem 4rem 3rem 4rem;
    }

    /* Slider Brand Header */
    .slider-brand-header {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .brand-crest {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%);
      border: 1px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 16px -4px rgba(37, 99, 235, 0.5);
    }

    .brand-icon {
      color: #ffffff;
      font-size: 1.5rem;
    }

    .brand-titles {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .brand-name {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      color: #ffffff;
      line-height: 1.1;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .brand-badge-pill {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #93c5fd;
    }

    /* Slider Caption Card - Frosted Glass Container */
    .slider-caption-wrapper {
      margin: auto 0;
      max-width: 620px;
    }

    .slider-caption-card {
      background: rgba(15, 23, 42, 0.72);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 2.25rem 2.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      animation: slideCaptionIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes slideCaptionIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .caption-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      background: rgba(37, 99, 235, 0.25);
      border: 1px solid rgba(147, 197, 253, 0.35);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #93c5fd;
      margin-bottom: 1.25rem;
    }

    .caption-title {
      font-size: 1.875rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.3;
      letter-spacing: -0.02em;
      margin-bottom: 0.875rem;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
    }

    .caption-desc {
      font-size: 1rem;
      line-height: 1.65;
      color: #e2e8f0;
      margin-bottom: 1.5rem;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
    }

    .caption-highlights {
      display: flex;
      flex-wrap: wrap;
      gap: 0.625rem;
    }

    .highlight-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      font-size: 0.8125rem;
      font-weight: 500;
      color: #f1f5f9;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }

    .highlight-chip .icon-xs {
      color: #4ade80;
      font-size: 1rem;
    }

    /* Slider Footer / Progress & Chevron Navigation */
    .slider-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    .slider-progress-block {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .slide-counter {
      font-family: var(--font-mono, monospace);
      font-size: 0.8125rem;
      font-weight: 600;
      color: #93c5fd;
      letter-spacing: 0.05em;
    }

    .slide-progress-track {
      width: 90px;
      height: 3px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 9999px;
      overflow: hidden;
    }

    .slide-progress-bar {
      height: 100%;
      background: #3b82f6;
      border-radius: 9999px;
      transition: width 0.4s ease;
    }

    .slider-nav-arrows {
      display: flex;
      gap: 0.5rem;
    }

    .slider-arrow-btn {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.2s ease, border-color 0.2s ease;
    }

    .slider-arrow-btn:hover {
      background: rgba(255, 255, 255, 0.22);
      border-color: rgba(255, 255, 255, 0.3);
    }

    /* ==========================================================================
       RIGHT PANE: LOGIN FORM
       ========================================================================== */
    .auth-form-pane {
      flex: 1 1 44%;
      min-width: 440px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #ffffff;
      padding: 3rem 2.5rem;
      position: relative;
      z-index: 10;
      overflow-y: auto;
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
    }

    .mobile-brand-banner {
      display: none;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }

    .brand-crest-sm {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-900));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-brand-title {
      font-size: 1.125rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0;
      line-height: 1.1;
    }

    .mobile-brand-subtitle {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
      letter-spacing: 0.08em;
    }

    .form-header {
      margin-bottom: 2rem;
    }

    .form-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.02em;
      margin: 0 0 0.5rem;
    }

    .form-subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
      line-height: 1.5;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .input-with-icon {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-prefix-icon {
      position: absolute;
      left: 0.875rem;
      color: var(--text-muted);
      font-size: 1.25rem;
      pointer-events: none;
    }

    .input-with-icon input {
      padding-left: 2.75rem;
      padding-right: 2.75rem;
      height: 44px;
      font-size: 0.875rem;
    }

    .label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-toggle-pwd {
      position: absolute;
      right: 0.5rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.375rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: color 0.15s ease;
    }

    .btn-toggle-pwd:hover {
      color: var(--text-primary);
    }

    .btn-submit {
      width: 100%;
      height: 44px;
      font-size: 0.9375rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .spinner-inline {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Alert formatting */
    .alert-danger {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
    }

    .alert-text {
      flex: 1;
      font-size: 0.8125rem;
      line-height: 1.4;
    }

    .alert-close {
      background: transparent;
      border: none;
      font-size: 1.25rem;
      line-height: 1;
      color: inherit;
      cursor: pointer;
      padding: 0;
      opacity: 0.7;
    }

    .alert-close:hover {
      opacity: 1;
    }

    /* Demo credentials helper */
    .demo-accounts-section {
      margin-top: 2rem;
      padding-top: 1.25rem;
      border-top: 1px dashed var(--border-default);
    }

    .demo-accounts-title {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.625rem;
    }

    .demo-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .demo-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.625rem;
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .demo-chip:hover {
      background: var(--brand-50);
      border-color: var(--brand-200);
      color: var(--brand-700);
    }

    .auth-security-footer {
      margin-top: 2.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.6875rem;
      color: var(--text-muted);
      text-align: center;
    }

    /* ==========================================================================
       RESPONSIVE BREAKPOINTS
       ========================================================================== */
    @media (max-width: 1024px) {
      .auth-slider-pane {
        display: none;
      }

      .auth-form-pane {
        flex: 1 1 100%;
        min-width: 0;
        background: radial-gradient(circle at 50% 20%, #1e293b 0%, #0f172a 100%);
        padding: 2rem 1.5rem;
      }

      .auth-card {
        background: #ffffff;
        padding: 2.5rem 2rem;
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-xl);
      }

      .mobile-brand-banner {
        display: flex;
      }
    }
  `]
})
export class LoginComponent implements OnInit, OnDestroy {
  public email = '';
  public password = '';
  public isLoading = signal(false);
  public showPassword = signal(false);
  public errorMessage = signal<string | null>(null);

  // Auto-sliding showcase data (Configurable architectural model)
  public slides: LoginHeroSlide[] = DEFAULT_LOGIN_HERO_SLIDES;

  public currentSlide = signal(0);
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.startAutoSlide();
  }

  public ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  private startAutoSlide(): void {
    this.stopAutoSlide();
    this.timerId = setInterval(() => {
      this.currentSlide.update((idx) => (idx + 1) % this.slides.length);
    }, 5500);
  }

  private stopAutoSlide(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public goToSlide(index: number): void {
    this.currentSlide.set(index);
    this.startAutoSlide(); // Reset the cycle timer on manual interaction
  }

  public nextSlide(): void {
    this.currentSlide.update((idx) => (idx + 1) % this.slides.length);
    this.startAutoSlide();
  }

  public prevSlide(): void {
    this.currentSlide.update((idx) => (idx - 1 + this.slides.length) % this.slides.length);
    this.startAutoSlide();
  }

  public fillDemo(demoEmail: string, demoPassword?: string): void {
    this.email = demoEmail;
    if (demoPassword) {
      this.password = demoPassword;
    }
    this.errorMessage.set(null);
  }

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
