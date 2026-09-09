import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/services/leave.service';
import { MasterService } from '../../core/services/master.service';
import {
  LeaveTypeDto,
  CreateLeaveTypeDto,
  EmployeeLeaveBalanceDto,
  AllocateLeaveBalanceDto,
  LeaveRequestDto,
  EmployeeDto,
} from '@blue-royal/contracts';

import { AppShellComponent } from '../../core/layout/app-shell.component';

type ActiveTab = 'requests' | 'types' | 'balances';

@Component({
  selector: 'app-leave-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="leave-hub-container">
      <!-- Header -->
      <div class="hub-header">
        <div>
          <h2>Leave Management & Entitlements Hub</h2>
          <p class="subtitle">
            Enterprise leave approval pipeline, policy configurations, and annual employee entitlement allocations.
          </p>
        </div>
        <div class="tab-buttons">
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'requests'"
            (click)="activeTab.set('requests')"
          >
            Leave Requests
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'balances'"
            (click)="activeTab.set('balances')"
          >
            Employee Balances
          </button>
          <button
            class="tab-btn"
            [class.active]="activeTab() === 'types'"
            (click)="activeTab.set('types')"
          >
            Leave Types Catalog
          </button>
        </div>
      </div>

      <!-- Alerts -->
      @if (errorMessage()) {
        <div class="alert alert-danger">
          {{ errorMessage() }}
          <button class="alert-close" (click)="errorMessage.set(null)">×</button>
        </div>
      }
      @if (successMessage()) {
        <div class="alert alert-success">
          {{ successMessage() }}
          <button class="alert-close" (click)="successMessage.set(null)">×</button>
        </div>
      }

      <!-- TAB 1: LEAVE REQUESTS -->
      @if (activeTab() === 'requests') {
        <div class="panel">
          <div class="panel-bar">
            <div class="filter-group">
              <label>Status Filter:</label>
              <select [(ngModel)]="statusFilter" (change)="loadRequests()" class="form-select">
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <button (click)="loadRequests()" class="btn btn-secondary">Refresh</button>
          </div>

          @if (loadingRequests()) {
            <div class="loading">Loading leave applications...</div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Request #</th>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Date Range</th>
                    <th>Duration</th>
                    <th class="col-hide-mobile">Reason</th>
                    <th>Status</th>
                    <th class="col-sticky-right text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of requests(); track r.id) {
                    <tr>
                      <td class="col-sticky-left">
                        <span class="req-number">{{ r.requestNumber }}</span>
                      </td>
                      <td>
                        <strong>{{ r.employee?.firstName }} {{ r.employee?.lastName }}</strong>
                        <div class="sub-text">{{ r.employee?.employeeCode }}</div>
                      </td>
                      <td>
                        <span class="tag-type">{{ r.leaveType?.name }}</span>
                      </td>
                      <td>
                        <strong>{{ r.startDate }}</strong> ➔ <strong>{{ r.endDate }}</strong>
                      </td>
                      <td>
                        <strong>{{ r.totalDays }}</strong> day(s)
                      </td>
                      <td class="cell-reason col-hide-mobile" [title]="r.reason">{{ r.reason }}</td>
                      <td>
                        <span class="badge" [ngClass]="getStatusClass(r.status)">{{ r.status }}</span>
                        @if (r.status === 'REJECTED' && r.rejectionReason) {
                          <div class="rejection-hint" [title]="r.rejectionReason">
                            {{ r.rejectionReason }}
                          </div>
                        }
                      </td>
                      <td class="actions-cell col-sticky-right text-right">
                        @if (r.status === 'PENDING') {
                          <button (click)="approveRequest(r)" class="btn btn-sm btn-success">
                            <span class="material-symbols-outlined icon-sm">check</span>
                            <span>Approve</span>
                          </button>
                          <button (click)="openRejectModal(r)" class="btn btn-sm btn-danger">
                            <span class="material-symbols-outlined icon-sm">close</span>
                            <span>Reject</span>
                          </button>
                        } @else if (r.status === 'APPROVED') {
                          <button (click)="openRevokeModal(r)" class="btn btn-sm btn-danger-outline">
                            <span class="material-symbols-outlined icon-sm">undo</span>
                            <span>Revoke</span>
                          </button>
                        } @else {
                          <span class="text-muted">—</span>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="empty-cell">No leave requests found matching filters.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- TAB 2: EMPLOYEE BALANCES -->
      @if (activeTab() === 'balances') {
        <div class="panel">
          <div class="panel-bar">
            <div class="filter-group">
              <label>Year:</label>
              <select [(ngModel)]="balanceYearFilter" (change)="loadBalances()" class="form-select">
                <option [value]="2025">2025</option>
                <option [value]="2026">2026</option>
                <option [value]="2027">2027</option>
              </select>
            </div>
            <button (click)="openAllocateModal()" class="btn btn-primary">
              <span class="material-symbols-outlined icon-sm">add</span>
              <span>Allocate / Adjust Balance</span>
            </button>
          </div>

          @if (loadingBalances()) {
            <div class="loading">Loading employee leave balances...</div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Year</th>
                  <th>Allocated</th>
                  <th>Carried Fwd</th>
                  <th>Used</th>
                  <th>Pending</th>
                  <th>Available Rem.</th>
                </tr>
              </thead>
              <tbody>
                @for (b of balances(); track b.id) {
                  <tr>
                    <td>
                      <strong>{{ b.employee?.firstName }} {{ b.employee?.lastName }}</strong>
                      <div class="sub-text">{{ b.employee?.employeeCode }}</div>
                    </td>
                    <td>
                      <span class="tag-type">{{ b.leaveType?.name }}</span>
                    </td>
                    <td>{{ b.year }}</td>
                    <td>{{ b.allocatedDays | number: '1.2-2' }}</td>
                    <td>+{{ b.carriedForward | number: '1.2-2' }}</td>
                    <td class="text-indigo">{{ b.usedDays | number: '1.2-2' }}</td>
                    <td class="text-amber">{{ b.pendingDays | number: '1.2-2' }}</td>
                    <td>
                      <strong class="text-emerald">{{ b.remainingDays | number: '1.2-2' }}</strong>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="empty-cell">No employee balances configured for this year.</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }

      <!-- TAB 3: LEAVE TYPES CATALOG -->
      @if (activeTab() === 'types') {
        <div class="panel">
          <div class="panel-bar">
            <div>
              <h3>Configured Leave Types</h3>
            </div>
            <button (click)="openCreateTypeModal()" class="btn btn-primary">
              <span class="material-symbols-outlined icon-sm">add</span>
              <span>Add Leave Type</span>
            </button>
          </div>

          @if (loadingTypes()) {
            <div class="loading">Loading leave types catalog...</div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Is Paid</th>
                  <th>Default Days/Yr</th>
                  <th>Working Days Only</th>
                  <th>Probation Allowed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (t of leaveTypes(); track t.id) {
                  <tr>
                    <td>
                      <code>{{ t.code }}</code>
                    </td>
                    <td>
                      <strong>{{ t.name }}</strong>
                      <div class="sub-text">{{ t.description || 'No description' }}</div>
                    </td>
                    <td>
                      <span class="badge" [class.badge-paid]="t.isPaid" [class.badge-unpaid]="!t.isPaid">
                        {{ t.isPaid ? 'Paid' : 'Unpaid' }}
                      </span>
                    </td>
                    <td>{{ t.defaultDaysPerYear | number: '1.2-2' }} days</td>
                    <td>{{ t.deductWorkingDaysOnly ? 'Yes (skip weekend)' : 'No (calendar days)' }}</td>
                    <td>{{ t.allowDuringProbation ? 'Yes' : 'No' }}</td>
                    <td>
                      <span class="badge badge-active">{{ t.isActive ? 'Active' : 'Inactive' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }

      <!-- Consequential Dialog: Reject Leave Application -->
      @if (showRejectModal()) {
        <div class="dialog-backdrop" (click)="closeRejectModal()">
          <div class="dialog-box dialog-danger" (click)="$event.stopPropagation()">
            <div class="dialog-header">
              <div class="dialog-header-content">
                <div class="dialog-icon danger">
                  <span class="material-symbols-outlined">cancel</span>
                </div>
                <div>
                  <h3 class="dialog-title">Reject Leave Application</h3>
                  <p class="dialog-subtitle">Specify regulatory or staffing rationale for denial</p>
                </div>
              </div>
              <button type="button" class="dialog-close" (click)="closeRejectModal()">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <label for="rejReason">Rejection Reason * (Min 5 chars)</label>
                <textarea
                  id="rejReason"
                  [(ngModel)]="rejectionReasonText"
                  rows="3"
                  placeholder="Detail the regulatory / operational reason for rejecting this leave..."
                  class="form-control"
                ></textarea>
              </div>
            </div>
            <div class="dialog-footer">
              <button type="button" (click)="closeRejectModal()" class="btn btn-secondary">Dismiss</button>
              <button
                type="button"
                (click)="confirmReject()"
                [disabled]="rejectionReasonText.trim().length < 5"
                class="btn btn-danger"
              >
                <span class="material-symbols-outlined icon-sm">block</span>
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Consequential Dialog: Revoke Approved Leave -->
      @if (showRevokeModal()) {
        <div class="dialog-backdrop" (click)="closeRevokeModal()">
          <div class="dialog-box dialog-danger" (click)="$event.stopPropagation()">
            <div class="dialog-header">
              <div class="dialog-header-content">
                <div class="dialog-icon danger">
                  <span class="material-symbols-outlined">history</span>
                </div>
                <div>
                  <h3 class="dialog-title">Revoke Approved Leave</h3>
                  <p class="dialog-subtitle">Attendance status will be reset back to normal tracking</p>
                </div>
              </div>
              <button type="button" class="dialog-close" (click)="closeRevokeModal()">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <label for="revReason">Cancellation Reason *</label>
                <textarea
                  id="revReason"
                  [(ngModel)]="revokeReasonText"
                  rows="3"
                  placeholder="Reason for revoking approved leave (attendance records will be reset)..."
                  class="form-control"
                ></textarea>
              </div>
            </div>
            <div class="dialog-footer">
              <button type="button" (click)="closeRevokeModal()" class="btn btn-secondary">Dismiss</button>
              <button
                type="button"
                (click)="confirmRevoke()"
                [disabled]="revokeReasonText.trim().length < 5"
                class="btn btn-danger"
              >
                <span class="material-symbols-outlined icon-sm">undo</span>
                <span>Revoke Leave</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Contextual Drawer: Allocate Balance -->
      @if (showAllocateModal()) {
        <div class="drawer-backdrop" (click)="closeAllocateModal()">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">Allocate / Adjust Leave Balance</h2>
                <p class="drawer-subtitle">Configure statutory or contractual annual leave quota</p>
              </div>
              <button type="button" class="drawer-close" (click)="closeAllocateModal()" aria-label="Close drawer">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="drawer-body">
              <form (ngSubmit)="confirmAllocate()" id="allocateForm">
                <div class="form-section">
                  <div class="form-section-title">
                    <span class="material-symbols-outlined icon-sm">person</span>
                    <span>Employee & Category</span>
                  </div>
                  <div class="form-group">
                    <label for="allocEmp">Employee *</label>
                    <select id="allocEmp" [(ngModel)]="allocateForm.employeeId" name="employeeId" required class="form-control">
                      <option value="">-- Select Employee --</option>
                      @for (e of employees(); track e.id) {
                        <option [value]="e.id">{{ e.employeeCode }} — {{ e.firstName }} {{ e.lastName }}</option>
                      }
                    </select>
                  </div>

                  <div class="form-group">
                    <label for="allocType">Leave Type *</label>
                    <select id="allocType" [(ngModel)]="allocateForm.leaveTypeId" name="leaveTypeId" required class="form-control">
                      <option value="">-- Select Leave Category --</option>
                      @for (lt of leaveTypes(); track lt.id) {
                        <option [value]="lt.id">{{ lt.name }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="form-section">
                  <div class="form-section-title">
                    <span class="material-symbols-outlined icon-sm">event_repeat</span>
                    <span>Entitlement Quota</span>
                  </div>
                  <div class="form-grid-2">
                    <div class="form-group">
                      <label for="allocYear">Calendar Year *</label>
                      <input
                        id="allocYear"
                        type="number"
                        [(ngModel)]="allocateForm.year"
                        name="year"
                        required
                        class="form-control"
                      />
                    </div>
                    <div class="form-group">
                      <label for="allocDays">Allocated Days *</label>
                      <input
                        id="allocDays"
                        type="number"
                        step="0.5"
                        [(ngModel)]="allocateForm.allocatedDays"
                        name="allocatedDays"
                        required
                        class="form-control"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="allocCarry">Carried Forward Days</label>
                    <input
                      id="allocCarry"
                      type="number"
                      step="0.5"
                      [(ngModel)]="allocateForm.carriedForward"
                      name="carriedForward"
                      class="form-control"
                    />
                  </div>

                  <div class="form-group">
                    <label for="allocNotes">Operational Notes</label>
                    <input
                      id="allocNotes"
                      type="text"
                      [(ngModel)]="allocateForm.notes"
                      name="notes"
                      placeholder="Optional allocation note or policy reference"
                      class="form-control"
                    />
                  </div>
                </div>
              </form>
            </div>
            <div class="drawer-footer">
              <button type="button" (click)="closeAllocateModal()" class="btn btn-secondary">
                Dismiss
              </button>
              <button type="submit" form="allocateForm" class="btn btn-primary">
                <span class="material-symbols-outlined icon-sm">save</span>
                <span>Save Balance</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Contextual Drawer: Create Leave Type -->
      @if (showCreateTypeModal()) {
        <div class="drawer-backdrop" (click)="closeCreateTypeModal()">
          <div class="drawer-panel" (click)="$event.stopPropagation()">
            <div class="drawer-header">
              <div class="drawer-header-content">
                <h2 class="drawer-title">Create Leave Type</h2>
                <p class="drawer-subtitle">Define policy rules, deduction criteria, and defaults</p>
              </div>
              <button type="button" class="drawer-close" (click)="closeCreateTypeModal()" aria-label="Close drawer">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="drawer-body">
              <form (ngSubmit)="confirmCreateType()" id="createTypeForm">
                <div class="form-section">
                  <div class="form-section-title">
                    <span class="material-symbols-outlined icon-sm">category</span>
                    <span>General Classification</span>
                  </div>
                  <div class="form-grid-2">
                    <div class="form-group">
                      <label for="typeCode">Code * (e.g. ANNUAL)</label>
                      <input
                        id="typeCode"
                        type="text"
                        [(ngModel)]="createTypeForm.code"
                        name="code"
                        required
                        class="form-control"
                      />
                    </div>
                    <div class="form-group">
                      <label for="typeName">Name *</label>
                      <input
                        id="typeName"
                        type="text"
                        [(ngModel)]="createTypeForm.name"
                        name="name"
                        required
                        class="form-control"
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="typeDesc">Description</label>
                    <textarea
                      id="typeDesc"
                      [(ngModel)]="createTypeForm.description"
                      name="description"
                      rows="2"
                      placeholder="Policy rules and eligibility requirements..."
                      class="form-control"
                    ></textarea>
                  </div>
                </div>

                <div class="form-section">
                  <div class="form-section-title">
                    <span class="material-symbols-outlined icon-sm">rule</span>
                    <span>Entitlement & Rules</span>
                  </div>
                  <div class="form-group">
                    <label for="typeDays">Default Days / Year</label>
                    <input
                      id="typeDays"
                      type="number"
                      step="0.5"
                      [(ngModel)]="createTypeForm.defaultDaysPerYear"
                      name="defaultDaysPerYear"
                      class="form-control"
                    />
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.75rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                      <input
                        type="checkbox"
                        [(ngModel)]="createTypeForm.isPaid"
                        name="isPaid"
                      />
                      <span>Is Paid Leave (Remunerated)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                      <input
                        type="checkbox"
                        [(ngModel)]="createTypeForm.deductWorkingDaysOnly"
                        name="deductWorkingDaysOnly"
                      />
                      <span>Deduct Working Days Only (Skip weekends & statutory holidays)</span>
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div class="drawer-footer">
              <button type="button" (click)="closeCreateTypeModal()" class="btn btn-secondary">
                Dismiss
              </button>
              <button type="submit" form="createTypeForm" class="btn btn-primary">
                <span class="material-symbols-outlined icon-sm">check</span>
                <span>Create Type</span>
              </button>
            </div>
          </div>
        </div>
      }
      </div>
    </app-shell>
  `,
  styles: [
    `
      .leave-hub-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .hub-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--border-default);
        padding-bottom: 1.25rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .hub-header h2 {
        margin: 0 0 0.25rem 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .subtitle {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.8125rem;
      }
      .tab-buttons {
        display: flex;
        gap: 0.375rem;
        background: #ffffff;
        padding: 0.375rem;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
      }
      .tab-btn {
        padding: 0.45rem 0.875rem;
        border-radius: var(--radius-md);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-secondary);
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
      }
      .tab-btn:hover {
        background: var(--bg-surface-subtle);
        color: var(--text-primary);
        border-color: var(--border-default);
        transform: translateY(-1px);
      }
      .tab-btn:active {
        transform: translateY(0);
      }
      .tab-btn.active {
        background: var(--brand-50);
        color: var(--brand-700);
        border-color: var(--brand-200);
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(29, 78, 216, 0.1);
      }
      .panel {
        background: #ffffff;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
      }
      .panel-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-surface-alt);
      }
      .filter-group {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        font-weight: 500;
      }
      .form-select {
        padding: 6px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-size: 13px;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      .data-table th {
        background: var(--color-surface-alt);
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: var(--color-text-secondary);
        border-bottom: 1px solid var(--color-border);
      }
      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-hover);
        color: var(--color-text-primary);
      }
      .req-number {
        font-family: monospace;
        font-weight: 600;
        color: var(--color-info);
      }
      .tag-type {
        background: var(--color-hover);
        color: var(--color-text-primary);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .sub-text {
        font-size: 12px;
        color: var(--color-disabled);
      }
      .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .status-pending {
        background: var(--color-warning-bg);
        color: var(--color-warning-text);
      }
      .status-approved {
        background: var(--color-success-bg);
        color: var(--color-success-text);
      }
      .status-rejected {
        background: var(--color-danger-bg);
        color: var(--color-danger-text);
      }
      .status-cancelled {
        background: var(--color-hover);
        color: var(--color-text-muted);
      }
      .badge-paid {
        background: var(--color-primary-light);
        color: var(--color-info);
      }
      .badge-unpaid {
        background: var(--color-danger-bg);
        color: var(--color-danger-text);
      }
      .badge-active {
        background: var(--color-success-bg);
        color: var(--color-success-text);
      }
      .text-emerald {
        color: #059669;
      }
      .text-indigo {
        color: var(--color-info);
      }
      .text-amber {
        color: var(--color-warning);
      }
      .actions-cell {
        display: flex;
        gap: 6px;
      }
      .empty-cell {
        text-align: center;
        padding: 32px;
        color: var(--color-disabled);
        font-style: italic;
      }
      .loading {
        text-align: center;
        padding: 32px;
        color: var(--color-text-muted);
      }
      .alert {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .alert-danger {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        border: 1px solid #fecaca;
      }
      .alert-success {
        background: var(--color-success-bg);
        color: var(--color-success-text);
        border: 1px solid #bbf7d0;
      }
      .alert-close {
        background: transparent;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: inherit;
      }
      /* Modals */
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(15, 23, 42, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .modal-card {
        background: var(--color-surface);
        border-radius: 12px;
        width: 100%;
        max-width: 520px;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: var(--color-text-primary);
      }
      .close-btn {
        background: transparent;
        border: none;
        font-size: 24px;
        color: var(--color-disabled);
        cursor: pointer;
      }
      .form-group {
        margin-bottom: 14px;
      }
      .form-row {
        display: flex;
        gap: 14px;
      }
      .col {
        flex: 1;
      }
      .form-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin-bottom: 6px;
      }
      .form-control {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }
      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        justify-content: center;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
      .cell-reason {
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rejection-hint {
        font-size: 11px;
        color: var(--color-danger);
        font-style: italic;
      }
    `,
  ],
})
export class LeaveHubComponent implements OnInit {
  public activeTab = signal<ActiveTab>('requests');

  public loadingRequests = signal(false);
  public loadingBalances = signal(false);
  public loadingTypes = signal(false);

  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  // Tab 1: Requests
  public requests = signal<LeaveRequestDto[]>([]);
  public statusFilter = '';
  public selectedRequestForAction: LeaveRequestDto | null = null;
  public showRejectModal = signal(false);
  public rejectionReasonText = '';
  public showRevokeModal = signal(false);
  public revokeReasonText = '';

  // Tab 2: Balances
  public balances = signal<EmployeeLeaveBalanceDto[]>([]);
  public balanceYearFilter = 2026;
  public showAllocateModal = signal(false);
  public allocateForm: AllocateLeaveBalanceDto = {
    employeeId: '',
    leaveTypeId: '',
    year: 2026,
    allocatedDays: 30.0,
    carriedForward: 0.0,
    notes: '',
  };

  // Tab 3: Leave Types
  public leaveTypes = signal<LeaveTypeDto[]>([]);
  public showCreateTypeModal = signal(false);
  public createTypeForm: CreateLeaveTypeDto = {
    code: '',
    name: '',
    description: '',
    isPaid: true,
    defaultDaysPerYear: 30.0,
    deductWorkingDaysOnly: true,
    allowDuringProbation: false,
  };

  public employees = signal<EmployeeDto[]>([]);

  constructor(
    private leaveService: LeaveService,
    private masterService: MasterService,
  ) {}

  public ngOnInit(): void {
    this.loadRequests();
    this.loadBalances();
    this.loadLeaveTypes();
    this.loadEmployees();
  }

  // ================= Requests =================
  public loadRequests(): void {
    this.loadingRequests.set(true);
    const query: any = {};
    if (this.statusFilter) query.status = this.statusFilter;

    this.leaveService.listRequests(query).subscribe({
      next: (res) => {
        this.requests.set(res.data);
        this.loadingRequests.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load leave requests');
        this.loadingRequests.set(false);
      },
    });
  }

  public approveRequest(req: LeaveRequestDto): void {
    if (!confirm(`Approve leave application ${req.requestNumber} for ${req.employee?.firstName}?`)) {
      return;
    }

    this.leaveService.approveRequest(req.id).subscribe({
      next: () => {
        this.successMessage.set(`Leave application ${req.requestNumber} approved successfully`);
        this.loadRequests();
        this.loadBalances();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to approve leave request');
      },
    });
  }

  public openRejectModal(req: LeaveRequestDto): void {
    this.selectedRequestForAction = req;
    this.rejectionReasonText = '';
    this.showRejectModal.set(true);
  }

  public closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.selectedRequestForAction = null;
  }

  public confirmReject(): void {
    if (!this.selectedRequestForAction) return;

    this.leaveService
      .rejectRequest(this.selectedRequestForAction.id, this.rejectionReasonText)
      .subscribe({
        next: () => {
          this.successMessage.set(
            `Leave application ${this.selectedRequestForAction?.requestNumber} rejected`,
          );
          this.closeRejectModal();
          this.loadRequests();
          this.loadBalances();
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error?.message || 'Failed to reject leave request');
        },
      });
  }

  public openRevokeModal(req: LeaveRequestDto): void {
    this.selectedRequestForAction = req;
    this.revokeReasonText = '';
    this.showRevokeModal.set(true);
  }

  public closeRevokeModal(): void {
    this.showRevokeModal.set(false);
    this.selectedRequestForAction = null;
  }

  public confirmRevoke(): void {
    if (!this.selectedRequestForAction) return;

    this.leaveService
      .cancelRequest(this.selectedRequestForAction.id, this.revokeReasonText)
      .subscribe({
        next: () => {
          this.successMessage.set(
            `Leave application ${this.selectedRequestForAction?.requestNumber} revoked`,
          );
          this.closeRevokeModal();
          this.loadRequests();
          this.loadBalances();
        },
        error: (err) => {
          this.errorMessage.set(err.error?.error?.message || 'Failed to revoke leave request');
        },
      });
  }

  // ================= Balances =================
  public loadBalances(): void {
    this.loadingBalances.set(true);
    this.leaveService.listBalances({ year: this.balanceYearFilter }).subscribe({
      next: (res) => {
        this.balances.set(res.data);
        this.loadingBalances.set(false);
      },
      error: () => {
        this.loadingBalances.set(false);
      },
    });
  }

  public openAllocateModal(): void {
    this.allocateForm = {
      employeeId: this.employees().length > 0 ? this.employees()[0].id : '',
      leaveTypeId: this.leaveTypes().length > 0 ? this.leaveTypes()[0].id : '',
      year: this.balanceYearFilter,
      allocatedDays: 30.0,
      carriedForward: 0.0,
      notes: '',
    };
    this.showAllocateModal.set(true);
  }

  public closeAllocateModal(): void {
    this.showAllocateModal.set(false);
  }

  public confirmAllocate(): void {
    this.leaveService.allocateBalance(this.allocateForm).subscribe({
      next: () => {
        this.successMessage.set('Employee leave balance allocated/adjusted successfully');
        this.closeAllocateModal();
        this.loadBalances();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to allocate balance');
      },
    });
  }

  // ================= Types =================
  public loadLeaveTypes(): void {
    this.loadingTypes.set(true);
    this.leaveService.listLeaveTypes(true).subscribe({
      next: (res) => {
        this.leaveTypes.set(res.data);
        this.loadingTypes.set(false);
      },
      error: () => {
        this.loadingTypes.set(false);
      },
    });
  }

  public openCreateTypeModal(): void {
    this.createTypeForm = {
      code: '',
      name: '',
      description: '',
      isPaid: true,
      defaultDaysPerYear: 30.0,
      deductWorkingDaysOnly: true,
      allowDuringProbation: false,
    };
    this.showCreateTypeModal.set(true);
  }

  public closeCreateTypeModal(): void {
    this.showCreateTypeModal.set(false);
  }

  public confirmCreateType(): void {
    this.leaveService.createLeaveType(this.createTypeForm).subscribe({
      next: () => {
        this.successMessage.set('Leave type created successfully');
        this.closeCreateTypeModal();
        this.loadLeaveTypes();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to create leave type');
      },
    });
  }

  public loadEmployees(): void {
    this.masterService.getEmployees().subscribe({
      next: (res) => {
        this.employees.set(res.data);
      },
      error: () => {},
    });
  }

  public getStatusClass(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'status-pending';
      case 'APPROVED':
        return 'status-approved';
      case 'REJECTED':
        return 'status-rejected';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
  }
}
