import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PayrollService } from '../../core/services/payroll.service';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  PayrollPeriodDto,
  CreatePayrollPeriodDto,
  AttendancePeriodDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-payroll-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="payroll-hub-container">
      <!-- Header -->
      <div class="hub-header">
        <div>
          <h2>Payroll Management & Financial Hub</h2>
          <p class="subtitle">
            Enterprise compensation calculation engine, locked attendance consumption, manual adjustments, and auditable payroll sign-off.
          </p>
        </div>
        <div class="header-actions">
          @if (authService.hasPermission('payroll:create')) {
            <button class="btn btn-primary" (click)="openCreateModal()">
              + New Payroll Run
            </button>
          }
          <button class="btn btn-secondary" (click)="loadPeriods()">
            Refresh
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Payroll Runs</div>
          <div class="kpi-value">{{ periods().length }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active / Review Runs</div>
          <div class="kpi-value warning">{{ activeRunsCount() }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Finalized Runs</div>
          <div class="kpi-value success">{{ finalizedRunsCount() }}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Disbursed (Finalized)</div>
          <div class="kpi-value primary">AED {{ totalFinalizedNet() | number:'1.2-2' }}</div>
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

      <!-- Periods Panel -->
      <div class="panel">
        <div class="panel-bar">
          <div class="filter-group">
            <label>Filter Status:</label>
            <select [(ngModel)]="statusFilter" class="form-select">
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="calculated">Calculated</option>
              <option value="reviewed">Reviewed</option>
              <option value="finalized">Finalized</option>
            </select>
          </div>
          <span class="text-muted">Showing {{ filteredPeriods().length }} payroll period(s)</span>
        </div>

        @if (loading()) {
          <div class="loading">Loading payroll periods...</div>
        } @else if (filteredPeriods().length === 0) {
          <div class="empty-state">
            <p>No payroll periods found matching criteria.</p>
            @if (authService.hasPermission('payroll:create')) {
              <button class="btn btn-outline" (click)="openCreateModal()">Create First Payroll Run</button>
            }
          </div>
        } @else {
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Period Code</th>
                  <th>Name</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Employees</th>
                  <th>Gross Pay (AED)</th>
                  <th>Net Pay (AED)</th>
                  <th>Blocking Issues</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (period of filteredPeriods(); track period.id) {
                  <tr>
                    <td><strong>{{ period.periodCode }}</strong></td>
                    <td>{{ period.name }}</td>
                    <td>{{ period.startDate }} to {{ period.endDate }}</td>
                    <td>
                      <span class="status-badge status-{{ period.status }}">
                        {{ period.status | uppercase }}
                      </span>
                    </td>
                    <td>{{ period.employeeCount }}</td>
                    <td>{{ period.totalGrossPay | number:'1.2-2' }}</td>
                    <td><strong>{{ period.totalNetPay | number:'1.2-2' }}</strong></td>
                    <td>
                      @if (period.blockingIssuesCount > 0) {
                        <span class="badge-blocking">⚠️ {{ period.blockingIssuesCount }} Blocked</span>
                      } @else {
                        <span class="badge-clean">✓ 0 Issues</span>
                      }
                    </td>
                    <td class="action-cell">
                      <a [routerLink]="['/payroll/periods', period.id]" class="btn btn-sm btn-outline">
                        Open Run
                      </a>
                      @if (period.status !== 'finalized' && authService.hasPermission('payroll:calculate')) {
                        <button (click)="calculate(period.id)" class="btn btn-sm btn-secondary" title="Calculate or Recalculate">
                          ⚡ Calc
                        </button>
                      }
                      @if (period.status === 'calculated' && authService.hasPermission('payroll:review')) {
                        <button (click)="review(period.id)" class="btn btn-sm btn-info" [disabled]="period.blockingIssuesCount > 0" title="Sign off review">
                          Review
                        </button>
                      }
                      @if (period.status === 'reviewed' && authService.hasPermission('payroll:finalize')) {
                        <button (click)="finalize(period.id)" class="btn btn-sm btn-success" title="Finalize and permanently lock">
                          Finalize
                        </button>
                      }
                      @if (period.status === 'finalized' && authService.hasRole('super_admin')) {
                        <button (click)="openUnlockModal(period)" class="btn btn-sm btn-danger" title="Super Admin Administrative Unlock">
                          Unlock
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Create Payroll Period Modal -->
      @if (showCreateModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3>Create New Payroll Run</h3>
              <button class="modal-close" (click)="showCreateModal.set(false)">×</button>
            </div>
            <form (ngSubmit)="onCreateSubmit()">
              <div class="modal-body">
                <div class="form-group">
                  <label>Linked Attendance Period (Must be LOCKED) *</label>
                  <select
                    class="form-control"
                    [(ngModel)]="newPeriodDto.attendancePeriodId"
                    name="attendancePeriodId"
                    (change)="onAttendanceSelected()"
                    required
                  >
                    <option value="">-- Select a Locked Attendance Period --</option>
                    @for (att of lockedAttendancePeriods(); track att.id) {
                      <option [value]="att.id">
                        {{ att.periodCode }} - {{ att.name }} ({{ att.startDate }} to {{ att.endDate }})
                      </option>
                    }
                  </select>
                  @if (lockedAttendancePeriods().length === 0) {
                    <p class="hint text-danger">
                      No locked attendance periods available. Complete and lock attendance in the Attendance Hub first.
                    </p>
                  }
                </div>

                <div class="form-group">
                  <label>Period Code (e.g. 2026-05)</label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="newPeriodDto.periodCode"
                    name="periodCode"
                    placeholder="Inherited from attendance if blank"
                  />
                </div>

                <div class="form-group">
                  <label>Run Name / Title</label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="newPeriodDto.name"
                    name="name"
                    placeholder="e.g. May 2026 Regular Payroll"
                  />
                </div>

                <div class="form-group">
                  <label>Notes / Justification</label>
                  <textarea
                    class="form-control"
                    rows="2"
                    [(ngModel)]="newPeriodDto.notes"
                    name="notes"
                    placeholder="Optional notes regarding this payroll cycle..."
                  ></textarea>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showCreateModal.set(false)">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  [disabled]="!newPeriodDto.attendancePeriodId || submitting()"
                >
                  {{ submitting() ? 'Creating...' : 'Create Payroll Run' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Unlock Modal (Super Admin) -->
      @if (showUnlockModal()) {
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h3 class="text-danger">⚠️ Unlock Finalized Payroll Run</h3>
              <button class="modal-close" (click)="showUnlockModal.set(false)">×</button>
            </div>
            <form (ngSubmit)="onUnlockSubmit()">
              <div class="modal-body">
                <div class="alert alert-warning">
                  <strong>Warning:</strong> You are about to unlock a finalized payroll period ({{ selectedPeriod()?.periodCode }}).
                  This reverts the run back to DRAFT, temporarily hides payslips from Employee Self-Service, and requires a full audit record.
                </div>
                <div class="form-group">
                  <label>Mandatory Audit Justification (Minimum 15 characters) *</label>
                  <textarea
                    class="form-control"
                    rows="3"
                    [(ngModel)]="unlockReason"
                    name="unlockReason"
                    placeholder="Detail the audit justification, approver name, or correction mandate..."
                    required
                  ></textarea>
                  <span class="hint">{{ unlockReason.length }}/15 characters minimum</span>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showUnlockModal.set(false)">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-danger"
                  [disabled]="unlockReason.trim().length < 15 || submitting()"
                >
                  {{ submitting() ? 'Unlocking...' : 'Confirm Unlock' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .payroll-hub-container {
        padding: 24px;
        max-width: 1400px;
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
      .header-actions {
        display: flex;
        gap: 10px;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }
      .kpi-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px 20px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .kpi-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 6px;
      }
      .kpi-value {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
      }
      .kpi-value.warning { color: #d97706; }
      .kpi-value.success { color: #16a34a; }
      .kpi-value.primary { color: #2563eb; }

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
        padding: 14px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
      }
      .form-select, .form-control {
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        background: #ffffff;
        width: 100%;
        box-sizing: border-box;
      }
      .table-responsive {
        overflow-x: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
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
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
      }
      .data-table tr:hover {
        background: #f8fafc;
      }
      .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .status-draft { background: #f1f5f9; color: #475569; }
      .status-calculated { background: #e0f2fe; color: #0369a1; }
      .status-reviewed { background: #fef3c7; color: #b45309; }
      .status-finalized { background: #dcfce7; color: #15803d; }

      .badge-blocking {
        display: inline-block;
        padding: 4px 8px;
        background: #fee2e2;
        color: #b91c1c;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
      }
      .badge-clean {
        color: #16a34a;
        font-weight: 600;
        font-size: 12px;
      }
      .action-cell {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .btn-sm {
        padding: 5px 10px;
        font-size: 12px;
      }
      .btn-primary { background: #2563eb; color: #ffffff; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-secondary:hover { background: #e2e8f0; }
      .btn-outline { background: transparent; color: #2563eb; border: 1px solid #93c5fd; }
      .btn-outline:hover { background: #eff6ff; }
      .btn-info { background: #0284c7; color: #ffffff; }
      .btn-success { background: #16a34a; color: #ffffff; }
      .btn-danger { background: #dc2626; color: #ffffff; }

      .alert {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
      }
      .alert-danger { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
      .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .alert-warning { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      .alert-close {
        background: transparent;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: inherit;
      }

      .loading, .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: #64748b;
      }

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
        z-index: 999;
      }
      .modal-card {
        background: #ffffff;
        border-radius: 12px;
        width: 100%;
        max-width: 540px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-header h3 { margin: 0; font-size: 17px; }
      .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; }
      .modal-body { padding: 20px; }
      .modal-footer {
        padding: 14px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      .form-group { margin-bottom: 14px; }
      .form-group label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px; }
      .hint { font-size: 11px; color: #64748b; margin-top: 4px; display: block; }
      .text-danger { color: #dc2626; }
      .text-muted { color: #64748b; font-size: 13px; }
    `,
  ],
})
export class PayrollHubComponent implements OnInit {
  public periods = signal<PayrollPeriodDto[]>([]);
  public lockedAttendancePeriods = signal<AttendancePeriodDto[]>([]);
  public loading = signal<boolean>(false);
  public submitting = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public statusFilter: string = '';

  // Modals
  public showCreateModal = signal<boolean>(false);
  public showUnlockModal = signal<boolean>(false);
  public selectedPeriod = signal<PayrollPeriodDto | null>(null);
  public unlockReason: string = '';

  public newPeriodDto: CreatePayrollPeriodDto = {
    attendancePeriodId: '',
    periodCode: '',
    name: '',
    notes: '',
  };

  constructor(
    private payrollService: PayrollService,
    private attendanceService: AttendanceApiService,
    public authService: AuthService,
    private router: Router,
  ) {}

  public ngOnInit(): void {
    this.loadPeriods();
    this.loadAttendancePeriods();
  }

  public loadPeriods(): void {
    this.loading.set(true);
    this.payrollService.listPeriods().subscribe({
      next: (res) => {
        this.periods.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load payroll periods.');
        this.loading.set(false);
      },
    });
  }

  public loadAttendancePeriods(): void {
    this.attendanceService.listPeriods().subscribe({
      next: (res) => {
        const locked = (res.data || []).filter((p) => p.status === 'locked');
        this.lockedAttendancePeriods.set(locked);
      },
      error: () => {},
    });
  }

  public filteredPeriods(): PayrollPeriodDto[] {
    if (!this.statusFilter) return this.periods();
    return this.periods().filter((p) => p.status === this.statusFilter);
  }

  public activeRunsCount(): number {
    return this.periods().filter((p) => p.status === 'draft' || p.status === 'calculated' || p.status === 'reviewed').length;
  }

  public finalizedRunsCount(): number {
    return this.periods().filter((p) => p.status === 'finalized').length;
  }

  public totalFinalizedNet(): number {
    return this.periods()
      .filter((p) => p.status === 'finalized')
      .reduce((acc, p) => acc + Number(p.totalNetPay || 0), 0);
  }

  public openCreateModal(): void {
    this.newPeriodDto = {
      attendancePeriodId: '',
      periodCode: '',
      name: '',
      notes: '',
    };
    this.loadAttendancePeriods();
    this.showCreateModal.set(true);
  }

  public onAttendanceSelected(): void {
    const selected = this.lockedAttendancePeriods().find((p) => p.id === this.newPeriodDto.attendancePeriodId);
    if (selected) {
      if (!this.newPeriodDto.periodCode) {
        this.newPeriodDto.periodCode = selected.periodCode;
      }
      if (!this.newPeriodDto.name) {
        this.newPeriodDto.name = `${selected.name} Payroll`;
      }
    }
  }

  public onCreateSubmit(): void {
    if (!this.newPeriodDto.attendancePeriodId) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.payrollService.createPeriod(this.newPeriodDto).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.showCreateModal.set(false);
        this.successMessage.set(`Payroll run ${res.data.periodCode} created in DRAFT.`);
        this.loadPeriods();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to create payroll run.');
      },
    });
  }

  public calculate(id: string): void {
    this.loading.set(true);
    this.payrollService.calculatePeriod(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.successMessage.set(
          `Calculation completed for ${res.data.periodCode}. Net: AED ${res.data.totalNetPay.toFixed(2)}, Blocked: ${res.data.blockingIssuesCount}`,
        );
        this.loadPeriods();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Calculation failed.');
      },
    });
  }

  public review(id: string): void {
    this.payrollService.reviewPeriod(id).subscribe({
      next: (res) => {
        this.successMessage.set(`Payroll run ${res.data.periodCode} reviewed and ready for finalization.`);
        this.loadPeriods();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Review transition failed.');
      },
    });
  }

  public finalize(id: string): void {
    if (!confirm('Are you sure you want to finalize this payroll run? This will permanently lock all records and publish payslips to employees.')) {
      return;
    }

    this.payrollService.finalizePeriod(id).subscribe({
      next: (res) => {
        this.successMessage.set(`Payroll run ${res.data.periodCode} successfully FINALIZED and published.`);
        this.loadPeriods();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Finalization failed.');
      },
    });
  }

  public openUnlockModal(period: PayrollPeriodDto): void {
    this.selectedPeriod.set(period);
    this.unlockReason = '';
    this.showUnlockModal.set(true);
  }

  public onUnlockSubmit(): void {
    const period = this.selectedPeriod();
    if (!period || this.unlockReason.trim().length < 15) return;

    this.submitting.set(true);
    this.payrollService.unlockPeriod(period.id, { reason: this.unlockReason.trim() }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.showUnlockModal.set(false);
        this.successMessage.set(`Payroll run ${res.data.periodCode} unlocked back to DRAFT.`);
        this.loadPeriods();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Unlock failed.');
      },
    });
  }
}
