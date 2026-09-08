import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AttendanceApiService } from '../../core/services/attendance-api.service';
import { AttendancePeriodDto, AttendanceRecordDto } from '@blue-royal/contracts';

@Component({
  selector: 'app-my-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="my-attendance-container">
      <div class="header-bar">
        <div>
          <h2>My Monthly Attendance</h2>
          <span class="subtitle">Employee Self-Service Timesheet & Overtime Record</span>
        </div>
        <div class="period-select">
          <label>Period:</label>
          <select [ngModel]="selectedPeriodCode()" (ngModelChange)="onPeriodChange($event)" class="select-input">
            @for (p of periods(); track p.id) {
              <option [value]="p.periodCode">{{ p.periodCode }} ({{ p.name }})</option>
            }
          </select>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="alert alert-danger">{{ errorMessage() }}</div>
      }

      @if (isLoading()) {
        <div class="loading-state">Loading attendance records...</div>
      } @else {
        @if (summary(); as sum) {
          <!-- Summary KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-label">Total Days</span>
              <span class="kpi-value">{{ sum.totalDays }}</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Actual Hours Worked</span>
              <span class="kpi-value">{{ sum.totalActualHours }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Regular Hours</span>
              <span class="kpi-value">{{ sum.totalRegularHours }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Overtime Hours</span>
              <span class="kpi-value text-accent">{{ sum.totalOtHours }}h</span>
            </div>
            <div class="kpi-card">
              <span class="kpi-label">Absences</span>
              <span class="kpi-value text-muted">{{ sum.totalAbsences }}</span>
            </div>
          </div>

          <!-- Timesheet Details Table -->
          <div class="table-card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Day Type</th>
                  <th>Shift</th>
                  <th>Actual Hours</th>
                  <th>Regular Hours</th>
                  <th>OT Hours</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                @for (rec of records(); track rec.id) {
                  <tr [class.row-absent]="rec.isAbsent" [class.row-leave]="rec.isOnLeave">
                    <td class="font-mono">{{ rec.workDate }}</td>
                    <td>{{ getDayName(rec.workDate) }}</td>
                    <td>
                      <span class="tag-day-type tag-{{ rec.dayType }}">
                        {{ formatDayType(rec.dayType) }}
                      </span>
                    </td>
                    <td>{{ getShiftName(rec) }}</td>
                    <td class="font-bold">{{ rec.actualHours }}h</td>
                    <td>{{ rec.regularHours }}h</td>
                    <td class="text-accent font-bold">
                      @if (rec.otHours > 0) {
                        +{{ rec.otHours }}h
                      } @else {
                        -
                      }
                    </td>
                    <td>
                      @if (rec.isOnLeave) {
                        <span class="badge badge-leave">Leave</span>
                      } @else if (rec.isAbsent) {
                        <span class="badge badge-absent">Absent</span>
                      } @else if (rec.actualHours > 0) {
                        <span class="badge badge-present">Present</span>
                      } @else {
                        <span class="badge badge-off">Off</span>
                      }
                    </td>
                    <td class="text-muted">{{ rec.remarks || '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-state">No attendance records found for this period.</div>
        }
      }
    </div>
  `,
  styles: [
    `
      .my-attendance-container {
        padding: 1.5rem;
        background: #f8fafc;
        min-height: 100vh;
      }
      .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .header-bar h2 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
      .subtitle {
        font-size: 0.875rem;
        color: #64748b;
      }
      .period-select {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .select-input {
        padding: 0.5rem 1rem;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #fff;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }
      .kpi-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        flex-direction: column;
      }
      .kpi-label {
        font-size: 0.75rem;
        color: #64748b;
        text-transform: uppercase;
        font-weight: 600;
      }
      .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        margin-top: 0.25rem;
      }
      .text-accent { color: #2563eb; }
      .text-muted { color: #64748b; }
      .font-mono { font-family: monospace; }
      .font-bold { font-weight: 700; }
      .table-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: auto;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        white-space: nowrap;
      }
      .data-table th, .data-table td {
        border-bottom: 1px solid #e2e8f0;
        padding: 0.75rem 1rem;
        text-align: left;
      }
      .data-table th {
        background: #f8fafc;
        color: #475569;
        font-weight: 600;
      }
      .badge {
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-present { background: #dcfce7; color: #15803d; }
      .badge-absent { background: #fee2e2; color: #b91c1c; }
      .badge-leave { background: #fef9c3; color: #854d0e; }
      .badge-off { background: #f1f5f9; color: #475569; }
      .tag-day-type { font-size: 0.75rem; padding: 0.15rem 0.4rem; border-radius: 4px; }
      .tag-regular_workday { background: #f1f5f9; color: #334155; }
      .tag-weekly_off { background: #eff6ff; color: #1d4ed8; }
      .tag-public_holiday { background: #fef3c7; color: #b45309; }
      .row-absent { background: #fff5f5; }
      .row-leave { background: #fefce8; }
      .loading-state, .empty-state { text-align: center; padding: 3rem; color: #64748b; }
      .alert { padding: 0.75rem 1rem; border-radius: 6px; margin-bottom: 1rem; }
      .alert-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    `,
  ],
})
export class MyAttendanceComponent implements OnInit {
  public periods = signal<AttendancePeriodDto[]>([]);
  public selectedPeriodCode = signal<string>('');
  public records = signal<AttendanceRecordDto[]>([]);
  public summary = signal<any>(null);
  public isLoading = signal<boolean>(false);
  public errorMessage = signal<string | null>(null);

  constructor(private attendanceApi: AttendanceApiService) {}

  public ngOnInit(): void {
    this.loadPeriods();
  }

  public loadPeriods(): void {
    this.attendanceApi.listPeriods().subscribe({
      next: (res) => {
        this.periods.set(res.data);
        if (res.data.length > 0 && !this.selectedPeriodCode()) {
          this.selectedPeriodCode.set(res.data[0].periodCode);
          this.loadSelfAttendance();
        }
      },
      error: (err) => this.errorMessage.set(err.error?.error?.message || 'Failed to load periods'),
    });
  }

  public onPeriodChange(code: string): void {
    this.selectedPeriodCode.set(code);
    this.loadSelfAttendance();
  }

  public loadSelfAttendance(): void {
    this.isLoading.set(true);
    this.attendanceApi.getMyAttendance(this.selectedPeriodCode() || undefined).subscribe({
      next: (res) => {
        this.records.set(res.data.records);
        this.summary.set(res.data.summary);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error?.message || 'Failed to load self attendance');
        this.isLoading.set(false);
      },
    });
  }

  public getDayName(dateStr: string): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = new Date(`${dateStr}T00:00:00Z`);
    return days[d.getUTCDay()];
  }

  public formatDayType(type: string): string {
    if (type === 'regular_workday') return 'Workday';
    if (type === 'weekly_off') return 'Weekly Off';
    if (type === 'public_holiday') return 'Public Holiday';
    return type;
  }

  public getShiftName(rec: any): string {
    return rec?.shift?.name || 'Standard';
  }
}
