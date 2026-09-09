import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/services/leave.service';
import {
  MyLeaveOverviewDto,
  LeaveTypeDto,
  LeaveRequestDto,
  CreateLeaveRequestDto,
} from '@blue-royal/contracts';

import { AppShellComponent } from '../../core/layout/app-shell.component';

@Component({
  selector: 'app-my-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="leave-container">
      <!-- Top Bar -->
      <div class="header-card">
        <div class="header-info">
          <h2>My Leave Portal</h2>
          <p class="subtitle">
            View your real-time leave entitlement balances, track application statuses, and submit leave requests.
          </p>
        </div>
        <div class="header-actions">
          <select [ngModel]="selectedYear()" (ngModelChange)="onYearChange($event)" class="year-select">
            <option [value]="2025">Year 2025</option>
            <option [value]="2026">Year 2026</option>
            <option [value]="2027">Year 2027</option>
          </select>
          <button (click)="openRequestModal()" class="btn btn-primary">
            <span class="material-symbols-outlined icon-sm">add</span>
            <span>Request Leave</span>
          </button>
        </div>
      </div>

      <!-- Feedback Messages -->
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

      <!-- KPI Summary Cards -->
      @if (loading()) {
        <div class="loading-spinner">Loading leave balances...</div>
      } @else {
        <!-- Annual Leave Main Cards -->
        @if (annualBalance(); as b) {
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Annual Leave Allocated</span>
              <span class="kpi-value">{{ b.allocatedDays | number: '1.2-2' }}</span>
              <span class="kpi-sub">Carried Forward: +{{ b.carriedForward | number: '1.2-2' }}d</span>
            </div>
            <div class="kpi-card card-used">
              <span class="kpi-label">Days Used</span>
              <span class="kpi-value">{{ b.usedDays | number: '1.2-2' }}</span>
              <span class="kpi-sub">Approved Leaves</span>
            </div>
            <div class="kpi-card card-pending">
              <span class="kpi-label">Pending Approval</span>
              <span class="kpi-value">{{ b.pendingDays | number: '1.2-2' }}</span>
              <span class="kpi-sub">Under HR Review</span>
            </div>
            <div class="kpi-card card-remaining">
              <span class="kpi-label">Available Remaining</span>
              <span class="kpi-value remaining-value">{{ b.remainingDays | number: '1.2-2' }}</span>
              <span class="kpi-sub">Days Available to Request</span>
            </div>
          </div>
        }

        <!-- Other Entitlement Categories -->
        <div class="secondary-balances">
          <span class="sec-title">Other Leave Balances:</span>
          @for (bal of otherBalances(); track bal.id) {
            <div class="balance-pill">
              <span class="pill-name">{{ bal.leaveType?.name || 'Leave' }}:</span>
              <span class="pill-stat">
                Rem: <strong>{{ bal.remainingDays | number: '1.2-2' }}</strong> / Used: {{ bal.usedDays | number: '1.2-2' }}
              </span>
            </div>
          }
        </div>

        <!-- Requests History Table -->
        <div class="table-container">
          <div class="table-header">
            <h3>My Leave Applications</h3>
            <span class="badge badge-count">{{ requests().length }} Applications</span>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Leave Type</th>
                <th>Dates</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (req of requests(); track req.id) {
                <tr>
                  <td>
                    <span class="req-number">{{ req.requestNumber }}</span>
                  </td>
                  <td>
                    <span class="tag-type">{{ req.leaveType?.name }}</span>
                  </td>
                  <td>
                    <span class="date-range">{{ req.startDate }} ➔ {{ req.endDate }}</span>
                  </td>
                  <td>
                    <strong>{{ req.totalDays }}</strong> day(s)
                  </td>
                  <td class="cell-reason" [title]="req.reason">{{ req.reason }}</td>
                  <td>
                    <span class="badge badge-status" [ngClass]="getStatusClass(req.status)">
                      {{ req.status }}
                    </span>
                    @if (req.status === 'REJECTED' && req.rejectionReason) {
                      <div class="rejection-note" [title]="req.rejectionReason">
                        Reason: {{ req.rejectionReason }}
                      </div>
                    }
                  </td>
                  <td>
                    @if (req.status === 'PENDING') {
                      <button (click)="cancelRequest(req)" class="btn btn-sm btn-danger-outline">
                        Cancel
                      </button>
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="empty-cell">
                    No leave requests found for {{ selectedYear() }}. Click "+ Request Leave" to apply.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Modal: Submit Leave Request -->
      @if (showRequestModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Submit Leave Request</h3>
              <button (click)="closeRequestModal()" class="close-btn">×</button>
            </div>

            <form (ngSubmit)="submitRequest()" class="modal-form">
              <div class="form-group">
                <label>Leave Type <span class="req-star">*</span></label>
                <select [(ngModel)]="requestForm.leaveTypeId" name="leaveTypeId" required class="form-control">
                  <option value="">-- Select Leave Category --</option>
                  @for (lt of activeLeaveTypes(); track lt.id) {
                    <option [value]="lt.id">
                      {{ lt.name }} ({{ lt.isPaid ? 'Paid' : 'Unpaid' }})
                    </option>
                  }
                </select>
              </div>

              <div class="form-row">
                <div class="form-group col">
                  <label>Start Date <span class="req-star">*</span></label>
                  <input
                    type="date"
                    [(ngModel)]="requestForm.startDate"
                    name="startDate"
                    required
                    class="form-control"
                  />
                </div>
                <div class="form-group col">
                  <label>End Date <span class="req-star">*</span></label>
                  <input
                    type="date"
                    [(ngModel)]="requestForm.endDate"
                    name="endDate"
                    required
                    class="form-control"
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Reason for Leave <span class="req-star">*</span></label>
                <textarea
                  [(ngModel)]="requestForm.reason"
                  name="reason"
                  rows="3"
                  required
                  minlength="5"
                  placeholder="Provide brief explanation for requested leave..."
                  class="form-control"
                ></textarea>
              </div>

              <div class="modal-actions">
                <button type="button" (click)="closeRequestModal()" class="btn btn-secondary">
                  Dismiss
                </button>
                <button type="submit" [disabled]="submitting()" class="btn btn-primary">
                  {{ submitting() ? 'Submitting...' : 'Submit Application' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
      </div>
    </app-shell>
  `,
  styles: [
    `
      .leave-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .header-card {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid var(--border-default);
        padding-bottom: 1.25rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .header-info h2 {
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
      .header-actions {
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      .year-select {
        padding: 0.45rem 0.875rem;
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-md);
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--text-primary);
        background: #ffffff;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .kpi-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .kpi-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--color-text-muted);
        margin-bottom: 8px;
      }
      .kpi-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--color-text-primary);
        margin-bottom: 4px;
      }
      .kpi-sub {
        font-size: 12px;
        color: var(--color-disabled);
      }
      .card-remaining {
        border-left: 4px solid var(--color-success);
      }
      .remaining-value {
        color: #059669;
      }
      .card-pending {
        border-left: 4px solid #f59e0b;
      }
      .card-used {
        border-left: 4px solid #6366f1;
      }
      .secondary-balances {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 24px;
        padding: 12px 16px;
        background: var(--color-surface-alt);
        border: 1px solid var(--color-border);
        border-radius: 8px;
      }
      .sec-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
      }
      .balance-pill {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 12px;
        color: var(--color-text-primary);
      }
      .pill-name {
        font-weight: 600;
        margin-right: 4px;
      }
      .table-container {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--color-border);
      }
      .table-header h3 {
        margin: 0;
        font-size: 16px;
        color: var(--color-text-primary);
      }
      .badge-count {
        background: var(--color-hover);
        color: var(--color-text-secondary);
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 600;
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
        padding: 14px 16px;
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
      .date-range {
        font-weight: 500;
      }
      .cell-reason {
        max-width: 250px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .badge-status {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
      .rejection-note {
        font-size: 11px;
        color: var(--color-danger);
        margin-top: 4px;
        font-style: italic;
      }
      .empty-cell {
        text-align: center;
        padding: 32px;
        color: var(--color-disabled);
        font-style: italic;
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
        font-weight: bold;
        cursor: pointer;
        color: inherit;
      }
      /* Modal Styles */
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
        margin-bottom: 20px;
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
        margin-bottom: 16px;
      }
      .form-row {
        display: flex;
        gap: 16px;
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
      .req-star {
        color: var(--color-danger);
      }
      .form-control {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }
      .loading-spinner {
        text-align: center;
        padding: 40px;
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class MyLeaveComponent implements OnInit {
  public loading = signal(false);
  public submitting = signal(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public selectedYear = signal(new Date().getFullYear());
  public overview = signal<MyLeaveOverviewDto | null>(null);
  public activeLeaveTypes = signal<LeaveTypeDto[]>([]);
  public showRequestModal = signal(false);

  public requestForm: CreateLeaveRequestDto = {
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  };

  public annualBalance = computed(() => {
    const ov = this.overview();
    if (!ov) return null;
    return ov.balances.find((b) => b.leaveType?.code === 'ANNUAL') || ov.balances[0] || null;
  });

  public otherBalances = computed(() => {
    const ov = this.overview();
    if (!ov) return [];
    return ov.balances.filter((b) => b.leaveType?.code !== 'ANNUAL');
  });

  public requests = computed(() => {
    const ov = this.overview();
    return ov ? ov.requests : [];
  });

  constructor(private leaveService: LeaveService) {}

  public ngOnInit(): void {
    this.loadData();
    this.loadLeaveTypes();
  }

  public onYearChange(year: number): void {
    this.selectedYear.set(Number(year));
    this.loadData();
  }

  public loadData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.leaveService.getMyLeaveOverview(this.selectedYear()).subscribe({
      next: (res) => {
        this.overview.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load leave overview');
        this.loading.set(false);
      },
    });
  }

  public loadLeaveTypes(): void {
    this.leaveService.listLeaveTypes(false).subscribe({
      next: (res) => {
        this.activeLeaveTypes.set(res.data);
      },
      error: () => {},
    });
  }

  public openRequestModal(): void {
    this.requestForm = {
      leaveTypeId: this.activeLeaveTypes().length > 0 ? this.activeLeaveTypes()[0].id : '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: '',
    };
    this.showRequestModal.set(true);
  }

  public closeRequestModal(): void {
    this.showRequestModal.set(false);
  }

  public submitRequest(): void {
    if (!this.requestForm.leaveTypeId || !this.requestForm.startDate || !this.requestForm.endDate) {
      this.errorMessage.set('Please fill in all mandatory fields');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.leaveService.submitMyLeave(this.requestForm).subscribe({
      next: (res) => {
        this.successMessage.set(
          `Leave request ${res.data.requestNumber} submitted successfully in PENDING status`,
        );
        this.submitting.set(false);
        this.closeRequestModal();
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to submit leave request');
        this.submitting.set(false);
      },
    });
  }

  public cancelRequest(req: LeaveRequestDto): void {
    if (!confirm(`Are you sure you want to cancel leave application ${req.requestNumber}?`)) {
      return;
    }

    this.leaveService.cancelMyLeave(req.id).subscribe({
      next: () => {
        this.successMessage.set(`Leave application ${req.requestNumber} cancelled successfully`);
        this.loadData();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to cancel leave application');
      },
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
