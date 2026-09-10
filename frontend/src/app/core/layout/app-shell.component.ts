import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  tab?: string;
  exact?: boolean;
}

export interface NavSection {
  id: string;
  title: string;
  icon?: string;
  isAccordion: boolean;
  items: NavItem[];
}

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
          @for (section of navigationSections(); track section.id) {
            @if (!section.isAccordion) {
              <!-- Flat Section Header (e.g. CORE, MY WORKSPACE) -->
              <div class="nav-section-title">{{ section.title }}</div>
              @for (item of section.items; track item.label + item.route) {
                <a
                  [routerLink]="item.route"
                  [queryParams]="item.tab ? { tab: item.tab } : null"
                  [class.active]="isItemActive(item)"
                  class="nav-item"
                  (click)="closeMobile()"
                >
                  <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
                  <span class="nav-label">{{ item.label }}</span>
                </a>
              }
            } @else {
              <!-- Accordion Group -->
              <div class="nav-accordion-group">
                <button
                  type="button"
                  class="nav-section-header"
                  (click)="toggleSection(section.id)"
                  [class.has-active]="isSectionActive(section)"
                >
                  <div class="header-label-wrap">
                    @if (section.icon) {
                      <span class="material-symbols-outlined section-prefix-icon">{{ section.icon }}</span>
                    }
                    <span class="section-title-text">{{ section.title }}</span>
                  </div>
                  <span
                    class="material-symbols-outlined section-chevron"
                    [class.rotated]="isSectionExpanded(section.id)"
                  >expand_more</span>
                </button>

                @if (isSectionExpanded(section.id)) {
                  <div class="nav-submenu">
                    @for (item of section.items; track item.label + item.route) {
                      <a
                        [routerLink]="item.route"
                        [queryParams]="item.tab ? { tab: item.tab } : null"
                        [class.active]="isItemActive(item)"
                        class="nav-subitem"
                        (click)="closeMobile()"
                      >
                        <span class="material-symbols-outlined nav-icon">{{ item.icon }}</span>
                        <span class="nav-label">{{ item.label }}</span>
                      </a>
                    }
                  </div>
                }
              </div>
            }
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
            <span class="material-symbols-outlined icon-sm">logout</span>
          </button>
        </div>
      </aside>

      <!-- Main Shell Content Area -->
      <div class="main-container">
        <!-- Top Navbar with Breadcrumb Trail -->
        <header class="topbar">
          <div class="topbar-left">
            <button class="mobile-toggle" (click)="toggleMobile()" aria-label="Toggle navigation menu">
              <span class="material-symbols-outlined">menu</span>
            </button>

            <!-- Dynamic Breadcrumb Trail -->
            <nav class="breadcrumb-trail" aria-label="Breadcrumb">
              <span class="breadcrumb-group">{{ currentBreadcrumb().group }}</span>
              <span class="breadcrumb-divider">/</span>
              <span class="breadcrumb-page">{{ currentBreadcrumb().page }}</span>
            </nav>
          </div>

          <div class="topbar-right">
            <div class="system-status-pill">
              <span class="status-indicator-dot"></span>
              <span>Enterprise Node Online</span>
            </div>

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
      width: 256px;
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
      flex-shrink: 0;
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
      padding: 0.875rem 0.625rem;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.2) transparent;

      &::-webkit-scrollbar {
        width: 5px;
        height: 5px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.2);
        border-radius: 9999px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.4);
      }
    }

    .nav-section-title {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #64748b;
      padding: 0.65rem 0.5rem 0.25rem;
      text-transform: uppercase;
    }

    /* Accordion Groups */
    .nav-accordion-group {
      display: flex;
      flex-direction: column;
      margin-top: 0.15rem;
    }

    .nav-section-header {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.45rem 0.5rem;
      border-radius: var(--radius-sm);
      color: #94a3b8;
      transition: all 0.15s ease;
      text-align: left;
    }

    .nav-section-header:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.04);
    }

    .nav-section-header.has-active {
      color: var(--brand-300);
      font-weight: 600;
    }

    .header-label-wrap {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    .section-prefix-icon {
      font-size: 0.95rem;
      color: #64748b;
    }

    .nav-section-header:hover .section-prefix-icon,
    .nav-section-header.has-active .section-prefix-icon {
      color: var(--brand-400);
    }

    .section-title-text {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .section-chevron {
      font-size: 1.1rem;
      color: #64748b;
      transition: transform 0.2s ease;
    }

    .section-chevron.rotated {
      transform: rotate(180deg);
    }

    /* Submenu items */
    .nav-submenu {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding-left: 0.75rem;
      margin-left: 0.5rem;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      margin-top: 0.15rem;
      margin-bottom: 0.35rem;
    }

    .nav-item,
    .nav-subitem {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-md);
      color: #cbd5e1;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .nav-subitem {
      font-size: 0.8rem;
      padding: 0.35rem 0.55rem;
    }

    .nav-item:hover,
    .nav-subitem:hover {
      background-color: var(--bg-sidebar-hover);
      color: #ffffff;
    }

    .nav-item.active,
    .nav-subitem.active {
      background-color: var(--brand-600);
      color: #ffffff;
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .nav-icon {
      font-size: 1.15rem;
      width: 1.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      transition: color 0.15s ease;
    }

    .nav-item:hover .nav-icon,
    .nav-subitem:hover .nav-icon,
    .nav-item.active .nav-icon,
    .nav-subitem.active .nav-icon {
      color: #ffffff;
    }

    .sidebar-footer {
      padding: 0.875rem 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      overflow: hidden;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      background: var(--brand-700);
      color: #ffffff;
      font-size: 0.6875rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 0.75rem;
      font-weight: 600;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role-badge {
      font-size: 0.5625rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--brand-300);
    }

    .btn-sidebar-logout {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.35rem 0.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      transition: all 0.15s ease;
    }

    .btn-sidebar-logout:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    /* Main Container */
    .main-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .topbar {
      height: 56px;
      background-color: var(--bg-surface);
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
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-primary);
    }

    /* Dynamic Breadcrumb Trail */
    .breadcrumb-trail {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .breadcrumb-group {
      color: var(--text-muted);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-size: 0.6875rem;
    }

    .breadcrumb-divider {
      color: var(--border-default);
      font-size: 0.8125rem;
    }

    .breadcrumb-page {
      color: var(--text-primary);
      font-weight: 700;
    }

    .system-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.55rem;
      border-radius: var(--radius-full);
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      font-size: 0.6875rem;
      font-weight: 600;
    }

    .status-indicator-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: #10b981;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.875rem;
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
  public currentUrl = signal('');

  // Accordion expansion state per section key
  public expandedSections = signal<Record<string, boolean>>({
    orgSetup: true,
    workforceOversight: true,
    operationsGov: false,
    people: true,
    workforceOps: true,
    payroll: false,
    orgRef: false,
  });

  // Role detection computed signals
  public isSuperAdmin = computed(() => this.authService.hasRole('super_admin'));
  public isHrAdmin = computed(() => this.authService.hasRole('hr_admin') && !this.isSuperAdmin());
  public isEmployee = computed(() => !this.isSuperAdmin() && !this.isHrAdmin());

  // Strictly role-generated navigation model
  public navigationSections = computed<NavSection[]>(() => {
    if (this.isSuperAdmin()) {
      return [
        {
          id: 'core',
          title: 'CORE',
          isAccordion: false,
          items: [
            { label: 'Dashboard', route: '/dashboard', icon: 'space_dashboard', exact: true }
          ]
        },
        {
          id: 'orgSetup',
          title: 'ORGANIZATION SETUP',
          icon: 'corporate_fare',
          isAccordion: true,
          items: [
            { label: 'Clients', route: '/masters', tab: 'clients', icon: 'business' },
            { label: 'Projects', route: '/masters', tab: 'projects', icon: 'location_on' },
            { label: 'Designations', route: '/masters', tab: 'designations', icon: 'badge' },
            { label: 'Work Shifts & Hours', route: '/masters', tab: 'shifts', icon: 'schedule' },
            { label: 'Holidays & Weekly Offs', route: '/masters', tab: 'calendar', icon: 'event' },
            { label: 'Salary Packages', route: '/masters', tab: 'salary', icon: 'account_balance_wallet' }
          ]
        },
        {
          id: 'workforceOversight',
          title: 'WORKFORCE OVERSIGHT',
          icon: 'groups',
          isAccordion: true,
          items: [
            { label: 'Employee Directory', route: '/employees', icon: 'group' },
            { label: 'Workforce Deployments', route: '/masters', tab: 'assignments', icon: 'assignment_ind' },
            { label: 'Client Invoicing Rates', route: '/masters', tab: 'client-rates', icon: 'receipt' }
          ]
        },
        {
          id: 'operationsGov',
          title: 'OPERATIONS & GOVERNANCE',
          icon: 'admin_panel_settings',
          isAccordion: true,
          items: [
            { label: 'Attendance Periods', route: '/attendance', icon: 'fact_check' },
            { label: 'Payroll Processing', route: '/payroll', icon: 'payments' },
            { label: 'Compliance & Documents', route: '/documents', icon: 'folder_shared' }
          ]
        }
      ];
    }

    if (this.isHrAdmin()) {
      return [
        {
          id: 'core',
          title: 'CORE',
          isAccordion: false,
          items: [
            { label: 'HR Dashboard', route: '/dashboard', icon: 'space_dashboard', exact: true }
          ]
        },
        {
          id: 'people',
          title: 'PEOPLE & ONBOARDING',
          icon: 'person_search',
          isAccordion: true,
          items: [
            { label: 'Employee Directory', route: '/employees', icon: 'badge' },
            { label: 'Onboarding Hub', route: '/onboarding', icon: 'person_add_alt' },
            { label: 'Document Center', route: '/documents', icon: 'folder_shared' }
          ]
        },
        {
          id: 'workforceOps',
          title: 'WORKFORCE OPERATIONS',
          icon: 'engineering',
          isAccordion: true,
          items: [
            { label: 'Workforce Deployments', route: '/masters', tab: 'assignments', icon: 'assignment_ind' },
            { label: 'Worker Pay Rates', route: '/masters', tab: 'employee-rates', icon: 'price_change' },
            { label: 'Attendance & Timesheets', route: '/attendance', icon: 'schedule' },
            { label: 'Leave Management', route: '/leave', icon: 'event_available' }
          ]
        },
        {
          id: 'payroll',
          title: 'COMPENSATION & PAYROLL',
          icon: 'receipt_long',
          isAccordion: true,
          items: [
            { label: 'Payroll Processing', route: '/payroll', icon: 'payments' }
          ]
        },
        {
          id: 'orgRef',
          title: 'ORGANIZATION REFERENCE',
          icon: 'tune',
          isAccordion: true,
          items: [
            { label: 'Job Designations', route: '/masters', tab: 'designations', icon: 'work' },
            { label: 'Work Shifts', route: '/masters', tab: 'shifts', icon: 'more_time' },
            { label: 'Company Holidays', route: '/masters', tab: 'calendar', icon: 'event_note' },
            { label: 'Commercial Clients', route: '/masters', tab: 'clients', icon: 'domain' }
          ]
        }
      ];
    }

    // Default: EMPLOYEE (Personal ESS Workspace Only)
    return [
      {
        id: 'core',
        title: 'CORE',
        isAccordion: false,
        items: [
          { label: 'Employee Portal', route: '/dashboard', icon: 'space_dashboard', exact: true }
        ]
      },
      {
        id: 'workspace',
        title: 'MY WORKSPACE',
        isAccordion: false,
        items: [
          { label: 'My Timesheet', route: '/attendance/my-attendance', icon: 'calendar_month' },
          { label: 'My Leave', route: '/leave/my-leave', icon: 'beach_access' },
          { label: 'My Payslips', route: '/payroll/my-payroll', icon: 'receipt_long' },
          { label: 'My Documents', route: '/documents/my-documents', icon: 'description' }
        ]
      }
    ];
  });

  // Dynamic breadcrumb computation
  public currentBreadcrumb = computed(() => {
    const url = this.currentUrl();
    const cleanPath = url.split('?')[0];

    if (cleanPath === '/dashboard') {
      return {
        group: 'CORE',
        page: this.isSuperAdmin() ? 'Dashboard' : this.isHrAdmin() ? 'HR Operational Dashboard' : 'Employee Self-Service'
      };
    }
    if (cleanPath === '/employees') return { group: this.isSuperAdmin() ? 'WORKFORCE OVERSIGHT' : 'PEOPLE', page: 'Employee Directory' };
    if (cleanPath === '/onboarding') return { group: 'PEOPLE', page: 'Onboarding & Verification Hub' };
    if (cleanPath === '/documents/my-documents') return { group: 'MY WORKSPACE', page: 'My Compliance Documents' };
    if (cleanPath === '/documents') return { group: this.isSuperAdmin() ? 'OPERATIONS & GOVERNANCE' : 'PEOPLE', page: this.isSuperAdmin() ? 'Compliance & Documents' : 'Document Center & Compliance' };
    if (cleanPath === '/attendance/my-attendance') return { group: 'MY WORKSPACE', page: 'My Timesheet & Punches' };
    if (cleanPath === '/attendance') return { group: this.isSuperAdmin() ? 'OPERATIONS & GOVERNANCE' : 'WORKFORCE', page: this.isSuperAdmin() ? 'Attendance Periods' : 'Attendance & Timesheets' };
    if (cleanPath === '/leave/my-leave') return { group: 'MY WORKSPACE', page: 'My Leave Requests' };
    if (cleanPath === '/leave') return { group: 'WORKFORCE', page: 'Leave Management & Approvals' };
    if (cleanPath === '/payroll/my-payroll') return { group: 'MY WORKSPACE', page: 'My Itemized Payslips' };
    if (cleanPath.startsWith('/payroll/periods/')) return { group: 'PAYROLL', page: 'Payroll Period Breakdown' };
    if (cleanPath === '/payroll') return { group: this.isSuperAdmin() ? 'OPERATIONS & GOVERNANCE' : 'PAYROLL', page: 'Payroll Processing' };

    if (cleanPath === '/masters') {
      if (url.includes('tab=clients')) return { group: 'ORGANIZATION SETUP', page: 'Clients' };
      if (url.includes('tab=projects')) return { group: 'ORGANIZATION SETUP', page: 'Projects & Worksites' };
      if (url.includes('tab=designations')) return { group: this.isSuperAdmin() ? 'ORGANIZATION SETUP' : 'ORGANIZATION REFERENCE', page: 'Job Designations' };
      if (url.includes('tab=shifts')) return { group: 'ORGANIZATION SETUP', page: 'Work Shifts & Hours' };
      if (url.includes('tab=calendar')) return { group: 'ORGANIZATION SETUP', page: 'Holidays & Weekly Offs' };
      if (url.includes('tab=salary')) return { group: 'ORGANIZATION SETUP', page: 'Salary Packages' };
      if (url.includes('tab=assignments')) return { group: this.isSuperAdmin() ? 'WORKFORCE OVERSIGHT' : 'WORKFORCE OPERATIONS', page: 'Workforce Deployments' };
      if (url.includes('tab=employee-rates')) return { group: 'WORKFORCE OPERATIONS', page: 'Employee Compensation' };
      if (url.includes('tab=client-rates')) return { group: this.isSuperAdmin() ? 'WORKFORCE OVERSIGHT' : 'COMMERCIAL', page: 'Client Billing Rates' };
      if (url.includes('tab=rates')) return { group: this.isSuperAdmin() ? 'WORKFORCE OVERSIGHT' : 'COMMERCIAL', page: 'Rate Simulator' };
      return { group: 'ORGANIZATION SETUP', page: 'Master Catalogs' };
    }

    return { group: 'WORKSPACE', page: 'Enterprise HRMS' };
  });

  constructor(
    public authService: AuthService,
    private router: Router,
  ) {
    this.currentUrl.set(this.router.url);
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.autoExpandActiveSection();
      });
    this.autoExpandActiveSection();
  }

  public toggleSection(sectionKey: string): void {
    this.expandedSections.update(m => ({
      ...m,
      [sectionKey]: !m[sectionKey]
    }));
  }

  public isSectionExpanded(sectionKey: string): boolean {
    return !!this.expandedSections()[sectionKey];
  }

  public isTabActive(tab?: string): boolean {
    if (!tab) return false;
    return this.currentUrl().includes(`tab=${tab}`);
  }

  public isRouteActive(path: string, exact: boolean = false): boolean {
    const cleanUrl = this.currentUrl().split('?')[0];
    if (exact) {
      return cleanUrl === path;
    }
    return cleanUrl === path || cleanUrl.startsWith(path + '/');
  }

  public isItemActive(item: NavItem): boolean {
    const cleanUrl = this.currentUrl().split('?')[0];

    if (item.tab) {
      return cleanUrl === item.route && this.isTabActive(item.tab);
    }

    if (item.exact) {
      return cleanUrl === item.route;
    }

    // Distinguish administrative routes from personal sub-routes
    if (item.route === '/attendance' && cleanUrl.startsWith('/attendance/my-attendance')) {
      return false;
    }
    if (item.route === '/payroll' && cleanUrl.startsWith('/payroll/my-payroll')) {
      return false;
    }
    if (item.route === '/documents' && cleanUrl.startsWith('/documents/my-documents')) {
      return false;
    }
    if (item.route === '/leave' && cleanUrl.startsWith('/leave/my-leave')) {
      return false;
    }

    if (item.route === '/masters') {
      return cleanUrl === '/masters' && !this.currentUrl().includes('tab=');
    }

    return this.isRouteActive(item.route, false);
  }

  public isSectionActive(section: NavSection): boolean {
    return section.items.some(item => this.isItemActive(item));
  }

  private autoExpandActiveSection(): void {
    const sections = this.navigationSections();
    for (const section of sections) {
      if (section.isAccordion && this.isSectionActive(section)) {
        this.expandedSections.update(m => ({ ...m, [section.id]: true }));
      }
    }
  }

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
