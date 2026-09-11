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
              <button class="btn btn-primary btn-lg" (click)="openPrimaryForm()">
                <span class="material-symbols-outlined icon-sm">{{ currentMeta().ctaIcon }}</span>
                <span>{{ currentMeta().ctaLabel }}</span>
              </button>
            </div>
          }
        </header>



        <!-- View Assignment Modal -->
        @if (selectedAssignmentForView(); as assign) {
          <div class="modal-overlay" (click)="selectedAssignmentForView.set(null)">
            <div class="modal-card" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h3>Assignment Details</h3>
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
                    <span class="detail-label">Status</span>
                    <div>
                      <span class="badge" [class.badge-active]="!assign.effectiveTo">
                        {{ assign.effectiveTo ? 'Closed / Past' : 'Active' }}
                      </span>
                    </div>
                  </div>
                </div>
                @if (assign.remarks) {
                  <div class="detail-remarks">
                    <span class="detail-label">Remarks</span>
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

        <!-- Offcanvas Drawer & Backdrop -->
        @if (isOffcanvasOpen()) {
          <div class="offcanvas-backdrop" (click)="closeOffcanvas()"></div>
          <aside class="offcanvas-panel" role="dialog" aria-modal="true">
            <div class="offcanvas-header">
              <div class="offcanvas-header-left">
                <div class="offcanvas-icon-pill">
                  <span class="material-symbols-outlined">{{ offcanvasMeta().icon }}</span>
                </div>
                <div>
                  <h2 class="offcanvas-title">{{ offcanvasMeta().title }}</h2>
                  <p class="offcanvas-subtitle">{{ offcanvasMeta().subtitle }}</p>
                </div>
              </div>
              <button type="button" class="btn-offcanvas-close" (click)="closeOffcanvas()" title="Close Drawer">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="offcanvas-body">
              <!-- CLIENT ADD / EDIT FORM -->
              @if (showNewClient || selectedClientForEdit()) {
                <form (ngSubmit)="submitActiveOffcanvas()">
                  @if (clientFormError()) {
                    <div class="alert-guidance alert-warning mb-3" style="padding: 0.6rem 0.8rem; font-size: 0.8125rem;">
                      <span class="material-symbols-outlined icon-sm">warning</span>
                      <span>{{ clientFormError() }}</span>
                    </div>
                  }

                  <div class="form-group mb-3">
                    <label class="form-label" for="clientCode">Client Code <span class="req">*</span></label>
                    <input
                      id="clientCode"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewClient ? newClientCode : editClientCode"
                      (ngModelChange)="showNewClient ? (newClientCode = $event) : (editClientCode = $event)"
                      name="clientCode"
                      placeholder="e.g. CLI-001"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="clientName">Client Name <span class="req">*</span></label>
                    <input
                      id="clientName"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewClient ? newClientName : editClientName"
                      (ngModelChange)="showNewClient ? (newClientName = $event) : (editClientName = $event)"
                      name="clientName"
                      placeholder="e.g. Emaar Properties"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="clientContact">Contact Person</label>
                    <input
                      id="clientContact"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewClient ? newClientContact : editClientContact"
                      (ngModelChange)="showNewClient ? (newClientContact = $event) : (editClientContact = $event)"
                      name="clientContact"
                      placeholder="e.g. John Doe"
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="clientEmail">Email</label>
                    <input
                      id="clientEmail"
                      type="email"
                      class="form-control"
                      [ngModel]="showNewClient ? newClientEmail : editClientEmail"
                      (ngModelChange)="showNewClient ? (newClientEmail = $event) : (editClientEmail = $event)"
                      name="clientEmail"
                      placeholder="e.g. contact@company.com"
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="clientPhone">Phone Number</label>
                    <input
                      id="clientPhone"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewClient ? newClientPhone : editClientPhone"
                      (ngModelChange)="showNewClient ? (newClientPhone = $event) : (editClientPhone = $event)"
                      name="clientPhone"
                      placeholder="e.g. +971 50 123 4567"
                    />
                  </div>
                </form>
              }

              <!-- PROJECT ADD / EDIT FORM -->
              @if (showNewProject || selectedProjectForEdit()) {
                <form (ngSubmit)="submitActiveOffcanvas()">
                  @if (projectFormError()) {
                    <div class="alert-guidance alert-warning mb-3" style="padding: 0.6rem 0.8rem; font-size: 0.8125rem;">
                      <span class="material-symbols-outlined icon-sm">warning</span>
                      <span>{{ projectFormError() }}</span>
                    </div>
                  }

                  <div class="form-group mb-3">
                    <label class="form-label" for="projectClientId">Client <span class="req">*</span></label>
                    <select
                      id="projectClientId"
                      class="form-control"
                      [ngModel]="showNewProject ? newProjClientId : editProjClientId"
                      (ngModelChange)="showNewProject ? (newProjClientId = $event) : (editProjClientId = $event)"
                      name="projectClientId"
                      required
                    >
                      <option value="">Select Client</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="projectCode">Project Code <span class="req">*</span></label>
                    <input
                      id="projectCode"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewProject ? newProjCode : editProjCode"
                      (ngModelChange)="showNewProject ? (newProjCode = $event) : (editProjCode = $event)"
                      name="projectCode"
                      placeholder="e.g. PRJ-001"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="projectName">Project Name <span class="req">*</span></label>
                    <input
                      id="projectName"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewProject ? newProjName : editProjName"
                      (ngModelChange)="showNewProject ? (newProjName = $event) : (editProjName = $event)"
                      name="projectName"
                      placeholder="e.g. Downtown Tower Project"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="projectLocation">Location</label>
                    <input
                      id="projectLocation"
                      type="text"
                      class="form-control"
                      [ngModel]="showNewProject ? newProjLocation : editProjLocation"
                      (ngModelChange)="showNewProject ? (newProjLocation = $event) : (editProjLocation = $event)"
                      name="projectLocation"
                      placeholder="e.g. Dubai, UAE"
                    />
                  </div>
                </form>
              }

              <!-- ASSIGNMENT (DEPLOYMENT) FORM -->
              @if (showNewAssignment) {
                <form (ngSubmit)="createAssignment()">
                  <div class="form-group mb-3">
                    <label class="form-label" for="newAssignEmpId">Employee <span class="req">*</span></label>
                    <select
                      id="newAssignEmpId"
                      class="form-control"
                      [(ngModel)]="newAssignEmpId"
                      name="newAssignEmpId"
                      required
                    >
                      <option value="">-- Select Employee --</option>
                      @for (e of employees(); track e.id) {
                        <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newAssignClientId">Commercial Client <span class="req">*</span></label>
                    <select
                      id="newAssignClientId"
                      class="form-control"
                      [(ngModel)]="newAssignClientId"
                      (change)="onAssignClientChange()"
                      name="newAssignClientId"
                      required
                    >
                      <option value="">-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newAssignProjId">Project Worksite <span class="req">*</span></label>
                    <select
                      id="newAssignProjId"
                      class="form-control"
                      [(ngModel)]="newAssignProjId"
                      name="newAssignProjId"
                      required
                    >
                      <option value="">-- Select Worksite --</option>
                      @for (p of filteredProjects(); track p.id) {
                        <option [value]="p.id">{{ p.name }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newAssignDesId">Designated Role <span class="req">*</span></label>
                    <select
                      id="newAssignDesId"
                      class="form-control"
                      [(ngModel)]="newAssignDesId"
                      name="newAssignDesId"
                      required
                    >
                      <option value="">-- Select Designation --</option>
                      @for (d of designations(); track d.id) {
                        <option [value]="d.id">{{ d.title }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newAssignFrom">Effective Start Date <span class="req">*</span></label>
                    <input
                      id="newAssignFrom"
                      type="date"
                      class="form-control"
                      [(ngModel)]="newAssignFrom"
                      name="newAssignFrom"
                      required
                    />
                  </div>
                </form>
              }

              <!-- EDIT ASSIGNMENT FORM -->
              @if (selectedAssignmentForEdit(); as assign) {
                <form (ngSubmit)="saveAssignmentEdit()">
                  <div class="edit-banner mb-3">
                    <div><strong>{{ assign.employeeName }}</strong> ({{ assign.employeeCode }})</div>
                    <small>{{ assign.clientName }} &bull; {{ assign.projectName }} &bull; {{ assign.designationTitle }}</small>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="editAssignEffectiveTo">Effective End Date</label>
                    <input
                      id="editAssignEffectiveTo"
                      type="date"
                      class="form-control"
                      [(ngModel)]="editAssignEffectiveTo"
                      name="editAssignEffectiveTo"
                    />
                    <small class="form-hint">Leave blank for ongoing assignment. Setting past or today will mark it as closed.</small>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="editAssignRemarks">Remarks</label>
                    <textarea
                      id="editAssignRemarks"
                      rows="3"
                      class="form-control"
                      [(ngModel)]="editAssignRemarks"
                      name="editAssignRemarks"
                      placeholder="Optional transfer or demobilization notes..."
                    ></textarea>
                  </div>
                </form>
              }

              <!-- EMPLOYEE HOURLY RATE FORM -->
              @if (showNewEmployeeRate) {
                <form (ngSubmit)="createEmployeeRate()">
                  <div class="form-group mb-3">
                    <label class="form-label" for="newEmpRateEmpId">Employee <span class="req">*</span></label>
                    <select
                      id="newEmpRateEmpId"
                      class="form-control"
                      [(ngModel)]="newEmpRateEmpId"
                      name="newEmpRateEmpId"
                      required
                    >
                      <option value="">-- Select Employee --</option>
                      @for (e of employees(); track e.id) {
                        <option [value]="e.id">{{ e.firstName }} {{ e.lastName }} ({{ e.employeeCode }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newEmpRateNormal">Normal Hourly Pay Rate (AED/hr) <span class="req">*</span></label>
                    <input
                      id="newEmpRateNormal"
                      type="number"
                      step="0.01"
                      min="0"
                      class="form-control"
                      [(ngModel)]="newEmpRateNormal"
                      name="newEmpRateNormal"
                      placeholder="e.g. 25.00"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newEmpRateOt">Overtime Hourly Pay Rate (AED/hr) <span class="req">*</span></label>
                    <input
                      id="newEmpRateOt"
                      type="number"
                      step="0.01"
                      min="0"
                      class="form-control"
                      [(ngModel)]="newEmpRateOt"
                      name="newEmpRateOt"
                      placeholder="e.g. 31.25"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newEmpRateFrom">Effective From <span class="req">*</span></label>
                    <input
                      id="newEmpRateFrom"
                      type="date"
                      class="form-control"
                      [(ngModel)]="newEmpRateFrom"
                      name="newEmpRateFrom"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newEmpRateReason">Reason for Rate / Adjustment</label>
                    <input
                      id="newEmpRateReason"
                      type="text"
                      class="form-control"
                      [(ngModel)]="newEmpRateReason"
                      name="newEmpRateReason"
                      placeholder="e.g. Annual revision, probation completion"
                    />
                  </div>
                </form>
              }

              <!-- CLIENT BILLING RATE FORM -->
              @if (showNewClientRate) {
                <form (ngSubmit)="createClientRate()">
                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateClientId">Commercial Client <span class="req">*</span></label>
                    <select
                      id="newClientRateClientId"
                      class="form-control"
                      [(ngModel)]="newClientRateClientId"
                      (change)="onClientRateClientChange()"
                      name="newClientRateClientId"
                      required
                    >
                      <option value="">-- Select Client --</option>
                      @for (c of clients(); track c.id) {
                        <option [value]="c.id">{{ c.name }} ({{ c.code }})</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateProjId">Project Worksite (Optional)</label>
                    <select
                      id="newClientRateProjId"
                      class="form-control"
                      [(ngModel)]="newClientRateProjId"
                      name="newClientRateProjId"
                    >
                      <option value="">-- Client-Wide Default (All Worksites) --</option>
                      @for (p of clientRateProjects(); track p.id) {
                        <option [value]="p.id">{{ p.name }} (Project-Specific)</option>
                      }
                    </select>
                    <small class="form-hint">Leave blank to establish client-wide default billing rate</small>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateDesId">Designated Role <span class="req">*</span></label>
                    <select
                      id="newClientRateDesId"
                      class="form-control"
                      [(ngModel)]="newClientRateDesId"
                      name="newClientRateDesId"
                      required
                    >
                      <option value="">-- Select Designation --</option>
                      @for (d of designations(); track d.id) {
                        <option [value]="d.id">{{ d.title }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateNormal">Normal Hourly Billing Rate (AED/hr) <span class="req">*</span></label>
                    <input
                      id="newClientRateNormal"
                      type="number"
                      step="0.01"
                      min="0"
                      class="form-control"
                      [(ngModel)]="newClientRateNormal"
                      name="newClientRateNormal"
                      placeholder="e.g. 45.00"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateOt">Overtime Hourly Billing Rate (AED/hr) <span class="req">*</span></label>
                    <input
                      id="newClientRateOt"
                      type="number"
                      step="0.01"
                      min="0"
                      class="form-control"
                      [(ngModel)]="newClientRateOt"
                      name="newClientRateOt"
                      placeholder="e.g. 56.25"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newClientRateFrom">Effective From <span class="req">*</span></label>
                    <input
                      id="newClientRateFrom"
                      type="date"
                      class="form-control"
                      [(ngModel)]="newClientRateFrom"
                      name="newClientRateFrom"
                      required
                    />
                  </div>
                </form>
              }

              <!-- DESIGNATION FORM -->
              @if (showNewDesignation) {
                <form (ngSubmit)="createDesignation()">
                  <div class="form-group mb-3">
                    <label class="form-label" for="newDesCode">Designation Code <span class="req">*</span></label>
                    <input
                      id="newDesCode"
                      type="text"
                      class="form-control"
                      [(ngModel)]="newDesCode"
                      name="newDesCode"
                      placeholder="e.g. DES-PLUMB"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newDesTitle">Job Title <span class="req">*</span></label>
                    <input
                      id="newDesTitle"
                      type="text"
                      class="form-control"
                      [(ngModel)]="newDesTitle"
                      name="newDesTitle"
                      placeholder="e.g. Master Plumber"
                      required
                    />
                  </div>

                  <div class="form-group mb-3">
                    <label class="form-label" for="newDesDesc">Description / Responsibilities</label>
                    <textarea
                      id="newDesDesc"
                      rows="3"
                      class="form-control"
                      [(ngModel)]="newDesDesc"
                      name="newDesDesc"
                      placeholder="Standard responsibilities..."
                    ></textarea>
                  </div>
                </form>
              }

              <!-- SHIFT FORM -->
              @if (showNewShift || selectedShiftForEdit()) {
                <form (ngSubmit)="selectedShiftForEdit() ? saveShiftEdit() : createShift()">
                  @if (shiftFormError()) {
                    <div class="form-error-banner mb-3">
                      <span class="material-symbols-outlined error-icon">error</span>
                      <p class="error-msg">{{ shiftFormError() }}</p>
                    </div>
                  }

                  @if (selectedShiftForEdit()) {
                    <div class="form-group mb-3">
                      <label class="form-label" for="editShiftCode">Shift Code <span class="req">*</span></label>
                      <input
                        id="editShiftCode"
                        type="text"
                        class="form-control"
                        [(ngModel)]="editShiftCode"
                        name="editShiftCode"
                        placeholder="e.g. SH-DAY-8H"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="editShiftName">Shift Name <span class="req">*</span></label>
                      <input
                        id="editShiftName"
                        type="text"
                        class="form-control"
                        [(ngModel)]="editShiftName"
                        name="editShiftName"
                        placeholder="e.g. Standard Morning Shift"
                        required
                      />
                    </div>

                    <div class="form-row-2 mb-3">
                      <div class="form-group">
                        <label class="form-label" for="editShiftStart">Start Time <span class="req">*</span></label>
                        <input
                          id="editShiftStart"
                          type="time"
                          class="form-control"
                          [(ngModel)]="editShiftStart"
                          name="editShiftStart"
                          required
                        />
                      </div>
                      <div class="form-group">
                        <label class="form-label" for="editShiftEnd">End Time <span class="req">*</span></label>
                        <input
                          id="editShiftEnd"
                          type="time"
                          class="form-control"
                          [(ngModel)]="editShiftEnd"
                          name="editShiftEnd"
                          required
                        />
                      </div>
                    </div>

                    <div class="form-row-2 mb-3">
                      <div class="form-group">
                        <label class="form-label" for="editShiftBreak">Break (minutes)</label>
                        <input
                          id="editShiftBreak"
                          type="number"
                          class="form-control"
                          [(ngModel)]="editShiftBreak"
                          name="editShiftBreak"
                          placeholder="60"
                          min="0"
                        />
                      </div>
                      <div class="form-group">
                        <label class="form-label" for="editShiftHours">Work Hours</label>
                        <input
                          id="editShiftHours"
                          type="text"
                          class="form-control"
                          [value]="editShiftWorkHoursDisplay()"
                          disabled
                          readonly
                        />
                        <small class="form-hint">Calculated automatically from start time, end time, and break.</small>
                      </div>
                    </div>
                  } @else {
                    <div class="form-group mb-3">
                      <label class="form-label" for="newShiftCode">Shift Code <span class="req">*</span></label>
                      <input
                        id="newShiftCode"
                        type="text"
                        class="form-control"
                        [(ngModel)]="newShiftCode"
                        name="newShiftCode"
                        placeholder="e.g. SH-DAY-8H"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="newShiftName">Shift Name <span class="req">*</span></label>
                      <input
                        id="newShiftName"
                        type="text"
                        class="form-control"
                        [(ngModel)]="newShiftName"
                        name="newShiftName"
                        placeholder="e.g. Standard Morning Shift"
                        required
                      />
                    </div>

                    <div class="form-row-2 mb-3">
                      <div class="form-group">
                        <label class="form-label" for="newShiftStart">Start Time <span class="req">*</span></label>
                        <input
                          id="newShiftStart"
                          type="time"
                          class="form-control"
                          [(ngModel)]="newShiftStart"
                          name="newShiftStart"
                          required
                        />
                      </div>
                      <div class="form-group">
                        <label class="form-label" for="newShiftEnd">End Time <span class="req">*</span></label>
                        <input
                          id="newShiftEnd"
                          type="time"
                          class="form-control"
                          [(ngModel)]="newShiftEnd"
                          name="newShiftEnd"
                          required
                        />
                      </div>
                    </div>

                    <div class="form-row-2 mb-3">
                      <div class="form-group">
                        <label class="form-label" for="newShiftBreak">Break (minutes)</label>
                        <input
                          id="newShiftBreak"
                          type="number"
                          class="form-control"
                          [(ngModel)]="newShiftBreak"
                          name="newShiftBreak"
                          placeholder="60"
                          min="0"
                        />
                      </div>
                      <div class="form-group">
                        <label class="form-label" for="newShiftHours">Work Hours</label>
                        <input
                          id="newShiftHours"
                          type="text"
                          class="form-control"
                          [value]="newShiftWorkHoursDisplay()"
                          disabled
                          readonly
                        />
                        <small class="form-hint">Calculated automatically from start time, end time, and break.</small>
                      </div>
                    </div>
                  }
                </form>
              }

              <!-- HOLIDAY FORM -->
              @if (showNewHoliday || selectedHolidayForEdit()) {
                <form (ngSubmit)="selectedHolidayForEdit() ? saveHolidayEdit() : createHoliday()">
                  @if (holidayFormError()) {
                    <div class="form-error-banner mb-3">
                      <span class="material-symbols-outlined error-icon">error</span>
                      <p class="error-msg">{{ holidayFormError() }}</p>
                    </div>
                  }

                  @if (selectedHolidayForEdit()) {
                    <div class="form-group mb-3">
                      <label class="form-label" for="editHolidayName">Holiday Name <span class="req">*</span></label>
                      <input
                        id="editHolidayName"
                        type="text"
                        class="form-control"
                        [(ngModel)]="editHolidayName"
                        name="editHolidayName"
                        placeholder="e.g. Independence Day"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="editHolidayDate">Date <span class="req">*</span></label>
                      <input
                        id="editHolidayDate"
                        type="date"
                        class="form-control"
                        [(ngModel)]="editHolidayDate"
                        name="editHolidayDate"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="editHolidayDesc">Description</label>
                      <input
                        id="editHolidayDesc"
                        type="text"
                        class="form-control"
                        [(ngModel)]="editHolidayDesc"
                        name="editHolidayDesc"
                        placeholder="e.g. Indian Independence Day celebration"
                      />
                    </div>
                  } @else {
                    <div class="form-group mb-3">
                      <label class="form-label" for="newHolidayName">Holiday Name <span class="req">*</span></label>
                      <input
                        id="newHolidayName"
                        type="text"
                        class="form-control"
                        [(ngModel)]="newHolidayName"
                        name="newHolidayName"
                        placeholder="e.g. Independence Day"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="newHolidayDate">Date <span class="req">*</span></label>
                      <input
                        id="newHolidayDate"
                        type="date"
                        class="form-control"
                        [(ngModel)]="newHolidayDate"
                        name="newHolidayDate"
                        required
                      />
                    </div>

                    <div class="form-group mb-3">
                      <label class="form-label" for="newHolidayDesc">Description</label>
                      <input
                        id="newHolidayDesc"
                        type="text"
                        class="form-control"
                        [(ngModel)]="newHolidayDesc"
                        name="newHolidayDesc"
                        placeholder="e.g. Indian Independence Day celebration"
                      />
                    </div>
                  }
                </form>
              }
            </div>

            <div class="offcanvas-footer">
              <button type="button" class="btn btn-secondary" (click)="closeOffcanvas()">
                Cancel
              </button>
              <button type="button" class="btn btn-primary" (click)="submitActiveOffcanvas()">
                <span class="material-symbols-outlined icon-sm">check</span>
                <span>{{ offcanvasMeta().submitLabel }}</span>
              </button>
            </div>
          </aside>
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
                  <h2>Clients Master</h2>
                  <p class="subtitle">Manage clients and their associated projects.</p>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Client Name</th>
                      <th>Contact Person</th>
                      <th>Email</th>
                      <th>Phone Number</th>
                      <th>Status</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (c of clients(); track c.id) {
                      <tr>
                        <td><code>{{ c.code }}</code></td>
                        <td><strong>{{ c.name }}</strong></td>
                        <td>{{ c.contactPerson || '—' }}</td>
                        <td>{{ c.email || c.contactEmail || '—' }}</td>
                        <td>{{ c.phoneNumber || c.contactPhone || '—' }}</td>
                        <td>
                          <span class="badge" [class.badge-active]="c.isActive !== false">
                            {{ c.isActive !== false ? 'Active' : 'Inactive' }}
                          </span>
                        </td>
                        <td class="text-right">
                          <div class="action-btn-group">
                            <button
                              type="button"
                              class="btn-action btn-action-edit"
                              (click)="openEditClient(c)"
                              title="Edit Client"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="7" class="empty-state">No clients found. Click 'Add Client' to add a client.</td>
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
                  <h2>Projects Master</h2>
                  <p class="subtitle">Manage client projects and locations.</p>
                </div>
              </div>

              @if (clients().length === 0) {
                <div class="alert-guidance alert-warning">
                  <div class="guidance-icon"><span class="material-symbols-outlined">warning</span></div>
                  <div class="guidance-content">
                    <strong>Prerequisite Missing: Clients</strong>
                    <p>Every Project must belong to a Client. You cannot create a project until at least one Client exists.</p>
                    <div class="guidance-actions">
                      <button type="button" class="btn btn-sm btn-primary" (click)="setTab('clients')">
                        <span class="material-symbols-outlined icon-sm">corporate_fare</span>
                        <span>Go to Clients Master (Step 1)</span>
                      </button>
                    </div>
                  </div>
                </div>
              }

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Project Code</th>
                      <th>Project Name</th>
                      <th>Client</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of projects(); track p.id) {
                      <tr>
                        <td><code>{{ p.code }}</code></td>
                        <td><strong>{{ p.name }}</strong></td>
                        <td>{{ p.clientName || p.clientId }}</td>
                        <td>{{ p.location || p.siteLocation || '—' }}</td>
                        <td>
                          <span class="badge" [class.badge-active]="p.status === 'active'">
                            {{ p.status }}
                          </span>
                        </td>
                        <td class="text-right">
                          <div class="action-btn-group">
                            <button
                              type="button"
                              class="btn-action btn-action-edit"
                              (click)="openEditProject(p)"
                              title="Edit Project"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="6" class="empty-state">
                          @if (clients().length === 0) {
                            <span>No clients exist yet. Create a Client first before adding Projects.</span>
                          } @else {
                            <span>No projects found. Click 'Add Project' to configure a project.</span>
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
                  <h2>Employee Assignments</h2>
                  <p class="subtitle">Assign employees to clients and projects.</p>
                </div>
              </div>

              @if (employees().length === 0 || projects().length === 0 || designations().length === 0) {
                <div class="alert-guidance alert-info">
                  <div class="guidance-icon"><span class="material-symbols-outlined">info</span></div>
                  <div class="guidance-content">
                    <strong>Prerequisites</strong>
                    <p>
                      To create an assignment, you need at least one <strong>Employee</strong>, one <strong>Project</strong>, and one <strong>Designation</strong>.
                    </p>
                    <div class="guidance-actions">
                      @if (employees().length === 0) {
                        <a routerLink="/employees" class="btn btn-sm btn-outline">Add Employee</a>
                      }
                      @if (projects().length === 0) {
                        <button type="button" class="btn btn-sm btn-outline" (click)="setTab('projects')">Create Project</button>
                      }
                      @if (designations().length === 0) {
                        <button type="button" class="btn btn-sm btn-outline" (click)="setTab('designations')">Create Designation</button>
                      }
                    </div>
                  </div>
                </div>
              }

              <!-- Search & Filter Controls -->
              <div class="filter-toolbar">
                <div class="search-box">
                  <span class="material-symbols-outlined icon-sm text-muted">search</span>
                  <input
                    type="text"
                    class="search-input"
                    placeholder="Search assignments by employee, client, project, designation..."
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
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Client</th>
                      <th>Project</th>
                      <th>Designation</th>
                      <th>Start Date</th>
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
                            {{ a.effectiveTo ? 'Closed' : 'Active' }}
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
                              title="Edit Assignment"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                            @if (!a.effectiveTo) {
                              <button
                                type="button"
                                class="btn-action btn-action-danger"
                                (click)="deactivateAssignment(a)"
                                title="Deactivate"
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
                            <span>No employee assignments yet. Click 'Assign Employee' to create one.</span>
                          } @else {
                            <span>No assignments match the current search or filters.</span>
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
              </div>

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
                <a routerLink="/employees" class="btn btn-outline btn-sm">
                  <span class="material-symbols-outlined icon-sm">badge</span>
                  <span>Open Full Directory</span>
                </a>
              </div>

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
                  <h2>Work Shifts</h2>
                  <p class="subtitle">Set the start time, end time, and break for each shift.</p>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Shift Name</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Break</th>
                      <th>Work Hours</th>
                      <th>Night Shift</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (s of shifts(); track s.id) {
                      <tr>
                        <td><code>{{ s.code }}</code></td>
                        <td><strong>{{ s.name }}</strong></td>
                        <td>{{ s.startTime }}</td>
                        <td>{{ s.endTime }}</td>
                        <td>{{ s.breakMinutes }} min</td>
                        <td>{{ s.workHours }} hrs</td>
                        <td>
                          <span class="badge" [class.badge-active]="s.isNightShift">
                            {{ s.isNightShift ? 'Yes' : 'No' }}
                          </span>
                        </td>
                        <td class="text-right">
                          <div class="action-btn-group">
                            <button
                              type="button"
                              class="btn-action btn-action-edit"
                              (click)="openEditShift(s)"
                              title="Edit Work Shift"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="8" class="empty-state">No work shifts found. Click 'Add Work Shift' to create one.</td>
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
                  <h2>Holidays</h2>
                  <p class="subtitle">Manage holidays for your organization.</p>
                </div>
              </div>

              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Holiday Name</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th class="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (h of holidays(); track h.id) {
                      <tr>
                        <td><strong>{{ h.name }}</strong></td>
                        <td>{{ formatHolidayDate(h.holidayDate) }}</td>
                        <td>{{ h.description || '—' }}</td>
                        <td class="text-right">
                          <div class="action-btn-group">
                            <button
                              type="button"
                              class="btn-action btn-action-edit"
                              (click)="openEditHoliday(h)"
                              title="Edit Holiday"
                            >
                              <span class="material-symbols-outlined icon-xs">edit</span>
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="4" class="empty-state">No holidays found. Click 'Add Holiday' to create one.</td>
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

      /* Offcanvas Drawer & Backdrop */
      .offcanvas-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        backdrop-filter: blur(2px);
        z-index: 999;
        animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .offcanvas-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 480px;
        max-width: 100vw;
        background: var(--bg-surface, #ffffff);
        box-shadow: -8px 0 32px rgba(15, 23, 42, 0.2);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
      }

      .offcanvas-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        background: var(--bg-surface, #ffffff);
      }

      .offcanvas-header-left {
        display: flex;
        align-items: center;
        gap: 0.875rem;
      }

      .offcanvas-icon-pill {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-md, 8px);
        background: var(--brand-50, #eff6ff);
        color: var(--brand-600, #2563eb);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .offcanvas-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--text-primary, #0f172a);
        margin: 0;
      }

      .offcanvas-subtitle {
        font-size: 0.8125rem;
        color: var(--text-secondary, #64748b);
        margin: 0.125rem 0 0 0;
      }

      .btn-offcanvas-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: var(--radius-sm, 6px);
        color: var(--text-muted, #94a3b8);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .btn-offcanvas-close:hover {
        background: var(--bg-muted, #f1f5f9);
        color: var(--text-primary, #0f172a);
      }

      .offcanvas-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
      }

      .offcanvas-body .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .offcanvas-body .mb-3 {
        margin-bottom: 1.125rem;
      }

      .offcanvas-body .form-row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
      }

      .offcanvas-body .form-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-primary, #1e293b);
      }

      .offcanvas-body .req {
        color: #ef4444;
        font-weight: 700;
      }

      .offcanvas-body .form-hint {
        font-size: 0.75rem;
        color: var(--text-secondary, #64748b);
        margin-top: 0.125rem;
      }

      .offcanvas-body .form-control {
        width: 100%;
        padding: 0.625rem 0.75rem;
        font-size: 0.875rem;
        border: 1px solid var(--border-color, #cbd5e1);
        border-radius: var(--radius-md, 6px);
        background: #ffffff;
        color: var(--text-primary, #0f172a);
        font-family: inherit;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .offcanvas-body .form-control:focus {
        outline: none;
        border-color: var(--brand-500, #3b82f6);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }

      .edit-banner {
        padding: 0.75rem 1rem;
        background: var(--brand-50, #eff6ff);
        border: 1px solid var(--brand-200, #bfdbfe);
        border-radius: var(--radius-md, 6px);
      }

      .offcanvas-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #e2e8f0);
        background: var(--bg-surface, #ffffff);
      }

      @media (max-width: 640px) {
        .offcanvas-panel {
          width: 100vw;
        }
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

  // New / Edit Client Form State
  public newClientCode = '';
  public newClientName = '';
  public newClientContact = '';
  public newClientEmail = '';
  public newClientPhone = '';
  public selectedClientForEdit = signal<ClientDto | null>(null);
  public editClientCode = '';
  public editClientName = '';
  public editClientContact = '';
  public editClientEmail = '';
  public editClientPhone = '';
  public clientFormError = signal<string | null>(null);

  // New / Edit Project Form State
  public newProjClientId = '';
  public newProjCode = '';
  public newProjName = '';
  public newProjLocation = '';
  public selectedProjectForEdit = signal<ProjectDto | null>(null);
  public editProjClientId = '';
  public editProjCode = '';
  public editProjName = '';
  public editProjLocation = '';
  public projectFormError = signal<string | null>(null);

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

  // New / Edit Shift Form State
  public newShiftCode = '';
  public newShiftName = '';
  public newShiftStart = '08:00';
  public newShiftEnd = '17:00';
  public newShiftBreak = 60;
  public selectedShiftForEdit = signal<ShiftDto | null>(null);
  public editShiftCode = '';
  public editShiftName = '';
  public editShiftStart = '08:00';
  public editShiftEnd = '17:00';
  public editShiftBreak = 60;
  public shiftFormError = signal<string | null>(null);

  // New / Edit Holiday Form State
  public newHolidayYear = 2026;
  public newHolidayName = '';
  public newHolidayDate = '';
  public newHolidayDesc = '';
  public selectedHolidayForEdit = signal<PublicHolidayDto | null>(null);
  public editHolidayName = '';
  public editHolidayDate = '';
  public editHolidayDesc = '';
  public holidayFormError = signal<string | null>(null);

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

  // Filtered Assignments computed signal
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
          breadcrumbPage: 'Employee Assignments',
          title: 'Employee Assignments',
          subtitle: 'Assign employees to clients and projects.',
          ctaLabel: 'Assign Employee',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'clients':
        return {
          breadcrumbGroup: 'ORGANIZATION MASTER',
          breadcrumbPage: 'Clients',
          title: 'Clients',
          subtitle: 'Manage clients and their associated projects.',
          ctaLabel: 'Add Client',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 1,
        };
      case 'projects':
        return {
          breadcrumbGroup: 'ORGANIZATION MASTER',
          breadcrumbPage: 'Projects',
          title: 'Projects',
          subtitle: 'Manage client projects and locations.',
          ctaLabel: 'Add Project',
          ctaIcon: 'add',
          isFlowTab: true,
          flowStep: 2,
        };
      case 'designations':
        return {
          breadcrumbGroup: 'ORGANIZATION MASTER',
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
          breadcrumbGroup: 'ORGANIZATION MASTER',
          breadcrumbPage: 'Work Shift',
          title: 'Work Shift',
          subtitle: 'Manage employee working shifts and hours.',
          ctaLabel: 'Add Work Shift',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'calendar':
        return {
          breadcrumbGroup: 'ORGANIZATION MASTER',
          breadcrumbPage: 'Holidays',
          title: 'Holidays',
          subtitle: 'Manage organization holidays.',
          ctaLabel: 'Add Holiday',
          ctaIcon: 'add',
          isFlowTab: false,
          flowStep: 0,
        };
      case 'salary':
        return {
          breadcrumbGroup: 'ORGANIZATION MASTER',
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
          breadcrumbGroup: 'ORGANIZATION MASTER',
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

  public isOffcanvasOpen(): boolean {
    return (
      this.showNewClient ||
      this.selectedClientForEdit() !== null ||
      this.showNewProject ||
      this.selectedProjectForEdit() !== null ||
      this.showNewAssignment ||
      this.showNewEmployeeRate ||
      this.showNewClientRate ||
      this.showNewDesignation ||
      this.showNewShift ||
      this.selectedShiftForEdit() !== null ||
      this.showNewHoliday ||
      this.selectedHolidayForEdit() !== null ||
      this.selectedAssignmentForEdit() !== null
    );
  }

  public openPrimaryForm(): void {
    this.closeOffcanvas();
    const tab = this.activeTab();
    switch (tab) {
      case 'clients':
        this.showNewClient = true;
        break;
      case 'projects':
        this.showNewProject = true;
        break;
      case 'assignments':
        this.showNewAssignment = true;
        break;
      case 'employee-rates':
        this.showNewEmployeeRate = true;
        break;
      case 'client-rates':
        this.showNewClientRate = true;
        break;
      case 'designations':
        this.showNewDesignation = true;
        break;
      case 'shifts':
        this.showNewShift = true;
        break;
      case 'calendar':
        this.showNewHoliday = true;
        break;
      case 'employees':
        this.router.navigate(['/employees']);
        break;
    }
  }

  public closeOffcanvas(): void {
    this.showNewClient = false;
    this.selectedClientForEdit.set(null);
    this.clientFormError.set(null);
    this.showNewProject = false;
    this.selectedProjectForEdit.set(null);
    this.projectFormError.set(null);
    this.showNewAssignment = false;
    this.showNewEmployeeRate = false;
    this.showNewClientRate = false;
    this.showNewDesignation = false;
    this.showNewShift = false;
    this.selectedShiftForEdit.set(null);
    this.shiftFormError.set(null);
    this.showNewHoliday = false;
    this.selectedHolidayForEdit.set(null);
    this.holidayFormError.set(null);
    this.selectedAssignmentForEdit.set(null);
  }

  public offcanvasMeta(): { title: string; subtitle: string; icon: string; submitLabel: string } {
    if (this.selectedClientForEdit()) {
      return {
        title: 'Edit Client',
        subtitle: 'Update client information',
        icon: 'corporate_fare',
        submitLabel: 'Save Changes',
      };
    }
    if (this.showNewClient) {
      return {
        title: 'Add Client',
        subtitle: 'Add a new client',
        icon: 'corporate_fare',
        submitLabel: 'Save Client',
      };
    }
    if (this.selectedProjectForEdit()) {
      return {
        title: 'Edit Project',
        subtitle: 'Update project information',
        icon: 'folder_open',
        submitLabel: 'Save Changes',
      };
    }
    if (this.showNewProject) {
      return {
        title: 'Add Project',
        subtitle: 'Add a new project',
        icon: 'folder_open',
        submitLabel: 'Save Project',
      };
    }
    if (this.selectedAssignmentForEdit()) {
      return {
        title: 'Edit Assignment',
        subtitle: 'Update effective duration and remarks',
        icon: 'edit_calendar',
        submitLabel: 'Save Changes',
      };
    }
    if (this.showNewAssignment) {
      return {
        title: 'Deploy Workforce Employee',
        subtitle: 'Assign worker to client project & designation',
        icon: 'badge',
        submitLabel: 'Deploy Worker',
      };
    }
    if (this.showNewEmployeeRate) {
      return {
        title: 'Set Employee Pay Rate',
        subtitle: 'Configure internal remuneration cost stream',
        icon: 'payments',
        submitLabel: 'Save Worker Rate',
      };
    }
    if (this.showNewClientRate) {
      return {
        title: 'Set Client Billing Rate',
        subtitle: 'Configure commercial invoice revenue stream',
        icon: 'receipt_long',
        submitLabel: 'Save Invoicing Rate',
      };
    }
    if (this.showNewDesignation) {
      return {
        title: 'Add Job Designation',
        subtitle: 'Create standard role in catalog',
        icon: 'work',
        submitLabel: 'Save Designation',
      };
    }
    if (this.selectedShiftForEdit()) {
      return {
        title: 'Edit Work Shift',
        subtitle: 'Update the shift working hours.',
        icon: 'schedule',
        submitLabel: 'Save Changes',
      };
    }
    if (this.showNewShift) {
      return {
        title: 'Add Work Shift',
        subtitle: 'Set the working hours for this shift.',
        icon: 'schedule',
        submitLabel: 'Save Shift',
      };
    }
    if (this.selectedHolidayForEdit()) {
      return {
        title: 'Edit Holiday',
        subtitle: 'Update holiday information',
        icon: 'event',
        submitLabel: 'Save Changes',
      };
    }
    if (this.showNewHoliday) {
      return {
        title: 'Add Holiday',
        subtitle: 'Add a new holiday',
        icon: 'event',
        submitLabel: 'Save Holiday',
      };
    }
    return {
      title: 'Form',
      subtitle: '',
      icon: 'add',
      submitLabel: 'Submit',
    };
  }

  public submitActiveOffcanvas(): void {
    if (this.selectedClientForEdit()) {
      this.saveClientEdit();
    } else if (this.showNewClient) {
      this.createClient();
    } else if (this.selectedProjectForEdit()) {
      this.saveProjectEdit();
    } else if (this.showNewProject) {
      this.createProject();
    } else if (this.selectedAssignmentForEdit()) {
      this.saveAssignmentEdit();
    } else if (this.showNewAssignment) {
      this.createAssignment();
    } else if (this.showNewEmployeeRate) {
      this.createEmployeeRate();
    } else if (this.showNewClientRate) {
      this.createClientRate();
    } else if (this.showNewDesignation) {
      this.createDesignation();
    } else if (this.selectedShiftForEdit()) {
      this.saveShiftEdit();
    } else if (this.showNewShift) {
      this.createShift();
    } else if (this.selectedHolidayForEdit()) {
      this.saveHolidayEdit();
    } else if (this.showNewHoliday) {
      this.createHoliday();
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
      `Are you sure you want to deactivate the assignment for ${assign.employeeName || 'this employee'}? Effective end date will be set to today.`
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

  public openEditClient(client: ClientDto): void {
    this.closeOffcanvas();
    this.selectedClientForEdit.set(client);
    this.editClientCode = client.code || '';
    this.editClientName = client.name || '';
    this.editClientContact = client.contactPerson || '';
    this.editClientEmail = client.email || client.contactEmail || '';
    this.editClientPhone = client.phoneNumber || client.contactPhone || '';
    this.clientFormError.set(null);
  }

  public createClient(): void {
    this.clientFormError.set(null);
    const code = this.newClientCode.trim();
    const name = this.newClientName.trim();
    const contactPerson = this.newClientContact.trim();
    const email = this.newClientEmail.trim();
    const phoneNumber = this.newClientPhone.trim();

    if (!code) {
      this.clientFormError.set('Client Code is required');
      return;
    }
    if (!name) {
      this.clientFormError.set('Client Name is required');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.clientFormError.set('Please enter a valid email address');
      return;
    }

    this.masterService
      .createClient({
        code,
        name,
        contactPerson: contactPerson || undefined,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
      })
      .subscribe({
        next: () => {
          this.showNewClient = false;
          this.newClientCode = '';
          this.newClientName = '';
          this.newClientContact = '';
          this.newClientEmail = '';
          this.newClientPhone = '';
          this.clientFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.clientFormError.set(err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to create client');
        },
      });
  }

  public saveClientEdit(): void {
    const client = this.selectedClientForEdit();
    if (!client) return;
    this.clientFormError.set(null);

    const code = this.editClientCode.trim();
    const name = this.editClientName.trim();
    const contactPerson = this.editClientContact.trim();
    const email = this.editClientEmail.trim();
    const phoneNumber = this.editClientPhone.trim();

    if (!code) {
      this.clientFormError.set('Client Code is required');
      return;
    }
    if (!name) {
      this.clientFormError.set('Client Name is required');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.clientFormError.set('Please enter a valid email address');
      return;
    }

    this.masterService
      .updateClient(client.id, {
        code,
        name,
        contactPerson: contactPerson || null,
        email: email || null,
        phoneNumber: phoneNumber || null,
      })
      .subscribe({
        next: () => {
          this.selectedClientForEdit.set(null);
          this.clientFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.clientFormError.set(err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to update client');
        },
      });
  }

  public openEditProject(project: ProjectDto): void {
    this.closeOffcanvas();
    this.selectedProjectForEdit.set(project);
    this.editProjClientId = project.clientId || '';
    this.editProjCode = project.code || '';
    this.editProjName = project.name || '';
    this.editProjLocation = project.location || project.siteLocation || '';
    this.projectFormError.set(null);
  }

  public createProject(): void {
    this.projectFormError.set(null);
    const clientId = this.newProjClientId.trim();
    const code = this.newProjCode.trim();
    const name = this.newProjName.trim();
    const location = this.newProjLocation.trim();

    if (!clientId) {
      this.projectFormError.set('Client is required');
      return;
    }
    if (!code) {
      this.projectFormError.set('Project Code is required');
      return;
    }
    if (!name) {
      this.projectFormError.set('Project Name is required');
      return;
    }

    this.masterService
      .createProject({
        clientId,
        code,
        name,
        location: location || undefined,
      })
      .subscribe({
        next: () => {
          this.showNewProject = false;
          this.newProjClientId = '';
          this.newProjCode = '';
          this.newProjName = '';
          this.newProjLocation = '';
          this.projectFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.projectFormError.set(err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to create project');
        },
      });
  }

  public saveProjectEdit(): void {
    const project = this.selectedProjectForEdit();
    if (!project) return;
    this.projectFormError.set(null);

    const clientId = this.editProjClientId.trim();
    const code = this.editProjCode.trim();
    const name = this.editProjName.trim();
    const location = this.editProjLocation.trim();

    if (!clientId) {
      this.projectFormError.set('Client is required');
      return;
    }
    if (!code) {
      this.projectFormError.set('Project Code is required');
      return;
    }
    if (!name) {
      this.projectFormError.set('Project Name is required');
      return;
    }

    this.masterService
      .updateProject(project.id, {
        clientId,
        code,
        name,
        location: location || null,
      })
      .subscribe({
        next: () => {
          this.selectedProjectForEdit.set(null);
          this.projectFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.projectFormError.set(err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to update project');
        },
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

  public calculateShiftWorkHours(start: string, end: string, breakMins: number): {
    workHours: number | null;
    isNightShift: boolean;
    errorMessage: string | null;
  } {
    if (!start || !end) return { workHours: null, isNightShift: false, errorMessage: null };
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startMins = (sH || 0) * 60 + (sM || 0);
    const endMins = (eH || 0) * 60 + (eM || 0);

    if (startMins === endMins) {
      return {
        workHours: null,
        isNightShift: false,
        errorMessage: 'Start time and end time cannot be the same.',
      };
    }

    let durationMins = endMins - startMins;
    const isNightShift = endMins < startMins;
    if (isNightShift) {
      durationMins += 1440;
    }

    const cleanBreak = breakMins !== undefined && !isNaN(Number(breakMins)) ? Number(breakMins) : 0;
    if (cleanBreak < 0) {
      return {
        workHours: null,
        isNightShift,
        errorMessage: 'Break time cannot be negative.',
      };
    }
    if (cleanBreak >= durationMins) {
      return {
        workHours: null,
        isNightShift,
        errorMessage: 'Break time cannot be greater than the shift duration.',
      };
    }

    const netMins = durationMins - cleanBreak;
    const hours = Math.round((netMins / 60) * 100) / 100;
    return {
      workHours: hours,
      isNightShift,
      errorMessage: null,
    };
  }

  public newShiftWorkHoursDisplay(): string {
    const res = this.calculateShiftWorkHours(this.newShiftStart, this.newShiftEnd, this.newShiftBreak);
    if (res.workHours !== null) return `${res.workHours.toFixed(2)} hrs`;
    return '—';
  }

  public editShiftWorkHoursDisplay(): string {
    const res = this.calculateShiftWorkHours(this.editShiftStart, this.editShiftEnd, this.editShiftBreak);
    if (res.workHours !== null) return `${res.workHours.toFixed(2)} hrs`;
    return '—';
  }

  public openEditShift(s: ShiftDto): void {
    this.closeOffcanvas();
    this.selectedShiftForEdit.set(s);
    this.editShiftCode = s.code;
    this.editShiftName = s.name;
    this.editShiftStart = s.startTime?.slice(0, 5) || '08:00';
    this.editShiftEnd = s.endTime?.slice(0, 5) || '17:00';
    this.editShiftBreak = s.breakMinutes !== undefined ? s.breakMinutes : 60;
    this.shiftFormError.set(null);
  }

  public saveShiftEdit(): void {
    const shift = this.selectedShiftForEdit();
    if (!shift) return;
    this.shiftFormError.set(null);

    const code = this.editShiftCode.trim();
    const name = this.editShiftName.trim();
    const startTime = this.editShiftStart;
    const endTime = this.editShiftEnd;
    const breakMinutes = Number(this.editShiftBreak) >= 0 ? Number(this.editShiftBreak) : 0;

    if (!code) {
      this.shiftFormError.set('Shift Code is required');
      return;
    }
    if (!name) {
      this.shiftFormError.set('Shift Name is required');
      return;
    }
    if (!startTime || !endTime) {
      this.shiftFormError.set('Start Time and End Time are required');
      return;
    }

    const metrics = this.calculateShiftWorkHours(startTime, endTime, breakMinutes);
    if (metrics.errorMessage) {
      this.shiftFormError.set(metrics.errorMessage);
      return;
    }

    this.masterService
      .updateShift(shift.id, {
        code,
        name,
        startTime,
        endTime,
        breakMinutes,
        workHours: metrics.workHours || 0,
      })
      .subscribe({
        next: () => {
          this.selectedShiftForEdit.set(null);
          this.shiftFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.shiftFormError.set(
            err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to update shift'
          );
        },
      });
  }

  public createShift(): void {
    this.shiftFormError.set(null);
    const code = this.newShiftCode.trim();
    const name = this.newShiftName.trim();
    const startTime = this.newShiftStart;
    const endTime = this.newShiftEnd;
    const breakMinutes = Number(this.newShiftBreak) >= 0 ? Number(this.newShiftBreak) : 0;

    if (!code) {
      this.shiftFormError.set('Shift Code is required');
      return;
    }
    if (!name) {
      this.shiftFormError.set('Shift Name is required');
      return;
    }
    if (!startTime || !endTime) {
      this.shiftFormError.set('Start Time and End Time are required');
      return;
    }

    const metrics = this.calculateShiftWorkHours(startTime, endTime, breakMinutes);
    if (metrics.errorMessage) {
      this.shiftFormError.set(metrics.errorMessage);
      return;
    }

    this.masterService
      .createShift({
        code,
        name,
        startTime,
        endTime,
        breakMinutes,
        workHours: metrics.workHours || 0,
      })
      .subscribe({
        next: () => {
          this.showNewShift = false;
          this.newShiftCode = '';
          this.newShiftName = '';
          this.newShiftStart = '08:00';
          this.newShiftEnd = '17:00';
          this.newShiftBreak = 60;
          this.shiftFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.shiftFormError.set(
            err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to create shift'
          );
        },
      });
  }

  public formatHolidayDate(dateStr: string): string {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = parts[2].padStart(2, '0');
      const monthIdx = parseInt(parts[1], 10) - 1;
      const month = months[monthIdx] || parts[1];
      const year = parts[0];
      return `${day} ${month} ${year}`;
    }
    return dateStr;
  }

  public openEditHoliday(h: PublicHolidayDto): void {
    this.closeOffcanvas();
    this.selectedHolidayForEdit.set(h);
    this.editHolidayName = h.name;
    this.editHolidayDate = h.holidayDate;
    this.editHolidayDesc = h.description || '';
    this.holidayFormError.set(null);
  }

  public saveHolidayEdit(): void {
    const holiday = this.selectedHolidayForEdit();
    if (!holiday) return;
    this.holidayFormError.set(null);

    const name = this.editHolidayName.trim();
    const date = this.editHolidayDate;
    const desc = this.editHolidayDesc.trim();

    if (!name) {
      this.holidayFormError.set('Holiday Name is required');
      return;
    }
    if (!date) {
      this.holidayFormError.set('Date is required');
      return;
    }

    const year = Number(date.split('-')[0]) || holiday.calendarYear;

    this.masterService
      .updatePublicHoliday(holiday.id, {
        name,
        holidayDate: date,
        calendarYear: year,
        description: desc || null,
      })
      .subscribe({
        next: () => {
          this.selectedHolidayForEdit.set(null);
          this.holidayFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.holidayFormError.set(
            err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to update holiday'
          );
        },
      });
  }

  public createHoliday(): void {
    this.holidayFormError.set(null);
    const name = this.newHolidayName.trim();
    const date = this.newHolidayDate;
    const desc = this.newHolidayDesc.trim();

    if (!name) {
      this.holidayFormError.set('Holiday Name is required');
      return;
    }
    if (!date) {
      this.holidayFormError.set('Date is required');
      return;
    }

    const year = Number(date.split('-')[0]) || Number(this.newHolidayYear) || new Date().getFullYear();

    this.masterService
      .createPublicHoliday({
        calendarYear: year,
        name,
        holidayDate: date,
        description: desc || null,
      })
      .subscribe({
        next: () => {
          this.showNewHoliday = false;
          this.newHolidayName = '';
          this.newHolidayDate = '';
          this.newHolidayDesc = '';
          this.holidayFormError.set(null);
          this.refreshAll();
        },
        error: (err) => {
          this.holidayFormError.set(
            err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to create holiday'
          );
        },
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
