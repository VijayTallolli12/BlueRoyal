import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PayrollService } from '../../core/services/payroll.service';
import { PayrollItemDto, EmployeePayslipDto } from '@blue-royal/contracts';

@Component({
  selector: 'app-my-payroll',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="my-payroll-container">
      <!-- Header -->
      <div class="header">
        <div>
          <h2>My Payslips & Remuneration</h2>
          <p class="subtitle">
            Transparent employee remuneration records, detailed hours breakdown, and published monthly payslips.
          </p>
        </div>
        <button class="btn btn-secondary" (click)="loadPayrollHistory()">
          Refresh
        </button>
      </div>

      <!-- Alerts -->
      @if (errorMessage()) {
        <div class="alert alert-danger">
          {{ errorMessage() }}
          <button class="alert-close" (click)="errorMessage.set(null)">×</button>
        </div>
      }

      <!-- Payslips Grid -->
      @if (loading()) {
        <div class="loading">Loading your published payslips...</div>
      } @else if (history().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">💵</div>
          <h3>No Finalized Payslips Available</h3>
          <p>You currently do not have any published payslips. Once HR finalizes a payroll run, your itemized payslip will appear here.</p>
        </div>
      } @else {
        <div class="payslips-grid">
          @for (item of history(); track item.id) {
            <div class="payslip-card">
              <div class="card-top">
                <div>
                  <span class="period-code">{{ item.payrollPeriodId }}</span>
                  <div class="basis-tag">{{ item.remunerationBasis | uppercase }}</div>
                </div>
                <span class="status-badge status-finalized">FINALIZED</span>
              </div>

              <div class="card-body">
                <div class="stat-row">
                  <span class="label">Gross Earnings</span>
                  <span class="val">AED {{ item.grossPay | number:'1.2-2' }}</span>
                </div>
                <div class="stat-row">
                  <span class="label">Total Deductions</span>
                  <span class="val text-danger">AED {{ item.totalDeductions | number:'1.2-2' }}</span>
                </div>
                <div class="stat-divider"></div>
                <div class="stat-row highlight">
                  <span class="label">Net Payable</span>
                  <span class="net-val">AED {{ item.netPay | number:'1.2-2' }}</span>
                </div>
              </div>

              <div class="card-footer">
                <button class="btn btn-primary btn-block" (click)="viewPayslip(item.payrollPeriodId)">
                  View Full Payslip
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- Detailed Payslip Modal -->
      @if (selectedPayslip()) {
        <div class="modal-backdrop">
          <div class="modal-card modal-payslip">
            <div class="modal-header no-print">
              <h3>Employee Remuneration Slip</h3>
              <div class="modal-header-actions">
                <button class="btn btn-secondary btn-sm" (click)="printPayslip()">🖨️ Print</button>
                <button class="modal-close" (click)="selectedPayslip.set(null)">×</button>
              </div>
            </div>

            <div class="modal-body payslip-document" id="printable-payslip">
              <!-- Official Document Header -->
              <div class="document-header">
                <div>
                  <h1 class="company-name">BLUE ROYAL</h1>
                  <p class="company-sub">Human Resources Management & Remuneration</p>
                </div>
                <div class="doc-meta">
                  <div class="doc-title">PAYSLIP</div>
                  <div class="doc-period">Period: {{ selectedPayslip()?.period?.periodCode }}</div>
                  <div class="doc-dates">{{ selectedPayslip()?.period?.startDate }} to {{ selectedPayslip()?.period?.endDate }}</div>
                </div>
              </div>

              <!-- Employee Details Bar -->
              <div class="emp-details-grid">
                <div>
                  <span class="dt-label">Employee Code</span>
                  <span class="dt-val">{{ selectedPayslip()?.employee?.employeeCode }}</span>
                </div>
                <div>
                  <span class="dt-label">Employee Name</span>
                  <span class="dt-val">{{ selectedPayslip()?.employee?.name }}</span>
                </div>
                <div>
                  <span class="dt-label">Designation</span>
                  <span class="dt-val">{{ selectedPayslip()?.employee?.designation || 'General Staff' }}</span>
                </div>
                <div>
                  <span class="dt-label">Remuneration Basis</span>
                  <span class="dt-val">{{ selectedPayslip()?.employee?.remunerationBasis | uppercase }}</span>
                </div>
              </div>

              <!-- Attendance Metrics -->
              <div class="attendance-bar">
                <div class="att-kpi">
                  <span>Days Worked</span>
                  <strong>{{ selectedPayslip()?.attendanceSummary?.daysWorked }}</strong>
                </div>
                <div class="att-kpi">
                  <span>Regular Hours</span>
                  <strong>{{ selectedPayslip()?.attendanceSummary?.regularHours }}h</strong>
                </div>
                <div class="att-kpi">
                  <span>Overtime Hours</span>
                  <strong>{{ selectedPayslip()?.attendanceSummary?.otHours }}h</strong>
                </div>
                <div class="att-kpi">
                  <span>Absences</span>
                  <strong>{{ selectedPayslip()?.attendanceSummary?.absenceDays }}</strong>
                </div>
                <div class="att-kpi">
                  <span>Approved Leaves</span>
                  <strong>{{ selectedPayslip()?.attendanceSummary?.leaveDays }}</strong>
                </div>
              </div>

              <!-- Earnings & Deductions Tables -->
              <div class="breakdown-columns">
                <!-- Earnings Column -->
                <div class="column">
                  <div class="table-heading earnings-heading">Earnings (AED)</div>
                  <table class="payslip-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th class="text-right">Hours/Qty</th>
                        <th class="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of selectedPayslip()?.earnings; track line.id) {
                        <tr>
                          <td>{{ line.description }}</td>
                          <td class="text-right">{{ line.quantity || '-' }}</td>
                          <td class="text-right">{{ line.amount | number:'1.2-2' }}</td>
                        </tr>
                      }
                      @if ((selectedPayslip()?.earnings?.length || 0) === 0) {
                        <tr><td colspan="3" class="text-center text-muted">No earning lines</td></tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- Deductions & Adjustments Column -->
                <div class="column">
                  <div class="table-heading deductions-heading">Deductions & Adjustments (AED)</div>
                  <table class="payslip-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th class="text-right">Type</th>
                        <th class="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of selectedPayslip()?.deductions; track line.id) {
                        <tr>
                          <td>{{ line.description }}</td>
                          <td class="text-right"><span class="badge-tag">Deduction</span></td>
                          <td class="text-right text-danger">-{{ line.amount | number:'1.2-2' }}</td>
                        </tr>
                      }
                      @for (line of selectedPayslip()?.adjustments; track line.id) {
                        <tr>
                          <td>{{ line.description }}</td>
                          <td class="text-right">
                            <span class="badge-tag" [class.badge-add]="line.adjustmentType === 'addition'">
                              {{ line.adjustmentType }}
                            </span>
                          </td>
                          <td class="text-right" [class.text-danger]="line.adjustmentType === 'deduction'">
                            {{ line.adjustmentType === 'deduction' ? '-' : '+' }}{{ line.amount | number:'1.2-2' }}
                          </td>
                        </tr>
                      }
                      @if ((selectedPayslip()?.deductions?.length || 0) === 0 && (selectedPayslip()?.adjustments?.length || 0) === 0) {
                        <tr><td colspan="3" class="text-center text-muted">No deductions or adjustments</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Financial Net Payable Box -->
              <div class="net-summary-box">
                <div class="summary-left">
                  <div><strong>Total Gross Earnings:</strong> AED {{ selectedPayslip()?.grossPay | number:'1.2-2' }}</div>
                  <div><strong>Total Deductions:</strong> AED {{ selectedPayslip()?.totalDeductions | number:'1.2-2' }}</div>
                </div>
                <div class="summary-right">
                  <span class="net-label">NET PAYABLE AMOUNT</span>
                  <span class="net-amount">AED {{ selectedPayslip()?.netPay | number:'1.2-2' }}</span>
                </div>
              </div>

              <div class="payslip-footer">
                <p>This is a computer-generated payslip from Blue Royal HRMS. Confirmed under authoritative financial traceability.</p>
              </div>
            </div>

            <div class="modal-footer no-print">
              <button class="btn btn-secondary" (click)="selectedPayslip.set(null)">Close</button>
              <button class="btn btn-primary" (click)="printPayslip()">🖨️ Print Payslip</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .my-payroll-container {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 24px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      }
      .header h2 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
      .subtitle { margin: 0; color: #64748b; font-size: 13px; }

      .payslips-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 20px;
      }
      .payslip-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .payslip-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
      }
      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
      }
      .period-code {
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        display: block;
      }
      .basis-tag {
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        margin-top: 2px;
      }
      .status-badge {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
      }
      .status-finalized { background: #dcfce7; color: #15803d; }

      .card-body { margin-bottom: 16px; }
      .stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin-bottom: 8px;
      }
      .stat-row .label { color: #64748b; }
      .stat-row .val { font-weight: 600; color: #1e293b; }
      .stat-divider {
        height: 1px;
        background: #e2e8f0;
        margin: 10px 0;
      }
      .stat-row.highlight {
        align-items: center;
        margin-bottom: 0;
      }
      .stat-row.highlight .label { font-weight: 600; color: #0f172a; }
      .net-val {
        font-size: 18px;
        font-weight: 700;
        color: #16a34a;
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
      }
      .btn-block { width: 100%; display: block; text-align: center; }
      .btn-primary { background: #2563eb; color: #ffffff; }
      .btn-primary:hover { background: #1d4ed8; }
      .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
      .btn-sm { padding: 4px 10px; font-size: 12px; }

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
      .alert-close { background: none; border: none; font-size: 18px; cursor: pointer; color: inherit; }

      .loading, .empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
      .empty-icon { font-size: 48px; margin-bottom: 12px; }
      .empty-state h3 { margin: 0 0 6px 0; font-size: 18px; color: #0f172a; }
      .empty-state p { margin: 0; font-size: 14px; max-width: 480px; margin: 0 auto; }

      /* Modal & Payslip Document */
      .modal-backdrop {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.6);
        display: flex; justify-content: center; align-items: center;
        z-index: 999;
      }
      .modal-payslip {
        max-width: 840px;
        width: 100%;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .modal-header {
        padding: 16px 24px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .modal-header-actions { display: flex; gap: 8px; align-items: center; }
      .modal-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #94a3b8; }
      .modal-body { padding: 24px; max-height: 75vh; overflow-y: auto; }
      .modal-footer {
        padding: 14px 24px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .payslip-document {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        color: #1e293b;
      }
      .document-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 16px;
        margin-bottom: 16px;
      }
      .company-name {
        margin: 0;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #0f172a;
      }
      .company-sub { margin: 2px 0 0 0; font-size: 12px; color: #64748b; }
      .doc-meta { text-align: right; }
      .doc-title { font-size: 18px; font-weight: 800; color: #2563eb; }
      .doc-period { font-size: 13px; font-weight: 600; color: #334155; }
      .doc-dates { font-size: 12px; color: #64748b; }

      .emp-details-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .dt-label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
      .dt-val { font-size: 14px; font-weight: 700; color: #0f172a; }

      .attendance-bar {
        display: flex;
        gap: 16px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 10px 16px;
        margin-bottom: 16px;
        background: #fbfcfe;
      }
      .att-kpi { flex: 1; }
      .att-kpi span { font-size: 11px; text-transform: uppercase; color: #64748b; display: block; }
      .att-kpi strong { font-size: 15px; color: #0f172a; }

      .breakdown-columns {
        display: flex;
        gap: 20px;
        margin-bottom: 16px;
      }
      .column { flex: 1; }
      .table-heading {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 6px 0;
        border-bottom: 2px solid #e2e8f0;
        margin-bottom: 6px;
      }
      .earnings-heading { color: #16a34a; border-color: #bbf7d0; }
      .deductions-heading { color: #dc2626; border-color: #fecaca; }

      .payslip-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .payslip-table th {
        text-align: left;
        color: #64748b;
        padding: 6px 4px;
        border-bottom: 1px solid #e2e8f0;
      }
      .payslip-table td {
        padding: 8px 4px;
        border-bottom: 1px solid #f1f5f9;
      }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .text-danger { color: #dc2626; }
      .text-muted { color: #94a3b8; }
      .badge-tag {
        font-size: 10px;
        padding: 2px 5px;
        background: #fee2e2;
        color: #991b1b;
        border-radius: 4px;
      }
      .badge-add { background: #dcfce7; color: #166534; }

      .net-summary-box {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        border: 2px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px 20px;
        margin-top: 16px;
      }
      .summary-left div { font-size: 13px; color: #475569; margin-bottom: 2px; }
      .summary-right { text-align: right; }
      .net-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; display: block; }
      .net-amount { font-size: 22px; font-weight: 800; color: #16a34a; }

      .payslip-footer {
        text-align: center;
        margin-top: 24px;
        font-size: 11px;
        color: #94a3b8;
      }

      @media print {
        .no-print { display: none !important; }
        .modal-backdrop { position: static; background: none; }
        .modal-card { box-shadow: none; max-width: 100%; border: none; }
        .modal-body { padding: 0; max-height: none; overflow: visible; }
      }
    `,
  ],
})
export class MyPayrollComponent implements OnInit {
  public history = signal<PayrollItemDto[]>([]);
  public loading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);

  public selectedPayslip = signal<EmployeePayslipDto | null>(null);

  constructor(private payrollService: PayrollService) {}

  public ngOnInit(): void {
    this.loadPayrollHistory();
  }

  public loadPayrollHistory(): void {
    this.loading.set(true);
    this.payrollService.getMyPayroll().subscribe({
      next: (res) => {
        this.history.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load payroll history.');
        this.loading.set(false);
      },
    });
  }

  public viewPayslip(periodId: string): void {
    this.payrollService.getMyPayslip(periodId).subscribe({
      next: (res) => {
        this.selectedPayslip.set(res.data);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || err.message || 'Failed to load detailed payslip.');
      },
    });
  }

  public printPayslip(): void {
    window.print();
  }
}
