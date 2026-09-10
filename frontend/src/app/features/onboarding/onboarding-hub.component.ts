import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OnboardingService } from '../../core/services/onboarding.service';
import { MasterService } from '../../core/services/master.service';
import { AuthService } from '../../core/services/auth.service';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import {
  EmployeeOnboardingDto,
  EmployeeDto,
  StartOnboardingDto,
  UpdateOnboardingProgressDto,
  CompleteOnboardingDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-onboarding-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="onboarding-workspace">
        <!-- Page Header -->
        <div class="page-header">
          <div>
            <div class="breadcrumb">PEOPLE / ONBOARDING HUB</div>
            <h1 class="page-title">Employee Onboarding & Verification Hub</h1>
            <p class="page-desc">
              Track 5-pillar onboarding readiness (Profile, Statutory, Assignment, Compensation, Mandatory Documents) and enforce statutory compliance before full operational activation.
            </p>
          </div>
          <div class="header-actions">
            @if (authService.hasPermission('onboarding:create')) {
              <button class="btn btn-primary" (click)="openStartDrawer()">
                <span class="material-symbols-outlined icon-sm">person_add_alt</span>
                <span>Initiate Onboarding</span>
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
            <span class="kpi-label">Active Onboardings</span>
            <span class="kpi-value text-primary">{{ inProgressCount() }}</span>
            <span class="kpi-sub">Pipelines in progress</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Ready for Activation</span>
            <span class="kpi-value text-success">{{ readyForActivationCount() }}</span>
            <span class="kpi-sub">100% prerequisites met</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Blocked / Action Req</span>
            <span class="kpi-value text-accent">{{ blockedCount() }}</span>
            <span class="kpi-sub">Missing mandatory documents</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Onboarded</span>
            <span class="kpi-value">{{ completedCount() }}</span>
            <span class="kpi-sub">Activated full employees</span>
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

        <!-- Status Filter Tabs -->
        <div class="filter-bar">
          <div class="tabs">
            <button
              class="tab-btn"
              [class.active]="selectedTab() === 'all'"
              (click)="selectedTab.set('all')"
            >
              All Pipelines ({{ onboardings().length }})
            </button>
            <button
              class="tab-btn"
              [class.active]="selectedTab() === 'in_progress'"
              (click)="selectedTab.set('in_progress')"
            >
              In Progress ({{ inProgressCount() }})
            </button>
            <button
              class="tab-btn"
              [class.active]="selectedTab() === 'completed'"
              (click)="selectedTab.set('completed')"
            >
              Completed ({{ completedCount() }})
            </button>
          </div>

          <div class="search-box">
            <span class="material-symbols-outlined icon-sm search-icon">search</span>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Filter by employee name or code..."
              class="form-control"
            />
          </div>
        </div>

        <!-- Onboarding Pipelines Table -->
        <div class="table-container">
          @if (isLoading()) {
            <div class="loading-state">
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
              <div class="skeleton skeleton-row"></div>
            </div>
          } @else if (filteredPipelines().length === 0) {
            @if (onboardings().length === 0) {
              <!-- Educational Empty State for Zero Onboardings -->
              <div class="empty-state-onboarding">
                <div class="empty-icon-badge">
                  <span class="material-symbols-outlined icon-hero">how_to_reg</span>
                </div>
                <h3 class="empty-title">No Active Onboarding Pipelines</h3>
                <p class="empty-desc">
                  Onboarding is a statutory gatekeeper enforcing 5-pillar readiness (Profile, Employment Parameters, Workforce Deployment, Compensation, and Mandatory Documents) before workers can be rostered or billed.
                </p>

                <div class="prereq-flow-grid">
                  <div class="prereq-step-card" [class.is-ready]="clientsCount() > 0 && projectsCount() > 0 && designationsCount() > 0">
                    <div class="prereq-step-num">1</div>
                    <div class="prereq-step-info">
                      <strong>Organization Masters</strong>
                      <p>Clients, Worksites & Designations</p>
                      <span class="prereq-status">
                        {{ (clientsCount() > 0 && projectsCount() > 0 && designationsCount() > 0) ? '✓ Prerequisites configured' : 'Pending configuration' }}
                      </span>
                    </div>
                    <a routerLink="/masters" [queryParams]="{tab: 'clients'}" class="btn btn-sm btn-outline">
                      Masters Setup
                    </a>
                  </div>

                  <div class="prereq-step-card" [class.is-ready]="employees().length > 0">
                    <div class="prereq-step-num">2</div>
                    <div class="prereq-step-info">
                      <strong>Employee Profile</strong>
                      <p>Biographical candidate records</p>
                      <span class="prereq-status">
                        {{ employees().length > 0 ? '✓ ' + employees().length + ' candidate(s) available' : 'No candidates registered' }}
                      </span>
                    </div>
                    <a routerLink="/employees" class="btn btn-sm btn-outline">
                      Directory
                    </a>
                  </div>

                  <div class="prereq-step-card is-active-step">
                    <div class="prereq-step-num">3</div>
                    <div class="prereq-step-info">
                      <strong>Initiate Pipeline</strong>
                      <p>Track 5 pillars & statutory gating</p>
                      <span class="prereq-status text-primary">Ready to enroll</span>
                    </div>
                    @if (authService.hasPermission('onboarding:create')) {
                      <button class="btn btn-sm btn-primary" (click)="openStartDrawer()">
                        Initiate
                      </button>
                    }
                  </div>
                </div>
              </div>
            } @else {
              <div class="empty-state">
                <span class="material-symbols-outlined icon-lg text-muted">search_off</span>
                <p>No onboarding pipelines found matching the current search or status filter.</p>
              </div>
            }
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Employee</th>
                    <th>Code</th>
                    <th>Readiness Score</th>
                    <th class="col-hide-mobile">5-Pillar Readiness Breakdown</th>
                    <th class="col-hide-tablet">Target Date</th>
                    <th>Status</th>
                    <th class="col-sticky-right text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pipeline of filteredPipelines(); track pipeline.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <div class="emp-profile-cell">
                          <div class="emp-avatar">
                            {{ pipeline.employeeName ? pipeline.employeeName.charAt(0) : 'E' }}
                          </div>
                          <div class="emp-info">
                            <span class="font-medium text-primary">{{ pipeline.employeeName || 'Unknown' }}</span>
                            <span class="text-xs text-muted">{{ pipeline.currentStep }}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="code-badge">{{ pipeline.employeeCode || '—' }}</span>
                      </td>
                      <td>
                        <div class="readiness-cell">
                          <div class="progress-bar-wrap">
                            <div
                              class="progress-bar-fill"
                              [style.width.%]="pipeline.completionPercentage"
                              [class.bg-success]="pipeline.completionPercentage === 100"
                              [class.bg-primary]="pipeline.completionPercentage >= 60 && pipeline.completionPercentage < 100"
                              [class.bg-warning]="pipeline.completionPercentage < 60"
                            ></div>
                          </div>
                          <span class="readiness-percent font-mono">{{ pipeline.completionPercentage }}%</span>
                        </div>
                      </td>
                      <td class="col-hide-mobile">
                        <div class="checklist-pills">
                          <span
                            class="pillar-pill"
                            [class.pill-done]="pipeline.checklistProgress.personalInfo"
                            [title]="pipeline.checklistProgress.personalInfo ? '1. Personal Profile: 20% (Satisfied)' : '1. Personal Profile: 0% (Pending)'"
                          >
                            <span class="material-symbols-outlined pill-icon">{{ pipeline.checklistProgress.personalInfo ? 'check' : 'remove' }}</span>
                            <span>Profile</span>
                          </span>
                          <span
                            class="pillar-pill"
                            [class.pill-done]="pipeline.checklistProgress.employmentDetails"
                            [title]="pipeline.checklistProgress.employmentDetails ? '2. Employment Details: 20% (Satisfied)' : '2. Employment Details: 0% (Pending)'"
                          >
                            <span class="material-symbols-outlined pill-icon">{{ pipeline.checklistProgress.employmentDetails ? 'check' : 'remove' }}</span>
                            <span>Employment</span>
                          </span>
                          <span
                            class="pillar-pill"
                            [class.pill-done]="pipeline.checklistProgress.assignmentSetup"
                            [title]="pipeline.checklistProgress.assignmentSetup ? '3. Project Deployment: 20% (Satisfied)' : '3. Project Deployment: 0% (Pending assignment)'"
                          >
                            <span class="material-symbols-outlined pill-icon">{{ pipeline.checklistProgress.assignmentSetup ? 'check' : 'remove' }}</span>
                            <span>Deployment</span>
                          </span>
                          <span
                            class="pillar-pill"
                            [class.pill-done]="pipeline.checklistProgress.compensationSetup"
                            [title]="pipeline.checklistProgress.compensationSetup ? '4. Compensation Rates: 20% (Satisfied)' : '4. Compensation Rates: 0% (Pending pay rate)'"
                          >
                            <span class="material-symbols-outlined pill-icon">{{ pipeline.checklistProgress.compensationSetup ? 'check' : 'remove' }}</span>
                            <span>Compensation</span>
                          </span>
                          <span
                            class="pillar-pill"
                            [class.pill-done]="pipeline.checklistProgress.mandatoryDocuments"
                            [class.pill-alert]="!pipeline.checklistProgress.mandatoryDocuments"
                            [title]="pipeline.checklistProgress.mandatoryDocuments ? '5. Mandatory Documents: 20% (Satisfied)' : '5. Mandatory Documents: 0% (Action Required)'"
                          >
                            <span class="material-symbols-outlined pill-icon">{{ pipeline.checklistProgress.mandatoryDocuments ? 'check' : 'priority_high' }}</span>
                            <span>Documents</span>
                          </span>
                        </div>
                      </td>
                      <td class="col-hide-tablet text-secondary">
                        {{ pipeline.targetStartDate || '—' }}
                      </td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-approved]="pipeline.status === 'completed'"
                          [class.status-pending]="pipeline.status === 'in_progress'"
                          [class.status-rejected]="pipeline.status === 'cancelled'"
                        >
                          {{ pipeline.status | uppercase }}
                        </span>
                      </td>
                      <td class="col-sticky-right text-right">
                        <div class="action-btn-group">
                          <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            (click)="openInspectDrawer(pipeline)"
                            title="Inspect & Process Onboarding"
                          >
                            <span class="material-symbols-outlined icon-sm">fact_check</span>
                            <span>Inspect</span>
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

      <!-- DRAWER: INITIATE ONBOARDING -->
      @if (isStartDrawerOpen()) {
        <div class="drawer-backdrop" (click)="isStartDrawerOpen.set(false)">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">Initiate Employee Onboarding</h2>
                <p class="drawer-subtitle">
                  Enroll an existing employee record into the statutory onboarding workflow.
                </p>
              </div>
              <button type="button" class="drawer-close" (click)="isStartDrawerOpen.set(false)">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="drawer-body">
              <!-- Master Catalog Prerequisites Status Banner -->
              <div class="master-prereq-box">
                <div class="prereq-box-header">
                  <span class="material-symbols-outlined icon-sm text-primary">account_tree</span>
                  <strong>Organization Masters Dependency</strong>
                </div>
                <p class="text-xs text-secondary mb-2">
                  Onboarding links an existing employee profile to authoritative Organization Masters (Designation, Project Worksite, Worker Pay Rates). Master data is configured centrally in Organization Setup, not created ad-hoc here.
                </p>
                <div class="prereq-micro-badges">
                  <span class="micro-badge" [class.micro-badge-ok]="designationsCount() > 0">
                    {{ designationsCount() }} Designation(s)
                  </span>
                  <span class="micro-badge" [class.micro-badge-ok]="clientsCount() > 0">
                    {{ clientsCount() }} Client(s)
                  </span>
                  <span class="micro-badge" [class.micro-badge-ok]="projectsCount() > 0">
                    {{ projectsCount() }} Worksite(s)
                  </span>
                </div>
                @if (designationsCount() === 0 || projectsCount() === 0) {
                  <div class="alert alert-warning text-xs mt-2" role="alert">
                    <span class="material-symbols-outlined icon-sm">warning</span>
                    <span>
                      Missing master catalogs! To fulfill Pillar 3, please configure
                      <a routerLink="/masters" [queryParams]="{tab: 'clients'}" class="alert-link">Clients & Worksites</a>
                      and
                      <a routerLink="/masters" [queryParams]="{tab: 'designations'}" class="alert-link">Designations</a>.
                    </span>
                  </div>
                }
              </div>

              @if (availableEmployees().length === 0) {
                <div class="alert alert-info text-xs mt-2" role="alert">
                  <span class="material-symbols-outlined icon-sm">info</span>
                  <span>
                    No un-enrolled candidates found in the Directory.
                    <a routerLink="/employees" class="alert-link">Register a new employee first</a>.
                  </span>
                </div>
              }

              <form (ngSubmit)="onStartOnboarding()" class="drawer-form mt-2" id="startForm">
                <div class="form-group">
                  <label for="startEmp">Select Employee *</label>
                  <select
                    id="startEmp"
                    [(ngModel)]="newOnboarding.employeeId"
                    name="employeeId"
                    required
                    class="form-control"
                  >
                    <option value="">-- Choose Employee --</option>
                    @for (emp of availableEmployees(); track emp.id) {
                      <option [value]="emp.id">
                        {{ emp.employeeCode }} — {{ emp.firstName }} {{ emp.lastName }} ({{ emp.status }})
                      </option>
                    }
                  </select>
                </div>

                <div class="form-group">
                  <label for="targetDate">Target Completion Date</label>
                  <input
                    id="targetDate"
                    type="date"
                    [(ngModel)]="newOnboarding.targetStartDate"
                    name="targetDate"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label for="startNotes">Onboarding Instructions & Notes</label>
                  <textarea
                    id="startNotes"
                    [(ngModel)]="newOnboarding.notes"
                    name="notes"
                    rows="3"
                    class="form-control"
                    placeholder="Enter notes or specific deployment requirements..."
                  ></textarea>
                </div>
              </form>
            </div>

            <div class="drawer-footer">
              <button type="button" class="btn btn-secondary" (click)="isStartDrawerOpen.set(false)">
                Cancel
              </button>
              <button
                type="submit"
                form="startForm"
                class="btn btn-primary"
                [disabled]="isSubmitting() || !newOnboarding.employeeId"
              >
                @if (isSubmitting()) {
                  <span>Starting...</span>
                } @else {
                  <span class="material-symbols-outlined icon-sm">play_arrow</span>
                  <span>Start Pipeline</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- DRAWER: INSPECT & PROCESS ONBOARDING -->
      @if (selectedPipeline(); as pipeline) {
        <div class="drawer-backdrop" (click)="selectedPipeline.set(null)">
          <div class="drawer-panel drawer-panel-lg" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">Onboarding Pipeline: {{ pipeline.employeeName }}</h2>
                <p class="drawer-subtitle">
                  {{ pipeline.employeeCode }} • Current Step: {{ pipeline.currentStep }} • Readiness: {{ pipeline.completionPercentage }}%
                </p>
              </div>
              <button type="button" class="drawer-close" (click)="selectedPipeline.set(null)">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="drawer-body">
              <!-- Score Header Card -->
              <div class="score-card">
                <div class="score-main">
                  <div class="score-number">{{ pipeline.completionPercentage }}%</div>
                  <div class="score-info">
                    <h3>Overall Onboarding Readiness</h3>
                    <p>
                      {{ pipeline.completionPercentage === 100 ? 'All 5 statutory pillars verified. Ready for employee activation.' : 'Incomplete prerequisites. Complete all 5 pillars to proceed.' }}
                    </p>
                  </div>
                </div>
                <button class="btn btn-secondary btn-sm" (click)="onRefreshPipeline(pipeline.id)">
                  <span class="material-symbols-outlined icon-sm">sync</span>
                  <span>Re-evaluate</span>
                </button>
              </div>

              <!-- 5 Checklist Pillars -->
              <div class="checklist-section">
                <h3 class="section-title">Statutory Readiness Pillars (20% each)</h3>

                <div class="pillar-item" [class.pillar-complete]="pipeline.checklistProgress.personalInfo">
                  <div class="pillar-icon">
                    <span class="material-symbols-outlined">
                      {{ pipeline.checklistProgress.personalInfo ? 'check_circle' : 'pending' }}
                    </span>
                  </div>
                  <div class="pillar-details">
                    <h4>1. Personal & Identity Profile (20%)</h4>
                    <p>Full legal name, date of birth, gender, nationality, contact details.</p>
                  </div>
                  <span class="pillar-status">
                    {{ pipeline.checklistProgress.personalInfo ? 'SATISFIED' : 'PENDING' }}
                  </span>
                </div>

                <div class="pillar-item" [class.pillar-complete]="pipeline.checklistProgress.employmentDetails">
                  <div class="pillar-icon">
                    <span class="material-symbols-outlined">
                      {{ pipeline.checklistProgress.employmentDetails ? 'check_circle' : 'pending' }}
                    </span>
                  </div>
                  <div class="pillar-details">
                    <h4>2. Employment & Contract Parameters (20%)</h4>
                    <p>Date of joining, contract duration, employment type (full-time/contract).</p>
                  </div>
                  <span class="pillar-status">
                    {{ pipeline.checklistProgress.employmentDetails ? 'SATISFIED' : 'PENDING' }}
                  </span>
                </div>

                <div class="pillar-item" [class.pillar-complete]="pipeline.checklistProgress.assignmentSetup">
                  <div class="pillar-icon">
                    <span class="material-symbols-outlined">
                      {{ pipeline.checklistProgress.assignmentSetup ? 'check_circle' : 'pending' }}
                    </span>
                  </div>
                  <div class="pillar-details">
                    <h4>3. Organizational & Project Assignment (20%)</h4>
                    <p>
                      Valid Client, Project deployment, and authoritative Designation configured in 
                      <a routerLink="/masters" [queryParams]="{tab: 'assignments'}" class="text-brand font-medium">Workforce Assignments</a>.
                    </p>
                  </div>
                  <span class="pillar-status">
                    {{ pipeline.checklistProgress.assignmentSetup ? 'SATISFIED' : 'PENDING' }}
                  </span>
                </div>

                <div class="pillar-item" [class.pillar-complete]="pipeline.checklistProgress.compensationSetup">
                  <div class="pillar-icon">
                    <span class="material-symbols-outlined">
                      {{ pipeline.checklistProgress.compensationSetup ? 'check_circle' : 'pending' }}
                    </span>
                  </div>
                  <div class="pillar-details">
                    <h4>4. Employee Compensation & Remuneration (20%)</h4>
                    <p>
                      Authoritative Employee Pay Rate or Monthly Package structure configured in 
                      <a routerLink="/masters" [queryParams]="{tab: 'employee-rates'}" class="text-brand font-medium">Employee Rates</a>
                      (strictly separate from commercial client billing).
                    </p>
                  </div>
                  <span class="pillar-status">
                    {{ pipeline.checklistProgress.compensationSetup ? 'SATISFIED' : 'PENDING' }}
                  </span>
                </div>

                <div class="pillar-item" [class.pillar-complete]="pipeline.checklistProgress.mandatoryDocuments">
                  <div class="pillar-icon">
                    <span class="material-symbols-outlined">
                      {{ pipeline.checklistProgress.mandatoryDocuments ? 'check_circle' : 'error' }}
                    </span>
                  </div>
                  <div class="pillar-details">
                    <h4>5. Statutory Mandatory Documents (20%)</h4>
                    <p>
                      Passport, Visa, Emirates ID, or contract documents uploaded and verified in
                      <a routerLink="/documents" class="text-brand font-medium">Document Center ➔</a>
                      @if (pipeline.missingRequirements && pipeline.missingRequirements.length > 0) {
                        <span class="missing-badge">Missing: {{ pipeline.missingRequirements.join(', ') }}</span>
                      }
                    </p>
                  </div>
                  <span class="pillar-status">
                    {{ pipeline.checklistProgress.mandatoryDocuments ? 'SATISFIED' : 'ACTION REQ' }}
                  </span>
                </div>
              </div>

              <!-- Completion Gate Action -->
              @if (pipeline.status !== 'completed' && authService.hasPermission('onboarding:complete')) {
                <div class="activation-card">
                  <div class="activation-header">
                    <span class="material-symbols-outlined icon-sm text-primary">verified_user</span>
                    <h4>Statutory Activation Gate</h4>
                  </div>
                  <p class="text-sm text-secondary">
                    Finalizing onboarding transitions the employee status from <code>draft/probation</code> to active workforce deployment. Requires 100% readiness score.
                  </p>

                  <div class="form-group mt-2">
                    <label>Activation Status Post-Onboarding</label>
                    <select [(ngModel)]="activationStatus" class="form-control">
                      <option value="probation">Probation (Default)</option>
                      <option value="active">Active (Full Permanent)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    class="btn btn-success mt-2"
                    [disabled]="pipeline.completionPercentage < 100 || isSubmitting()"
                    (click)="onCompleteOnboarding(pipeline.id)"
                  >
                    <span class="material-symbols-outlined icon-sm">task_alt</span>
                    <span>Complete Onboarding & Activate Employee</span>
                  </button>
                  @if (pipeline.completionPercentage < 100) {
                    <p class="text-xs text-danger mt-1">
                      Button locked: Prerequisites not 100% satisfied.
                    </p>
                  }
                </div>
              }
            </div>

            <div class="drawer-footer">
              <button type="button" class="btn btn-secondary" (click)="selectedPipeline.set(null)">
                Close
              </button>
            </div>
          </div>
        </div>
      }
    </app-shell>
  `,
  styles: [`
    .onboarding-workspace {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border-default);
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
      margin: 0 0 0.25rem 0;
    }

    .page-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0;
      max-width: 800px;
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
    }

    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    .search-box {
      position: relative;
      min-width: 280px;
    }

    .search-icon {
      position: absolute;
      left: 0.625rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }

    .search-box input {
      padding-left: 2rem;
    }

    .emp-profile-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .emp-avatar {
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: var(--brand-100);
      color: var(--brand-700);
      font-weight: 600;
      font-size: 0.8125rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .emp-info {
      display: flex;
      flex-direction: column;
    }

    .readiness-cell {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      min-width: 140px;
    }

    .progress-bar-wrap {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .readiness-percent {
      font-size: 0.75rem;
      font-weight: 600;
      width: 36px;
      text-align: right;
    }

    .checklist-pills {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .pillar-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      background: #f1f5f9;
      color: #64748b;
      font-weight: 500;
    }

    .pillar-pill.pill-done {
      background: #dcfce7;
      color: #166534;
      font-weight: 600;
    }

    .pillar-pill.pill-alert {
      background: #fee2e2;
      color: #991b1b;
      font-weight: 600;
    }

    .pill-icon {
      font-size: 0.8125rem;
    }

    .pill {
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      background: #f1f5f9;
      color: #64748b;
      font-weight: 500;
    }

    .pill-done {
      background: #dcfce7;
      color: #166534;
      font-weight: 600;
    }

    /* Educational Onboarding Empty State */
    .empty-state-onboarding {
      text-align: center;
      padding: 2.5rem 1.5rem;
      background: #ffffff;
      border: 1px dashed var(--border-default);
      border-radius: var(--radius-lg);
      max-width: 760px;
      margin: 1.5rem auto;
    }

    .empty-icon-badge {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--brand-50, #eff6ff);
      color: var(--brand-600, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem auto;
    }

    .icon-hero {
      font-size: 2rem;
    }

    .empty-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.5rem 0;
    }

    .empty-desc {
      font-size: 0.875rem;
      color: var(--text-secondary);
      max-width: 580px;
      margin: 0 auto 1.5rem auto;
      line-height: 1.5;
    }

    .prereq-flow-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      text-align: left;
      margin-bottom: 1rem;
    }

    .prereq-step-card {
      background: var(--bg-surface-subtle, #f8fafc);
      border: 1px solid var(--border-default, #e2e8f0);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .prereq-step-card.is-ready {
      border-color: #86efac;
      background: #f0fdf4;
    }

    .prereq-step-card.is-active-step {
      border-color: var(--brand-400, #60a5fa);
      background: #eff6ff;
    }

    .prereq-step-num {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e2e8f0;
      color: var(--text-primary);
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .is-ready .prereq-step-num {
      background: #22c55e;
      color: #ffffff;
    }

    .is-active-step .prereq-step-num {
      background: var(--brand-600, #2563eb);
      color: #ffffff;
    }

    .prereq-step-info strong {
      font-size: 0.8125rem;
      display: block;
      color: var(--text-primary);
    }

    .prereq-step-info p {
      font-size: 0.6875rem;
      color: var(--text-secondary);
      margin: 0.125rem 0;
    }

    .prereq-status {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
    }

    .is-ready .prereq-status {
      color: #16a34a;
    }

    .btn-outline {
      border: 1px solid var(--border-default);
      background: #ffffff;
      color: var(--text-secondary);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-outline:hover {
      background: #f1f5f9;
      color: var(--text-primary);
    }

    /* Master Dependency Box in Drawer */
    .master-prereq-box {
      background: #f8fafc;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 0.875rem;
      margin-bottom: 1rem;
    }

    .prereq-box-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8125rem;
      margin-bottom: 0.25rem;
    }

    .prereq-micro-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 0.5rem;
    }

    .micro-badge {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: #fee2e2;
      color: #991b1b;
    }

    .micro-badge.micro-badge-ok {
      background: #dcfce7;
      color: #166534;
    }

    .alert-link {
      font-weight: 600;
      color: inherit;
      text-decoration: underline;
    }

    .score-card {
      background: #f8fafc;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .score-main {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }

    .score-number {
      font-size: 2rem;
      font-weight: 800;
      font-family: var(--font-mono);
      color: var(--color-primary);
    }

    .score-info h3 {
      margin: 0 0 0.25rem 0;
      font-size: 0.9375rem;
    }

    .score-info p {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .checklist-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 0.875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 0;
    }

    .pillar-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.875rem 1rem;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      background: #ffffff;
    }

    .pillar-item.pillar-complete {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }

    .pillar-icon {
      color: #64748b;
    }

    .pillar-complete .pillar-icon {
      color: #16a34a;
    }

    .pillar-details {
      flex: 1;
    }

    .pillar-details h4 {
      margin: 0 0 0.125rem 0;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .pillar-details p {
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .pillar-status {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
    }

    .pillar-complete .pillar-status {
      background: #dcfce7;
      color: #166534;
    }

    .missing-badge {
      display: block;
      color: #dc2626;
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .activation-card {
      border: 1px dashed var(--color-primary);
      border-radius: var(--radius-md);
      padding: 1.25rem;
      background: #f8fafc;
    }

    .activation-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .activation-header h4 {
      margin: 0;
      font-size: 0.9375rem;
    }

    .bg-success { background-color: #22c55e; }
    .bg-primary { background-color: #3b82f6; }
    .bg-warning { background-color: #f59e0b; }
  `],
})
export class OnboardingHubComponent implements OnInit {
  public onboardings = signal<EmployeeOnboardingDto[]>([]);
  public employees = signal<EmployeeDto[]>([]);
  public designationsCount = signal(0);
  public projectsCount = signal(0);
  public clientsCount = signal(0);
  public isLoading = signal(true);
  public isSubmitting = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public selectedTab = signal<'all' | 'in_progress' | 'completed'>('all');
  public searchQuery = '';

  public isStartDrawerOpen = signal(false);
  public selectedPipeline = signal<EmployeeOnboardingDto | null>(null);

  public newOnboarding: StartOnboardingDto = {
    employeeId: '',
    targetStartDate: '',
    notes: '',
  };

  public activationStatus: 'probation' | 'active' = 'probation';

  constructor(
    public onboardingService: OnboardingService,
    private masterService: MasterService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.loadData();
  }

  public loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.onboardingService.getOnboardings().subscribe({
      next: (res) => {
        this.onboardings.set(res.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load onboarding pipelines');
        this.isLoading.set(false);
      },
    });

    this.masterService.getEmployees().subscribe({
      next: (res) => {
        this.employees.set(res.data || []);
      },
    });

    this.masterService.getDesignations().subscribe({
      next: (res) => {
        this.designationsCount.set(res.data?.length || 0);
      },
    });

    this.masterService.getProjects().subscribe({
      next: (res) => {
        this.projectsCount.set(res.data?.length || 0);
      },
    });

    this.masterService.getClients().subscribe({
      next: (res) => {
        this.clientsCount.set(res.data?.length || 0);
      },
    });
  }

  public inProgressCount = computed(() => {
    return this.onboardings().filter((o) => o.status === 'in_progress').length;
  });

  public completedCount = computed(() => {
    return this.onboardings().filter((o) => o.status === 'completed').length;
  });

  public readyForActivationCount = computed(() => {
    return this.onboardings().filter((o) => o.status === 'in_progress' && o.completionPercentage === 100).length;
  });

  public blockedCount = computed(() => {
    return this.onboardings().filter((o) => o.status === 'in_progress' && !o.checklistProgress.mandatoryDocuments).length;
  });

  public availableEmployees = computed(() => {
    const existingEmpIds = new Set(this.onboardings().map((o) => o.employeeId));
    return this.employees().filter((e) => !existingEmpIds.has(e.id));
  });

  public filteredPipelines = computed(() => {
    let list = this.onboardings();

    if (this.selectedTab() === 'in_progress') {
      list = list.filter((o) => o.status === 'in_progress');
    } else if (this.selectedTab() === 'completed') {
      list = list.filter((o) => o.status === 'completed');
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          (o.employeeName && o.employeeName.toLowerCase().includes(q)) ||
          (o.employeeCode && o.employeeCode.toLowerCase().includes(q)),
      );
    }

    return list;
  });

  public openStartDrawer(): void {
    this.newOnboarding = {
      employeeId: '',
      targetStartDate: new Date().toISOString().slice(0, 10),
      notes: '',
    };
    this.isStartDrawerOpen.set(true);
  }

  public openInspectDrawer(pipeline: EmployeeOnboardingDto): void {
    this.onboardingService.getOnboardingById(pipeline.id).subscribe({
      next: (res) => {
        this.selectedPipeline.set(res.data);
      },
      error: () => {
        this.selectedPipeline.set(pipeline);
      },
    });
  }

  public onRefreshPipeline(id: string): void {
    this.onboardingService.refreshReadiness(id).subscribe({
      next: (res) => {
        this.selectedPipeline.set(res.data);
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to re-evaluate pipeline');
      },
    });
  }

  public onStartOnboarding(): void {
    if (!this.newOnboarding.employeeId) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.onboardingService.startOnboarding(this.newOnboarding).subscribe({
      next: (res) => {
        this.successMessage.set('Onboarding pipeline initiated successfully');
        this.isStartDrawerOpen.set(false);
        this.isSubmitting.set(false);
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to start onboarding pipeline');
        this.isSubmitting.set(false);
      },
    });
  }

  public onCompleteOnboarding(id: string): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const dto: CompleteOnboardingDto = {
      activationStatus: this.activationStatus,
      notes: 'Completed via Onboarding Hub statutory verification gate',
    };

    this.onboardingService.completeOnboarding(id, dto).subscribe({
      next: (res) => {
        this.successMessage.set('Employee activated and onboarding marked complete!');
        this.selectedPipeline.set(null);
        this.isSubmitting.set(false);
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to complete onboarding');
        this.isSubmitting.set(false);
      },
    });
  }
}
