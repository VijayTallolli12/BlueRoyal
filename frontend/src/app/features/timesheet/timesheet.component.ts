import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../core/layout/app-shell.component';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { MasterService } from '../../core/services/master.service';
import { AttendancePeriodDto, AttendanceGridResponseDto, EmployeeDto } from '@blue-royal/contracts';

export interface TimesheetEmployeeRow {
  id: string;
  name: string;
  code: string;
  designation?: string;
  totalHours: number;
  ot: number;
  dailyHours: Record<number, number>;
}

@Component({
  selector: 'app-timesheet',
  standalone: true,
  imports: [CommonModule, FormsModule, AppShellComponent],
  template: `
    <app-shell>
      <div class="timesheet-page">
        <header class="page-header">
          <div>
            <h1 class="page-title">Timesheet</h1>
            <p class="subtitle">Monthly employee timesheet hours, overtime tracking, and export</p>
          </div>
          <div class="header-actions">
            <label class="month-picker">
              <span>Month</span>
              <input
                type="month"
                [ngModel]="selectedMonth()"
                (ngModelChange)="onMonthChange($event)"
              />
            </label>
            <button (click)="loadTimesheetData()" class="btn btn-secondary btn-sm" title="Refresh">
              <span class="material-symbols-outlined icon-sm">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <!-- Messages -->
        @if (errorMessage()) {
          <div class="alert alert-danger">{{ errorMessage() }}</div>
        }
        @if (successMessage()) {
          <div class="alert alert-success">{{ successMessage() }}</div>
        }

        <!-- Top KPIs -->
        <section class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Employees</span>
            <span class="kpi-value">{{ employeeRows().length }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total Hours</span>
            <span class="kpi-value">{{ totalHours() | number: '1.1-1' }}h</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">OT</span>
            <span class="kpi-value accent">{{ totalOt() | number: '1.1-1' }}h</span>
          </div>
        </section>

        <!-- Timesheet Panel -->
        <section class="panel">
          <div class="panel-header">
            <h3>Timesheet</h3>
            <div class="panel-meta">
              @if (currentPeriod()) {
                <span class="badge status-{{ currentPeriod()!.status }}">
                  Period: {{ currentPeriod()!.name }} ({{ currentPeriod()!.status | uppercase }})
                </span>
              } @else {
                <span class="badge badge-neutral">No official period locked for this month</span>
              }
            </div>
          </div>

          @if (isLoading()) {
            <div class="loading-state">Loading monthly timesheet grid...</div>
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-sticky-left">Employee</th>
                    <th>Total Hours</th>
                    <th>OT</th>
                    @for (day of daysInMonth(); track day) {
                      <th class="col-day">{{ day }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (employee of employeeRows(); track employee.id) {
                    <tr [class.selected-row]="selectedEmployeeId() === employee.id" (click)="selectedEmployeeId.set(employee.id)">
                      <td class="col-sticky-left">
                        <div class="employee-name">{{ employee.name }}</div>
                        <div class="employee-code">{{ employee.code }}</div>
                      </td>
                      <td class="font-bold">{{ employee.totalHours }}h</td>
                      <td class="accent font-bold">{{ employee.ot }}h</td>
                      @for (day of daysInMonth(); track day) {
                        <td class="col-day-val" [class.has-hours]="getCellValue(employee, day) > 0">
                          {{ getCellValue(employee, day) > 0 ? getCellValue(employee, day) + 'h' : '-' }}
                        </td>
                      }
                    </tr>
                  } @empty {
                    <tr>
                      <td [attr.colspan]="daysInMonth().length + 3" class="empty-cell">
                        No employees found for this timesheet period.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <!-- Download Actions -->
        <section class="download-actions">
          <button
            class="btn btn-secondary"
            type="button"
            (click)="downloadEmployeeTimesheet()"
            [disabled]="employeeRows().length === 0"
          >
            <span class="material-symbols-outlined icon-sm">download</span>
            <span>Download Employee Timesheet</span>
          </button>
          <button
            class="btn btn-primary"
            type="button"
            (click)="downloadAllEmployeesTimesheet()"
            [disabled]="employeeRows().length === 0"
          >
            <span class="material-symbols-outlined icon-sm">download_for_offline</span>
            <span>Download All Employees Timesheet</span>
          </button>
        </section>
      </div>
    </app-shell>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .timesheet-page {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-title {
        margin: 0;
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--text-primary, #1e293b);
      }
      .subtitle {
        margin: 0.25rem 0 0;
        color: var(--text-secondary, #64748b);
        font-size: 0.8125rem;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .month-picker {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        background: #fff;
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .month-picker input {
        border: none;
        background: transparent;
        font: inherit;
        outline: none;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }
      .kpi-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .kpi-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
        color: #64748b;
      }
      .kpi-value {
        font-size: 1.625rem;
        font-weight: 700;
        color: #1e293b;
      }
      .accent { color: #d97706; }
      .font-bold { font-weight: 600; }
      .panel {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid #edf2f7;
        background: #f8fafc;
      }
      .panel-header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: #1e293b;
      }
      .table-wrap {
        overflow-x: auto;
        max-height: 60vh;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
        font-size: 0.8125rem;
      }
      .data-table th,
      .data-table td {
        padding: 0.65rem 0.75rem;
        border-bottom: 1px solid #edf2f7;
        text-align: left;
        white-space: nowrap;
      }
      .data-table th {
        background: #f8fafc;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #475569;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .col-sticky-left {
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 5;
        border-right: 1px solid #edf2f7;
        min-width: 180px;
      }
      th.col-sticky-left {
        z-index: 15;
        background: #f8fafc;
      }
      .employee-name {
        font-weight: 600;
        color: #0f172a;
      }
      .employee-code {
        font-size: 0.72rem;
        color: #64748b;
        font-family: monospace;
      }
      .col-day {
        text-align: center;
        min-width: 38px;
      }
      .col-day-val {
        text-align: center;
        color: #94a3b8;
      }
      .col-day-val.has-hours {
        color: #0f172a;
        font-weight: 500;
      }
      .selected-row {
        background-color: #f0fdf4;
      }
      .selected-row .col-sticky-left {
        background-color: #f0fdf4;
      }
      .download-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        border: 1px solid #cbd5e1;
        background: #fff;
        border-radius: 0.5rem;
        padding: 0.6rem 1.1rem;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .btn:hover:not(:disabled) {
        background: #f1f5f9;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn-primary {
        background: #2563eb;
        color: #fff;
        border-color: #2563eb;
      }
      .btn-primary:hover:not(:disabled) {
        background: #1d4ed8;
      }
      .btn-sm {
        padding: 0.35rem 0.65rem;
        font-size: 0.75rem;
      }
      .loading-state,
      .empty-cell {
        text-align: center;
        padding: 2.5rem 1rem;
        color: #64748b;
        font-style: italic;
      }
      .badge {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
      }
      .status-draft { background: #e0f2fe; color: #0369a1; }
      .status-submitted { background: #fef3c7; color: #b45309; }
      .status-approved { background: #dcfce7; color: #15803d; }
      .status-locked { background: #f1f5f9; color: #475569; }
      .badge-neutral { background: #f1f5f9; color: #64748b; }
      .alert {
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.8125rem;
      }
      .alert-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
      .alert-success { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    `,
  ],
})
export class TimesheetComponent implements OnInit {
  public selectedMonth = signal<string>(this.defaultMonth());
  public periods = signal<AttendancePeriodDto[]>([]);
  public currentPeriod = signal<AttendancePeriodDto | null>(null);
  public employeeRows = signal<TimesheetEmployeeRow[]>([]);
  public selectedEmployeeId = signal<string>('');

  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);
  public successMessage = signal<string | null>(null);

  public totalHours = computed(() =>
    this.employeeRows().reduce((sum, e) => sum + Number(e.totalHours || 0), 0),
  );

  public totalOt = computed(() =>
    this.employeeRows().reduce((sum, e) => sum + Number(e.ot || 0), 0),
  );

  public daysInMonth = computed(() => {
    const value = this.selectedMonth();
    if (!value) return Array.from({ length: 30 }, (_, index) => index + 1);
    const [year, month] = value.split('-').map(Number);
    const date = new Date(year, month, 0);
    return Array.from({ length: date.getDate() }, (_, index) => index + 1);
  });

  constructor(
    private attendanceApi: AttendanceApiService,
    private masterService: MasterService,
  ) {}

  public ngOnInit(): void {
    this.loadTimesheetData();
  }

  public onMonthChange(month: string): void {
    this.selectedMonth.set(month);
    this.loadTimesheetData();
  }

  public loadTimesheetData(): void {
    const month = this.selectedMonth();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.attendanceApi.listPeriods().subscribe({
      next: (res) => {
        this.periods.set(res.data);
        const matchingPeriod = res.data.find(
          (p) => p.periodCode === month || (p.startDate && p.startDate.startsWith(month)),
        );
        this.currentPeriod.set(matchingPeriod || null);

        if (matchingPeriod) {
          this.attendanceApi.getGrid(matchingPeriod.id).subscribe({
            next: (gridRes) => {
              this.populateFromGrid(gridRes.data);
              this.isLoading.set(false);
            },
            error: () => {
              this.loadFallbackEmployees();
            },
          });
        } else {
          this.loadFallbackEmployees();
        }
      },
      error: () => {
        this.loadFallbackEmployees();
      },
    });
  }

  private populateFromGrid(grid: AttendanceGridResponseDto): void {
    const mapped: TimesheetEmployeeRow[] = (grid.rows || []).map((row) => {
      const dailyHours: Record<number, number> = {};

      if (row.days) {
        Object.entries(row.days).forEach(([dayStr, cell]) => {
          const dayNum = Number(dayStr);
          if (!isNaN(dayNum)) {
            dailyHours[dayNum] = Number(cell.actualHours || 0);
          }
        });
      } else if (row.records) {
        Object.entries(row.records).forEach(([dateStr, rec]: [string, any]) => {
          const dayNum = parseInt(dateStr.split('-')[2], 10);
          if (!isNaN(dayNum)) {
            dailyHours[dayNum] = Number(rec?.actualHours || 0);
          }
        });
      }

      return {
        id: row.employeeId,
        name: row.employeeName,
        code: row.employeeCode,
        designation: row.designationTitle || '',
        totalHours: Number(row.summary?.totalActualHours ?? row.totalActualHours ?? 0),
        ot: Number(row.summary?.totalOtHours ?? row.totalOtHours ?? 0),
        dailyHours,
      };
    });

    this.employeeRows.set(mapped);
    if (mapped.length > 0 && !this.selectedEmployeeId()) {
      this.selectedEmployeeId.set(mapped[0].id);
    }
  }

  private loadFallbackEmployees(): void {
    this.masterService.getEmployees().subscribe({
      next: (empRes) => {
        const rows: TimesheetEmployeeRow[] = (empRes.data || []).map((emp: EmployeeDto) => ({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
          code: emp.employeeCode,
          designation: '',
          totalHours: 0,
          ot: 0,
          dailyHours: {},
        }));
        this.employeeRows.set(rows);
        if (rows.length > 0 && !this.selectedEmployeeId()) {
          this.selectedEmployeeId.set(rows[0].id);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.employeeRows.set([]);
        this.isLoading.set(false);
      },
    });
  }

  public getCellValue(employee: TimesheetEmployeeRow, day: number): number {
    return employee.dailyHours?.[day] ?? 0;
  }

  public downloadEmployeeTimesheet(): void {
    const selectedId = this.selectedEmployeeId() || (this.employeeRows()[0]?.id);
    const emp = this.employeeRows().find((e) => e.id === selectedId);
    if (!emp) {
      this.errorMessage.set('Please select an employee to download their timesheet.');
      return;
    }

    const month = this.selectedMonth();
    const days = this.daysInMonth();
    const headers = ['Day', 'Date', 'Employee Code', 'Employee Name', 'Hours', 'OT Hours'];
    const rows = days.map((day) => {
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      const hours = this.getCellValue(emp, day);
      const ot = hours > 8 ? hours - 8 : 0;
      return [day, dateStr, `"${emp.code}"`, `"${emp.name}"`, hours, ot];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    this.triggerDownload(csvContent, `timesheet_${emp.code}_${month}.csv`, 'text/csv');
    this.successMessage.set(`Downloaded timesheet for ${emp.name} (${month})`);
  }

  public downloadAllEmployeesTimesheet(): void {
    const period = this.currentPeriod();
    if (period) {
      this.attendanceApi.downloadTemplate(period.id).subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `timesheet_all_employees_${period.periodCode}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.successMessage.set(`Downloaded timesheet for all employees (${period.periodCode})`);
        },
        error: () => {
          this.exportAllAsCsv();
        },
      });
    } else {
      this.exportAllAsCsv();
    }
  }

  private exportAllAsCsv(): void {
    const month = this.selectedMonth();
    const days = this.daysInMonth();
    const headers = ['Employee Code', 'Employee Name', 'Total Hours', 'OT Hours', ...days.map((d) => `Day ${d}`)];
    const rows = this.employeeRows().map((emp) => {
      const dayValues = days.map((d) => this.getCellValue(emp, d));
      return [`"${emp.code}"`, `"${emp.name}"`, emp.totalHours, emp.ot, ...dayValues];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    this.triggerDownload(csvContent, `timesheet_all_employees_${month}.csv`, 'text/csv');
    this.successMessage.set(`Downloaded timesheet CSV for all employees (${month})`);
  }

  private triggerDownload(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private defaultMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
