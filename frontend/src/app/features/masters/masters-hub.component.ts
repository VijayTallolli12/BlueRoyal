import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MasterService } from '../../core/services/master.service';
import {
  DesignationDto,
  ClientDto,
  ProjectDto,
  EmployeeDto,
  EmployeeAssignmentDto,
  EmployeeHourlyRateDto,
  ClientBillingRateDto,
  ResolvedBillingRateDto,
  ShiftDto,
  PublicHolidayDto,
  SalaryComponentDto,
} from '@blue-royal/contracts';

import { AppShellComponent } from '../../core/layout/app-shell.component';

export type MasterTab =
  | 'overview'
  | 'designations'
  | 'employees'
  | 'clients'
  | 'projects'
  | 'assignments'
  | 'employee-rates'
  | 'client-rates'
  | 'rates'
  | 'shifts'
  | 'calendar'
  | 'salary';

@Component({
  selector: 'app-masters-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="masters-workspace">
        <!-- Dynamic Contextual Page Header -->
        <header class="page-header">
          <div class="header-main">
            <div class="breadcrumb">{{ currentMeta().breadcrumbGroup }} / {{ currentMeta().breadcrumbPage }}</div>
            <h1 class="page-title">{{ currentMeta().title }}</h1>
            <p class="page-desc">{{ currentMeta().subtitle }}</p>
          </div>
          @if (currentMeta().ctaLabel) {
            <div class="header-actions">
              <button class="btn btn-primary btn-lg" (click)="togglePrimaryForm()">
                <span class="material-symbols-outlined icon-sm">{{ isPrimaryFormOpen() ? 'close' : currentMeta().ctaIcon }}</span>
                <span>{{ isPrimaryFormOpen() ? 'Cancel' : currentMeta().ctaLabel }}</span>
              </button>
            </div>
          }
        </header>

        <!-- Contextual Workforce Flow Indicator (Subtle, Compact Secondary Navigation) -->
        @if (currentMeta().isFlowTab) {
          <div class="contextual-flow-strip">
            <div class="flow-lead">
              <span class="material-symbols-outlined icon-xs">linear_scale</span>
              <span>WORKFORCE PIPELINE:</span>
            </div>
            <div class="flow-steps">
              <button class="flow-step-pill" [class.current]="activeTab() === 'clients'" (click)="setTab('clients')">
                <span class="step-badge">1</span>
                <span>Clients</span>
              </button>
              <span class="flow-sep">➔</span>
              <button class="flow-step-pill" [class.current]="activeTab() === 'projects'" (click)="setTab('projects')">
                <span class="step-badge">2</span>
                <span>Projects</span>
              </button>
              <span class="flow-sep">➔</span>
              <button class="flow-step-pill" [class.current]="activeTab() === 'assignments'" (click)="setTab('assignments')">
                <span class="step-badge">3</span>
                <span>Deployments</span>
              </button>
              <span class="flow-sep">➔</span>
              <button class="flow-step-pill" [class.current]="activeTab() === 'employee-rates'" (click)="setTab('employee-rates')">
                <span class="step-badge">4</span>
                <span>Employee Pay</span>
              </button>
              <span class="flow-sep">➔</span>
              <button class="flow-step-pill" [class.current]="activeTab() === 'client-rates'" (click)="setTab('client-rates')">
                <span class="step-badge">5</span>
                <span>Client Billing</span>
              </button>
            </div>
          </div>
        }

        <!-- View Assignment Modal -->
        @if (selectedAssignmentForView(); as assign) {
          <div class="modal-overlay" (click)="selectedAssignmentForView.set(null)">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h3>Workforce Deployment Details</h3>
                <button type="button" class="btn-icon-close" (click)="selectedAssignmentForView.set(null)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <div class="modal-body">
                <div class="detail-grid">
                  <div class="detail-item">
                    <span class="detail-label">Employee</span>
                    <strong class="detail-val">{{ assign.employeeName || assign.employeeId }}</strong>
                    <span class="detail-sub">{{ assign.employeeCode || '—' }}</span>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Commercial Client</span>
                    <strong class="detail-val">{{ assign.clientName || assign.clientId }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Project / Worksite</span>
                    <strong class="detail-val">{{ assign.projectName || assign.projectId }}</strong>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Authoritative Designation</span>
                    <div><span class="tag">{{ assign.designationTitle || assign.designationId }}</span></div>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Effective Interval</span>
                    <code>{{ assign.effectiveFrom }} ➔ {{ assign.effectiveTo || 'Ongoing' }}</code>
                  </div>
                  <div class="detail-item">
                    <span class="detail-label">Deployment Status</span>
                    <div>
                      <span class="badge" [class.badge-active]="!assign.effectiveTo">
                        {{ assign.effectiveTo ? 'Closed / Past' : 'Active Deployment' }}
                      </span>
                    </div>
                  </div>
                </div>
                @if (assign.remarks) {
                  <div class="detail-remarks">
                    <span class="detail-label">Deployment Remarks</span>
                    <p>{{ assign.remarks }}</p>
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="selectedAssignmentForView.set(null)">Close</button>
              </div>
            </div>
          </div>
        }

        <!-- Edit Assignment Modal -->
        @if (selectedAssignmentForEdit(); as assign) {
          <div class="modal-overlay" (click)="selectedAssignmentForEdit.set(null)">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h3>Edit Workforce Deployment</h3>
                <button type="button" class="btn-icon-close" (click)="selectedAssignmentForEdit.set(null)">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
              <form (ngSubmit)="saveAssignmentEdit()">
                <div class="modal-body">
                  <div class="edit-banner">
                    <div>
                      <strong>{{ assign.employeeName }}</strong> ({{ assign.employeeCode }})
                    </div>
                    <small>{{ assign.clientName }} &bull; {{ assign.projectName }} &bull; {{ assign.designationTitle }}</small>
                  </div>
                  <div class="form-group mb-3">
                    <label class="form-label">Effective End Date (Leave blank for Ongoing deployment)</label>
                    <input type="date" [(ngModel)]="editAssignEffectiveTo" name="editAssignEffectiveTo" class="form-control" />
                    <small class="form-hint">Setting a date in the past or today will mark this deployment as closed.</small>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Deployment Remarks / Transfer Notes</label>
                    <textarea [(ngModel)]="editAssignRemarks" name="editAssignRemarks" rows="3" class="form-control" placeholder="Optional notes..."></textarea>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" (click)="selectedAssignmentForEdit.set(null)">Cancel</button>
                  <button type="submit" class="btn btn-primary">Save Deployment</button>
                </div>
              </form>
            </div>
          </div>
        }

        <div class="masters-container">

          <!-- TAB: OVERVIEW -->
          @if (activeTab() === 'overview') {
            <div class="panel">
              <h2>Workforce Deployment & Master Catalogs Architecture</h2>
              <p class="subtitle">
                Authoritative multi-tenant relational catalogs managing clients, project worksites, effective-dated worker assignments, and strictly segregated dual-stream rates.
              </p>
              
              <div class="overview-grid">
                <div class="flow-card">
                  <h3>Dual-Stream Separation Principle</h3>
                  <div class="flow-diagram">
                    <div class="flow-step cost-step">
                      <strong>Stream A: Worker Remuneration (Cost)</strong>
                      <span>Employee Base Hourly + OT Rate</span>
                      <small>Source of truth for Worker Payroll</small>
                    </div>
                    <div class="flow-vs">VS</div>
                    <div class="flow-step rev-step">
                      <strong>Stream B: Client Invoicing (Revenue)</strong>
                      <span>Project-Specific / Client Default Rate</span>
                      <small>Source of truth for Commercial Billing</small>
                    </div>
                  </div>
                  <p class="note">
                    <strong>Statutory Principle:</strong> Employee pay is strictly decoupled from client invoice billing rates. Blue Royal never derives employee compensation from client billing.
                  </p>
                </div>

                <div class="flow-card">
                  <h3>Onboarding Verification Linkage</h3>
                  <p class="subtitle" style="margin-bottom: 0.75rem;">
                    The Employee Onboarding Hub acts as an authoritative validation gate consuming Master configurations:
                  </p>
                  <ul class="checklist">
                    <li>
                      <span class="check-icon">✓</span>
                      <div>
                        <strong>Pillar 3 (Assignment):</strong>
                        <span>Validates worker has an active Client + Project + Designation assignment.</span>
                      </div>
                    </li>
                    <li>
                      <span class="check-icon">✓</span>
                      <div>
                        <strong>Pillar 4 (Remuneration):</strong>
                        <span>Validates worker has an active Employee Hourly Pay Rate or Monthly Salary Package.</span>
                      </div>
                    </li>
                    <li>
                      <span class="check-icon">✓</span>
                      <div>
                        <strong>Operational Readiness:</strong>
                        <span>100% Onboarding readiness required before worker can be rostered for attendance and commercial billing.</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          }

          <!-- TAB: CLIENTS -->
          @if (activeTab() === 'clients') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Clients Master Catalog</h2>
                  <p class="subtitle">Commercial partner entities holding project worksites and master billing agreements.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewClient = !showNewClient">
                  <span class="material-symbols-outlined icon-sm">{{ showNewClient ? 'close' : 'add' }}</span>
                  <span>{{ showNewClient ? 'Cancel' : 'Add Client' }}</span>
                </button>
              </div>

              @if (showNewClient) {
                <form class="create-form" (ngSubmit)="createClient()">
                  <div class="form-row">
                    <input type="text" [(ngModel)]="newClientCode" name="newClientCode" placeholder="Code (e.g. CLI-EMAAR)" required />
                    <input type="text" [(ngModel)]="newClientName" name="newClientName" placeholder="Client Legal Name" required />
                    <input type="text" [(ngModel)]="newClientContact" name="newClientContact" placeholder="Contact Person" />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save Client</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Company / Client Name</th>
                      <th>Contact Person</th>
                      <th>Category</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of clients(); track c.id) {
                      <tr>
                        <td><code>{{ c.code }}</code></td>
                        <td><strong>{{ c.name }}</strong></td>
                        <td>{{ c.contactPerson || '—' }}</td>
                        <td><span class="badge">Commercial Partner</span></td>
                        <td><span class="badge badge-active">Active</span></td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="empty-state">No commercial clients found.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: PROJECTS -->
          @if (activeTab() === 'projects') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Project Worksites Master</h2>
                  <p class="subtitle">Operational worksites and deployment locations tied to commercial clients.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewProject = !showNewProject">
                  <span class="material-symbols-outlined icon-sm">{{ showNewProject ? 'close' : 'add' }}</span>
                  <span>{{ showNewProject ? 'Cancel' : 'Add Project' }}</span>
                </button>
              </div>

              @if (clients().length === 0) {
                <div class="alert-guidance alert-warning">
                  <div class="guidance-icon"><span class="material-symbols-outlined">warning</span></div>
                  <div class="guidance-content">
                    <strong>Prerequisite Missing: Commercial Clients</strong>
                    <p>Every Project Worksite must belong to a parent Commercial Client entity. You cannot create a project until at least one Client exists.</p>
                    <div class="guidance-actions">
                      <button type="button" class="btn btn-sm btn-primary" (click)="setTab('clients')">
                        <span class="material-symbols-outlined icon-sm">corporate_fare</span>
                        <span>Go to Clients Master (Step 1)</span>
                      </button>
                    </div>
                  </div>
                </div>
              }

              @if (showNewProject) {
                <form class="create-form" (ngSubmit)="createProject()">
                  <div class="form-grid">
                    <select [(ngModel)]="newProjClientId" name="newProjClientId" required>
                      <option value="">-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                      }
                    </select>
                    <input type="text" [(ngModel)]="newProjCode" name="newProjCode" placeholder="Project Code (e.g. PRJ-DOWNTOWN)" required />
                    <input type="text" [(ngModel)]="newProjName" name="newProjName" placeholder="Project Name" required />
                    <input type="text" [(ngModel)]="newProjLocation" name="newProjLocation" placeholder="Site Location (e.g. Downtown Dubai)" />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save Project</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Project / Worksite Name</th>
                      <th>Client Partner</th>
                      <th>Site Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of projects(); track p.id) {
                      <tr>
                        <td><code>{{ p.code }}</code></td>
                        <td><strong>{{ p.name }}</strong></td>
                        <td>{{ p.clientName || p.clientId }}</td>
                        <td>{{ p.siteLocation || '—' }}</td>
                        <td><span class="badge badge-active">{{ p.status }}</span></td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="empty-state">
                          @if (clients().length === 0) {
                            <span>No commercial clients exist yet. Create a Client first before adding Project Worksites.</span>
                          } @else {
                            <span>No project worksites found. Click 'Add Project' to configure a worksite.</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: ASSIGNMENTS -->
          @if (activeTab() === 'assignments') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Workforce Deployments</h2>
                  <p class="subtitle">Assign employees to clients, projects and designated roles (satisfies Onboarding Pillar 3).</p>
                </div>
                <button class="btn btn-primary" (click)="showNewAssignment = !showNewAssignment">
                  <span class="material-symbols-outlined icon-sm">{{ showNewAssignment ? 'close' : 'add' }}</span>
                  <span>{{ showNewAssignment ? 'Cancel' : 'Deploy Employee' }}</span>
                </button>
              </div>

              @if (employees().length === 0 || projects().length === 0 || designations().length === 0) {
                <div class="alert-guidance alert-info">
                  <div class="guidance-icon"><span class="material-symbols-outlined">info</span></div>
                  <div class="guidance-content">
                    <strong>Workforce Deployment Prerequisites</strong>
                    <p>
                      An authoritative deployment assignment links an <strong>Employee</strong> to an active <strong>Client Project</strong> worksite and an authoritative <strong>Designation</strong> (satisfies Onboarding Pillar 3).
                    </p>
                    <div class="guidance-actions">
                      @if (employees().length === 0) {
                        <a routerLink="/employees" class="btn btn-sm btn-outline">Add Employee in Directory</a>
                      }
                      @if (projects().length === 0) {
                        <button type="button" class="btn btn-sm btn-outline" (click)="setTab('projects')">Create Project Worksite</button>
                      }
                      @if (designations().length === 0) {
                        <button type="button" class="btn btn-sm btn-outline" (click)="setTab('designations')">Create Job Designation</button>
                      }
                    </div>
                  </div>
                </div>
              }

              @if (showNewAssignment) {
                <form class="create-form" (ngSubmit)="createAssignment()">
                  <div class="form-grid">
                    <select [(ngModel)]="newAssignEmpId" name="newAssignEmpId" required>
                      <option value="">-- Select Employee --</option>
                      @for (e of employees(); track e.id) {
                        <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                      }
                    </select>
                    <select [(ngModel)]="newAssignClientId" (change)="onAssignClientChange()" name="newAssignClientId" required>
                      <option value="">-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }}</option>
                      }
                    </select>
                    <select [(ngModel)]="newAssignProjId" name="newAssignProjId" required>
                      <option value="">-- Select Project --</option>
                      @for (p of filteredProjects(); track p.id) {
                        <option [value]="p.id">{{ p.name }}</option>
                      }
                    </select>
                    <select [(ngModel)]="newAssignDesId" name="newAssignDesId" required>
                      <option value="">-- Assign Designation --</option>
                      @for (d of designations(); track d.id) {
                        <option [value]="d.id">{{ d.title }}</option>
                      }
                    </select>
                    <input type="date" [(ngModel)]="newAssignFrom" name="newAssignFrom" placeholder="Effective From" required />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Deploy Worker</span>
                    </button>
                  </div>
                </form>
              }

              <!-- Search & Filter Controls -->
              <div class="filter-toolbar">
                <div class="search-box">
                  <span class="material-symbols-outlined icon-sm text-muted">search</span>
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search deployments by employee, client, project, designation..."
                    [ngModel]="assignmentSearch()"
                    (ngModelChange)="assignmentSearch.set($event)"
                  />
                  @if (assignmentSearch()) {
                    <button type="button" class="btn-clear" (click)="assignmentSearch.set('')" title="Clear Search">
                      <span class="material-symbols-outlined icon-xs">close</span>
                    </button>
                  }
                </div>

                <div class="filter-controls">
                  <select
                    class="filter-select"
                    [ngModel]="assignmentClientFilter()"
                    (ngModelChange)="assignmentClientFilter.set($event)"
                  >
                    <option value="">All Clients</option>
                    @for (c of clients(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>

                  <select
                    class="filter-select"
                    [ngModel]="assignmentStatusFilter()"
                    (ngModelChange)="assignmentStatusFilter.set($event)"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Deployments</option>
                    <option value="closed">Closed Deployments</option>
                  </select>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Client</th>
                      <th>Project / Worksite</th>
                      <th>Designation</th>
                      <th>Effective From</th>
                      <th>Status</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of filteredAssignments(); track a.id) {
                      <tr>
                        <td>
                          <strong>{{ a.employeeName || a.employeeId }}</strong>
                          <div class="cell-sub">{{ a.employeeCode || '—' }}</div>
                        </td>
                        <td>{{ a.clientName || a.clientId }}</td>
                        <td>{{ a.projectName || a.projectId }}</td>
                        <td><span class="tag">{{ a.designationTitle || a.designationId }}</span></td>
                        <td>
                          <code>{{ a.effectiveFrom }} ➔ {{ a.effectiveTo || 'Ongoing' }}</code>
                        </td>
                        <td>
                          <span class="badge" [class.badge-active]="!a.effectiveTo">
                            {{ a.effectiveTo ? 'Closed' : 'Active Deployment' }}
                          </span>
                        </td>
                        <td class="text-right">
                          <div class="action-btn-group">
                            <button
                              type="button"
                              class="btn-action btn-action-view"
                              (click)="openViewAssignment(a)"
                              title="View Details"
                            >
                              <span class="material-symbols-outlined icon-xs">visibility</span>
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              class="btn-action btn-action-edit"
                              (click)="openEditAssignment(a)"
                              title="Edit Deployment"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                            @if (!a.effectiveTo) {
                              <button
                                type="button"
                                class="btn-action btn-action-danger"
                                (click)="deactivateAssignment(a)"
                                title="Deactivate / Close Deployment"
                              >
                                <span class="material-symbols-outlined icon-xs">person_remove</span>
                                <span>Deactivate</span>
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">
                          @if (assignments().length === 0) {
                            <span>No employee deployments configured yet. Click 'Deploy Employee' to assign a worker to a site.</span>
                          } @else {
                            <span>No deployments match the current search or filters.</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: EMPLOYEE HOURLY RATES (WORKER REMUNERATION COST) -->
          @if (activeTab() === 'employee-rates') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <div class="stream-pill stream-cost">INTERNAL WORKER PAY (COST)</div>
                  <h2>Employee Compensation & Overtime Pay Rates</h2>
                  <p class="subtitle">
                    Statutory hourly wages and overtime rates paid directly to workers (satisfies Onboarding Pillar 4). Strictly segregated from client invoices.
                  </p>
                </div>
                <button class="btn btn-primary" (click)="showNewEmployeeRate = !showNewEmployeeRate">
                  <span class="material-symbols-outlined icon-sm">{{ showNewEmployeeRate ? 'close' : 'add' }}</span>
                  <span>{{ showNewEmployeeRate ? 'Cancel' : 'Set Employee Pay Rate' }}</span>
                </button>
              </div>

              <!-- Stream Cost Explainer Banner -->
              <div class="stream-explainer-banner cost-banner">
                <div class="banner-icon-wrap">
                  <span class="material-symbols-outlined">payments</span>
                </div>
                <div class="banner-text">
                  <strong>Internal Remuneration (Cost Stream) — Worker Payroll Source of Truth</strong>
                  <p>
                    These hourly wage rates define what Blue Royal pays to the individual worker for normal hours and overtime. They are consumed by the Payroll computation engine and fulfill <strong>Onboarding Pillar 4</strong>. Under UAE statutory guidelines, worker pay rates are strictly decoupled from commercial client billing.
                  </p>
                </div>
              </div>

              @if (employees().length === 0) {
                <div class="alert-guidance alert-warning">
                  <div class="guidance-icon"><span class="material-symbols-outlined">warning</span></div>
                  <div class="guidance-content">
                    <strong>Prerequisite Missing: Registered Employees</strong>
                    <p>You cannot assign an Employee Pay Rate until at least one candidate or employee is registered in the system.</p>
                    <div class="guidance-actions">
                      <a routerLink="/employees" class="btn btn-sm btn-primary">Go to Employee Directory</a>
                    </div>
                  </div>
                </div>
              }

              @if (showNewEmployeeRate) {
                <form class="create-form" (ngSubmit)="createEmployeeRate()">
                  <div class="form-grid">
                    <select [(ngModel)]="newEmpRateEmpId" name="newEmpRateEmpId" required>
                      <option value="">-- Select Employee --</option>
                      @for (e of employees(); track e.id) {
                        <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                      }
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      [(ngModel)]="newEmpRateNormal"
                      name="newEmpRateNormal"
                      placeholder="Normal Pay Rate (AED/hr)"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      [(ngModel)]="newEmpRateOt"
                      name="newEmpRateOt"
                      placeholder="OT Pay Rate (AED/hr)"
                      required
                    />
                    <input
                      type="date"
                      [(ngModel)]="newEmpRateFrom"
                      name="newEmpRateFrom"
                      placeholder="Effective From"
                      required
                    />
                    <input
                      type="text"
                      [(ngModel)]="newEmpRateReason"
                      name="newEmpRateReason"
                      placeholder="Reason (e.g. Initial Onboarding Rate)"
                    />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save Worker Rate</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Normal Pay Rate</th>
                      <th>OT Pay Rate</th>
                      <th>Effective Interval</th>
                      <th>Change Reason</th>
                      <th>Remuneration Stream</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of employeeRates(); track r.id) {
                      <tr>
                        <td>
                          <strong>{{ r.employeeName || r.employeeId }}</strong>
                          <div class="cell-sub">{{ r.employeeCode || '—' }}</div>
                        </td>
                        <td>
                          <span class="rate-amount">AED {{ r.normalHourlyRate | number:'1.2-2' }}</span>
                          <span class="rate-unit">/hr</span>
                        </td>
                        <td>
                          <span class="rate-amount">AED {{ r.otHourlyRate | number:'1.2-2' }}</span>
                          <span class="rate-unit">/hr</span>
                        </td>
                        <td><code>{{ r.effectiveFrom }} ➔ {{ r.effectiveTo || 'Ongoing' }}</code></td>
                        <td>{{ r.changeReason || 'Initial setup' }}</td>
                        <td><span class="badge badge-worker-pay">Worker Pay (Cost)</span></td>
                        <td>
                          <span class="badge" [class.badge-active]="!r.effectiveTo">
                            {{ r.effectiveTo ? 'Superseded' : 'Active Pay Rate' }}
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">No employee pay rates configured yet. Click 'Set Employee Pay Rate' to create one.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: CLIENT BILLING RATES (COMMERCIAL INVOICING REVENUE) -->
          @if (activeTab() === 'client-rates') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <div class="stream-pill stream-rev">COMMERCIAL INVOICING (REVENUE)</div>
                  <h2>Client Commercial Invoicing Billing Rates</h2>
                  <p class="subtitle">
                    Commercial billing rates charged to clients for workforce deployment. Supports two-tier resolution: Project-Specific Rate overrides Client-Wide Fallback.
                  </p>
                </div>
                <button class="btn btn-primary" (click)="showNewClientRate = !showNewClientRate">
                  <span class="material-symbols-outlined icon-sm">{{ showNewClientRate ? 'close' : 'add' }}</span>
                  <span>{{ showNewClientRate ? 'Cancel' : 'Add Billing Rate' }}</span>
                </button>
              </div>

              <!-- Stream Revenue Explainer Banner -->
              <div class="stream-explainer-banner rev-banner">
                <div class="banner-icon-wrap">
                  <span class="material-symbols-outlined">receipt_long</span>
                </div>
                <div class="banner-text">
                  <strong>Commercial Invoicing (Revenue Stream) — Two-Tier Billing Resolution Engine</strong>
                  <p>
                    These hourly billing rates define what Blue Royal invoices to external commercial clients. The resolution engine follows a 2-tier hierarchy: <strong>Tier 1 (Project-Specific Rate)</strong> automatically overrides <strong>Tier 2 (Client-Wide Fallback)</strong>. Client billing rates are strictly segregated from worker compensation.
                  </p>
                </div>
              </div>

              @if (clients().length === 0 || designations().length === 0) {
                <div class="alert-guidance alert-warning">
                  <div class="guidance-icon"><span class="material-symbols-outlined">warning</span></div>
                  <div class="guidance-content">
                    <strong>Prerequisites Missing: Clients & Job Designations</strong>
                    <p>Commercial client billing rates require at least one Client entity and one Designation catalog entry.</p>
                    <div class="guidance-actions">
                      @if (clients().length === 0) {
                        <button type="button" class="btn btn-sm btn-primary" (click)="setTab('clients')">Configure Clients (Step 1)</button>
                      }
                      @if (designations().length === 0) {
                        <button type="button" class="btn btn-sm btn-primary" (click)="setTab('designations')">Configure Designations</button>
                      }
                    </div>
                  </div>
                </div>
              }

              @if (showNewClientRate) {
                <form class="create-form" (ngSubmit)="createClientRate()">
                  <div class="form-grid">
                    <select [(ngModel)]="newClientRateClientId" (change)="onClientRateClientChange()" name="newClientRateClientId" required>
                      <option value="">-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                      }
                    </select>
                    <select [(ngModel)]="newClientRateProjId" name="newClientRateProjId">
                      <option value="">-- Client-Wide Default (All Projects) --</option>
                      @for (p of clientRateProjects(); track p.id) {
                        <option [value]="p.id">{{ p.name }} (Project-Specific)</option>
                      }
                    </select>
                    <select [(ngModel)]="newClientRateDesId" name="newClientRateDesId" required>
                      <option value="">-- Select Designation --</option>
                      @for (d of designations(); track d.id) {
                        <option [value]="d.id">{{ d.title }}</option>
                      }
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      [(ngModel)]="newClientRateNormal"
                      name="newClientRateNormal"
                      placeholder="Normal Invoicing Rate (AED/hr)"
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      [(ngModel)]="newClientRateOt"
                      name="newClientRateOt"
                      placeholder="OT Invoicing Rate (AED/hr)"
                      required
                    />
                    <input
                      type="date"
                      [(ngModel)]="newClientRateFrom"
                      name="newClientRateFrom"
                      placeholder="Effective From"
                      required
                    />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save Invoicing Rate</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Commercial Client</th>
                      <th>Project Worksite Scope</th>
                      <th>Designation</th>
                      <th>Normal Invoice Rate</th>
                      <th>OT Invoice Rate</th>
                      <th>Effective Interval</th>
                      <th>Resolution Tier</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of clientRates(); track r.id) {
                      <tr>
                        <td><strong>{{ r.clientName || r.clientId }}</strong></td>
                        <td>
                          @if (r.projectName) {
                            <span class="project-tag">{{ r.projectName }}</span>
                          } @else {
                            <span class="client-wide-tag">All Projects (Client-Wide)</span>
                          }
                        </td>
                        <td><span class="tag">{{ r.designationTitle || r.designationId }}</span></td>
                        <td>
                          <span class="rate-amount">AED {{ r.normalBillingRate | number:'1.2-2' }}</span>
                          <span class="rate-unit">/hr</span>
                        </td>
                        <td>
                          <span class="rate-amount">AED {{ r.otBillingRate | number:'1.2-2' }}</span>
                          <span class="rate-unit">/hr</span>
                        </td>
                        <td><code>{{ r.effectiveFrom }} ➔ {{ r.effectiveTo || 'Ongoing' }}</code></td>
                        <td>
                          @if (r.projectId) {
                            <span class="badge badge-tier-project">Tier 1: Project-Specific</span>
                          } @else {
                            <span class="badge badge-tier-client">Tier 2: Client Fallback</span>
                          }
                        </td>
                        <td>
                          <span class="badge" [class.badge-active]="!r.effectiveTo">
                            {{ r.effectiveTo ? 'Superseded' : 'Active Rate' }}
                          </span>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="empty-state">No commercial client billing rates configured yet.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: RATE SIMULATOR & ENGINE RESOLUTION -->
          @if (activeTab() === 'rates') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Point-in-Time Commercial Billing Rate Resolution Simulator</h2>
                  <p class="subtitle">
                    Tests the 4-tier engine: Work Date ➔ Authoritative Assignment ➔ Tier 1 (Project Rate) ➔ Tier 2 (Client Fallback) ➔ Rate Missing Alert.
                  </p>
                </div>
              </div>
              
              <div class="resolution-tester">
                <h3>Test Point-in-Time Commercial Resolution Engine</h3>
                <div class="form-row">
                  <select [(ngModel)]="resolutionEmpId" name="resolutionEmpId">
                    <option value="">-- Select Employee --</option>
                    @for (e of employees(); track e.id) {
                      <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                    }
                  </select>
                  <input type="date" [(ngModel)]="resolutionWorkDate" name="resolutionWorkDate" />
                  <button class="btn btn-primary" (click)="resolveBilling()">
                    <span class="material-symbols-outlined icon-sm">science</span>
                    <span>Simulate Resolution</span>
                  </button>
                </div>

                @if (resolvedRate(); as res) {
                  <div class="resolution-result" [class.resolved]="res.status === 'RESOLVED'" [class.error]="res.status !== 'RESOLVED'">
                    <h4>Resolution Status: <code>{{ res.status }}</code></h4>
                    @if (res.status === 'RESOLVED') {
                      <div class="res-details">
                        <p><strong>Resolved Tier:</strong> <span class="badge badge-active">{{ res.rateSource }}</span></p>
                        <p><strong>Normal Invoice Rate:</strong> AED {{ res.normalBillingRate }}/hr</p>
                        <p><strong>OT Invoice Rate:</strong> AED {{ res.otBillingRate }}/hr</p>
                      </div>
                    } @else {
                      <p class="error-msg">{{ res.errorMessage }} (Code: {{ res.errorCode }})</p>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- TAB: DESIGNATIONS -->
          @if (activeTab() === 'designations') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Designations Master Catalog</h2>
                  <p class="subtitle">Standard trade, occupational, and administrative job roles across all projects.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewDesignation = !showNewDesignation">
                  <span class="material-symbols-outlined icon-sm">{{ showNewDesignation ? 'close' : 'add' }}</span>
                  <span>{{ showNewDesignation ? 'Cancel' : 'Add Designation' }}</span>
                </button>
              </div>

              @if (showNewDesignation) {
                <form class="create-form" (ngSubmit)="createDesignation()">
                  <div class="form-row">
                    <input type="text" [(ngModel)]="newDesCode" name="newDesCode" placeholder="Code (e.g. DES-PLUMB)" required />
                    <input type="text" [(ngModel)]="newDesTitle" name="newDesTitle" placeholder="Title (e.g. Master Plumber)" required />
                    <input type="text" [(ngModel)]="newDesDesc" name="newDesDesc" placeholder="Description" />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of designations(); track d.id) {
                      <tr>
                        <td><code>{{ d.code }}</code></td>
                        <td><strong>{{ d.title }}</strong></td>
                        <td>{{ d.description || '—' }}</td>
                        <td><span class="badge" [class.badge-active]="d.isActive">Active</span></td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" class="empty-state">No designations found.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: EMPLOYEES -->
          @if (activeTab() === 'employees') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Employees Master (Biographical Identity)</h2>
                  <p class="subtitle">Core biographical registry for Blue Royal workforce.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewEmployee = !showNewEmployee">
                  <span class="material-symbols-outlined icon-sm">{{ showNewEmployee ? 'close' : 'add' }}</span>
                  <span>{{ showNewEmployee ? 'Cancel' : 'Register Employee' }}</span>
                </button>
              </div>

              @if (showNewEmployee) {
                <form class="create-form" (ngSubmit)="createEmployee()">
                  <div class="form-grid">
                    <input type="text" [(ngModel)]="newEmpCode" name="newEmpCode" placeholder="Emp Code (BR-001)" required />
                    <input type="text" [(ngModel)]="newEmpFirst" name="newEmpFirst" placeholder="First Name" required />
                    <input type="text" [(ngModel)]="newEmpLast" name="newEmpLast" placeholder="Last Name" required />
                    <select [(ngModel)]="newEmpGender" name="newEmpGender">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                    <input type="date" [(ngModel)]="newEmpDob" name="newEmpDob" placeholder="DOB" required />
                    <input type="text" [(ngModel)]="newEmpNat" name="newEmpNat" placeholder="Nationality" required />
                    <input type="date" [(ngModel)]="newEmpJoining" name="newEmpJoining" placeholder="Joining Date" required />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Register Employee</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Nationality</th>
                      <th>Joining Date</th>
                      <th>Active Designation</th>
                      <th>Active Deployment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (emp of employees(); track emp.id) {
                      <tr>
                        <td><code>{{ emp.employeeCode }}</code></td>
                        <td><strong>{{ emp.firstName }} {{ emp.lastName }}</strong></td>
                        <td>{{ emp.nationality }}</td>
                        <td>{{ emp.dateOfJoining }}</td>
                        <td>
                          @if (emp.currentDesignation) {
                            <span class="tag">{{ emp.currentDesignation.title }}</span>
                          } @else {
                            <em class="text-muted">Unassigned</em>
                          }
                        </td>
                        <td>
                          @if (emp.currentAssignment) {
                            <span>{{ emp.currentAssignment.clientName }} / {{ emp.currentAssignment.projectName }}</span>
                          } @else {
                            <em class="text-muted">No active project</em>
                          }
                        </td>
                        <td><span class="badge badge-active">{{ emp.status }}</span></td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">No employees found.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: SHIFTS -->
          @if (activeTab() === 'shifts') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Shifts & Rostering Master</h2>
                  <p class="subtitle">Standard operational shift schedules and working hours.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewShift = !showNewShift">
                  <span class="material-symbols-outlined icon-sm">{{ showNewShift ? 'close' : 'add' }}</span>
                  <span>{{ showNewShift ? 'Cancel' : 'Add Shift' }}</span>
                </button>
              </div>

              @if (showNewShift) {
                <form class="create-form" (ngSubmit)="createShift()">
                  <div class="form-grid">
                    <input type="text" [(ngModel)]="newShiftCode" name="newShiftCode" placeholder="Code (e.g. SH-DAY-8H)" required />
                    <input type="text" [(ngModel)]="newShiftName" name="newShiftName" placeholder="Shift Name" required />
                    <input type="time" [(ngModel)]="newShiftStart" name="newShiftStart" required />
                    <input type="time" [(ngModel)]="newShiftEnd" name="newShiftEnd" required />
                    <input type="number" [(ngModel)]="newShiftBreak" name="newShiftBreak" placeholder="Break Mins" />
                    <input type="number" step="0.5" [(ngModel)]="newShiftHours" name="newShiftHours" placeholder="Work Hours (8.0)" required />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Save Shift</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Timings</th>
                      <th>Break</th>
                      <th>Work Hours</th>
                      <th>Night Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (s of shifts(); track s.id) {
                      <tr>
                        <td><code>{{ s.code }}</code></td>
                        <td><strong>{{ s.name }}</strong></td>
                        <td>{{ s.startTime }} – {{ s.endTime }}</td>
                        <td>{{ s.breakMinutes }}m</td>
                        <td>{{ s.workHours }} hrs</td>
                        <td>{{ s.isNightShift ? 'Yes' : 'No' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="empty-state">No shifts configured.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: CALENDAR & HOLIDAYS -->
          @if (activeTab() === 'calendar') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Company & Statutory Public Holidays</h2>
                  <p class="subtitle">Authoritative holiday calendar used for attendance, overtime calculations, and leave encashment.</p>
                </div>
                <button class="btn btn-primary" (click)="showNewHoliday = !showNewHoliday">
                  <span class="material-symbols-outlined icon-sm">{{ showNewHoliday ? 'close' : 'add' }}</span>
                  <span>{{ showNewHoliday ? 'Cancel' : 'Add Holiday' }}</span>
                </button>
              </div>

              @if (showNewHoliday) {
                <form class="create-form" (ngSubmit)="createHoliday()">
                  <div class="form-row">
                    <input type="number" [(ngModel)]="newHolidayYear" name="newHolidayYear" placeholder="Year (2026)" required />
                    <input type="text" [(ngModel)]="newHolidayName" name="newHolidayName" placeholder="Holiday Name" required />
                    <input type="date" [(ngModel)]="newHolidayDate" name="newHolidayDate" required />
                    <input type="text" [(ngModel)]="newHolidayDesc" name="newHolidayDesc" placeholder="Description" />
                    <button type="submit" class="btn btn-success">
                      <span class="material-symbols-outlined icon-sm">check</span>
                      <span>Add Holiday</span>
                    </button>
                  </div>
                </form>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Holiday Name</th>
                      <th>Date</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (h of holidays(); track h.id) {
                      <tr>
                        <td>{{ h.calendarYear }}</td>
                        <td><strong>{{ h.name }}</strong></td>
                        <td><code>{{ h.holidayDate }}</code></td>
                        <td>{{ h.description || '—' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" class="empty-state">No public holidays found.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- TAB: SALARY COMPONENTS -->
          @if (activeTab() === 'salary') {
            <div class="panel">
              <div class="panel-header">
                <div>
                  <h2>Salary Components Master (Monthly Remuneration)</h2>
                  <p class="subtitle">Authoritative compensation structure components for monthly salaried personnel (WPS Compliant).</p>
                </div>
              </div>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Component Name</th>
                      <th>Type</th>
                      <th>Calculation</th>
                      <th>WPS Basic</th>
                      <th>WPS Housing</th>
                      <th>Recurring</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (sc of salaryComponents(); track sc.id) {
                      <tr>
                        <td><code>{{ sc.code }}</code></td>
                        <td><strong>{{ sc.name }}</strong></td>
                        <td><span class="badge" [class.badge-active]="sc.type === 'earning'">{{ sc.type | uppercase }}</span></td>
                        <td>{{ sc.calculationType }}</td>
                        <td>{{ sc.isWpsBasic ? '✓' : '—' }}</td>
                        <td>{{ sc.isWpsHousing ? '✓' : '—' }}</td>
                        <td>{{ sc.isRecurring ? 'Yes' : 'No' }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">No salary components found.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </div>
      </div>
    </app-shell>
  `,
  styles: [
    `
      .masters-workspace {
        padding-bottom: 2rem;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }
      .header-main {
        flex: 1;
        min-width: 260px;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }
      .breadcrumb {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--brand-600);
        margin-bottom: 0.25rem;
        text-transform: uppercase;
      }
      .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 0.25rem 0;
        letter-spacing: -0.02em;
      }
      .page-desc {
        color: var(--text-secondary);
        font-size: 0.875rem;
        margin: 0;
        line-height: 1.45;
      }

      /* Contextual Workforce Flow Indicator (Slim & Compact) */
      .contextual-flow-strip {
        display: flex;
        align-items: center;
        gap: 0.875rem;
        background: #f8fafc;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.45rem 0.875rem;
        margin-bottom: 1.25rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        overflow-x: auto;
      }
      .flow-lead {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: #64748b;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .flow-steps {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-shrink: 0;
      }
      .flow-step-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: var(--radius-full);
        padding: 0.2rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .flow-step-pill:hover {
        background: #f1f5f9;
        border-color: #cbd5e1;
        color: #0f172a;
      }
      .flow-step-pill.current {
        background: var(--brand-50);
        border-color: var(--brand-300);
        color: var(--brand-700);
        font-weight: 700;
      }
      .step-badge {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #475569;
        font-size: 0.625rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .flow-step-pill.current .step-badge {
        background: var(--brand-600);
        color: #ffffff;
      }
      .flow-sep {
        color: #94a3b8;
        font-size: 0.6875rem;
      }

      /* Filter Toolbar for Deployments */
      .filter-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      .search-box {
        flex: 1;
        min-width: 260px;
        display: flex;
        align-items: center;
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0 0.625rem;
        gap: 0.35rem;
      }
      .search-box:focus-within {
        border-color: var(--brand-500);
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
      }
      .search-input {
        border: none;
        outline: none;
        width: 100%;
        padding: 0.5rem 0.25rem;
        font-size: 0.8125rem;
        color: var(--text-primary);
        background: transparent;
      }
      .btn-clear {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 0.2rem;
        display: flex;
        align-items: center;
      }
      .btn-clear:hover {
        color: var(--text-primary);
      }
      .filter-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .filter-select {
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--text-primary);
        outline: none;
        cursor: pointer;
      }
      .filter-select:focus {
        border-color: var(--brand-500);
      }

      /* Action Buttons */
      .action-btn-group {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }
      .btn-action {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-action-view {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #334155;
      }
      .btn-action-view:hover {
        background: #f1f5f9;
        color: #0f172a;
      }
      .btn-action-edit {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
      }
      .btn-action-edit:hover {
        background: #dbeafe;
      }
      .btn-action-danger {
        background: #fef2f2;
        border-color: #fecaca;
        color: #dc2626;
      }
      .btn-action-danger:hover {
        background: #fee2e2;
      }
      .icon-xs {
        font-size: 0.875rem !important;
      }
      .text-right {
        text-align: right;
      }

      /* Modals */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        backdrop-filter: blur(2px);
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .modal-card {
        background: #ffffff;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-xl);
        width: 100%;
        max-width: 520px;
        overflow: hidden;
        border: 1px solid var(--border-default);
      }
      .modal-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--border-default);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .btn-icon-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 0.25rem;
        border-radius: var(--radius-sm);
      }
      .btn-icon-close:hover {
        color: #dc2626;
        background: #fee2e2;
      }
      .modal-body {
        padding: 1.25rem;
      }
      .modal-footer {
        padding: 0.875rem 1.25rem;
        border-top: 1px solid var(--border-default);
        background: #f8fafc;
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }
      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
      }
      .detail-label {
        font-size: 0.6875rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }
      .detail-val {
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .detail-sub {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .detail-remarks {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-subtle);
      }
      .detail-remarks p {
        margin: 0.25rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .edit-banner {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: var(--radius-md);
        padding: 0.75rem;
        margin-bottom: 1rem;
        font-size: 0.8125rem;
      }
      .edit-banner small {
        color: #1e40af;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .mb-3 {
        margin-bottom: 0.75rem;
      }
      .form-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .form-control {
        width: 100%;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--text-primary);
        outline: none;
      }
      .form-control:focus {
        border-color: var(--brand-500);
      }
      .form-hint {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .btn-secondary {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }
      .btn-secondary:hover {
        background: #e2e8f0;
      }

      /* Panels */
      .panel {
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        box-shadow: var(--shadow-sm);
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border-subtle);
        gap: 1rem;
        flex-wrap: wrap;
      }
      .panel-header h2 {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0.25rem 0;
      }
      .subtitle {
        color: var(--text-muted);
        margin: 0;
        font-size: 0.8125rem;
      }

      /* Stream indicators */
      .stream-pill {
        display: inline-block;
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 0.15rem 0.5rem;
        border-radius: var(--radius-sm);
        margin-bottom: 0.25rem;
      }
      .stream-cost {
        background: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
      }
      .stream-rev {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
      }

      /* Forms */
      .create-form {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1rem 1.25rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.25rem;
      }
      .form-row {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
      }
      .form-grid input,
      .form-grid select,
      .form-row input,
      .form-row select {
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        background: #ffffff;
        color: var(--text-primary);
      }

      /* Responsive Tables */
      .table-responsive {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        margin-top: 0.5rem;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 650px;
      }
      .data-table th {
        text-align: left;
        padding: 0.75rem 1rem;
        background: var(--bg-surface-subtle);
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-bottom: 1px solid var(--border-default);
      }
      .data-table td {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid var(--border-subtle);
        font-size: 0.8125rem;
        color: var(--text-primary);
        vertical-align: middle;
      }
      .data-table tr:hover td {
        background: var(--bg-surface-subtle);
      }
      .cell-sub {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .empty-state {
        text-align: center;
        color: var(--text-muted);
        padding: 2rem !important;
      }

      /* Prerequisite Guidance Alerts & Explainer Banners */
      .alert-guidance {
        display: flex;
        gap: 0.875rem;
        padding: 1rem 1.25rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.25rem;
        border: 1px solid transparent;
      }
      .alert-guidance.alert-warning {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
      }
      .alert-guidance.alert-info {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
      }
      .guidance-icon {
        flex-shrink: 0;
        margin-top: 0.125rem;
      }
      .guidance-content {
        flex: 1;
      }
      .guidance-content strong {
        display: block;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
      }
      .guidance-content p {
        font-size: 0.8125rem;
        margin: 0 0 0.625rem 0;
        line-height: 1.4;
      }
      .guidance-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .stream-explainer-banner {
        display: flex;
        gap: 0.875rem;
        align-items: flex-start;
        padding: 0.875rem 1rem;
        border-radius: var(--radius-md);
        margin-bottom: 1.25rem;
        border: 1px solid transparent;
      }
      .stream-explainer-banner.cost-banner {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e3a8a;
      }
      .stream-explainer-banner.rev-banner {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #14532d;
      }
      .banner-icon-wrap {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cost-banner .banner-icon-wrap {
        background: #dbeafe;
        color: #1d4ed8;
      }
      .rev-banner .banner-icon-wrap {
        background: #dcfce7;
        color: #15803d;
      }
      .banner-text strong {
        display: block;
        font-size: 0.8125rem;
        margin-bottom: 0.15rem;
      }
      .banner-text p {
        margin: 0;
        font-size: 0.75rem;
        line-height: 1.4;
      }
      .btn-outline {
        border: 1px solid var(--border-default);
        background: #ffffff;
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.625rem;
        border-radius: var(--radius-sm);
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
      }
      .btn-outline:hover {
        background: #f1f5f9;
        color: var(--text-primary);
      }

      /* Badges & Tags */
      .badge {
        display: inline-block;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--bg-surface-subtle);
        color: var(--text-secondary);
        border: 1px solid var(--border-default);
      }
      .badge-active {
        background: var(--status-approved-bg);
        color: var(--status-approved-text);
        border-color: var(--status-approved-border);
      }
      .badge-worker-pay {
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
      }
      .badge-tier-project {
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #bbf7d0;
      }
      .badge-tier-client {
        background: #fefce8;
        color: #854d0e;
        border: 1px solid #fef08a;
      }
      .tag {
        background: var(--brand-50);
        color: var(--brand-700);
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-weight: 600;
        font-size: 0.75rem;
        border: 1px solid var(--brand-200);
      }
      .project-tag {
        background: #ecfdf5;
        color: #047857;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid #a7f3d0;
      }
      .client-wide-tag {
        background: #f8fafc;
        color: #475569;
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-style: italic;
        border: 1px dashed var(--border-default);
      }
      .rate-amount {
        font-weight: 700;
        color: var(--text-primary);
        font-family: monospace;
        font-size: 0.875rem;
      }
      .rate-unit {
        color: var(--text-muted);
        font-size: 0.75rem;
      }

      /* Overview & Flow Layout */
      .overview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 1.25rem;
        margin-top: 1rem;
      }
      .flow-card {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1.25rem;
        border-radius: var(--radius-md);
      }
      .flow-diagram {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 1rem 0;
        flex-wrap: wrap;
      }
      .flow-step {
        background: #ffffff;
        border: 1px solid var(--border-default);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 140px;
        box-shadow: var(--shadow-sm);
      }
      .flow-step.cost-step {
        border-left: 4px solid #2563eb;
      }
      .flow-step.rev-step {
        border-left: 4px solid #16a34a;
      }
      .flow-step strong {
        font-size: 0.8125rem;
        margin-bottom: 0.25rem;
      }
      .flow-step span {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .flow-step small {
        font-size: 0.6875rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
      }
      .flow-vs {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-muted);
        padding: 0 0.25rem;
      }
      .note {
        font-size: 0.75rem;
        color: var(--text-secondary);
        background: #ffffff;
        padding: 0.75rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-subtle);
        margin: 0.5rem 0 0 0;
      }
      .checklist {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .checklist li {
        display: flex;
        align-items: flex-start;
        gap: 0.625rem;
        background: #ffffff;
        padding: 0.625rem 0.75rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-subtle);
      }
      .check-icon {
        color: #16a34a;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .checklist strong {
        font-size: 0.8125rem;
        display: block;
        color: var(--text-primary);
      }
      .checklist span {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      /* Simulator */
      .resolution-tester {
        background: var(--bg-surface-subtle);
        border: 1px solid var(--border-default);
        padding: 1.25rem;
        border-radius: var(--radius-md);
      }
      .resolution-tester h3 {
        font-size: 0.9375rem;
        margin: 0 0 0.75rem 0;
      }
      .resolution-result {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: var(--radius-md);
      }
      .resolution-result.resolved {
        background: var(--status-approved-bg);
        border: 1px solid var(--status-approved-border);
        color: var(--status-approved-text);
      }
      .resolution-result.error {
        background: var(--status-danger-bg);
        border: 1px solid var(--status-danger-border);
        color: var(--status-danger-text);
      }
      .res-details {
        margin-top: 0.5rem;
      }
      .res-details p {
        margin: 0.25rem 0;
        font-size: 0.8125rem;
      }
      .error-msg {
        margin: 0;
        font-weight: 500;
      }

      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.45rem 0.875rem;
        font-size: 0.8125rem;
        font-weight: 600;
        border-radius: var(--radius-md);
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn-primary {
        background: var(--brand-600);
        color: #ffffff;
      }
      .btn-primary:hover {
        background: var(--brand-700);
      }
      .btn-success {
        background: #16a34a;
        color: #ffffff;
      }
      .btn-success:hover {
        background: #15803d;
      }
      .icon-sm {
        font-size: 1.125rem;
      }
    `,
  ],
})
export class MastersHubComponent implements OnInit {
  public activeTab = signal<MasterTab>('overview');

  public designations = signal<DesignationDto[]>([]);
  public clients = signal<ClientDto[]>([]);
  public projects = signal<ProjectDto[]>([]);
  public employees = signal<EmployeeDto[]>([]);
  public assignments = signal<EmployeeAssignmentDto[]>([]);
  public employeeRates = signal<EmployeeHourlyRateDto[]>([]);
  public clientRates = signal<ClientBillingRateDto[]>([]);
  public shifts = signal<ShiftDto[]>([]);
  public holidays = signal<PublicHolidayDto[]>([]);
  public salaryComponents = signal<SalaryComponentDto[]>([]);

  public filteredProjects = signal<ProjectDto[]>([]);
  public clientRateProjects = signal<ProjectDto[]>([]);
  public resolvedRate = signal<ResolvedBillingRateDto | null>(null);

  // Form toggles
  public showNewDesignation = false;
  public showNewEmployee = false;
  public showNewClient = false;
  public showNewProject = false;
  public showNewAssignment = false;
  public showNewEmployeeRate = false;
  public showNewClientRate = false;
  public showNewShift = false;
  public showNewHoliday = false;

  // New Designation Form State
  public newDesCode = '';
  public newDesTitle = '';
  public newDesDesc = '';

  // New Employee Form State
  public newEmpCode = '';
  public newEmpFirst = '';
  public newEmpLast = '';
  public newEmpGender = 'male';
  public newEmpDob = '';
  public newEmpNat = '';
  public newEmpJoining = '';

  // New Client Form State
  public newClientCode = '';
  public newClientName = '';
  public newClientContact = '';

  // New Project Form State
  public newProjClientId = '';
  public newProjCode = '';
  public newProjName = '';
  public newProjLocation = '';

  // New Assignment Form State
  public newAssignEmpId = '';
  public newAssignClientId = '';
  public newAssignProjId = '';
  public newAssignDesId = '';
  public newAssignFrom = '';

  // New Employee Rate Form State
  public newEmpRateEmpId = '';
  public newEmpRateNormal = 0;
  public newEmpRateOt = 0;
  public newEmpRateFrom = '';
  public newEmpRateReason = '';

  // New Client Rate Form State
  public newClientRateClientId = '';
  public newClientRateProjId = '';
  public newClientRateDesId = '';
  public newClientRateNormal = 0;
  public newClientRateOt = 0;
  public newClientRateFrom = '';

  // New Shift Form State
  public newShiftCode = '';
  public newShiftName = '';
  public newShiftStart = '07:00';
  public newShiftEnd = '16:00';
  public newShiftBreak = 60;
  public newShiftHours = 8.0;

  // New Holiday Form State
  public newHolidayYear = 2026;
  public newHolidayName = '';
  public newHolidayDate = '';
  public newHolidayDesc = '';

  // Resolution Tester State
  public resolutionEmpId = '';
  public resolutionWorkDate = new Date().toISOString().slice(0, 10);

  // Assignments Search & Filter State
  public assignmentSearch = signal<string>('');
  public assignmentStatusFilter = signal<'all' | 'active' | 'closed'>('all');
  public assignmentClientFilter = signal<string>('');

  // Modals for Assignment View and Edit
  public selectedAssignmentForView = signal<EmployeeAssignmentDto | null>(null);
  public selectedAssignmentForEdit = signal<EmployeeAssignmentDto | null>(null);
  public editAssignEffectiveTo = '';
  public editAssignRemarks = '';

  // Filtered Deployments computed signal
  public filteredAssignments = computed(() => {
    const list = this.assignments();
    const query = this.assignmentSearch().trim().toLowerCase();
    const statusFilter = this.assignmentStatusFilter();
    const clientFilter = this.assignmentClientFilter();

    return list.filter((a) => {
      if (statusFilter === 'active' && a.effectiveTo) return false;
      if (statusFilter === 'closed' && !a.effectiveTo) return false;
      if (clientFilter && a.clientId !== clientFilter) return false;

      if (query) {
        const empName = (a.employeeName || '').toLowerCase();
        const empCode = (a.employeeCode || '').toLowerCase();
        const clientName = (a.clientName || '').toLowerCase();
        const projName = (a.projectName || '').toLowerCase();
        const desTitle = (a.designationTitle || '').toLowerCase();
        return (
          empName.includes(query) ||
          empCode.includes(query) ||
          clientName.includes(query) ||
          projName.includes(query) ||
          desTitle.includes(query)
        );
      }
      return true;
    });
  });

  // Dynamic Information Architecture Metadata per Tab
  public currentMeta = computed(() => {
    const tab = this.activeTab();
    const isSuperAdmin = this.authService.hasRole('super_admin');

    switch (tab) {
      case 'assignments':
        return {
          breadcrumbGroup: isSuperAdmin ? 'WORKFORCE OVERSIGHT' : 'WORKFORCE OPERATIONS',
          breadcrumbPage: 'Workforce Deployments',
          title: 'Workforce Deployments',
          subtitle: 'Assign employees to clients, projects and designated roles.',
          ctaLabel: 'Deploy Employee',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 3,
        };
      case 'clients':
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Clients',
          title: 'Clients',
          subtitle: 'Manage commercial clients and their associated work.',
          ctaLabel: 'Add Client',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 1,
        };
      case 'projects':
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Projects & Worksites',
          title: 'Projects & Worksites',
          subtitle: 'Manage client projects and worksite locations.',
          ctaLabel: 'Add Project',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 2,
        };
      case 'designations':
        return {
          breadcrumbGroup: isSuperAdmin ? 'ORGANIZATION SETUP' : 'ORGANIZATION REFERENCE',
          breadcrumbPage: 'Job Designations',
          title: 'Job Designations',
          subtitle: 'Manage job/designation master data.',
          ctaLabel: 'Add Designation',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'shifts':
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Work Shifts & Hours',
          title: 'Work Shifts & Hours',
          subtitle: 'Manage employee work schedules.',
          ctaLabel: 'Add Shift',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'calendar':
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Holidays & Weekly Offs',
          title: 'Holidays & Weekly Offs',
          subtitle: 'Manage organization calendar.',
          ctaLabel: 'Add Holiday',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'salary':
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Salary Packages',
          title: 'Salary Packages',
          subtitle: 'Manage standard compensation structures.',
          ctaLabel: null as string | null,
          ctaIcon: '',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'employee-rates':
        return {
          breadcrumbGroup: 'WORKFORCE OPERATIONS',
          breadcrumbPage: 'Employee Compensation',
          title: 'Employee Compensation',
          subtitle: 'Manage employee pay rates used for payroll.',
          ctaLabel: 'Set Employee Rate',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 4,
        };
      case 'client-rates':
        return {
          breadcrumbGroup: isSuperAdmin ? 'WORKFORCE OVERSIGHT' : 'COMMERCIAL',
          breadcrumbPage: 'Client Billing Rates',
          title: 'Client Billing Rates',
          subtitle: 'Manage commercial billing rates used for client invoicing.',
          ctaLabel: 'Set Billing Rate',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 5,
        };
      case 'rates':
        return {
          breadcrumbGroup: isSuperAdmin ? 'WORKFORCE OVERSIGHT' : 'COMMERCIAL',
          breadcrumbPage: 'Rate Simulator',
          title: 'Rate Simulator',
          subtitle: 'Simulate dual-stream rate resolution across client and worker contracts.',
          ctaLabel: null as string | null,
          ctaIcon: '',
          isFlowTab: true,
          flowStep: 5,
        };
      case 'employees':
        return {
          breadcrumbGroup: isSuperAdmin ? 'WORKFORCE OVERSIGHT' : 'PEOPLE',
          breadcrumbPage: 'Employee Registry',
          title: 'Employee Registry',
          subtitle: 'Core biographical employee records.',
          ctaLabel: 'Register Employee',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'overview':
      default:
        return {
          breadcrumbGroup: 'ORGANIZATION SETUP',
          breadcrumbPage: 'Master Catalogs',
          title: 'Master Catalogs & Operations Overview',
          subtitle: 'Authoritative commercial entities, deployment worksites, and dual-stream rate architecture.',
          ctaLabel: null as string | null,
          ctaIcon: '',
          isFlowTab: false,
          flowStep: 0,
        };
    }
  });

  public isPrimaryFormOpen(): boolean {
    switch (this.activeTab()) {
      case 'assignments': return this.showNewAssignment;
      case 'clients': return this.showNewClient;
      case 'projects': return this.showNewProject;
      case 'designations': return this.showNewDesignation;
      case 'shifts': return this.showNewShift;
      case 'calendar': return this.showNewHoliday;
      case 'employee-rates': return this.showNewEmployeeRate;
      case 'client-rates': return this.showNewClientRate;
      case 'employees': return this.showNewEmployee;
      default: return false;
    }
  }

  public togglePrimaryForm(): void {
    switch (this.activeTab()) {
      case 'assignments': this.showNewAssignment = !this.showNewAssignment; break;
      case 'clients': this.showNewClient = !this.showNewClient; break;
      case 'projects': this.showNewProject = !this.showNewProject; break;
      case 'designations': this.showNewDesignation = !this.showNewDesignation; break;
      case 'shifts': this.showNewShift = !this.showNewShift; break;
      case 'calendar': this.showNewHoliday = !this.showNewHoliday; break;
      case 'employee-rates': this.showNewEmployeeRate = !this.showNewEmployeeRate; break;
      case 'client-rates': this.showNewClientRate = !this.showNewClientRate; break;
      case 'employees': this.showNewEmployee = !this.showNewEmployee; break;
    }
  }

  public openViewAssignment(assign: EmployeeAssignmentDto): void {
    this.selectedAssignmentForView.set(assign);
  }

  public openEditAssignment(assign: EmployeeAssignmentDto): void {
    this.selectedAssignmentForEdit.set(assign);
    this.editAssignEffectiveTo = assign.effectiveTo || '';
    this.editAssignRemarks = assign.remarks || '';
  }

  public saveAssignmentEdit(): void {
    const assign = this.selectedAssignmentForEdit();
    if (!assign) return;
    this.masterService
      .updateAssignment(assign.id, {
        effectiveTo: this.editAssignEffectiveTo || null,
        remarks: this.editAssignRemarks || undefined,
      })
      .subscribe(() => {
        this.selectedAssignmentForEdit.set(null);
        this.refreshAll();
      });
  }

  public deactivateAssignment(assign: EmployeeAssignmentDto): void {
    const confirmed = confirm(
      `Are you sure you want to deactivate and close deployment for ${assign.employeeName || 'this employee'}? Effective end date will be set to today.`
    );
    if (!confirmed) return;
    const today = new Date().toISOString().slice(0, 10);
    this.masterService
      .updateAssignment(assign.id, {
        effectiveTo: today,
        remarks: (assign.remarks ? assign.remarks + ' | ' : '') + 'Closed by administrator',
      })
      .subscribe(() => {
        this.refreshAll();
      });
  }

  constructor(
    public authService: AuthService,
    private masterService: MasterService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  public ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const tabParam = params.get('tab') as MasterTab;
      if (tabParam) {
        this.activeTab.set(tabParam);
      }
    });

    this.refreshAll();
  }

  public setTab(tab: MasterTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  public refreshAll(): void {
    this.masterService.getDesignations().subscribe((res) => this.designations.set(res.data));
    this.masterService.getClients().subscribe((res) => this.clients.set(res.data));
    this.masterService.getProjects().subscribe((res) => this.projects.set(res.data));
    this.masterService.getEmployees().subscribe((res) => this.employees.set(res.data));
    this.masterService.getAssignments().subscribe((res) => this.assignments.set(res.data));
    this.masterService.getEmployeeRates().subscribe((res) => this.employeeRates.set(res.data));
    this.masterService.getClientRates().subscribe((res) => this.clientRates.set(res.data));
    this.masterService.getShifts().subscribe((res) => this.shifts.set(res.data));
    this.masterService.getPublicHolidays().subscribe((res) => this.holidays.set(res.data));
    this.masterService.getSalaryComponents().subscribe((res) => this.salaryComponents.set(res.data));
  }

  public createDesignation(): void {
    if (!this.newDesCode || !this.newDesTitle) return;
    this.masterService
      .createDesignation({
        code: this.newDesCode,
        title: this.newDesTitle,
        description: this.newDesDesc || null,
      })
      .subscribe(() => {
        this.showNewDesignation = false;
        this.newDesCode = '';
        this.newDesTitle = '';
        this.newDesDesc = '';
        this.refreshAll();
      });
  }

  public createEmployee(): void {
    if (!this.newEmpCode || !this.newEmpFirst || !this.newEmpLast) return;
    this.masterService
      .createEmployee({
        employeeCode: this.newEmpCode,
        firstName: this.newEmpFirst,
        lastName: this.newEmpLast,
        gender: this.newEmpGender as any,
        dateOfBirth: this.newEmpDob,
        nationality: this.newEmpNat,
        dateOfJoining: this.newEmpJoining,
      })
      .subscribe(() => {
        this.showNewEmployee = false;
        this.newEmpCode = '';
        this.newEmpFirst = '';
        this.newEmpLast = '';
        this.refreshAll();
      });
  }

  public createClient(): void {
    if (!this.newClientCode || !this.newClientName) return;
    this.masterService
      .createClient({
        code: this.newClientCode,
        name: this.newClientName,
        contactPerson: this.newClientContact || null,
      })
      .subscribe(() => {
        this.showNewClient = false;
        this.newClientCode = '';
        this.newClientName = '';
        this.refreshAll();
      });
  }

  public createProject(): void {
    if (!this.newProjClientId || !this.newProjCode || !this.newProjName) return;
    this.masterService
      .createProject({
        clientId: this.newProjClientId,
        code: this.newProjCode,
        name: this.newProjName,
        siteLocation: this.newProjLocation || null,
      })
      .subscribe(() => {
        this.showNewProject = false;
        this.newProjCode = '';
        this.newProjName = '';
        this.refreshAll();
      });
  }

  public onAssignClientChange(): void {
    const list = this.projects().filter((p) => p.clientId === this.newAssignClientId);
    this.filteredProjects.set(list);
  }

  public createAssignment(): void {
    if (!this.newAssignEmpId || !this.newAssignClientId || !this.newAssignProjId || !this.newAssignDesId || !this.newAssignFrom) return;
    this.masterService
      .createAssignment({
        employeeId: this.newAssignEmpId,
        clientId: this.newAssignClientId,
        projectId: this.newAssignProjId,
        designationId: this.newAssignDesId,
        effectiveFrom: this.newAssignFrom,
      })
      .subscribe(() => {
        this.showNewAssignment = false;
        this.newAssignEmpId = '';
        this.newAssignClientId = '';
        this.newAssignProjId = '';
        this.newAssignDesId = '';
        this.newAssignFrom = '';
        this.refreshAll();
      });
  }

  public createEmployeeRate(): void {
    if (!this.newEmpRateEmpId || !this.newEmpRateNormal || !this.newEmpRateFrom) return;
    this.masterService
      .createEmployeeRate({
        employeeId: this.newEmpRateEmpId,
        normalHourlyRate: Number(this.newEmpRateNormal),
        otHourlyRate: Number(this.newEmpRateOt || this.newEmpRateNormal * 1.25),
        effectiveFrom: this.newEmpRateFrom,
        changeReason: this.newEmpRateReason || null,
      })
      .subscribe(() => {
        this.showNewEmployeeRate = false;
        this.newEmpRateEmpId = '';
        this.newEmpRateNormal = 0;
        this.newEmpRateOt = 0;
        this.newEmpRateFrom = '';
        this.newEmpRateReason = '';
        this.refreshAll();
      });
  }

  public onClientRateClientChange(): void {
    const list = this.projects().filter((p) => p.clientId === this.newClientRateClientId);
    this.clientRateProjects.set(list);
  }

  public createClientRate(): void {
    if (!this.newClientRateClientId || !this.newClientRateDesId || !this.newClientRateNormal || !this.newClientRateFrom) return;
    this.masterService
      .createClientRate({
        clientId: this.newClientRateClientId,
        projectId: this.newClientRateProjId || null,
        designationId: this.newClientRateDesId,
        normalBillingRate: Number(this.newClientRateNormal),
        otBillingRate: Number(this.newClientRateOt || this.newClientRateNormal * 1.25),
        effectiveFrom: this.newClientRateFrom,
      })
      .subscribe(() => {
        this.showNewClientRate = false;
        this.newClientRateClientId = '';
        this.newClientRateProjId = '';
        this.newClientRateDesId = '';
        this.newClientRateNormal = 0;
        this.newClientRateOt = 0;
        this.newClientRateFrom = '';
        this.refreshAll();
      });
  }

  public createShift(): void {
    if (!this.newShiftCode || !this.newShiftName) return;
    this.masterService
      .createShift({
        code: this.newShiftCode,
        name: this.newShiftName,
        startTime: this.newShiftStart,
        endTime: this.newShiftEnd,
        breakMinutes: this.newShiftBreak,
        workHours: this.newShiftHours,
      })
      .subscribe(() => {
        this.showNewShift = false;
        this.refreshAll();
      });
  }

  public createHoliday(): void {
    if (!this.newHolidayName || !this.newHolidayDate) return;
    this.masterService
      .createPublicHoliday({
        calendarYear: Number(this.newHolidayYear),
        name: this.newHolidayName,
        holidayDate: this.newHolidayDate,
        description: this.newHolidayDesc || null,
      })
      .subscribe(() => {
        this.showNewHoliday = false;
        this.refreshAll();
      });
  }

  public resolveBilling(): void {
    if (!this.resolutionEmpId || !this.resolutionWorkDate) return;
    this.masterService
      .resolveBillingRate(this.resolutionEmpId, this.resolutionWorkDate)
      .subscribe((res) => {
        this.resolvedRate.set(res.data);
      });
  }
}
