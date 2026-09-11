import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MasterService } from '../../core/services/master.service';
import { DocumentService } from '../../core/services/document.service';
import { AuthService } from '../../core/services/auth.service';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import {
  EmployeeDto,
  EmployeeAssignmentDto,
  DesignationDto,
  EmployeeDocumentDto,
  EmployeeGender,
  EmploymentType,
  RemunerationBasis,
  EmployeeStatus,
} from '@blue-royal/contracts';

export const EMPLOYEE_COUNTRIES: readonly string[] = [
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Kuwait',
  'Bahrain',
  'Philippines',
  'Egypt',
  'United Kingdom',
  'United States',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'Nepal',
  'Other',
] as const;

interface EmployeeFormState {
  id?: string;
  employeeCode: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: EmployeeGender;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phoneNumber: string;
  address: string;
  country: string;
  employmentType: EmploymentType;
  dateOfJoining: string;
  contractEndDate?: string;
  remunerationBasis: RemunerationBasis;
  status: EmployeeStatus;
  profilePhoto?: string | null;
}

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
            <div class="breadcrumb">EMPLOYEES</div>
            <h1 class="page-title">Employees</h1>
            <p class="page-desc">
              Manage employee information and profiles.
            </p>
          </div>
          <div class="header-actions">
            @if (authService.hasPermission('employees:create')) {
              <button class="btn btn-primary" (click)="openAddDrawer()">
                <span class="material-symbols-outlined icon-sm">person_add</span>
                <span>Add Employee</span>
              </button>
            }
            <button class="btn btn-secondary" (click)="loadData()">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <!-- 3 KPI Cards -->
        <div class="kpi-grid">
          <!-- Card 1: Total Headcount -->
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="material-symbols-outlined kpi-icon">groups</span>
              <span class="kpi-title">Total Headcount</span>
            </div>
            <div class="kpi-body single">
              <div class="kpi-stat-item align-left">
                <span class="kpi-number">{{ totalHeadcount() }}</span>
                <span class="kpi-caption">Employees</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Employment Type -->
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="material-symbols-outlined kpi-icon">badge</span>
              <span class="kpi-title">Employment Type</span>
            </div>
            <div class="kpi-body split">
              <div class="kpi-stat-item">
                <span class="kpi-number">{{ fullTimeCount() }}</span>
                <span class="kpi-caption">Full-Time</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-stat-item">
                <span class="kpi-number">{{ contractCount() }}</span>
                <span class="kpi-caption">Contract</span>
              </div>
            </div>
          </div>

          <!-- Card 3: Employee Status -->
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="material-symbols-outlined kpi-icon">check_circle</span>
              <span class="kpi-title">Employee Status</span>
            </div>
            <div class="kpi-body split">
              <div class="kpi-stat-item">
                <span class="kpi-number">{{ activeCount() }}</span>
                <span class="kpi-caption">Active</span>
              </div>
              <div class="kpi-divider"></div>
              <div class="kpi-stat-item">
                <span class="kpi-number">{{ inactiveCount() }}</span>
                <span class="kpi-caption">Inactive</span>
              </div>
            </div>
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
                placeholder="Search by name, employee code, email, or country..."
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
                <button class="btn btn-primary" (click)="openAddDrawer()">
                  <span class="material-symbols-outlined icon-sm">person_add</span>
                  <span>Add First Employee</span>
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
                    <th>Country</th>
                    <th>Employment Type</th>
                    <th>Status</th>
                    <th class="col-actions col-sticky-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (emp of filteredEmployees(); track emp.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <div class="emp-cell">
                          <div class="emp-avatar" [class.has-photo]="emp.profilePhoto">
                            @if (emp.profilePhoto) {
                              <img [src]="getPhotoUrl(emp.id)" alt="Photo" class="emp-avatar-img" (error)="onAvatarError($event)" />
                            } @else {
                              {{ emp.firstName.charAt(0) }}{{ emp.lastName.charAt(0) }}
                            }
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
                        <span class="country-badge">{{ emp.country || '—' }}</span>
                      </td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="emp.employmentType === 'full_time'"
                          [class.status-pending]="emp.employmentType === 'contract'"
                        >
                          {{ emp.employmentType === 'full_time' ? 'FULL-TIME' : 'CONTRACT' }}
                        </span>
                      </td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="emp.status === 'active' || emp.status === 'probation'"
                          [class.status-rejected]="emp.status === 'terminated' || emp.status === 'inactive' || emp.status === 'resigned'"
                        >
                          {{ (emp.status || 'active') | uppercase }}
                        </span>
                      </td>
                      <td class="col-actions col-sticky-right">
                        <div class="action-btn-group">
                          @if (authService.hasPermission('employees:update')) {
                            <button
                              type="button"
                              class="btn btn-secondary btn-sm"
                              (click)="openEditDrawer(emp)"
                              title="Edit Employee"
                            >
                              <span class="material-symbols-outlined icon-sm">edit</span>
                              <span>Edit</span>
                            </button>
                          }
                          <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            (click)="openProfileDrawer(emp)"
                            title="View Profile"
                          >
                            <span class="material-symbols-outlined icon-sm">visibility</span>
                            <span>Profile</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- CONTEXTUAL OFFCANVAS DRAWER: ADD / EDIT / PROFILE -->
      @if (isDrawerOpen()) {
        <div class="drawer-backdrop" (click)="closeDrawer()">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <!-- Drawer Header -->
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">
                  {{
                    drawerMode() === 'add'
                      ? 'Add Employee'
                      : drawerMode() === 'edit'
                      ? 'Edit Employee'
                      : 'Employee Profile'
                  }}
                </h2>
                <p class="drawer-subtitle">
                  {{
                    drawerMode() === 'add'
                      ? 'Enter employee details and required documents.'
                      : drawerMode() === 'edit'
                      ? 'Update employee profile and details.'
                      : (selectedEmployee()?.employeeCode + ' • ' + selectedEmployee()?.firstName + ' ' + selectedEmployee()?.lastName)
                  }}
                </p>
              </div>
              <button type="button" class="drawer-close" (click)="closeDrawer()" aria-label="Close drawer">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <!-- Drawer Body -->
            <div class="drawer-body">
              @if (drawerError()) {
                <div class="alert alert-danger mb-3" role="alert">
                  <span class="material-symbols-outlined icon-sm">error</span>
                  <span>{{ drawerError() }}</span>
                </div>
              }

              @if (drawerMode() === 'add' || drawerMode() === 'edit') {
                <form (ngSubmit)="onSaveEmployee()" class="drawer-form" id="employeeForm">
                  <!-- Section 1: Profile Photo -->
                  <div class="form-section photo-card-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">photo_camera</span>
                      <span>Profile Photo</span>
                    </div>
                    <div class="photo-upload-row">
                      <div class="photo-avatar-preview">
                        @if (photoPreview()) {
                          <img [src]="photoPreview()" alt="Preview" class="preview-img" />
                        } @else if (formEmployee.profilePhoto && drawerMode() === 'edit' && !isPhotoRemoved()) {
                          <img [src]="getPhotoUrl(formEmployee.id!)" alt="Profile" class="preview-img" (error)="onAvatarError($event)" />
                        } @else {
                          <span class="material-symbols-outlined photo-placeholder-icon">person</span>
                        }
                      </div>
                      <div class="photo-controls">
                        <div class="photo-btn-group">
                          <label class="btn btn-secondary btn-sm file-upload-label">
                            <span class="material-symbols-outlined icon-sm">upload</span>
                            <span>{{ (photoPreview() || (formEmployee.profilePhoto && !isPhotoRemoved())) ? 'Change Photo' : 'Upload Photo' }}</span>
                            <input type="file" (change)="onPhotoFileChange($event)" accept="image/*" class="sr-only" />
                          </label>
                          @if (photoPreview() || (formEmployee.profilePhoto && !isPhotoRemoved())) {
                            <button type="button" class="btn btn-secondary btn-sm text-danger" (click)="onRemovePhoto()">
                              <span class="material-symbols-outlined icon-sm">delete</span>
                              <span>Remove</span>
                            </button>
                          }
                        </div>
                        <span class="text-hint">PNG, JPG, or WebP. Suggested square aspect ratio.</span>
                      </div>
                    </div>
                  </div>

                  <!-- Section 2: Employee Basic Details -->
                  <div class="form-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">badge</span>
                      <span>Basic Details</span>
                    </div>
                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="empCode">Employee Code *</label>
                        <input
                          id="empCode"
                          type="text"
                          [(ngModel)]="formEmployee.employeeCode"
                          name="empCode"
                          placeholder="e.g. EMP-001"
                          required
                          [disabled]="drawerMode() === 'edit'"
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="empEmail">Email *</label>
                        <input
                          id="empEmail"
                          type="email"
                          [(ngModel)]="formEmployee.email"
                          name="empEmail"
                          placeholder="name@company.com"
                          required
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-3">
                      <div class="form-group">
                        <label for="empFirst">First Name *</label>
                        <input
                          id="empFirst"
                          type="text"
                          [(ngModel)]="formEmployee.firstName"
                          name="empFirst"
                          placeholder="First name"
                          required
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="empMiddle">Middle Name</label>
                        <input
                          id="empMiddle"
                          type="text"
                          [(ngModel)]="formEmployee.middleName"
                          name="empMiddle"
                          placeholder="Middle name (optional)"
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="empLast">Last Name *</label>
                        <input
                          id="empLast"
                          type="text"
                          [(ngModel)]="formEmployee.lastName"
                          name="empLast"
                          placeholder="Last name"
                          required
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-3">
                      <div class="form-group">
                        <label for="empGender">Gender</label>
                        <select
                          id="empGender"
                          [(ngModel)]="formEmployee.gender"
                          name="empGender"
                          class="form-control"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label for="empDob">Date of Birth</label>
                        <input
                          id="empDob"
                          type="date"
                          [(ngModel)]="formEmployee.dateOfBirth"
                          name="empDob"
                          class="form-control"
                        />
                      </div>
                      <div class="form-group">
                        <label for="empPhone">Phone Number</label>
                        <input
                          id="empPhone"
                          type="tel"
                          [(ngModel)]="formEmployee.phoneNumber"
                          name="empPhone"
                          placeholder="+971 50 123 4567"
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="empCountry">Country *</label>
                        <select
                          id="empCountry"
                          [(ngModel)]="formEmployee.country"
                          name="empCountry"
                          required
                          class="form-control"
                        >
                          <option value="" disabled>Select Country</option>
                          @for (c of countriesList; track c) {
                            <option [value]="c">{{ c }}</option>
                          }
                        </select>
                        <span class="text-hint">Feeds Dashboard Employees by Region</span>
                      </div>
                      @if (drawerMode() === 'edit') {
                        <div class="form-group">
                          <label for="empStatus">Employee Status</label>
                          <select
                            id="empStatus"
                            [(ngModel)]="formEmployee.status"
                            name="empStatus"
                            class="form-control"
                          >
                            <option value="active">Active</option>
                            <option value="probation">Probation</option>
                            <option value="inactive">Inactive</option>
                            <option value="terminated">Terminated</option>
                          </select>
                        </div>
                      }
                    </div>

                    <div class="form-group">
                      <label for="empAddress">Address</label>
                      <textarea
                        id="empAddress"
                        [(ngModel)]="formEmployee.address"
                        name="empAddress"
                        rows="2"
                        placeholder="Street address, building, city..."
                        class="form-control"
                      ></textarea>
                    </div>
                  </div>

                  <!-- Section 3: Employment Parameters -->
                  <div class="form-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">work</span>
                      <span>Employment & Contract</span>
                    </div>
                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="empType">Employment Type *</label>
                        <select
                          id="empType"
                          [(ngModel)]="formEmployee.employmentType"
                          name="empType"
                          required
                          class="form-control"
                        >
                          <option value="full_time">Full-Time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label for="empDoj">Date of Joining *</label>
                        <input
                          id="empDoj"
                          type="date"
                          [(ngModel)]="formEmployee.dateOfJoining"
                          name="empDoj"
                          required
                          class="form-control"
                        />
                      </div>
                    </div>

                    <div class="form-grid-2">
                      <div class="form-group">
                        <label for="empContractEnd">Contract End Date</label>
                        <input
                          id="empContractEnd"
                          type="date"
                          [(ngModel)]="formEmployee.contractEndDate"
                          name="empContractEnd"
                          [required]="formEmployee.employmentType === 'contract'"
                          [disabled]="formEmployee.employmentType !== 'contract'"
                          class="form-control"
                        />
                        @if (formEmployee.employmentType === 'contract') {
                          <span class="text-hint text-warning">Required for contract employees</span>
                        }
                      </div>
                      <div class="form-group">
                        <label for="empRemun">Remuneration Basis *</label>
                        <select
                          id="empRemun"
                          [(ngModel)]="formEmployee.remunerationBasis"
                          name="empRemun"
                          required
                          class="form-control"
                        >
                          <option value="hourly">Hourly Timesheet Pay</option>
                          <option value="salaried">Monthly Fixed Package</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <!-- Section 4: Mandatory Statutory Documents -->
                  <div class="form-section">
                    <div class="form-section-title">
                      <span class="material-symbols-outlined icon-sm">description</span>
                      <span>Statutory Documents</span>
                    </div>

                    <!-- Passport Upload -->
                    <div class="doc-upload-box">
                      <div class="doc-upload-header">
                        <span class="doc-upload-title">
                          Passport {{ drawerMode() === 'add' ? '*' : '' }}
                        </span>
                        @if (existingPassportDoc()) {
                          <span class="badge badge-success">On File</span>
                        } @else if (drawerMode() === 'edit') {
                          <span class="badge badge-muted">Not uploaded</span>
                        }
                      </div>

                      @if (existingPassportDoc(); as pDoc) {
                        <div class="existing-doc-row">
                          <span class="material-symbols-outlined icon-sm text-primary">check_circle</span>
                          <span class="doc-name">{{ pDoc.fileName }}</span>
                          <a [href]="documentService.getDownloadUrl(pDoc.id)" target="_blank" class="btn btn-secondary btn-xs">
                            <span class="material-symbols-outlined icon-xs">download</span>
                            <span>Download</span>
                          </a>
                        </div>
                      }

                      <div class="file-picker-row">
                        <label class="btn btn-secondary btn-sm file-upload-label">
                          <span class="material-symbols-outlined icon-sm">attach_file</span>
                          <span>{{ selectedPassportFile ? 'Change Passport File' : (existingPassportDoc() ? 'Replace Passport File' : 'Select Passport File *') }}</span>
                          <input type="file" (change)="onPassportFileChange($event)" accept=".pdf,image/*" class="sr-only" />
                        </label>
                        @if (selectedPassportFile) {
                          <div class="selected-file-badge">
                            <span class="material-symbols-outlined icon-xs">description</span>
                            <span class="file-name-text">{{ selectedPassportFile.name }}</span>
                            <span class="file-size-text">({{ formatBytes(selectedPassportFile.size) }})</span>
                            <button type="button" class="clear-file-btn" (click)="clearPassportFile()">×</button>
                          </div>
                        } @else if (drawerMode() === 'add') {
                          <span class="text-hint text-warning">Mandatory document for registration</span>
                        }
                      </div>
                    </div>

                    <!-- Visa Upload -->
                    <div class="doc-upload-box">
                      <div class="doc-upload-header">
                        <span class="doc-upload-title">
                          Visa {{ drawerMode() === 'add' ? '*' : '' }}
                        </span>
                        @if (existingVisaDoc()) {
                          <span class="badge badge-success">On File</span>
                        } @else if (drawerMode() === 'edit') {
                          <span class="badge badge-muted">Not uploaded</span>
                        }
                      </div>

                      @if (existingVisaDoc(); as vDoc) {
                        <div class="existing-doc-row">
                          <span class="material-symbols-outlined icon-sm text-primary">check_circle</span>
                          <span class="doc-name">{{ vDoc.fileName }}</span>
                          <a [href]="documentService.getDownloadUrl(vDoc.id)" target="_blank" class="btn btn-secondary btn-xs">
                            <span class="material-symbols-outlined icon-xs">download</span>
                            <span>Download</span>
                          </a>
                        </div>
                      }

                      <div class="file-picker-row">
                        <label class="btn btn-secondary btn-sm file-upload-label">
                          <span class="material-symbols-outlined icon-sm">attach_file</span>
                          <span>{{ selectedVisaFile ? 'Change Visa File' : (existingVisaDoc() ? 'Replace Visa File' : 'Select Visa File *') }}</span>
                          <input type="file" (change)="onVisaFileChange($event)" accept=".pdf,image/*" class="sr-only" />
                        </label>
                        @if (selectedVisaFile) {
                          <div class="selected-file-badge">
                            <span class="material-symbols-outlined icon-xs">description</span>
                            <span class="file-name-text">{{ selectedVisaFile.name }}</span>
                            <span class="file-size-text">({{ formatBytes(selectedVisaFile.size) }})</span>
                            <button type="button" class="clear-file-btn" (click)="clearVisaFile()">×</button>
                          </div>
                        } @else if (drawerMode() === 'add') {
                          <span class="text-hint text-warning">Mandatory document for registration</span>
                        }
                      </div>
                    </div>
                  </div>
                </form>
              } @else {
                <!-- Profile Inspection Mode -->
                @if (selectedEmployee(); as emp) {
                  <div class="profile-card">
                    <div class="profile-header">
                      <div class="profile-avatar-lg" [class.has-photo]="emp.profilePhoto">
                        @if (emp.profilePhoto) {
                          <img [src]="getPhotoUrl(emp.id)" alt="Photo" class="profile-avatar-img" (error)="onAvatarError($event)" />
                        } @else {
                          {{ emp.firstName.charAt(0) }}{{ emp.lastName.charAt(0) }}
                        }
                      </div>
                      <div>
                        <h3 class="profile-name">{{ emp.firstName }} {{ emp.lastName }}</h3>
                        <span class="profile-sub">{{ emp.employeeCode }} • {{ emp.email || 'No email' }}</span>
                        <div class="profile-tag-row">
                          <span class="country-badge">{{ emp.country || 'No country set' }}</span>
                          <span
                            class="status-badge"
                            [class.status-approved]="emp.status === 'active' || emp.status === 'probation'"
                            [class.status-rejected]="emp.status === 'terminated' || emp.status === 'inactive' || emp.status === 'resigned'"
                          >
                            {{ (emp.status || 'active') | uppercase }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div class="profile-metrics">
                      <div class="p-metric">
                        <span class="p-label">Contract Type</span>
                        <span class="p-val">{{ emp.employmentType === 'full_time' ? 'Full-Time' : 'Contract' }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Joined On</span>
                        <span class="p-val">{{ emp.dateOfJoining }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Contract Expiry</span>
                        <span class="p-val">{{ emp.contractEndDate || 'Permanent' }}</span>
                      </div>
                      <div class="p-metric">
                        <span class="p-label">Payroll Basis</span>
                        <span class="p-val">{{ (emp.remunerationBasis || 'hourly') | uppercase }}</span>
                      </div>
                    </div>

                    <!-- Biographical Info -->
                    <div class="profile-info-box">
                      <div class="summary-title">
                        <span class="material-symbols-outlined icon-sm">person</span>
                        <span>Biographical & Contact</span>
                      </div>
                      <div class="profile-info-grid">
                        <div class="info-item">
                          <span class="info-lbl">Gender:</span>
                          <span class="info-val">{{ formatGender(emp.gender) }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-lbl">Date of Birth:</span>
                          <span class="info-val">{{ emp.dateOfBirth || '—' }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-lbl">Phone:</span>
                          <span class="info-val">{{ emp.phoneNumber || '—' }}</span>
                        </div>
                        <div class="info-item">
                          <span class="info-lbl">Country:</span>
                          <span class="info-val">{{ emp.country || '—' }}</span>
                        </div>
                        <div class="info-item col-span-2">
                          <span class="info-lbl">Address:</span>
                          <span class="info-val">{{ emp.address || '—' }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Statutory Documents Status -->
                    <div class="profile-info-box">
                      <div class="summary-title">
                        <span class="material-symbols-outlined icon-sm">verified_user</span>
                        <span>Statutory Compliance Documents</span>
                      </div>

                      <div class="doc-status-list">
                        <!-- Passport -->
                        <div class="doc-status-item">
                          <div class="doc-status-info">
                            <span class="material-symbols-outlined icon-sm" [class.text-success]="getEmployeePassportDoc(emp.id)" [class.text-muted]="!getEmployeePassportDoc(emp.id)">
                              {{ getEmployeePassportDoc(emp.id) ? 'check_circle' : 'pending' }}
                            </span>
                            <div class="doc-status-text">
                              <span class="doc-status-name">Passport</span>
                              @if (getEmployeePassportDoc(emp.id); as doc) {
                                <span class="doc-status-sub">{{ doc.fileName }}</span>
                              } @else {
                                <span class="doc-status-sub text-muted">Passport — Not uploaded</span>
                              }
                            </div>
                          </div>
                          @if (getEmployeePassportDoc(emp.id); as doc) {
                            <a [href]="documentService.getDownloadUrl(doc.id)" target="_blank" class="btn btn-secondary btn-xs">
                              <span class="material-symbols-outlined icon-xs">download</span>
                              <span>Download</span>
                            </a>
                          }
                        </div>

                        <!-- Visa -->
                        <div class="doc-status-item">
                          <div class="doc-status-info">
                            <span class="material-symbols-outlined icon-sm" [class.text-success]="getEmployeeVisaDoc(emp.id)" [class.text-muted]="!getEmployeeVisaDoc(emp.id)">
                              {{ getEmployeeVisaDoc(emp.id) ? 'check_circle' : 'pending' }}
                            </span>
                            <div class="doc-status-text">
                              <span class="doc-status-name">Visa</span>
                              @if (getEmployeeVisaDoc(emp.id); as doc) {
                                <span class="doc-status-sub">{{ doc.fileName }}</span>
                              } @else {
                                <span class="doc-status-sub text-muted">Visa — Not uploaded</span>
                              }
                            </div>
                          </div>
                          @if (getEmployeeVisaDoc(emp.id); as doc) {
                            <a [href]="documentService.getDownloadUrl(doc.id)" target="_blank" class="btn btn-secondary btn-xs">
                              <span class="material-symbols-outlined icon-xs">download</span>
                              <span>Download</span>
                            </a>
                          }
                        </div>
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
                            <span class="a-val">{{ assign.clientName || assign.clientId }} / {{ assign.projectName || assign.projectId }}</span>
                          </div>
                          <div class="assign-row">
                            <span class="a-label">Designation:</span>
                            <span class="a-val">{{ assign.designationTitle || 'Assigned Worker' }}</span>
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

              @if (drawerMode() === 'profile' && selectedEmployee()) {
                @if (authService.hasPermission('employees:update')) {
                  <button type="button" class="btn btn-primary" (click)="openEditDrawer(selectedEmployee()!)">
                    <span class="material-symbols-outlined icon-sm">edit</span>
                    <span>Edit Profile</span>
                  </button>
                }
              }

              @if (drawerMode() === 'add' || drawerMode() === 'edit') {
                <button
                  type="submit"
                  form="employeeForm"
                  class="btn btn-primary"
                  [disabled]="isSubmitting()"
                >
                  @if (isSubmitting()) {
                    <span>Saving...</span>
                  } @else {
                    <span class="material-symbols-outlined icon-sm">save</span>
                    <span>{{ drawerMode() === 'add' ? 'Save Employee' : 'Save Changes' }}</span>
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

    /* 3 KPI Cards Layout */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    @media (max-width: 900px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 0.75rem 1rem;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 102px;
      box-sizing: border-box;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-card:hover {
      border-color: var(--border-hover, #cbd5e1);
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.06));
    }

    .kpi-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.125rem;
    }

    .kpi-icon {
      font-size: 1rem;
      color: var(--text-muted);
      opacity: 0.8;
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }

    .kpi-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-secondary);
      line-height: 1.2;
    }

    .kpi-body {
      display: flex;
      flex: 1;
      align-items: center;
    }

    .kpi-body.single {
      align-items: center;
    }

    .kpi-body.split {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-stat-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .kpi-stat-item.align-left {
      align-items: flex-start;
      text-align: left;
    }

    .kpi-number {
      font-size: 1.625rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .kpi-caption {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--text-muted);
      margin-top: 0.125rem;
    }

    .kpi-divider {
      width: 1px;
      height: 26px;
      background-color: var(--border-subtle, #e2e8f0);
      flex-shrink: 0;
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
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-800));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.75rem;
      flex-shrink: 0;
      overflow: hidden;
    }

    .emp-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
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

    .country-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: var(--text-secondary);
    }

    .action-btn-group {
      display: flex;
      gap: 0.375rem;
      justify-content: flex-end;
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

    /* Offcanvas Drawer */
    .drawer-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
    }

    .drawer-panel {
      background: #ffffff;
      width: 100%;
      max-width: 580px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.25s ease-out;
    }

    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-default);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: var(--bg-surface-subtle);
    }

    .drawer-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 0.25rem;
      color: var(--text-primary);
    }

    .drawer-subtitle {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin: 0;
    }

    .drawer-close {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
      border-radius: 4px;
    }
    .drawer-close:hover {
      background: var(--border-default);
      color: var(--text-primary);
    }

    .drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .drawer-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-default);
      background: var(--bg-surface-subtle);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    /* Form Styles */
    .drawer-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-section {
      background: #ffffff;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-section-title {
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-default);
    }

    .form-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.875rem;
    }

    .form-grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.875rem;
    }

    @media (max-width: 600px) {
      .form-grid-2, .form-grid-3 {
        grid-template-columns: 1fr;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .form-group label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .text-hint {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    /* Photo Upload Component */
    .photo-upload-row {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .photo-avatar-preview {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--bg-surface-subtle);
      border: 2px dashed var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .photo-placeholder-icon {
      font-size: 2rem;
      color: var(--text-muted);
    }

    .photo-controls {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }

    .photo-btn-group {
      display: flex;
      gap: 0.5rem;
    }

    .file-upload-label {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin: 0;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    /* Document Upload Box */
    .doc-upload-box {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      padding: 0.875rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .doc-upload-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .doc-upload-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .existing-doc-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #ffffff;
      border: 1px solid var(--border-default);
      padding: 0.375rem 0.625rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .existing-doc-row .doc-name {
      flex: 1;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-picker-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .selected-file-badge {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: #e0f2fe;
      border: 1px solid #bae6fd;
      color: #0369a1;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      max-width: 100%;
    }

    .file-name-text {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .file-size-text {
      color: #0284c7;
      font-size: 0.6875rem;
    }

    .clear-file-btn {
      background: none;
      border: none;
      color: #0369a1;
      cursor: pointer;
      font-weight: 700;
      font-size: 0.875rem;
      padding: 0 0.125rem;
      line-height: 1;
    }

    .badge-success {
      background: #dcfce7;
      color: #166534;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
    }

    .badge-muted {
      background: #f1f5f9;
      color: var(--text-muted);
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
    }

    /* Profile View Styles */
    .profile-card {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-default);
    }

    .profile-avatar-lg {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--brand-600), var(--brand-900));
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      overflow: hidden;
      flex-shrink: 0;
    }

    .profile-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
    }

    .profile-sub {
      font-size: 0.8125rem;
      color: var(--text-muted);
      display: block;
      margin-bottom: 0.375rem;
    }

    .profile-tag-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
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

    .profile-info-box {
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

    .profile-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.625rem 1rem;
      font-size: 0.8125rem;
    }

    .col-span-2 {
      grid-column: span 2;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .info-lbl {
      color: var(--text-muted);
      font-size: 0.6875rem;
      font-weight: 500;
    }

    .info-val {
      color: var(--text-primary);
      font-weight: 600;
    }

    .doc-status-list {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .doc-status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--border-default);
      padding: 0.625rem 0.875rem;
      border-radius: 4px;
    }

    .doc-status-info {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .doc-status-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .doc-status-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .doc-status-sub {
      font-size: 0.6875rem;
      color: var(--text-secondary);
    }

    .assignment-summary-box {
      background: var(--bg-surface-subtle);
      border: 1px solid var(--border-default);
      border-radius: 6px;
      padding: 1rem;
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

    .btn-xs {
      padding: 0.15rem 0.5rem;
      font-size: 0.6875rem;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .icon-xs {
      font-size: 0.875rem !important;
    }
  `]
})
export class EmployeesComponent implements OnInit {
  public employees = signal<EmployeeDto[]>([]);
  public assignments = signal<EmployeeAssignmentDto[]>([]);
  public designations = signal<DesignationDto[]>([]);
  public profileDocuments = signal<EmployeeDocumentDto[]>([]);

  public isLoading = signal(true);
  public isSubmitting = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);
  public drawerError = signal<string | null>(null);

  // Filters
  public searchQuery = '';
  public typeFilter = '';

  // Drawer State
  public isDrawerOpen = signal(false);
  public drawerMode = signal<'add' | 'edit' | 'profile'>('add');
  public selectedEmployee = signal<EmployeeDto | null>(null);

  // Countries Master Reference
  public countriesList = EMPLOYEE_COUNTRIES;

  // Form Model
  public formEmployee: EmployeeFormState = this.getInitialFormState();

  // Photo state
  public photoPreview = signal<string | null>(null);
  public selectedPhotoFile: File | null = null;
  public isPhotoRemoved = signal(false);

  // Document file states
  public selectedPassportFile: File | null = null;
  public selectedVisaFile: File | null = null;

  // KPIs
  public totalHeadcount = computed(() => this.employees().length);

  public fullTimeCount = computed(() => {
    return this.employees().filter((e) => e.employmentType === 'full_time').length;
  });

  public contractCount = computed(() => {
    return this.employees().filter((e) => e.employmentType === 'contract').length;
  });

  public activeCount = computed(() => {
    return this.employees().filter((e) => ['active', 'probation', 'on_leave'].includes(e.status)).length;
  });

  public inactiveCount = computed(() => {
    return this.employees().filter((e) => ['inactive', 'terminated', 'resigned'].includes(e.status)).length;
  });

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
        (e.email && e.email.toLowerCase().includes(query)) ||
        (e.country && e.country.toLowerCase().includes(query));
      return matchesType && matchesQuery;
    });
  });

  // Existing documents helpers
  public existingPassportDoc = computed(() => {
    return this.profileDocuments().find(
      (d) => d.documentTypeCode === 'PASSPORT' || (d as any).documentType?.code === 'PASSPORT',
    );
  });

  public existingVisaDoc = computed(() => {
    return this.profileDocuments().find(
      (d) => d.documentTypeCode === 'VISA' || (d as any).documentType?.code === 'VISA',
    );
  });

  constructor(
    private masterService: MasterService,
    public documentService: DocumentService,
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
        this.errorMessage.set(err.error?.error?.message || 'Failed to load employees.');
        this.isLoading.set(false);
      },
    });

    this.masterService.getAssignments().subscribe({
      next: (res) => this.assignments.set(res.data),
      error: () => {},
    });

    this.masterService.getDesignations().subscribe({
      next: (res) => this.designations.set(res.data),
      error: () => {},
    });
  }

  public getPhotoUrl(employeeId: string): string {
    const token = this.authService.getAccessToken();
    return this.masterService.getEmployeePhotoUrl(employeeId, token || undefined);
  }

  public onAvatarError(event: Event): void {
    const target = event.target as HTMLElement;
    if (target) {
      target.style.display = 'none';
    }
  }

  public getEmployeeAssignment(empId: string): EmployeeAssignmentDto | undefined {
    const today = new Date().toISOString().slice(0, 10);
    return this.assignments().find(
      (a) => a.employeeId === empId && (!a.effectiveTo || a.effectiveTo >= today),
    );
  }

  public getEmployeePassportDoc(empId: string): EmployeeDocumentDto | undefined {
    return this.profileDocuments().find(
      (d) => d.documentTypeCode === 'PASSPORT' || (d as any).documentType?.code === 'PASSPORT',
    );
  }

  public getEmployeeVisaDoc(empId: string): EmployeeDocumentDto | undefined {
    return this.profileDocuments().find(
      (d) => d.documentTypeCode === 'VISA' || (d as any).documentType?.code === 'VISA',
    );
  }

  public openAddDrawer(): void {
    this.drawerMode.set('add');
    this.drawerError.set(null);
    this.formEmployee = this.getInitialFormState();
    this.photoPreview.set(null);
    this.selectedPhotoFile = null;
    this.isPhotoRemoved.set(false);
    this.selectedPassportFile = null;
    this.selectedVisaFile = null;
    this.profileDocuments.set([]);
    this.isDrawerOpen.set(true);
  }

  public openEditDrawer(emp: EmployeeDto): void {
    this.drawerMode.set('edit');
    this.drawerError.set(null);
    this.selectedEmployee.set(emp);
    this.formEmployee = {
      id: emp.id,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      middleName: emp.middleName || '',
      lastName: emp.lastName,
      gender: emp.gender || 'prefer_not_to_say',
      dateOfBirth: emp.dateOfBirth || '',
      nationality: emp.nationality || '',
      email: emp.email || '',
      phoneNumber: emp.phoneNumber || '',
      address: emp.address || '',
      country: emp.country || '',
      employmentType: emp.employmentType || 'full_time',
      dateOfJoining: emp.dateOfJoining || new Date().toISOString().slice(0, 10),
      contractEndDate: emp.contractEndDate || undefined,
      remunerationBasis: emp.remunerationBasis || 'hourly',
      status: emp.status || 'active',
      profilePhoto: emp.profilePhoto,
    };
    this.photoPreview.set(null);
    this.selectedPhotoFile = null;
    this.isPhotoRemoved.set(false);
    this.selectedPassportFile = null;
    this.selectedVisaFile = null;

    // Load documents for existing employee
    this.loadEmployeeDocuments(emp.id);
    this.isDrawerOpen.set(true);
  }

  public openProfileDrawer(emp: EmployeeDto): void {
    this.selectedEmployee.set(emp);
    this.drawerMode.set('profile');
    this.drawerError.set(null);
    this.loadEmployeeDocuments(emp.id);
    this.isDrawerOpen.set(true);
  }

  public closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.drawerError.set(null);
  }

  public onPhotoFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedPhotoFile = file;
      this.isPhotoRemoved.set(false);
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  public onRemovePhoto(): void {
    this.photoPreview.set(null);
    this.selectedPhotoFile = null;
    this.isPhotoRemoved.set(true);
  }

  public onPassportFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedPassportFile = input.files[0];
    }
  }

  public clearPassportFile(): void {
    this.selectedPassportFile = null;
  }

  public onVisaFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedVisaFile = input.files[0];
    }
  }

  public clearVisaFile(): void {
    this.selectedVisaFile = null;
  }

  public formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  public formatGender(gender?: string): string {
    if (!gender) return '—';
    switch (gender) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'other': return 'Other';
      case 'prefer_not_to_say': return 'Prefer not to say';
      default: return gender;
    }
  }

  public onSaveEmployee(): void {
    this.drawerError.set(null);

    // Basic details validation
    if (!this.formEmployee.employeeCode?.trim()) {
      this.drawerError.set('Employee Code is required.');
      return;
    }
    if (!this.formEmployee.firstName?.trim() || !this.formEmployee.lastName?.trim()) {
      this.drawerError.set('First Name and Last Name are required.');
      return;
    }
    const email = this.formEmployee.email?.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      this.drawerError.set('A valid Email address is required.');
      return;
    }
    if (!this.formEmployee.country) {
      this.drawerError.set('Country is required.');
      return;
    }
    if (!this.formEmployee.dateOfJoining) {
      this.drawerError.set('Date of Joining is required.');
      return;
    }
    if (this.formEmployee.employmentType === 'contract' && !this.formEmployee.contractEndDate) {
      this.drawerError.set('Contract End Date is required for contract employees.');
      return;
    }

    // Strict validation for new employee: Passport and Visa are mandatory
    if (this.drawerMode() === 'add') {
      if (!this.selectedPassportFile) {
        this.drawerError.set('Passport document is mandatory for new employee registration.');
        return;
      }
      if (!this.selectedVisaFile) {
        this.drawerError.set('Visa document is mandatory for new employee registration.');
        return;
      }
    }

    this.isSubmitting.set(true);

    const formData = new FormData();
    formData.append('employeeCode', this.formEmployee.employeeCode.trim());
    formData.append('firstName', this.formEmployee.firstName.trim());
    formData.append('middleName', this.formEmployee.middleName?.trim() || '');
    formData.append('lastName', this.formEmployee.lastName.trim());
    formData.append('gender', this.formEmployee.gender);
    formData.append('dateOfBirth', this.formEmployee.dateOfBirth || '');
    formData.append('email', email);
    formData.append('phoneNumber', this.formEmployee.phoneNumber?.trim() || '');
    formData.append('country', this.formEmployee.country);
    formData.append('nationality', this.formEmployee.nationality || this.formEmployee.country);
    formData.append('address', this.formEmployee.address?.trim() || '');
    formData.append('employmentType', this.formEmployee.employmentType);
    formData.append('dateOfJoining', this.formEmployee.dateOfJoining);
    formData.append('remunerationBasis', this.formEmployee.remunerationBasis);
    if (this.formEmployee.contractEndDate) {
      formData.append('contractEndDate', this.formEmployee.contractEndDate);
    }
    if (this.drawerMode() === 'edit' && this.formEmployee.status) {
      formData.append('status', this.formEmployee.status);
    }

    // Append files if selected
    if (this.selectedPhotoFile) {
      formData.append('photo', this.selectedPhotoFile);
    } else if (this.isPhotoRemoved()) {
      formData.append('removePhoto', 'true');
    }

    if (this.selectedPassportFile) {
      formData.append('passport', this.selectedPassportFile);
    }
    if (this.selectedVisaFile) {
      formData.append('visa', this.selectedVisaFile);
    }

    if (this.drawerMode() === 'add') {
      this.masterService.createEmployeeFormData(formData).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.closeDrawer();
          this.successMessage.set(`Employee ${res.data.employeeCode} created successfully.`);
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.drawerError.set(err.error?.error?.message || 'Failed to create employee.');
        },
      });
    } else {
      const empId = this.formEmployee.id!;
      this.masterService.updateEmployee(empId, formData).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.closeDrawer();
          this.successMessage.set(`Employee ${res.data.employeeCode} updated successfully.`);
          this.loadData();
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.drawerError.set(err.error?.error?.message || 'Failed to update employee.');
        },
      });
    }
  }

  private loadEmployeeDocuments(employeeId: string): void {
    this.masterService.getEmployeeById(employeeId).subscribe({
      next: (res) => {
        const empAny = res.data as any;
        if (empAny.documents) {
          this.profileDocuments.set(empAny.documents);
        } else {
          this.profileDocuments.set([]);
        }
      },
      error: () => {
        this.profileDocuments.set([]);
      },
    });
  }

  private getInitialFormState(): EmployeeFormState {
    return {
      employeeCode: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: 'male',
      dateOfBirth: '1995-01-01',
      nationality: 'India',
      email: '',
      phoneNumber: '',
      address: '',
      country: 'India',
      employmentType: 'full_time',
      dateOfJoining: new Date().toISOString().slice(0, 10),
      contractEndDate: undefined,
      remunerationBasis: 'hourly',
      status: 'active',
      profilePhoto: null,
    };
  }
}
