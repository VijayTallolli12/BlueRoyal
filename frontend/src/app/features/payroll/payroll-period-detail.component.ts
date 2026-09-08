import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PayrollService } from '../../core/services/payroll.service';
import { AuthService } from '../../core/services/auth.service';
import {
  PayrollPeriodDto,
  PayrollItemDto,
  PayrollItemDetailDto,
  AddPayrollAdjustmentDto,
} from '@blue-royal/contracts';

@Component({
  selector: 'app-payroll-period-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="period-detail-container">
      <!-- Breadcrumb / Back -->
      <div class="nav-back">
        <a routerLink="/payroll" class="back-link">← Back to Payroll Hub</a>
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

      @if (loadingPeriod()) {
        <div class="loading">Loading payroll run details...</div>
      } @else {
        @if (period(); as p) {
          <!-- Header Banner -->
          <div class="run-header">
          <div class="run-title">
            <div class="title-row">
              <h2>{{ p.name }}</h2>
              <span class="status-badge status-{{ p.status }}">{{ p.status | uppercase }}</span>
              @if (p.blockingIssuesCount > 0) {
                <span class="badge-blocking">⚠️ {{ p.blockingIssuesCount }} BLOCKING ISSUES</span>
              }
            </div>
            <p class="subtitle">
              Period: <strong>{{ p.periodCode }}</strong> | Cycle Dates: {{ p.startDate }} to {{ p.endDate }}
              @if (p.calculatedAt) {
                | Last Calculated: {{ p.calculatedAt | date:'medium' }}
              }
            </p>
          </div>

          <!-- Actions -->
          <div class="header-actions">
            @if (p.status !== 'finalized' && authService.hasPermission('payroll:calculate')) {
              <button class="btn btn-secondary" (click)="recalculate()" [disabled]="actionLoading()">
                ⚡ Recalculate
              </button>
            }
            @if (p.status === 'calculated' && authService.hasPermission('payroll:review')) {
              <button
                class="btn btn-info"
                (click)="review()"
                [disabled]="p.blockingIssuesCount > 0 || actionLoading()"
                title="Review requires 0 blocking issues"
              >
                Sign-off Review
              </button>
            }
            @if (p.status === 'reviewed' && authService.hasPermission('payroll:finalize')) {
              <button class="btn btn-success" (click)="finalize()" [disabled]="actionLoading()">
                Finalize & Lock Run
              </button>
            }
            @if (p.status === 'finalized' && authService.hasRole('super_admin')) {
              <button class="btn btn-danger" (click)="openUnlockModal()" [disabled]="actionLoading()">
                Unlock Run
              </button>
            }
          </div>
        </div>

        <!-- Financial KPI Tiles -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Employees in Cycle</div>
            <div class="kpi-value">{{ p.employeeCount }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Gross Remuneration</div>
            <div class="kpi-value">AED {{ p.totalGrossPay | number:'1.2-2' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Deductions</div>
            <div class="kpi-value warning">AED {{ p.totalDeductions | number:'1.2-2' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Net Payable Amount</div>
            <div class="kpi-value success">AED {{ p.totalNetPay | number:'1.2-2' }}</div>
          </div>
        </div>

        <!-- Items Table Panel -->
        <div class="panel">
          <div class="panel-bar">
            <div class="filter-row">
              <input
                type="text"
                class="form-control filter-input"
                placeholder="Search employee code or name..."
                [(ngModel)]="searchQuery"
                (input)="filterItems()"
              />

              <select [(ngModel)]="basisFilter" (change)="filterItems()" class="form-select">
                <option value="">All Remuneration</option>
                <option value="hourly">Hourly Only</option>
                <option value="salaried">Salaried Only</option>
              </select>

              <select [(ngModel)]="blockingFilter" (change)="filterItems()" class="form-select">
                <option value="">All Statuses</option>
                <option value="blocked">Blocked / Incomplete Only</option>
                <option value="clean">Clean / Processed Only</option>
              </select>
            </div>
            <span class="text-muted">Showing {{ filteredItems().length }} of {{ items().length }} items</span>
          </div>

          @if (loadingItems()) {
            <div class="loading">Loading employee payroll items...</div>
          } @else if (filteredItems().length === 0) {
            <div class="empty-state">
              <p>No payroll records match the active filters.</p>
            </div>
          } @else {
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Emp Code</th>
                    <th>Employee Name</th>
                    <th>Basis</th>
                    <th>Designation</th>
                    <th>Reg Hours</th>
                    <th>OT Hours</th>
                    <th>Gross Pay (AED)</th>
                    <th>Deductions</th>
                    <th>Net Pay (AED)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of filteredItems(); track item.id) {
                    <tr [class.blocked-row]="item.hasBlockingIssue">
                      <td><strong>{{ item.employeeCode }}</strong></td>
                      <td>{{ item.employeeName }}</td>
                      <td>
                        <span class="basis-badge basis-{{ item.remunerationBasis }}">
                          {{ item.remunerationBasis | uppercase }}
                        </span>
                      </td>
                      <td>{{ item.designationTitle || '-' }}</td>
                      <td>{{ item.totalRegularHours }}h</td>
                      <td>{{ item.totalOtHours }}h</td>
                      <td>{{ item.grossPay | number:'1.2-2' }}</td>
                      <td>{{ item.totalDeductions | number:'1.2-2' }}</td>
                      <td><strong>{{ item.netPay | number:'1.2-2' }}</strong></td>
                      <td>
                        @if (item.hasBlockingIssue) {
                          <span class="badge-blocking" [title]="item.blockingReason || ''">
                            ⚠️ {{ item.blockingReason || 'Blocked' }}
                          </span>
                        } @else {
                          <span class="badge-clean">✓ Calculated</span>
                        }
                      </td>
                      <td>
                        <button class="btn btn-sm btn-outline" (click)="openBreakdown(item)">
                          Breakdown & Adjust
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        }
      }

      <!-- Item Breakdown & Adjustments Modal -->
      @if (selectedItemDetail()) {
        <div class="modal-backdrop">
          <div class="modal-card modal-lg">
            <div class="modal-header">
              <div>
                <h3>
                  {{ selectedItemDetail()?.item?.employeeName }} ({{ selectedItemDetail()?.item?.employeeCode }})
                </h3>
                <span class="subtitle">
                  Basis: {{ selectedItemDetail()?.item?.remunerationBasis | uppercase }} | Net Pay: AED {{ selectedItemDetail()?.item?.netPay | number:'1.2-2' }}
                </span>
              </div>
              <button class="modal-close" (click)="selectedItemDetail.set(null)">×</button>
            </div>

            <div class="modal-body">
              <!-- Attendance summary mini-bar -->
              <div class="mini-kpi-bar">
                <div class="mini-kpi">
                  <span>Regular Hours</span>
                  <strong>{{ selectedItemDetail()?.attendanceSummary?.totalRegularHours }}h</strong>
                </div>
                <div class="mini-kpi">
                  <span>Overtime Hours</span>
                  <strong>{{ selectedItemDetail()?.attendanceSummary?.totalOtHours }}h</strong>
                </div>
                <div class="mini-kpi">
                  <span>Absence Days</span>
                  <strong>{{ selectedItemDetail()?.attendanceSummary?.totalAbsenceDays }}</strong>
                </div>
                <div class="mini-kpi">
                  <span>Approved Leaves</span>
                  <strong>{{ selectedItemDetail()?.attendanceSummary?.totalLeaveDays }}</strong>
                </div>
              </div>

              <!-- Lines Table -->
              <div class="section-heading">Itemized Compensation & Adjustments</div>
              <div class="table-responsive">
                <table class="data-table data-table-sm">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Date / Component</th>
                      <th>Rate</th>
                      <th>Qty</th>
                      <th>Amount (AED)</th>
                      <th>Type</th>
                      @if (period()?.status !== 'finalized') {
                        <th>Action</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of selectedItemDetail()?.lines; track line.id) {
                      <tr>
                        <td>
                          <span class="category-badge category-{{ line.category }}">
                            {{ line.category | uppercase }}
                          </span>
                        </td>
                        <td><strong>{{ line.code }}</strong></td>
                        <td>{{ line.description }}</td>
                        <td>{{ line.workDate || '-' }}</td>
                        <td>{{ line.rate ? (line.rate | number:'1.2-2') : '-' }}</td>
                        <td>{{ line.quantity || '-' }}</td>
                        <td><strong>{{ line.amount | number:'1.2-2' }}</strong></td>
                        <td>
                          @if (line.isManual) {
                            <span class="badge-manual">Manual ({{ line.adjustmentType }})</span>
                          } @else {
                            <span class="badge-system">System</span>
                          }
                        </td>
                        @if (period()?.status !== 'finalized') {
                          <td>
                            @if (line.isManual) {
                              <button class="btn btn-sm btn-danger" (click)="deleteAdjustment(line.id)">
                                Remove
                              </button>
                            }
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Add Adjustment Section (if not finalized) -->
              @if (period()?.status !== 'finalized' && authService.hasPermission('payroll:calculate')) {
                <div class="adjustment-box">
                  <div class="section-heading">Add Manual Adjustment</div>
                  <form (ngSubmit)="onAddAdjustmentSubmit()" class="adj-form">
                    <div class="adj-row">
                      <div class="form-group flex-1">
                        <label>Adjustment Type *</label>
                        <select [(ngModel)]="newAdjDto.adjustmentType" name="adjType" class="form-control" required>
                          <option value="addition">Addition (Bonus / Extra Pay)</option>
                          <option value="deduction">Deduction (Recovery / Penalty)</option>
                        </select>
                      </div>
                      <div class="form-group flex-1">
                        <label>Amount (AED) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          [(ngModel)]="newAdjDto.amount"
                          name="adjAmount"
                          class="form-control"
                          placeholder="e.g. 150.00"
                          required
                        />
                      </div>
                    </div>
                    <div class="form-group">
                      <label>Mandatory Description (Min 5 chars) *</label>
                      <input
                        type="text"
                        [(ngModel)]="newAdjDto.description"
                        name="adjDesc"
                        class="form-control"
                        placeholder="Detail specific reason for manual adjustment..."
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      class="btn btn-primary btn-sm"
                      [disabled]="!newAdjDto.amount || newAdjDto.description.trim().length < 5 || adjSubmitting()"
                    >
                      {{ adjSubmitting() ? 'Applying...' : '+ Add Adjustment' }}
                    </button>
                  </form>
                </div>
              }
            </div>

            <div class="modal-footer">
              <button class="btn btn-secondary" (click)="selectedItemDetail.set(null)">Close</button>
            </div>
          </div>
        </div>
      }

      <!-- Unlock Modal -->
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
                  <strong>Warning:</strong> You are about to unlock a finalized payroll period ({{ period()?.periodCode }}).
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
                  [disabled]="unlockReason.trim().length < 15 || actionLoading()"
                >
                  {{ actionLoading() ? 'Unlocking...' : 'Confirm Unlock' }}
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
      .period-detail-container {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .nav-back { margin-bottom: 16px; }
      .back-link {
        color: #2563eb;
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
      }
      .back-link:hover { text-decoration: underline; }

      .run-header {
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
      .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
      }
      .title-row h2 { margin: 0; font-size: 20px; color: #0f172a; }
      .subtitle { margin: 0; color: #64748b; font-size: 13px; }
      .header-actions { display: flex; gap: 8px; }

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
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
      }
      .kpi-value.warning { color: #d97706; }
      .kpi-value.success { color: #16a34a; }

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
        gap: 16px;
        flex-wrap: wrap;
      }
      .filter-row {
        display: flex;
        gap: 10px;
        flex: 1;
        align-items: center;
      }
      .filter-input { max-width: 280px; }
      .form-select, .form-control {
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 13px;
        background: #ffffff;
      }
      .table-responsive { overflow-x: auto; }
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
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
      }
      .data-table tr:hover { background: #f8fafc; }
      .blocked-row { background: #fff1f2 !important; }

      .data-table-sm th, .data-table-sm td {
        padding: 8px 12px;
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

      .basis-badge {
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
      }
      .basis-hourly { background: #ede9fe; color: #6d28d9; }
      .basis-salaried { background: #e0e7ff; color: #3730a3; }

      .category-badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 700;
      }
      .category-earning { background: #dcfce7; color: #166534; }
      .category-deduction { background: #fee2e2; color: #991b1b; }
      .category-adjustment { background: #fef3c7; color: #92400e; }

      .badge-blocking {
        display: inline-block;
        padding: 3px 6px;
        background: #fee2e2;
        color: #b91c1c;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
      }
      .badge-clean { color: #16a34a; font-weight: 600; font-size: 12px; }
      .badge-manual { font-size: 11px; color: #d97706; font-weight: 600; }
      .badge-system { font-size: 11px; color: #64748b; }

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
      .btn-sm { padding: 5px 10px; font-size: 12px; }
      .btn-primary { background: #2563eb; color: #ffffff; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-outline { background: transparent; color: #2563eb; border: 1px solid #93c5fd; }
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
      .alert-close { background: transparent; border: none; font-size: 18px; cursor: pointer; color: inherit; }

      .loading, .empty-state { text-align: center; padding: 40px 20px; color: #64748b; }

      .modal-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.6);
        display: flex; justify-content: center; align-items: center;
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
      .modal-lg { max-width: 860px; }
      .modal-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-header h3 { margin: 0 0 2px 0; font-size: 17px; }
      .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; }
      .modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
      .modal-footer {
        padding: 14px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .mini-kpi-bar {
        display: flex;
        gap: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .mini-kpi { display: flex; flex-direction: column; }
      .mini-kpi span { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
      .mini-kpi strong { font-size: 15px; color: #0f172a; }

      .section-heading {
        font-size: 13px;
        font-weight: 700;
        color: #334155;
        margin: 16px 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .adjustment-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-top: 20px;
      }
      .adj-row { display: flex; gap: 12px; }
      .flex-1 { flex: 1; }
      .adj-form { display: flex; flex-direction: column; gap: 8px; }

      .form-group { margin-bottom: 8px; }
      .form-group label { display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px; }
      .hint { font-size: 11px; color: #64748b; margin-top: 4px; display: block; }
      .text-danger { color: #dc2626; }
      .text-muted { color: #64748b; font-size: 13px; }
    `,
  ],
})
export class PayrollPeriodDetailComponent implements OnInit {
  public periodId: string = '';
  public period = signal<PayrollPeriodDto | null>(null);
  public items = signal<PayrollItemDto[]>([]);
  public loadingPeriod = signal<boolean>(false);
  public loadingItems = signal<boolean>(false);
  public actionLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  // Filters
  public searchQuery: string = '';
  public basisFilter: string = '';
  public blockingFilter: string = '';

  // Breakdown Modal
  public selectedItemDetail = signal<PayrollItemDetailDto | null>(null);
  public adjSubmitting = signal<boolean>(false);
  public newAdjDto: AddPayrollAdjustmentDto = {
    adjustmentType: 'addition',
    amount: 0,
    description: '',
  };

  // Unlock Modal
  public showUnlockModal = signal<boolean>(false);
  public unlockReason: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private payrollService: PayrollService,
    public authService: AuthService,
  ) {}

  public ngOnInit(): void {
    this.periodId = this.route.snapshot.paramMap.get('id') || '';
    if (this.periodId) {
      this.loadPeriod();
      this.loadItems();
    }
  }

  public loadPeriod(): void {
    this.loadingPeriod.set(true);
    this.payrollService.getPeriod(this.periodId).subscribe({
      next: (res) => {
        this.period.set(res.data);
        this.loadingPeriod.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load payroll period.');
        this.loadingPeriod.set(false);
      },
    });
  }

  public loadItems(): void {
    this.loadingItems.set(true);
    this.payrollService.getPeriodItems(this.periodId).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.loadingItems.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load payroll items.');
        this.loadingItems.set(false);
      },
    });
  }

  public filteredItems(): PayrollItemDto[] {
    return this.items().filter((item) => {
      // Search
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const codeMatch = item.employeeCode?.toLowerCase().includes(q);
        const nameMatch = item.employeeName?.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch) return false;
      }
      // Basis
      if (this.basisFilter && item.remunerationBasis !== this.basisFilter) {
        return false;
      }
      // Blocking
      if (this.blockingFilter === 'blocked' && !item.hasBlockingIssue) {
        return false;
      }
      if (this.blockingFilter === 'clean' && item.hasBlockingIssue) {
        return false;
      }
      return true;
    });
  }

  public filterItems(): void {
    // triggers re-evaluation
  }

  public recalculate(): void {
    this.actionLoading.set(true);
    this.payrollService.calculatePeriod(this.periodId).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.period.set(res.data);
        this.successMessage.set(
          `Calculation refreshed. Total Net: AED ${res.data.totalNetPay.toFixed(2)}, Blocked: ${res.data.blockingIssuesCount}`,
        );
        this.loadItems();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Recalculation failed.');
      },
    });
  }

  public review(): void {
    this.actionLoading.set(true);
    this.payrollService.reviewPeriod(this.periodId).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.period.set(res.data);
        this.successMessage.set('Payroll run signed off in REVIEWED status.');
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Review sign-off failed.');
      },
    });
  }

  public finalize(): void {
    if (!confirm('Are you sure you want to finalize this payroll run? This will permanently lock all records and publish payslips to employees.')) {
      return;
    }
    this.actionLoading.set(true);
    this.payrollService.finalizePeriod(this.periodId).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.period.set(res.data);
        this.successMessage.set('Payroll run successfully FINALIZED and published.');
        this.loadItems();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Finalization failed.');
      },
    });
  }

  public openUnlockModal(): void {
    this.unlockReason = '';
    this.showUnlockModal.set(true);
  }

  public onUnlockSubmit(): void {
    if (this.unlockReason.trim().length < 15) return;
    this.actionLoading.set(true);
    this.payrollService.unlockPeriod(this.periodId, { reason: this.unlockReason.trim() }).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.showUnlockModal.set(false);
        this.period.set(res.data);
        this.successMessage.set('Payroll run unlocked back to DRAFT.');
        this.loadItems();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Unlock failed.');
      },
    });
  }

  public openBreakdown(item: PayrollItemDto): void {
    this.payrollService.getItemDetail(this.periodId, item.id).subscribe({
      next: (res) => {
        this.selectedItemDetail.set(res.data);
        this.newAdjDto = {
          adjustmentType: 'addition',
          amount: 0,
          description: '',
        };
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load item detail.');
      },
    });
  }

  public onAddAdjustmentSubmit(): void {
    const detail = this.selectedItemDetail();
    if (!detail || !this.newAdjDto.amount || this.newAdjDto.description.trim().length < 5) return;

    this.adjSubmitting.set(true);
    this.payrollService.addAdjustment(this.periodId, detail.item.id, this.newAdjDto).subscribe({
      next: () => {
        this.adjSubmitting.set(false);
        this.successMessage.set('Manual adjustment successfully recorded.');
        // Refresh breakdown and period items
        this.openBreakdown(detail.item);
        this.loadPeriod();
        this.loadItems();
      },
      error: (err) => {
        this.adjSubmitting.set(false);
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to add adjustment.');
      },
    });
  }

  public deleteAdjustment(lineId: string): void {
    const detail = this.selectedItemDetail();
    if (!detail) return;

    if (!confirm('Remove this manual adjustment?')) return;

    this.payrollService.deleteAdjustment(this.periodId, detail.item.id, lineId).subscribe({
      next: () => {
        this.successMessage.set('Adjustment removed.');
        this.openBreakdown(detail.item);
        this.loadPeriod();
        this.loadItems();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to remove adjustment.');
      },
    });
  }
}
