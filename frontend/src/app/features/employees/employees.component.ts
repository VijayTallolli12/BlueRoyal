import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import {
  EmployeeDto,
  CreateEmployeeDto,
  EmployeeAssignmentDto,
  DesignationDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="employees-workspace">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <div class="breadcrumb">PEOPLE / EMPLOYEES</div>
            <h1 class="page-title">Employee Directory & Workforce Roster</h1>
            <p class="page-desc">
              Manage centralized biographical profiles, statutory contract parameters, and organizational deployments.
            </p>
          </div>
          <div class="header-actions">
            @if (authService.hasPermission('employees:create')) {
              <button class="btn btn-primary" (click)="openRegisterDrawer()">
                <span class="material-symbols-outlined icon-sm">person_add</span>
                <span>Register Employee</span>
              </button>
            }
            <button class="btn btn-secondary" (click)="loadData()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- Metric Pulse Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Total Roster Headcount</span>
            <span class="kpi-value">{{ employees().length }}</span>
            <span class="kpi-sub">Active corporate profiles</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Full-Time Personnel</span>
            <span class="kpi-value text-primary">{{ fullTimeCount() }}</span>
            <span class="kpi-sub">Permanent contracts</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Contracted Workers</span>
            <span class="kpi-value text-accent">{{ contractCount() }}</span>
            <span class="kpi-sub">Fixed-term deployments</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Active Deployments</span>
            <span class="kpi-value text-success">{{ assignments().length }}</span>
            <span class="kpi-sub">Effective project assignments</span>
          </div>
        </div>

        <!-- Alert Banners -->
        @if (errorMessage()) {
          <div class="alert alert-danger" role="alert">
            <span class="material-symbols-outlined icon-sm">error</span>
            <span>{{ errorMessage() }}</span>
            <button type="button" class="alert-close" (click)="errorMessage.set(null)">×</button>
          </div>
        }
        @if (successMessage()) {
          <div class="alert alert-success" role="alert">
            <span class="material-symbols-outlined icon-sm">check_circle</span>
            <span>{{ successMessage() }}</span>
            <button type="button" class="alert-close" (click)="successMessage.set(null)">×</button>
          </div>
        }

        <!-- Data Grid Surface -->
        <div class="panel">
          <div class="panel-toolbar">
            <div class="search-box">
              <span class="material-symbols-outlined search-icon">search</span>
              <input
                type="text"
                [(ngModel)]="searchQuery"
                placeholder="Search by name, employee code, or email..."
                class="form-control search-input"
              />
            </div>

            <div class="filter-group">
              <label for="empTypeFilter">Employment Type:</label>
              <select id="empTypeFilter" [(ngModel)]="typeFilter" class="form-control select-compact">
                <option value="">All Types</option>
                <option value="full_time">Full-Time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <span class="count-tag">Showing {{ filteredEmployees().length }} of {{ employees().length }}</span>
          </div>

          @if (isLoading()) {
            <div class="loading-state">
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
            </div>
          } @else if (filteredEmployees().length === 0) {
            <div class="empty-state">
              <div class="empty-icon">
                <span class="material-symbols-outlined">group_off</span>
              </div>
              <h3>No Employees Found</h3>
              <p>No employee profiles match the current filter or search criteria.</p>
              @if (authService.hasPermission('employees:create')) {
                <button class="btn btn-primary" (click)="openRegisterDrawer()">
                  <span class="material-symbols-outlined icon-sm">person_add</span>
                  <span>Register First Employee</span>
                </button>
              }
            </div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Employee</th>
                    <th>Code</th>
                    <th class="col-hide-mobile">Email</th>
                    <th>Employment Type</th>
                    <th class="col-hide-tablet">Date of Joining</th>
                    <th class="col-hide-tablet">Contract End</th>
                    <th class="col-hide-mobile">Remuneration</th>
                    <th class="col-actions col-sticky-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (emp of filteredEmployees(); track emp.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <div class="emp-cell">
                          <div class="emp-avatar">
                            {{ emp.firstName.charAt(0) }}{{ emp.lastName.charAt(0) }}
                          </div>
                          <div class="emp-names">
                            <span class="emp-fullname">{{ emp.firstName }} {{ emp.lastName }}</span>
                            <span class="emp-sub">{{ emp.currentDesignation?.title || 'Unassigned' }}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="code-badge">{{ emp.employeeCode }}</span>
                      </td>
                      <td class="text-secondary col-hide-mobile">{{ emp.email || '—' }}</td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="emp.employmentType === 'full_time'"
                          [class.status-pending]="emp.employmentType === 'contract'"
                        >
                          {{ emp.employmentType === 'full_time' ? 'FULL-TIME' : 'CONTRACT' }}
                        </span>
                      </td>
                      <td class="text-secondary col-hide-tablet">{{ emp.dateOfJoining }}</td>
                      <td class="text-secondary col-hide-tablet">
                        @if (emp.contractEndDate) {
                          <span>{{ emp.contractEndDate }}</span>
                        } @else {
                          <span class="text-muted">Permanent</span>
                        }
                      </td>
                      <td class="col-hide-mobile">
                        <span class="remuneration-pill" [class.hourly]="emp.remunerationBasis === 'hourly'">
                          {{ (emp.remunerationBasis || 'hourly') | uppercase }}
                        </span>
                      </td>
                      <td class="col-actions col-sticky-right">
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          (click)="openProfileDrawer(emp)"
                          title="View Profile Workspace"
                        >
                          <span class="material-symbols-outlined icon-sm">visibility</span>
                          <span>Profile</span>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- CONTEXTUAL DRAWER: EMPLOYEE PROFILE & REGISTRATION -->
      @if (isDrawerOpen()) {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <!-- Drawer Header -->
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">
                  {{ drawerMode() === 'register' ? 'Register New Employee' : 'Employee Profile Workspace' }}
                </h2>
                <p class="drawer-subtitle">
                  {{ drawerMode() === 'register' ? 'Enter statutory identity and contractual onboarding details.' : selectedEmployee()?.employeeCode + ' • ' + selectedEmployee()?.firstName + ' ' + selectedEmployee()?.lastName }}
                </p>
              </div>
              <button type="button" class="drawer-close" (click)="closeDrawer()" aria-label="Close drawer">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Drawer Body -->
            <div class="drawer-body">
              @if (drawerMode() === 'register') {
                <form (ngSubmit)="onSaveNewEmployee()" class="drawer-form" id="employeeForm">
                  <!-- Section 1: Biographical Identity -->
                  <div class="form-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">person</span>
                      <span>Biographical Identity</span>
                    </div>
                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="regCode">Employee Code *</label>
                        <input
                          id="regCode"
                          type="text"
                          [(ngModel)]="newEmployee.employeeCode"
                          name="regCode"
                          placeholder="e.g. BR-010"
                          required
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="regEmail">Work Email</label>
                        <input
                          id="regEmail"
                          type="email"
                          [(ngModel)]="newEmployee.email"
                          name="regEmail"
                          placeholder="name@blueroyal.local"
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-3">
                      <div class="form-group">
                        <label for="regFirst">First Name *</label>
                        <input
                          id="regFirst"
                          type="text"
                          [(ngModel)]="newEmployee.firstName"
                          name="regFirst"
                          required
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="regMiddle">Middle Name</label>
                        <input
                          id="regMiddle"
                          type="text"
                          [(ngModel)]="newEmployee.middleName"
                          name="regMiddle"
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="regLast">Last Name *</label>
                        <input
                          id="regLast"
                          type="text"
                          [(ngModel)]="newEmployee.lastName"
                          name="regLast"
                          required
                          class="form-control"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Section 2: Employment & Contract -->
                  <div class="form-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">work</span>
                      <span>Contractual & Legal Parameters</span>
                    </div>
                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="regEmpType">Employment Type *</label>
                        <select
                          id="regEmpType"
                          [(ngModel)]="newEmployee.employmentType"
                          name="regEmpType"
                          required
                          class="form-control"
                        >
                          <option value="full_time">Full-Time (Permanent)</option>
                          <option value="contract">Fixed Contract</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label for="regDoj">Date of Joining *</label>
                        <input
                          id="regDoj"
                          type="date"
                          [(ngModel)]="newEmployee.dateOfJoining"
                          name="regDoj"
                          required
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="regContractEnd">Contract End Date</label>
                        <input
                          id="regContractEnd"
                          type="date"
                          [(ngModel)]="newEmployee.contractEndDate"
                          name="regContractEnd"
                          [disabled]="newEmployee.employmentType !== 'contract'"
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="regRemuneration">Remuneration Basis *</label>
                        <select
                          id="regRemuneration"
                          [(ngModel)]="newEmployee.remunerationBasis"
                          name="regRemuneration"
                          required
                          class="form-control"
                        >
                          <option value="hourly">Hourly Timesheet Pay</option>
                          <option value="salaried">Monthly Fixed Package</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </form>
              } @else {
                @if (selectedEmployee(); as emp) {
                  <!-- Profile Inspection Mode -->
                  <div class="profile-card">
                    <div class="profile-header">
                      <div class="profile-avatar-lg">
                        {{ emp.firstName.charAt(0) }}{{ emp.lastName.charAt(0) }}
                      </div>
                      <div>
                        <h3 class="profile-name">{{ emp.firstName }} {{ emp.lastName }}</h3>
                        <span class="profile-sub">{{ emp.employeeCode }} • {{ emp.email || 'No email' }}</span>
                      </div>
                    </div>

                    <div class="profile-metrics">
                      <div class="p-metric">
                        <span class="p-label">Contract Type</span>
                        <span class="p-val">{{ emp.employmentType === 'full_time' ? 'Full-Time' : 'Fixed Contract' }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Joined On</span>
                        <span class="p-val">{{ emp.dateOfJoining }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Contract Expiry</span>
                        <span class="p-val">{{ emp.contractEndDate || 'Ongoing / Permanent' }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Payroll Basis</span>
                        <span class="p-val">{{ (emp.remunerationBasis || 'hourly') | uppercase }}</span>
                      </div>
                    </div>

                    <!-- Associated Assignment Information -->
                    <div class="assignment-summary-box">
                      <div class="summary-title">
                        <span class="material-symbols-outlined icon-sm">assignment_ind</span>
                        <span>Active Deployment Assignment</span>
                      </div>
                      @if (getEmployeeAssignment(emp.id); as assign) {
                        <div class="assign-details">
                          <div class="assign-row">
                            <span class="a-label">Client / Project:</span>
                            <span class="a-val">{{ assign.clientId }} / {{ assign.projectId }}</span>
                          </div>
                          <div class="assign-row">
                            <span class="a-label">Effective From:</span>
                            <span class="a-val">{{ assign.effectiveFrom }}</span>
                          </div>
                        </div>
                      } @else {
                        <div class="text-muted text-sm">
                          No active project deployment assignment configured.
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Drawer Footer -->
            <div class="drawer-footer">
              <button type="button" class="btn btn-secondary" (click)="closeDrawer()">
                Close
              </button>
              @if (drawerMode() === 'register') {
                <button
                  type="submit"
                  form="employeeForm"
                  class="btn btn-primary"
                  [disabled]="isSubmitting() || !newEmployee.employeeCode || !newEmployee.firstName || !newEmployee.lastName || !newEmployee.dateOfJoining"
                >
                  @if (isSubmitting()) {
                    <span>Saving...</span>
                  } @else {
                    <span class="material-symbols-outlined icon-sm">save</span>
                    <span>Save Employee Profile</span>
                  }
                </button>
              }
            </div>
          </div>
        </div>
      }
    </app-shell>
  `,
  styles: [`
    .employees-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .breadcrumb {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
      letter-spacing: -0.02em;
    }

    .page-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 0.625rem;
    }

    .panel {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .panel-toolbar {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border-default);
      background-color: var(--bg-surface-subtle);
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 260px;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      color: var(--text-muted);
      font-size: 1.125rem;
      pointer-events: none;
    }

    .search-input {
      padding-left: 2.25rem;
      height: 38px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .select-compact {
      height: 38px;
      width: 140px;
    }

    .count-tag {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    .table-responsive {
      overflow-x: auto;
    }

    .emp-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .emp-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-800));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.75rem;
      flex-shrink: 0;
    }

    .emp-names {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .emp-fullname {
      font-weight: 600;
      color: var(--text-primary);
    }

    .emp-sub {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .code-badge {
      font-family: var(--font-mono, monospace);
      font-size: 0.75rem;
      font-weight: 600;
      background-color: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      color: var(--text-secondary);
    }

    .remuneration-pill {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background-color: var(--brand-50);
      color: var(--brand-700);
      border: 1px solid var(--brand-200);
    }

    .remuneration-pill.hourly {
      background-color: #f0fdf4;
      color: #166534;
      border-color: #bbf7d0;
    }

    .col-actions {
      text-align: right;
    }

    .empty-state {
      padding: 3.5rem 2rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: var(--bg-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      font-size: 1.75rem;
    }

    .profile-card {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-default);
    }

    .profile-avatar-lg {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-900));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.125rem;
      font-weight: 700;
    }

    .profile-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .profile-sub {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .profile-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.875rem;
    }

    .p-metric {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .p-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }

    .p-val {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.875rem;
    }

    .assignment-summary-box {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      padding: 1rem;
    }

    .summary-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.75rem;
    }

    .assign-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.8125rem;
    }

    .assign-row {
      display: flex;
      justify-content: space-between;
    }

    .a-label {
      color: var(--text-muted);
    }

    .a-val {
      font-weight: 600;
      color: var(--text-primary);
    }
  `]
})
export class EmployeesComponent implements OnInit {
  public employees = signal<EmployeeDto[]>([]);
  public assignments = signal<EmployeeAssignmentDto[]>([]);
  public designations = signal<DesignationDto[]>([]);
  public isLoading = signal(true);
  public isSubmitting = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  // Filters
  public searchQuery = '';
  public typeFilter = '';

  // Drawer state
  public isDrawerOpen = signal(false);
  public drawerMode = signal<'register' | 'profile'>('register');
  public selectedEmployee = signal<EmployeeDto | null>(null);

  // Form Model
  public newEmployee: CreateEmployeeDto = {
    employeeCode: '',
    firstName: '',
    middleName: '',
    lastName: '',
    gender: 'male',
    dateOfBirth: '1992-05-15',
    nationality: 'Emirati',
    email: '',
    employmentType: 'full_time',
    dateOfJoining: new Date().toISOString().slice(0, 10),
    contractEndDate: undefined,
    remunerationBasis: 'hourly',
  };

  public filteredEmployees = computed(() => {
    const list = this.employees();
    const query = this.searchQuery.toLowerCase().trim();
    const type = this.typeFilter;

    return list.filter((e) => {
      const matchesType = !type || e.employmentType === type;
      const matchesQuery =
        !query ||
        e.employeeCode.toLowerCase().includes(query) ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(query) ||
        (e.email && e.email.toLowerCase().includes(query));
      return matchesType && matchesQuery;
    });
  });

  public fullTimeCount = computed(() => {
    return this.employees().filter((e) => e.employmentType === 'full_time').length;
  });

  public contractCount = computed(() => {
    return this.employees().filter((e) => e.employmentType === 'contract').length;
  });

  constructor(
    private masterService: MasterService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.masterService.getEmployees().subscribe({
      next: (res) => {
        this.employees.set(res.data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load employees roster.');
        this.isLoading.set(false);
      }
    });

    this.masterService.getAssignments().subscribe({
      next: (res) => this.assignments.set(res.data),
      error: () => {}
    });

    this.masterService.getDesignations().subscribe({
      next: (res) => this.designations.set(res.data),
      error: () => {}
    });
  }

  public getEmployeeAssignment(empId: string): EmployeeAssignmentDto | undefined {
    const today = new Date().toISOString().slice(0, 10);
    return this.assignments().find(
      (a) => a.employeeId === empId && (!a.effectiveTo || a.effectiveTo >= today),
    );
  }

  public openRegisterDrawer(): void {
    this.drawerMode.set('register');
    this.newEmployee = {
      employeeCode: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '1992-05-15',
      nationality: 'Emirati',
      email: '',
      employmentType: 'full_time',
      dateOfJoining: new Date().toISOString().slice(0, 10),
      contractEndDate: undefined,
      remunerationBasis: 'hourly',
    };
    this.isDrawerOpen.set(true);
  }

  public openProfileDrawer(emp: EmployeeDto): void {
    this.selectedEmployee.set(emp);
    this.drawerMode.set('profile');
    this.isDrawerOpen.set(true);
  }

  public closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  public onSaveNewEmployee(): void {
    if (!this.newEmployee.employeeCode || !this.newEmployee.firstName || !this.newEmployee.lastName || !this.newEmployee.dateOfJoining) {
      this.errorMessage.set('Please provide all required fields: code, first name, last name, and date of joining.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.masterService.createEmployee(this.newEmployee).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeDrawer();
        this.successMessage.set(`Employee ${this.newEmployee.employeeCode} registered successfully.`);
        this.loadData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.error?.message || 'Failed to register employee.');
      }
    });
  }
}
