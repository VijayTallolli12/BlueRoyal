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

type ActiveTab = 'requests' | 'types' | 'balances';

@Component({
  selector: 'app-leave-hub',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
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
            <table class="data-table">
              <thead>
                <tr>
                  <th>Request #</th>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (r of requests(); track r.id) {
                  <tr>
                    <td>
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
                    <td class="cell-reason" [title]="r.reason">{{ r.reason }}</td>
                    <td>
                      <span class="badge" [ngClass]="getStatusClass(r.status)">{{ r.status }}</span>
                      @if (r.status === 'REJECTED' && r.rejectionReason) {
                        <div class="rejection-hint" [title]="r.rejectionReason">
                          {{ r.rejectionReason }}
                        </div>
                      }
                    </td>
                    <td class="actions-cell">
                      @if (r.status === 'PENDING') {
                        <button (click)="approveRequest(r)" class="btn btn-sm btn-success">
                          Approve
                        </button>
                        <button (click)="openRejectModal(r)" class="btn btn-sm btn-danger">
                          Reject
                        </button>
                      } @else if (r.status === 'APPROVED') {
                        <button (click)="openRevokeModal(r)" class="btn btn-sm btn-danger-outline">
                          Revoke
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
              + Allocate / Adjust Balance
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
            <button (click)="openCreateTypeModal()" class="btn btn-primary">+ Add Leave Type</button>
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

      <!-- Modal: Reject Request -->
      @if (showRejectModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Reject Leave Application</h3>
              <button (click)="closeRejectModal()" class="close-btn">×</button>
            </div>
            <div class="form-group">
              <label>Rejection Reason <span class="req-star">*</span> (Min 5 chars)</label>
              <textarea
                [(ngModel)]="rejectionReasonText"
                rows="3"
                placeholder="Detail the regulatory / operational reason for rejecting this leave..."
                class="form-control"
              ></textarea>
            </div>
            <div class="modal-actions">
              <button (click)="closeRejectModal()" class="btn btn-secondary">Dismiss</button>
              <button
                (click)="confirmReject()"
                [disabled]="rejectionReasonText.trim().length < 5"
                class="btn btn-danger"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Revoke Approved Leave -->
      @if (showRevokeModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Revoke Approved Leave</h3>
              <button (click)="closeRevokeModal()" class="close-btn">×</button>
            </div>
            <div class="form-group">
              <label>Cancellation Reason <span class="req-star">*</span></label>
              <textarea
                [(ngModel)]="revokeReasonText"
                rows="3"
                placeholder="Reason for revoking approved leave (attendance records will be reset)..."
                class="form-control"
              ></textarea>
            </div>
            <div class="modal-actions">
              <button (click)="closeRevokeModal()" class="btn btn-secondary">Dismiss</button>
              <button
                (click)="confirmRevoke()"
                [disabled]="revokeReasonText.trim().length < 5"
                class="btn btn-danger"
              >
                Revoke Leave
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal: Allocate Balance -->
      @if (showAllocateModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Allocate / Adjust Annual Leave Balance</h3>
              <button (click)="closeAllocateModal()" class="close-btn">×</button>
            </div>
            <form (ngSubmit)="confirmAllocate()" class="modal-form">
              <div class="form-group">
                <label>Employee <span class="req-star">*</span></label>
                <select [(ngModel)]="allocateForm.employeeId" name="employeeId" required class="form-control">
                  <option value="">-- Select Employee --</option>
                  @for (e of employees(); track e.id) {
                    <option [value]="e.id">{{ e.employeeCode }} — {{ e.firstName }} {{ e.lastName }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Leave Type <span class="req-star">*</span></label>
                <select [(ngModel)]="allocateForm.leaveTypeId" name="leaveTypeId" required class="form-control">
                  <option value="">-- Select Leave Category --</option>
                  @for (lt of leaveTypes(); track lt.id) {
                    <option [value]="lt.id">{{ lt.name }}</option>
                  }
                </select>
              </div>

              <div class="form-row">
                <div class="form-group col">
                  <label>Year <span class="req-star">*</span></label>
                  <input
                    type="number"
                    [(ngModel)]="allocateForm.year"
                    name="year"
                    required
                    class="form-control"
                  />
                </div>
                <div class="form-group col">
                  <label>Allocated Days <span class="req-star">*</span></label>
                  <input
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
                <label>Carried Forward Days</label>
                <input
                  type="number"
                  step="0.5"
                  [(ngModel)]="allocateForm.carriedForward"
                  name="carriedForward"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Notes</label>
                <input
                  type="text"
                  [(ngModel)]="allocateForm.notes"
                  name="notes"
                  placeholder="Optional allocation note"
                  class="form-control"
                />
              </div>

              <div class="modal-actions">
                <button type="button" (click)="closeAllocateModal()" class="btn btn-secondary">
                  Dismiss
                </button>
                <button type="submit" class="btn btn-primary">Save Balance</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal: Add Leave Type -->
      @if (showCreateTypeModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Create Leave Type</h3>
              <button (click)="closeCreateTypeModal()" class="close-btn">×</button>
            </div>
            <form (ngSubmit)="confirmCreateType()" class="modal-form">
              <div class="form-row">
                <div class="form-group col">
                  <label>Code <span class="req-star">*</span> (e.g. ANNUAL)</label>
                  <input
                    type="text"
                    [(ngModel)]="createTypeForm.code"
                    name="code"
                    required
                    class="form-control"
                  />
                </div>
                <div class="form-group col">
                  <label>Name <span class="req-star">*</span></label>
                  <input
                    type="text"
                    [(ngModel)]="createTypeForm.name"
                    name="name"
                    required
                    class="form-control"
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  [(ngModel)]="createTypeForm.description"
                  name="description"
                  rows="2"
                  class="form-control"
                ></textarea>
              </div>

              <div class="form-row">
                <div class="form-group col">
                  <label>Default Days / Year</label>
                  <input
                    type="number"
                    step="0.5"
                    [(ngModel)]="createTypeForm.defaultDaysPerYear"
                    name="defaultDaysPerYear"
                    class="form-control"
                  />
                </div>
                <div class="form-group col checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      [(ngModel)]="createTypeForm.isPaid"
                      name="isPaid"
                    />
                    Is Paid Leave
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      [(ngModel)]="createTypeForm.deductWorkingDaysOnly"
                      name="deductWorkingDaysOnly"
                    />
                    Skip Weekends & Holidays
                  </label>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" (click)="closeCreateTypeModal()" class="btn btn-secondary">
                  Dismiss
                </button>
                <button type="submit" class="btn btn-primary">Create Type</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .leave-hub-container {
        padding: 24px;
        max-width: 1300px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .hub-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .hub-header h2 {
        margin: 0 0 4px 0;
        font-size: 22px;
        color: #0f172a;
      }
      .subtitle {
        margin: 0;
        color: #64748b;
        font-size: 13px;
      }
      .tab-buttons {
        display: flex;
        gap: 8px;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 8px;
      }
      .tab-btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        background: transparent;
        color: #64748b;
        transition: all 0.2s;
      }
      .tab-btn.active {
        background: #ffffff;
        color: #0284c7;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
      .panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        overflow: hidden;
      }
      .panel-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
        background: #fafafa;
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
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      .data-table th {
        background: #f8fafc;
        padding: 12px 16px;
        text-align: left;
        font-weight: 600;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
      }
      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #334155;
      }
      .req-number {
        font-family: monospace;
        font-weight: 600;
        color: #0284c7;
      }
      .tag-type {
        background: #f1f5f9;
        color: #334155;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
      }
      .sub-text {
        font-size: 12px;
        color: #94a3b8;
      }
      .badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }
      .status-approved {
        background: #dcfce7;
        color: #166534;
      }
      .status-rejected {
        background: #fee2e2;
        color: #991b1b;
      }
      .status-cancelled {
        background: #f1f5f9;
        color: #64748b;
      }
      .badge-paid {
        background: #dbeafe;
        color: #1e40af;
      }
      .badge-unpaid {
        background: #fee2e2;
        color: #991b1b;
      }
      .badge-active {
        background: #dcfce7;
        color: #166534;
      }
      .text-emerald {
        color: #059669;
      }
      .text-indigo {
        color: #4f46e5;
      }
      .text-amber {
        color: #d97706;
      }
      .actions-cell {
        display: flex;
        gap: 6px;
      }
      .btn {
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
      }
      .btn-primary {
        background: #0284c7;
        color: #ffffff;
      }
      .btn-secondary {
        background: #e2e8f0;
        color: #334155;
      }
      .btn-success {
        background: #10b981;
        color: #ffffff;
      }
      .btn-danger {
        background: #ef4444;
        color: #ffffff;
      }
      .btn-danger-outline {
        background: transparent;
        border: 1px solid #ef4444;
        color: #ef4444;
      }
      .btn-sm {
        padding: 4px 8px;
        font-size: 12px;
      }
      .empty-cell {
        text-align: center;
        padding: 32px;
        color: #94a3b8;
        font-style: italic;
      }
      .loading {
        text-align: center;
        padding: 32px;
        color: #64748b;
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
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
      }
      .alert-success {
        background: #f0fdf4;
        color: #15803d;
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
        background: #ffffff;
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
        color: #0f172a;
      }
      .close-btn {
        background: transparent;
        border: none;
        font-size: 24px;
        color: #94a3b8;
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
        color: #334155;
        margin-bottom: 6px;
      }
      .form-control {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
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
        color: #dc2626;
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
